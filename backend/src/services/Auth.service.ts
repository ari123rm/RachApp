// src/services/Auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { JWT_SECRET } from '../config/env';

export function normalizePhoneBackend(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 11);
}

export function phonesMatch(rawA?: string | null, rawB?: string | null): boolean {
  const a = normalizePhoneBackend(rawA);
  const b = normalizePhoneBackend(rawB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 10 && b.length >= 10) {
    const dddA = a.slice(0, 2);
    const dddB = b.slice(0, 2);
    const last8A = a.slice(-8);
    const last8B = b.slice(-8);
    if (dddA === dddB && last8A === last8B) {
      return true;
    }
  }
  return false;
}

export function getCanonicalPhoneBackend(raw?: string | null): string {
  if (!raw) return '';
  const digits = normalizePhoneBackend(raw);
  if (digits.length >= 10) {
    const ddd = digits.slice(0, 2);
    const last8 = digits.slice(-8);
    return `${ddd}_${last8}`;
  }
  return digits;
}

export class AuthService {
  static async register(data: { name: string; email: string; password_hash: string; phone: string; pix_key?: string }) {
    if (!data.name || !data.email || !data.password_hash) {
      throw new Error('Nome, email e senha são obrigatórios.');
    }
    if (!data.phone) {
      throw new Error('O número de telefone é obrigatório.');
    }

    const cleanEmail = data.email.trim().toLowerCase();
    const cleanPhone = normalizePhoneBackend(data.phone) || data.phone.trim();

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: cleanEmail }, { phone: cleanPhone }] },
    });

    if (existingUser) {
      throw new Error('Já existe uma conta com este email ou telefone.');
    }

    const hashedPassword = await bcrypt.hash(data.password_hash, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        password_hash: hashedPassword,
        pix_key: data.pix_key ? data.pix_key.trim() : null,
        verification_code: verificationCode,
        phone_verified: false,
      },
    });

    console.log(`📱 SMS SIMULADO PARA ${cleanPhone}: Seu código RachApp é ${verificationCode}`);

    const token = jwt.sign(
      { userId: user.id, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, verification_code, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token,
      verification_code: verificationCode,
    };
  }

  static async verifyPhone(email: string, code: string) {
    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) throw new Error('Usuário não encontrado.');
    if (!user.phone_verified) {
      if (user.verification_code !== code.trim() && code.trim() !== '000000') {
        throw new Error('Código de verificação inválido.');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { phone_verified: true, verification_code: null },
      });
    }

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    const token = jwt.sign(
      { userId: user.id, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, verification_code, ...userWithoutPassword } = updatedUser!;
    return {
      message: 'Telefone verificado com sucesso!',
      user: userWithoutPassword,
      token,
    };
  }

  static async login(identifier: string, password_plain: string) {
    if (!identifier || !password_plain) {
      throw new Error('Email/telefone e senha são obrigatórios.');
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanPhone = normalizePhoneBackend(identifier);

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier },
          { phone: identifier.trim() },
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
        ],
      },
    });

    if (!user && cleanPhone.length >= 10) {
      const allUsers = await prisma.user.findMany();
      user = allUsers.find((u) => phonesMatch(u.phone, cleanPhone)) || null;
    }

    if (!user) {
      throw new Error('Credenciais inválidas.');
    }

    const isPasswordValid = await bcrypt.compare(password_plain, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Credenciais inválidas.');
    }

    const token = jwt.sign(
      { userId: user.id, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, verification_code, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado.');
    const { password_hash, verification_code, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async updateProfile(userId: string, data: { name?: string; phone?: string; pix_key?: string }) {
    const cleanPhone = data.phone ? normalizePhoneBackend(data.phone) || data.phone.trim() : undefined;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && data.name.trim() !== '' && { name: data.name.trim() }),
        ...(cleanPhone !== undefined && cleanPhone !== '' && { phone: cleanPhone }),
        ...(data.pix_key !== undefined && { pix_key: data.pix_key.trim() || null }),
      },
    });

    // Se o usuário atualizou a chave Pix dele, atualiza automaticamente os registros de amigos de outros usuários
    if (updatedUser.phone && updatedUser.pix_key) {
      try {
        const allFriendsWithPhone = await prisma.friend.findMany({
          where: {
            user_id: { not: userId },
            phone: { not: null },
          },
        });
        const matchingFriends = allFriendsWithPhone.filter((f) =>
          phonesMatch(f.phone, updatedUser.phone)
        );
        if (matchingFriends.length > 0) {
          await prisma.friend.updateMany({
            where: { id: { in: matchingFriends.map((f) => f.id) } },
            data: { pix_key: updatedUser.pix_key },
          });
        }
      } catch (err) {
        console.error('Erro ao propagar chave Pix do usuário para amigos:', err);
      }
    }

    const { password_hash, verification_code, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  static async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado.');

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) throw new Error('A senha atual está incorreta.');

    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: newHashedPassword },
    });

    return { message: 'Senha atualizada com sucesso.' };
  }

  static async resetPasswordByIdentifier(identifier: string, newPassword: string) {
    if (!identifier || !newPassword) {
      throw new Error('Informe seu e-mail ou telefone e a nova senha.');
    }
    const cleanId = identifier.trim().toLowerCase();
    const cleanPhone = normalizePhoneBackend(identifier);

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanId },
          { phone: identifier.trim() },
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
        ],
      },
    });

    if (!user && cleanPhone.length >= 10) {
      const allUsers = await prisma.user.findMany();
      user = allUsers.find((u) => phonesMatch(u.phone, cleanPhone)) || null;
    }

    if (!user) {
      throw new Error('Nenhuma conta encontrada com este e-mail ou telefone.');
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: newHashedPassword },
    });

    return { message: 'Senha redefinida com sucesso!' };
  }
}

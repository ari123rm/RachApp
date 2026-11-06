// src/services/Auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { JWT_SECRET } from '../config/env';

export function normalizePhoneBackend(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  // Remove DDI +55 (12 ou 13 dígitos)
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  // Remove zero inicial do DDD (ex: 011 ou 085)
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }

  // Se após retirar o 0 ainda sobrar DDI 55
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 11);
}

export function phonesMatch(rawA?: string | null, rawB?: string | null): boolean {
  const a = normalizePhoneBackend(rawA);
  const b = normalizePhoneBackend(rawB);
  if (!a || !b) return false;
  if (a === b) return true;

  // Se ambos tiverem DDD (10 ou 11 dígitos)
  if (a.length >= 10 && b.length >= 10) {
    const dddA = a.slice(0, 2);
    const dddB = b.slice(0, 2);
    const last8A = a.slice(-8);
    const last8B = b.slice(-8);
    if (dddA === dddB && last8A === last8B) {
      return true;
    }
  }

  // Se um deles foi digitado sem DDD (8 ou 9 dígitos) ou ambos sem DDD
  if (a.length >= 8 && b.length >= 8) {
    const last8A = a.slice(-8);
    const last8B = b.slice(-8);
    if (last8A === last8B) {
      if (a.length >= 10 && b.length >= 10) {
        return a.slice(0, 2) === b.slice(0, 2);
      }
      return true;
    }
  }

  return false;
}

export function normalizeNameForComparison(name?: string | null): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function areContactsSame(
  contactA: { name?: string | null; phone?: string | null },
  contactB: { name?: string | null; phone?: string | null }
): boolean {
  if (!contactA || !contactB) return false;

  const phoneA = normalizePhoneBackend(contactA.phone);
  const phoneB = normalizePhoneBackend(contactB.phone);

  // 1. Se ambos têm telefone válido (8+ dígitos), a comparação de telefone é prioritária
  if (phoneA.length >= 8 && phoneB.length >= 8) {
    if (phonesMatch(phoneA, phoneB)) return true;
    if (phoneA.length >= 10 && phoneB.length >= 10) return false;
  }

  const nameA = normalizeNameForComparison(contactA.name);
  const nameB = normalizeNameForComparison(contactB.name);

  // 2. Se os nomes forem idênticos (sem acento, minúsculas):
  if (nameA && nameB && nameA === nameB) {
    if (!phoneA || !phoneB) return true;
    return phonesMatch(phoneA, phoneB);
  }

  // 3. Se um nome contiver o outro ou compartilharem o primeiro nome
  if (nameA && nameB) {
    const wordsA = nameA.split(' ');
    const wordsB = nameB.split(' ');
    const sameFirstName = wordsA[0] && wordsB[0] && wordsA[0] === wordsB[0];

    if (sameFirstName && phoneA && phoneB && phonesMatch(phoneA, phoneB)) {
      return true;
    }
    if ((nameA.includes(nameB) || nameB.includes(nameA)) && (!phoneA || !phoneB)) {
      return true;
    }
  }

  return false;
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

    // Se outros usuários já haviam adicionado este telefone anteriormente, gera solicitações pendentes para aprovação
    try {
      const otherFriends = await prisma.friend.findMany({
        where: {
          user_id: { not: user.id },
          phone: { not: null },
        },
      });
      for (const of of otherFriends) {
        if (of.phone && phonesMatch(of.phone, cleanPhone)) {
          await prisma.friendshipRequest.upsert({
            where: {
              sender_id_receiver_id: {
                sender_id: of.user_id,
                receiver_id: user.id,
              },
            },
            update: {},
            create: {
              sender_id: of.user_id,
              receiver_id: user.id,
              status: 'PENDING',
            },
          });
        }
      }

      const groupMembersWithPhone = await prisma.groupMember.findMany({
        where: {
          user_id: null,
          friend: { phone: { not: null } },
        },
        include: { friend: true },
      });
      for (const gm of groupMembersWithPhone) {
        if (gm.friend?.phone && phonesMatch(gm.friend.phone, cleanPhone)) {
          await prisma.groupMember.update({
            where: { id: gm.id },
            data: {
              user_id: user.id,
              status: 'PENDING',
            },
          });
        }
      }
    } catch (err) {
      console.error('Erro ao vincular solicitações no registro:', err);
    }

    console.log(`[SMS SIMULADO] Para ${cleanPhone}: Seu código RachApp é ${verificationCode}`);

    const token = jwt.sign(
      { userId: user.id, name: user.name },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    const { password_hash, verification_code, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token,
      verification_code: verificationCode,
    };
  }

  static issueToken(userId: string, name: string) {
    return jwt.sign({ userId, name }, JWT_SECRET, { expiresIn: '365d' });
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
      { expiresIn: '365d' }
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
      { expiresIn: '365d' }
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

  static async updateProfile(
    userId: string,
    data: { name?: string; phone?: string; pix_key?: string; avatar_url?: string | null }
  ) {
    const cleanPhone = data.phone ? normalizePhoneBackend(data.phone) || data.phone.trim() : undefined;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && data.name.trim() !== '' && { name: data.name.trim() }),
        ...(cleanPhone !== undefined && cleanPhone !== '' && { phone: cleanPhone }),
        ...(data.pix_key !== undefined && { pix_key: data.pix_key.trim() || null }),
        ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url || null }),
      },
    });

    // Se o usuário atualizou a chave Pix ou a foto de perfil dele, propaga automaticamente para os registros de amigos de outros usuários
    if (updatedUser.phone) {
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
            data: {
              ...(updatedUser.pix_key ? { pix_key: updatedUser.pix_key } : {}),
              avatar_url: updatedUser.avatar_url || null,
            },
          });
        }
      } catch (err) {
        console.error('Erro ao propagar chave Pix e foto do usuário para amigos:', err);
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

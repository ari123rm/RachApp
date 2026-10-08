// src/services/AuthService.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { JWT_SECRET } from '../config/env';

export class AuthService {
  // 1. Registo de um novo utilizador
  static async register(data: { name: string; email: string; password_hash: string; phone: string; pix_key?: string }) {
    if (!data.phone) throw new Error('O número de telefone é obrigatório.');

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] },
    });

    if (existingUser) throw new Error('Já existe uma conta com este email ou telefone.');

    const hashedPassword = await bcrypt.hash(data.password_hash, 10);
    // Gera um código de 6 dígitos aleatório
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password_hash: hashedPassword,
        pix_key: data.pix_key,
        verification_code: verificationCode,
      },
    });

    // Aqui você integraria uma API de SMS (Twilio, Zenvia, AWS SNS). 
    // Por enquanto, vamos "imprimir" no console para simular o SMS:
    console.log(`📱 SMS SIMULADO PARA ${data.phone}: Seu código RachApp é ${verificationCode}`);

    const { password_hash, verification_code, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async verifyPhone(email: string, code: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) throw new Error('Usuário não encontrado.');
    if (user.phone_verified) throw new Error('Telefone já verificado.');
    if (user.verification_code !== code) throw new Error('Código de verificação inválido.');

    await prisma.user.update({
      where: { id: user.id },
      data: { phone_verified: true, verification_code: null },
    });

    return { message: 'Telefone verificado com sucesso!' };
  }

  // 2. Login e geração de Token
  static async login(email: string, password_plain: string) {
    // Procurar o utilizador
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Credenciais inválidas.');
    }

    // Comparar a palavra-passe enviada com o hash guardado
    const isPasswordValid = await bcrypt.compare(password_plain, user.password_hash);

    if (!isPasswordValid) {
      throw new Error('Credenciais inválidas.');
    }

    // Gerar o JWT (com duração de 7 dias)
    const token = jwt.sign(
      { userId: user.id, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }

  static async updateProfile(userId: string, data: { name?: string; phone?: string; pix_key?: string }) {
    // Usamos o ID que veio do token, garantindo que o utilizador só edita o próprio perfil
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        // Atualiza os campos apenas se eles tiverem sido enviados no corpo da requisição
        ...(data.name && { name: data.name }),
        ...(data.phone && { phone: data.phone }),
        ...(data.pix_key && { pix_key: data.pix_key }),
      },
    });

    const { password_hash, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  static async updatePassword(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { currentPassword, newPassword } = req.body;
      
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isPasswordValid) return res.status(400).json({ error: 'A senha atual está incorreta.' });

      const newHashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password_hash: newHashedPassword }
      });

      res.status(200).json({ message: 'Senha atualizada com sucesso.' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
  
}
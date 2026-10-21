// src/controllers/Auth.controller.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/Auth.service';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { name, email, password, phone, pix_key } = req.body;
      const result = await AuthService.register({
        name,
        email,
        password_hash: password,
        phone,
        pix_key,
      });
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const data = await AuthService.login(email, password);
      res.status(200).json(data);
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  static async verify(req: Request, res: Response) {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: 'Email e código são obrigatórios.' });
      }
      const result = await AuthService.verifyPhone(email, code);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async me(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Utilizador não autenticado.' });
      const user = await AuthService.getMe(userId);
      res.status(200).json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Utilizador não autenticado.' });
      }
      const { name, phone, pix_key, avatar_url } = req.body;
      const updatedUser = await AuthService.updateProfile(userId, { name, phone, pix_key, avatar_url });
      res.status(200).json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ error: 'Erro ao atualizar o perfil. ' + error.message });
    }
  }

  static async updatePassword(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Utilizador não autenticado.' });
      }
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Preencha a senha atual e a nova senha.' });
      }
      const result = await AuthService.updatePassword(userId, currentPassword, newPassword);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { identifier, newPassword } = req.body;
      const result = await AuthService.resetPasswordByIdentifier(identifier, newPassword);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
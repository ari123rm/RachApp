// src/controllers/AuthController.ts
import { Request, Response } from 'express';
import { AuthService } from '../services/Auth.service';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      // Idealmente, aqui utilizas o Zod para validar se o body está correto
      const { name, email, password, phone, pix_key } = req.body;
      
      const user = await AuthService.register({ 
        name, 
        email, 
        password_hash: password, // Mapeamos "password" para "password_hash"
        phone, 
        pix_key 
      });

      res.status(201).json(user);
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

  static async update(req: Request, res: Response) {
    try {
      // O userId vem do token, injetado pelo nosso authMiddleware!
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'Utilizador não autenticado.' });
      }

      const { name, phone, pix_key } = req.body;
      
      const updatedUser = await AuthService.updateProfile(userId, { name, phone, pix_key });
      
      res.status(200).json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ error: 'Erro ao atualizar o perfil. ' + error.message });
    }
  }
  static async verify(req: Request, res: Response) {
    try {
      const { email, code } = req.body;
      if (!email || !code) return res.status(400).json({ error: 'Email e código são obrigatórios.' });
      
      const result = await AuthService.verifyPhone(email, code);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
  
}
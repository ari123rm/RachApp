// src/controllers/GroupController.ts
import { Request, Response } from 'express';
import { GroupService } from '../services/Group.service';

export class GroupController {
  static async create(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { name } = req.body;

      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });
      if (!name) return res.status(400).json({ error: 'O nome do grupo é obrigatório.' });

      const group = await GroupService.createGroup(userId, name);
      res.status(201).json(group);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const groups = await GroupService.getUserGroups(userId);
      res.status(200).json(groups);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async addMember(req: Request, res: Response) {
    try {
      const { id } = req.params; // ID do grupo vem na URL (ex: /groups/123/members)
      const { identifier } = req.body; // Email ou telefone enviado pelo frontend

      if (!identifier) {
        return res.status(400).json({ error: 'Forneça o email ou telefone do amigo.' });
      }

      const member = await GroupService.addMember(id, identifier);
      res.status(201).json(member);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const group = await GroupService.getGroupById(id, userId);
      res.status(200).json(group);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
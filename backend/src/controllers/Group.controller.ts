// src/controllers/Group.controller.ts
import { Request, Response } from 'express';
import { GroupService } from '../services/Group.service';

export class GroupController {
  static async create(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { id, name, friendIds } = req.body;

      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });
      if (!name) return res.status(400).json({ error: 'O nome do grupo é obrigatório.' });

      const group = await GroupService.createGroup(userId, { id, name, friendIds });
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

  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const updated = await GroupService.updateGroup(userId, id, req.body);
      res.status(200).json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      await GroupService.deleteGroup(userId, id);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async addMember(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const { friendId, identifier, name, phone, pix_key, color } = req.body;
      if (!friendId && !identifier) {
        return res.status(400).json({ error: 'Selecione um amigo ou forneça o nome/telefone.' });
      }

      const member = await GroupService.addMember(id, userId, {
        friendId,
        identifier,
        name,
        phone,
        pix_key,
        color,
      });
      res.status(201).json(member);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async removeMember(req: Request, res: Response) {
    try {
      const { id, memberId } = req.params;
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      await GroupService.removeMember(id, userId, memberId);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
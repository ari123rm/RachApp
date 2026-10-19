// src/controllers/Friend.controller.ts
import { Request, Response } from 'express';
import { FriendService } from '../services/Friend.service';

export class FriendController {
  static async create(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const friend = await FriendService.create(userId, req.body);
      res.status(201).json(friend);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const friends = await FriendService.getAll(req.user!.userId);
      res.status(200).json(friends);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const updated = await FriendService.update(req.user!.userId, req.params.id, req.body);
      res.status(200).json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async toggleFavorite(req: Request, res: Response) {
    try {
      const updated = await FriendService.toggleFavorite(req.user!.userId, req.params.id);
      res.status(200).json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      await FriendService.delete(req.user!.userId, req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
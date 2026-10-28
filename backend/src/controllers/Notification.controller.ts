import { Request, Response } from 'express';
import { NotificationService } from '../services/Notification.service';

export class NotificationController {
  static async list(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const data = await NotificationService.listNotifications(userId, limit);
      return res.status(200).json(data);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const { id } = req.params;
      await NotificationService.markAsRead(userId, id);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async markAsReadByExpense(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const { expenseId } = req.params;
      const ids = await NotificationService.markAsReadByExpense(userId, expenseId);
      return res.status(200).json({ success: true, count: ids.length, ids });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      await NotificationService.markAllAsRead(userId);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async delete(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const { id } = req.params;
      await NotificationService.deleteNotification(userId, id);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  static async updateFcmToken(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const { fcmToken } = req.body;
      await NotificationService.updateFcmToken(userId, fcmToken || null);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }
}

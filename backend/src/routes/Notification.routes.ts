import { Router } from 'express';
import { NotificationController } from '../controllers/Notification.controller';
import { authMiddleware } from '../middlewares/Auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', NotificationController.list);
router.patch('/read-all', NotificationController.markAllAsRead);
router.patch('/read-expense/:expenseId', NotificationController.markAsReadByExpense);
router.patch('/:id/read', NotificationController.markAsRead);
router.delete('/:id', NotificationController.delete);
router.post('/fcm-token', NotificationController.updateFcmToken);

export default router;

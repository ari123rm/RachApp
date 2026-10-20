// src/routes/Friend.routes.ts
import { Router } from 'express';
import { FriendController } from '../controllers/Friend.controller';
import { authMiddleware } from '../middlewares/Auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', FriendController.list);
router.get('/requests', FriendController.listRequests);
router.post('/requests/accept', FriendController.acceptRequest);
router.post('/requests/reject', FriendController.rejectRequest);
router.post('/', FriendController.create);
router.put('/:id', FriendController.update);
router.patch('/:id/favorite', FriendController.toggleFavorite);
router.delete('/:id', FriendController.delete);

export default router;
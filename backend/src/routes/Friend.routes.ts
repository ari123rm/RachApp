// src/routes/Friend.routes.ts
import { Router } from 'express';
import { FriendController } from '../controllers/Friend.controller';
import { authMiddleware } from '../middlewares/Auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', FriendController.list);
router.post('/', FriendController.create);

// Solicitações de amizade e descoberta de contas (devem vir antes de /:id)
router.get('/discover', FriendController.discoverRegisteredUsers);
router.post('/discover', FriendController.discoverRegisteredUsers);
router.get('/requests', FriendController.listPendingRequests);
router.post('/requests/:id/accept', FriendController.acceptRequest);
router.post('/requests/:id/reject', FriendController.rejectRequest);

router.put('/:id', FriendController.update);
router.patch('/:id/favorite', FriendController.toggleFavorite);
router.delete('/:id', FriendController.delete);

export default router;

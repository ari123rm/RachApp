// src/routes/Friend.routes.ts
import { Router } from 'express';
import { FriendController } from '../controllers/Friend.controller';
import { authMiddleware } from '../middlewares/Auth.middleware';

const router = Router();

// Todas as rotas de amigos exigem autenticação do usuário
router.use(authMiddleware);

// GET /api/friends -> Lista todos os amigos do utilizador logado
router.get('/', FriendController.list);

// POST /api/friends -> Cria um novo amigo
router.post('/', FriendController.create);

// PATCH /api/friends/:id/favorite -> Alterna a estrela de favorito
router.patch('/:id/favorite', FriendController.toggleFavorite);

// DELETE /api/friends/:id -> Exclui um amigo (e os rachas atrelados a ele em cascata)
router.delete('/:id', FriendController.delete);

export default router;
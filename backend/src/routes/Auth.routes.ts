// src/routes/Auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/Auth.controller';
import { authMiddleware } from '../middlewares/Auth.middleware';

const router = Router();

// Rotas Públicas
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/verify', AuthController.verify);
router.post('/reset-password', AuthController.resetPassword);

// Rotas Privadas (Protegidas)
router.get('/me', authMiddleware, AuthController.me);
router.put('/profile', authMiddleware, AuthController.update);
router.put('/password', authMiddleware, AuthController.updatePassword);

export default router;
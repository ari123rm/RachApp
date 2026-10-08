// src/routes/Auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/Auth.controller';
import { authMiddleware } from '../middlewares/Auth.middleware';

const router = Router();

// ==========================
// Rotas Públicas
// ==========================
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// ==========================
// Rotas Privadas (Protegidas)
// ==========================
// O authMiddleware é colocado antes do AuthController.update
router.put('/profile', authMiddleware, AuthController.update);

export default router;
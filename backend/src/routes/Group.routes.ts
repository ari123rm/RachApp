// src/routes/Group.routes.ts
import { Router } from 'express';
import { GroupController } from '../controllers/Group.controller';
import { authMiddleware } from '../middlewares/Auth.middleware';

const router = Router();

// Protege todas as rotas de grupos (exige token JWT)
router.use(authMiddleware);

router.post('/', GroupController.create);
router.get('/', GroupController.list);
router.post('/:id/members', GroupController.addMember);
router.get('/:id', GroupController.getById);

export default router;
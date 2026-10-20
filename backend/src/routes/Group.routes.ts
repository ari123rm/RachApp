// src/routes/Group.routes.ts
import { Router } from 'express';
import { GroupController } from '../controllers/Group.controller';
import { authMiddleware } from '../middlewares/Auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', GroupController.create);
router.get('/', GroupController.list);
router.get('/:id', GroupController.getById);
router.put('/:id', GroupController.update);
router.delete('/:id', GroupController.delete);
router.post('/:id/members', GroupController.addMember);
router.delete('/:id/members/:memberId', GroupController.removeMember);

export default router;
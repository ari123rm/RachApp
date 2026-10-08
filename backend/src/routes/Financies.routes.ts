// src/routes/Financies.routes.ts
import { Router } from 'express';
import { FinanciesController } from '../controllers/Financies.controller';
import { authMiddleware } from '../middlewares/Auth.middleware';

const router = Router();

// Todas as rotas financeiras exigem autenticação
router.use(authMiddleware);

// POST /api/finances/groups/:groupId/expenses
router.post('/groups/:groupId/expenses', FinanciesController.addExpense);

// GET /api/finances/groups/:groupId/balances
router.get('/groups/:groupId/balances', FinanciesController.getBalances);

router.post('/payments', FinanciesController.registerPayment);
router.get('/dashboard', FinanciesController.getDashboard);

export default router;
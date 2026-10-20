// src/routes/Financies.routes.ts
import { Router } from 'express';
import { FinanciesController } from '../controllers/Financies.controller';
import { authMiddleware } from '../middlewares/Auth.middleware';

const router = Router();

router.use(authMiddleware);

// Sincronização completa (pull)
router.get('/sync', FinanciesController.syncData);

// CRUD de Despesas / Rachas
router.get('/expenses', FinanciesController.listExpenses);
router.post('/expenses', FinanciesController.createExpense);
router.put('/expenses/:id', FinanciesController.updateExpense);
router.delete('/expenses/:id', FinanciesController.deleteExpense);
router.post('/expenses/:id/payment', FinanciesController.setParticipantPayment);

// Rotas por grupo e pagamentos
router.post('/groups/:groupId/expenses', FinanciesController.addExpense);
router.get('/groups/:groupId/balances', FinanciesController.getBalances);
router.post('/payments', FinanciesController.registerPayment);
router.get('/dashboard', FinanciesController.getDashboard);

export default router;
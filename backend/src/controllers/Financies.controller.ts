// src/controllers/Financies.controller.ts
import { Request, Response } from 'express';
import { ExpenseService } from '../services/Expense.service';
import { FriendService } from '../services/Friend.service';
import { GroupService } from '../services/Group.service';
import { AuthService } from '../services/Auth.service';

export class FinanciesController {
  static async listExpenses(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Usuário não autenticado.' });

      const expenses = await ExpenseService.listExpenses(userId);
      res.status(200).json(expenses);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async createExpense(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Usuário não autenticado.' });

      const {
        id,
        groupId,
        paidByFriendId,
        title,
        tag,
        totalAmount,
        expenseDate,
        participantIds,
        pagamentos,
        valoresDevidos,
        selfAmountOwed,
      } = req.body;

      if (!title || totalAmount === undefined) {
        return res.status(400).json({ error: 'Dados incompletos para registrar a despesa.' });
      }

      const expense = await ExpenseService.createExpense({
        id,
        userId,
        groupId: groupId || req.params.groupId || null,
        paidByFriendId: paidByFriendId || null,
        title,
        tag,
        totalAmount: Number(totalAmount),
        expenseDate,
        participantIds: Array.isArray(participantIds) ? participantIds : [],
        pagamentos,
        valoresDevidos,
        selfAmountOwed,
      });

      res.status(201).json(expense);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async addExpense(req: Request, res: Response) {
    return FinanciesController.createExpense(req, res);
  }

  static async updateExpense(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Usuário não autenticado.' });

      const { id } = req.params;
      const updated = await ExpenseService.updateExpense(userId, id, req.body);
      res.status(200).json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteExpense(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Usuário não autenticado.' });

      const { id } = req.params;
      await ExpenseService.deleteExpense(userId, id);
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async setParticipantPayment(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Usuário não autenticado.' });

      const { id } = req.params;
      const { friendId, amountPaid } = req.body;
      if (!friendId) return res.status(400).json({ error: 'friendId é obrigatório.' });

      const result = await ExpenseService.setParticipantPayment(userId, id, friendId, amountPaid);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getBalances(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const userId = req.user?.userId;

      const summary = await ExpenseService.calculateGroupBalances(groupId, userId);

      res.status(200).json({
        groupId,
        ...summary,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async registerPayment(req: Request, res: Response) {
    try {
      const creditorId = req.user?.userId;
      const { debtorId, amount, groupId } = req.body;

      if (!creditorId) return res.status(401).json({ error: 'Utilizador não autenticado.' });
      if (!debtorId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Dados de pagamento inválidos.' });
      }

      const result = await ExpenseService.registerPayment(creditorId, debtorId, Number(amount), groupId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getDashboard(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      const dashboard = await ExpenseService.getDashboard(userId);
      res.status(200).json(dashboard);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async syncData(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: 'Não autorizado.' });

      // 1. Primeiro sincroniza vínculos reversos por telefone, grupos e despesas compartilhadas
      const [user, groups, expenses] = await Promise.all([
        AuthService.getMe(userId),
        GroupService.getUserGroups(userId),
        ExpenseService.listExpenses(userId),
      ]);

      // 2. Depois carrega a lista completa de amigos (já com novos vínculos criados) e dashboard
      const [friends, dashboard] = await Promise.all([
        FriendService.getAll(userId),
        ExpenseService.getDashboard(userId),
      ]);

      res.status(200).json({
        user,
        friends,
        groups,
        expenses,
        dashboard,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

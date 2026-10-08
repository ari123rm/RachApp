// src/controllers/FinanciesController.ts
import { Request, Response } from 'express';
import { ExpenseService } from '../services/Expense.service';

export class FinanciesController {
  
  static async addExpense(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { title, totalAmount, participantIds, tag } = req.body;
      const paidBy = req.user?.userId; // Quem fez a requisição é quem pagou a conta

      if (!paidBy) return res.status(401).json({ error: 'Usuário não autenticado.' });
      if (!title || !totalAmount || !participantIds || !Array.isArray(participantIds)) {
        return res.status(400).json({ error: 'Dados incompletos para registrar a despesa.' });
      }

      const expense = await ExpenseService.createExpense({
        groupId,
        paidBy,
        title,
        tag,
        totalAmount,
        participantIds
      });

      res.status(201).json(expense);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async getBalances(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      
      // Opcional: Validar se o usuário logado pertence a este grupo antes de liberar os dados
      // const userId = req.user?.userId;

      const optimizedTransfers = await ExpenseService.calculateGroupBalances(groupId);

      res.status(200).json({
        groupId,
        transfers: optimizedTransfers, // A lista limpa de quem deve pagar quem
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
  static async registerPayment(req: Request, res: Response) {
    try {
      const creditorId = req.user?.userId;
      const { debtorId, amount } = req.body;

      if (!creditorId) return res.status(401).json({ error: 'Utilizador não autenticado.' });
      if (!debtorId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Dados de pagamento inválidos.' });
      }

      const result = await ExpenseService.registerPayment(creditorId, debtorId, amount);
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
}
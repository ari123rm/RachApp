// src/services/Expense.service.ts
import { prisma } from '../config/db';

interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export class ExpenseService {
  // 1. Criar uma despesa e dividir os valores
  static async createExpense(data: {
    userId: string;
    groupId?: string;
    title: string;
    tag?: string;
    totalAmount: number;
    participantIds: string[]; // Lista de IDs da tabela Friend
  }) {
    if (data.participantIds.length === 0) {
      throw new Error('A despesa precisa ter pelo menos um participante.');
    }

    // A divisão inclui o utilizador logado (+1)
    const splitAmount = data.totalAmount / (data.participantIds.length + 1);

    const expense = await prisma.expense.create({
      data: {
        user_id: data.userId, // Atualizado (antes era paid_by)
        group_id: data.groupId || null,
        title: data.title,
        tag: data.tag,
        total_amount: data.totalAmount,
        expense_date: new Date(),
        participants: {
          create: data.participantIds.map(friendId => ({
            friend_id: friendId, // Atualizado (antes era user_id)
            amount_owed: splitAmount,
          }))
        }
      },
      include: {
        participants: true
      }
    });

    return expense;
  }

  // 2. Calcular Saldos e Otimizar Transferências
  static async calculateGroupBalances(groupId: string) {
    const expenses = await prisma.expense.findMany({
      where: { group_id: groupId },
      include: { participants: true }
    });

    const balances: Record<string, number> = {};

    expenses.forEach(exp => {
      const totalAmount = Number(exp.total_amount);
      
      // Quem pagou a conta recebe crédito
      balances[exp.user_id] = (balances[exp.user_id] || 0) + totalAmount;

      // Os amigos participantes recebem débito
      exp.participants.forEach(part => {
        const owedAmount = Number(part.amount_owed);
        balances[part.friend_id] = (balances[part.friend_id] || 0) - owedAmount; // Atualizado
      });
    });

    return this.simplifyDebts(balances);
  }

  // 3. Algoritmo de Minimização de Transferências Cruzadas
  private static simplifyDebts(balances: Record<string, number>): Transfer[] {
    const debtors: { id: string; amount: number }[] = [];
    const creditors: { id: string; amount: number }[] = [];

    for (const [userId, balance] of Object.entries(balances)) {
      if (balance < -0.01) debtors.push({ id: userId, amount: Math.abs(balance) });
      else if (balance > 0.01) creditors.push({ id: userId, amount: balance });
    }

    let i = 0; 
    let j = 0; 
    const transfers: Transfer[] = [];

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const transferAmount = Math.min(debtor.amount, creditor.amount);

      transfers.push({
        from: debtor.id,
        to: creditor.id,
        amount: Number(transferAmount.toFixed(2)) 
      });

      debtor.amount -= transferAmount;
      creditor.amount -= transferAmount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return transfers;
  }

  // 4. Registar o pagamento de um amigo e abater nas despesas
  static async registerPayment(creditorId: string, debtorFriendId: string, amount: number) {
    // Procurar despesas onde o usuário logado é o credor e o amigo participou
    const expenses = await prisma.expense.findMany({
      where: {
        user_id: creditorId, // Atualizado
        participants: {
          some: { friend_id: debtorFriendId } // Atualizado
        }
      },
      include: {
        participants: {
          where: { friend_id: debtorFriendId } // Atualizado
        }
      },
      orderBy: { expense_date: 'asc' } 
    });

    let remainingAmount = amount;

    for (const expense of expenses) {
      if (remainingAmount <= 0) break;

      const participant = expense.participants[0];
      const owed = Number(participant.amount_owed);
      const paid = Number(participant.amount_paid);
      const pending = owed - paid;

      if (pending > 0.01) {
        const amountToPayHere = Math.min(pending, remainingAmount);
        
        await prisma.expenseParticipant.update({
          where: {
            expense_id_friend_id: { // Atualizado (a chave composta do Prisma)
              expense_id: expense.id,
              friend_id: debtorFriendId // Atualizado
            }
          },
          data: {
            amount_paid: paid + amountToPayHere
          }
        });

        remainingAmount -= amountToPayHere;
      }
    }

    return { message: 'Pagamento registado e dívidas atualizadas com sucesso.' };
  }
  // 5. Resumo do Dashboard (Home)
  static async getDashboard(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Total Gasto no mês atual
    const expensesThisMonth = await prisma.expense.aggregate({
      _sum: { total_amount: true },
      where: { user_id: userId, expense_date: { gte: startOfMonth } }
    });
    const totalGasto = Number(expensesThisMonth._sum.total_amount || 0);

    // 2. Calcular quem deve ao utilizador (Amigos Devedores)
    const friends = await prisma.friend.findMany({
      where: { user_id: userId },
      include: { expenses: { include: { expense: true } } }
    });

    let totalAReceber = 0;
    const amigosDevedores: any[] = [];

    friends.forEach(friend => {
      let divida = 0;
      friend.expenses.forEach(expPart => {
        // Se a despesa foi criada por mim, o amigo deve-me
        if (expPart.expense.user_id === userId) {
          divida += (Number(expPart.amount_owed) - Number(expPart.amount_paid));
        }
      });

      if (divida > 0.01) {
        totalAReceber += divida;
        amigosDevedores.push({ ...friend, divida });
      }
    });

    return { totalGasto, totalAReceber, amigosDevedores };
  }
}
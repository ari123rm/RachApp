// src/services/Expense.service.ts
import { prisma } from '../config/db';

export interface Transfer {
  fromId: string;
  fromName: string;
  fromPhone?: string | null;
  fromColor?: string;
  toId: string;
  toName: string;
  toPhone?: string | null;
  toPixKey?: string | null;
  toColor?: string;
  amount: number;
}

export class ExpenseService {
  // 1. Listar todas as despesas do utilizador (avulsas e de grupos)
  static async listExpenses(userId: string) {
    const expenses = await prisma.expense.findMany({
      where: { user_id: userId },
      include: {
        participants: {
          include: {
            friend: true,
          },
        },
        group: {
          select: { id: true, name: true },
        },
        paidByFriend: true,
      },
      orderBy: { expense_date: 'desc' },
    });

    return expenses;
  }

  // 2. Criar uma despesa e dividir os valores (suporta divisão igual, por % ou valor personalizado)
  static async createExpense(data: {
    id?: string;
    userId: string;
    groupId?: string | null;
    paidByFriendId?: string | null;
    title: string;
    tag?: string;
    totalAmount: number;
    expenseDate?: string | Date;
    participantIds: string[];
    pagamentos?: Record<string, number>;
    valoresDevidos?: Record<string, number>;
    selfAmountOwed?: number;
  }) {
    let uniqueParticipantIds = Array.from(new Set(data.participantIds || []));

    // Se tiver groupId mas participantIds veio vazio, puxa os membros do grupo automaticamente
    if (uniqueParticipantIds.length === 0 && data.groupId) {
      const grpMembers = await prisma.groupMember.findMany({
        where: { group_id: data.groupId, friend_id: { not: null } },
      });
      uniqueParticipantIds = grpMembers
        .map((m) => m.friend_id!)
        .filter(Boolean);
    }

    if (uniqueParticipantIds.length === 0) {
      throw new Error('A despesa precisa ter pelo menos um participante.');
    }

    if (data.id) {
      const existing = await prisma.expense.findUnique({ where: { id: data.id } });
      if (existing && existing.user_id === data.userId) {
        return this.updateExpense(data.userId, data.id, data);
      }
    }

    const totalPeople = uniqueParticipantIds.length + 1;
    const defaultSplitAmount = Number((Number(data.totalAmount) / totalPeople).toFixed(2));
    const selfOwed =
      data.selfAmountOwed !== undefined
        ? Number(Number(data.selfAmountOwed).toFixed(2))
        : defaultSplitAmount;

    const parsedDate = data.expenseDate ? new Date(data.expenseDate) : new Date();
    const paidByFriendId = data.paidByFriendId || null;

    const expense = await prisma.expense.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        user_id: data.userId,
        group_id: data.groupId || null,
        paid_by_friend_id: paidByFriendId,
        title: data.title.trim(),
        tag: (data.tag || 'Uber').trim(),
        total_amount: Number(data.totalAmount),
        self_amount_owed: selfOwed,
        self_amount_paid: paidByFriendId ? 0 : selfOwed,
        expense_date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
        participants: {
          create: uniqueParticipantIds.map((friendId) => {
            const owedForFriend =
              data.valoresDevidos?.[friendId] !== undefined
                ? Number(Number(data.valoresDevidos[friendId]).toFixed(2))
                : defaultSplitAmount;
            const isFriendPayer = paidByFriendId === friendId;
            const customPaid = data.pagamentos?.[friendId];
            const amountPaid = isFriendPayer
              ? owedForFriend
              : customPaid !== undefined
              ? Math.min(owedForFriend, Number(customPaid))
              : 0;
            return {
              friend_id: friendId,
              amount_owed: owedForFriend,
              amount_paid: amountPaid,
            };
          }),
        },
      },
      include: {
        participants: {
          include: { friend: true },
        },
        group: { select: { id: true, name: true } },
        paidByFriend: true,
      },
    });

    return expense;
  }

  // 3. Editar/Atualizar uma despesa existente (suporta divisão personalizada)
  static async updateExpense(
    userId: string,
    expenseId: string,
    data: {
      title?: string;
      tag?: string;
      totalAmount?: number;
      expenseDate?: string | Date;
      groupId?: string | null;
      paidByFriendId?: string | null;
      participantIds?: string[];
      pagamentos?: Record<string, number>;
      valoresDevidos?: Record<string, number>;
      selfAmountOwed?: number;
    }
  ) {
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, user_id: userId },
      include: { participants: true },
    });

    if (!existing) {
      throw new Error('Racha não encontrado.');
    }

    const totalAmount =
      data.totalAmount !== undefined ? Number(data.totalAmount) : Number(existing.total_amount);
    const participantIds = data.participantIds
      ? Array.from(new Set(data.participantIds))
      : existing.participants.map((p) => p.friend_id);

    if (participantIds.length === 0) {
      throw new Error('A despesa precisa ter pelo menos um participante.');
    }

    const totalPeople = participantIds.length + 1;
    const defaultSplitAmount = Number((totalAmount / totalPeople).toFixed(2));
    const selfOwed =
      data.selfAmountOwed !== undefined
        ? Number(Number(data.selfAmountOwed).toFixed(2))
        : defaultSplitAmount;

    const paidByFriendId =
      data.paidByFriendId !== undefined ? data.paidByFriendId || null : existing.paid_by_friend_id;

    const existingPaidMap = new Map<string, number>();
    existing.participants.forEach((p) => {
      existingPaidMap.set(p.friend_id, Number(p.amount_paid));
    });

    const parsedDate = data.expenseDate ? new Date(data.expenseDate) : existing.expense_date;

    await prisma.expenseParticipant.deleteMany({
      where: { expense_id: expenseId },
    });

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.tag !== undefined ? { tag: data.tag.trim() } : {}),
        ...(data.groupId !== undefined ? { group_id: data.groupId || null } : {}),
        paid_by_friend_id: paidByFriendId,
        total_amount: totalAmount,
        self_amount_owed: selfOwed,
        self_amount_paid: paidByFriendId ? Number(existing.self_amount_paid) : selfOwed,
        expense_date: isNaN(parsedDate.getTime()) ? existing.expense_date : parsedDate,
        participants: {
          create: participantIds.map((friendId) => {
            const owedForFriend =
              data.valoresDevidos?.[friendId] !== undefined
                ? Number(Number(data.valoresDevidos[friendId]).toFixed(2))
                : defaultSplitAmount;
            const isFriendPayer = paidByFriendId === friendId;
            const prevPaid =
              data.pagamentos?.[friendId] !== undefined
                ? Number(data.pagamentos[friendId])
                : existingPaidMap.get(friendId) || 0;
            const amountPaid = isFriendPayer ? owedForFriend : Math.min(owedForFriend, prevPaid);
            return {
              friend_id: friendId,
              amount_owed: owedForFriend,
              amount_paid: amountPaid,
            };
          }),
        },
      },
      include: {
        participants: {
          include: { friend: true },
        },
        group: { select: { id: true, name: true } },
        paidByFriend: true,
      },
    });

    return updated;
  }

  // 4. Excluir uma despesa
  static async deleteExpense(userId: string, expenseId: string) {
    const existing = await prisma.expense.findFirst({
      where: { id: expenseId, user_id: userId },
    });
    if (!existing) throw new Error('Racha não encontrado.');

    await prisma.expense.delete({ where: { id: expenseId } });
  }

  // 5. Desfazer ou definir pagamento de um participante numa corrida específica
  static async setParticipantPayment(
    userId: string,
    expenseId: string,
    friendId: string,
    amountPaid?: number
  ) {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, user_id: userId },
      include: { participants: true },
    });
    if (!expense) throw new Error('Racha não encontrado.');

    const part = expense.participants.find((p) => p.friend_id === friendId);
    if (!part) throw new Error('Participante não encontrado neste racha.');

    const targetAmount =
      amountPaid !== undefined ? Math.min(Number(part.amount_owed), Math.max(0, Number(amountPaid))) : 0;

    return prisma.expenseParticipant.update({
      where: {
        expense_id_friend_id: {
          expense_id: expenseId,
          friend_id: friendId,
        },
      },
      data: {
        amount_paid: targetAmount,
      },
    });
  }

  // 6. Calcular Saldos do Grupo e Otimizar Transferências Cruzadas
  static async calculateGroupBalances(groupId: string, userId?: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: { select: { id: true, name: true, pix_key: true, phone: true } },
        members: {
          include: {
            friend: true,
            user: { select: { id: true, name: true, pix_key: true, phone: true } },
          },
        },
        expenses: {
          include: {
            participants: { include: { friend: true } },
            paidByFriend: true,
          },
        },
      },
    });

    if (!group) throw new Error('Grupo não encontrado.');

    const ownerId = userId || group.created_by;
    const ownerKey = `user:${ownerId}`;

    const entityMeta: Record<
      string,
      { id: string; name: string; phone?: string | null; pix_key?: string | null; color: string; isOwner?: boolean }
    > = {
      [ownerKey]: {
        id: ownerId,
        name: group.owner?.name || 'Você',
        phone: group.owner?.phone,
        pix_key: group.owner?.pix_key,
        color: 'bg-[#2DD4BF]',
        isOwner: true,
      },
    };

    group.members.forEach((m) => {
      if (m.friend) {
        entityMeta[m.friend.id] = {
          id: m.friend.id,
          name: m.friend.name,
          phone: m.friend.phone,
          pix_key: m.friend.pix_key,
          color: m.friend.color || 'bg-sky-500',
        };
      }
    });

    const netBalances: Record<string, number> = { [ownerKey]: 0 };
    const memberPendingCount: Record<string, number> = {};
    const memberOwesOwner: Record<string, number> = {};

    Object.keys(entityMeta).forEach((k) => {
      netBalances[k] = 0;
      memberPendingCount[k] = 0;
      memberOwesOwner[k] = 0;
    });

    group.expenses.forEach((exp) => {
      exp.participants.forEach((p) => {
        if (p.friend && !entityMeta[p.friend_id]) {
          entityMeta[p.friend_id] = {
            id: p.friend.id,
            name: p.friend.name,
            phone: p.friend.phone,
            pix_key: p.friend.pix_key,
            color: p.friend.color || 'bg-sky-500',
          };
          netBalances[p.friend_id] = 0;
          memberPendingCount[p.friend_id] = 0;
          memberOwesOwner[p.friend_id] = 0;
        }
      });

      const payerFriendId = exp.paid_by_friend_id;

      if (!payerFriendId) {
        exp.participants.forEach((part) => {
          const pending = Number(part.amount_owed) - Number(part.amount_paid);
          if (pending > 0.005) {
            netBalances[ownerKey] = (netBalances[ownerKey] || 0) + pending;
            netBalances[part.friend_id] = (netBalances[part.friend_id] || 0) - pending;
            memberPendingCount[part.friend_id] = (memberPendingCount[part.friend_id] || 0) + 1;
            memberOwesOwner[part.friend_id] = (memberOwesOwner[part.friend_id] || 0) + pending;
          }
        });
      } else {
        if (exp.paidByFriend && !entityMeta[payerFriendId]) {
          entityMeta[payerFriendId] = {
            id: exp.paidByFriend.id,
            name: exp.paidByFriend.name,
            phone: exp.paidByFriend.phone,
            pix_key: exp.paidByFriend.pix_key,
            color: exp.paidByFriend.color || 'bg-purple-500',
          };
        }

        exp.participants.forEach((part) => {
          if (part.friend_id === payerFriendId) return;
          const pending = Number(part.amount_owed) - Number(part.amount_paid);
          if (pending > 0.005) {
            netBalances[payerFriendId] = (netBalances[payerFriendId] || 0) + pending;
            netBalances[part.friend_id] = (netBalances[part.friend_id] || 0) - pending;
            memberPendingCount[part.friend_id] = (memberPendingCount[part.friend_id] || 0) + 1;
          }
        });

        const selfOwed =
          Number(exp.self_amount_owed) > 0
            ? Number(exp.self_amount_owed)
            : Number(exp.total_amount) / (exp.participants.length + 1);
        const selfPaid = Number(exp.self_amount_paid || 0);
        const selfPending = selfOwed - selfPaid;

        if (selfPending > 0.005) {
          netBalances[payerFriendId] = (netBalances[payerFriendId] || 0) + selfPending;
          netBalances[ownerKey] = (netBalances[ownerKey] || 0) - selfPending;
          memberOwesOwner[payerFriendId] = (memberOwesOwner[payerFriendId] || 0) - selfPending;
        }
      }
    });

    const transfers = this.simplifyDebts(netBalances, entityMeta);

    const memberBalances = Object.entries(entityMeta)
      .filter(([key]) => key !== ownerKey)
      .map(([key, meta]) => ({
        friendId: meta.id,
        name: meta.name,
        phone: meta.phone,
        pix_key: meta.pix_key,
        color: meta.color,
        netBalance: Number((netBalances[key] || 0).toFixed(2)),
        owesYou: Number((memberOwesOwner[key] || 0).toFixed(2)),
        pendingCount: memberPendingCount[key] || 0,
      }));

    return {
      userNetBalance: Number((netBalances[ownerKey] || 0).toFixed(2)),
      memberBalances,
      transfers,
    };
  }

  // 7. Algoritmo de Minimização de Transferências Cruzadas
  private static simplifyDebts(
    balances: Record<string, number>,
    entityMeta: Record<
      string,
      { id: string; name: string; phone?: string | null; pix_key?: string | null; color: string; isOwner?: boolean }
    >
  ): Transfer[] {
    const debtors: { key: string; amount: number }[] = [];
    const creditors: { key: string; amount: number }[] = [];

    for (const [key, balance] of Object.entries(balances)) {
      if (balance < -0.01) debtors.push({ key, amount: Math.abs(balance) });
      else if (balance > 0.01) creditors.push({ key, amount: balance });
    }

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let i = 0;
    let j = 0;
    const transfers: Transfer[] = [];

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const transferAmount = Math.min(debtor.amount, creditor.amount);
      const fromMeta = entityMeta[debtor.key] || { id: debtor.key, name: 'Participante', color: 'bg-gray-600' };
      const toMeta = entityMeta[creditor.key] || { id: creditor.key, name: 'Credor', color: 'bg-teal-500' };

      if (transferAmount >= 0.01) {
        transfers.push({
          fromId: fromMeta.id,
          fromName: fromMeta.isOwner ? 'Você' : fromMeta.name,
          fromPhone: fromMeta.phone,
          fromColor: fromMeta.color,
          toId: toMeta.id,
          toName: toMeta.isOwner ? 'Você' : toMeta.name,
          toPhone: toMeta.phone,
          toPixKey: toMeta.pix_key,
          toColor: toMeta.color,
          amount: Number(transferAmount.toFixed(2)),
        });
      }

      debtor.amount -= transferAmount;
      creditor.amount -= transferAmount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return transfers;
  }

  // 8. Registar o pagamento de um amigo e abater nas despesas mais antigas
  static async registerPayment(
    creditorId: string,
    debtorFriendId: string,
    amount: number,
    groupId?: string
  ) {
    const expenses = await prisma.expense.findMany({
      where: {
        user_id: creditorId,
        paid_by_friend_id: null,
        ...(groupId ? { group_id: groupId } : {}),
        participants: {
          some: { friend_id: debtorFriendId },
        },
      },
      include: {
        participants: {
          where: { friend_id: debtorFriendId },
        },
      },
      orderBy: { expense_date: 'asc' },
    });

    let remainingAmount = Number(amount);

    for (const expense of expenses) {
      if (remainingAmount <= 0.005) break;

      const participant = expense.participants[0];
      if (!participant) continue;

      const owed = Number(participant.amount_owed);
      const paid = Number(participant.amount_paid);
      const pending = owed - paid;

      if (pending > 0.005) {
        const amountToPayHere = Math.min(pending, remainingAmount);

        await prisma.expenseParticipant.update({
          where: {
            expense_id_friend_id: {
              expense_id: expense.id,
              friend_id: debtorFriendId,
            },
          },
          data: {
            amount_paid: Number((paid + amountToPayHere).toFixed(2)),
          },
        });

        remainingAmount -= amountToPayHere;
      }
    }

    return { message: 'Pagamento registado e dívidas atualizadas com sucesso.' };
  }

  // 9. Resumo do Dashboard (Home)
  static async getDashboard(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const expensesThisMonth = await prisma.expense.aggregate({
      _sum: { total_amount: true },
      where: { user_id: userId, expense_date: { gte: startOfMonth } },
    });
    const totalGasto = Number(expensesThisMonth._sum.total_amount || 0);

    const friends = await prisma.friend.findMany({
      where: { user_id: userId },
      include: { expenses: { include: { expense: true } } },
    });

    let totalAReceber = 0;
    const amigosDevedores: any[] = [];

    friends.forEach((friend) => {
      let divida = 0;
      let pendingExpensesCount = 0;
      friend.expenses.forEach((expPart) => {
        if (expPart.expense.user_id === userId && !expPart.expense.paid_by_friend_id) {
          const pendente = Number(expPart.amount_owed) - Number(expPart.amount_paid);
          if (pendente > 0.005) {
            divida += pendente;
            pendingExpensesCount += 1;
          }
        }
      });

      if (divida > 0.01) {
        const roundedDivida = Number(divida.toFixed(2));
        totalAReceber += roundedDivida;
        const { expenses, ...friendClean } = friend;
        amigosDevedores.push({
          ...friendClean,
          divida: roundedDivida,
          pendingExpensesCount,
        });
      }
    });

    return {
      totalGasto: Number(totalGasto.toFixed(2)),
      totalAReceber: Number(totalAReceber.toFixed(2)),
      amigosDevedores,
    };
  }
}
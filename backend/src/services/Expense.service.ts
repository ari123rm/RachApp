// src/services/Expense.service.ts
import { prisma } from '../config/db';
import { phonesMatch } from './Auth.service';
import { FriendService } from './Friend.service';

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
  /**
   * Transforma uma despesa criada por outro usuário (onde userId foi incluído pelo telefone)
   * para a perspectiva de userId ("Você" passa a ser userId, e o criador passa a ser um Friend local de userId).
   */
  static async transformExpenseForUser(
    exp: any,
    userId: string,
    reverseContext: Awaited<ReturnType<typeof FriendService.syncReverseLinks>>
  ) {
    if (exp.user_id === userId) {
      return exp;
    }

    const { reverseFriendIds, ensureLocalFriendForOwner, ensureLocalFriendForForeign } = reverseContext;
    const reverseSet = new Set(reverseFriendIds);

    const myPart = (exp.participants || []).find((p: any) => reverseSet.has(p.friend_id));
    const totalPeople = (exp.participants?.length || 0) + 1;
    const defaultShare = Number((Number(exp.total_amount || 0) / totalPeople).toFixed(2));

    const ownerUser = exp.owner || (await prisma.user.findUnique({ where: { id: exp.user_id } }));
    const ownerLocalFriend = ownerUser
      ? await ensureLocalFriendForOwner(ownerUser)
      : await ensureLocalFriendForForeign({ id: exp.user_id, name: 'Amigo' });

    const iAmPayer = Boolean(exp.paid_by_friend_id && reverseSet.has(exp.paid_by_friend_id));

    const myOwed = myPart ? Number(myPart.amount_owed) : defaultShare;
    const myPaid = iAmPayer ? myOwed : myPart ? Number(myPart.amount_paid || 0) : 0;

    let transformedPaidByFriend: any = null;
    let transformedPaidByFriendId: string | null = null;

    if (!exp.paid_by_friend_id) {
      // O criador da despesa pagou -> na minha visão, esse amigo pagou
      transformedPaidByFriend = ownerLocalFriend;
      transformedPaidByFriendId = ownerLocalFriend.id;
    } else if (iAmPayer) {
      // Eu paguei -> na minha visão, paid_by_friend_id é null ("Você")
      transformedPaidByFriend = null;
      transformedPaidByFriendId = null;
    } else if (exp.paidByFriend) {
      // Um terceiro amigo pagou
      const thirdLocal = await ensureLocalFriendForForeign(exp.paidByFriend);
      transformedPaidByFriend = thirdLocal;
      transformedPaidByFriendId = thirdLocal.id;
    }

    const ownerOwed =
      Number(exp.self_amount_owed) > 0 ? Number(exp.self_amount_owed) : defaultShare;
    const ownerPaid = !exp.paid_by_friend_id ? ownerOwed : Number(exp.self_amount_paid || 0);

    const transformedParticipants: any[] = [
      {
        expense_id: exp.id,
        friend_id: ownerLocalFriend.id,
        amount_owed: ownerOwed,
        amount_paid: ownerPaid,
        receipt_url: exp.self_receipt_url || null,
        friend: ownerLocalFriend,
      },
    ];

    for (const p of exp.participants || []) {
      if (reverseSet.has(p.friend_id)) continue;
      if (p.friend) {
        const localF = await ensureLocalFriendForForeign(p.friend);
        if (localF.id !== ownerLocalFriend.id) {
          transformedParticipants.push({
            expense_id: exp.id,
            friend_id: localF.id,
            amount_owed: Number(p.amount_owed),
            amount_paid: Number(p.amount_paid),
            receipt_url: p.receipt_url || null,
            friend: localF,
          });
        }
      }
    }

    return {
      ...exp,
      user_id: userId,
      original_owner_id: exp.user_id,
      paid_by_friend_id: transformedPaidByFriendId,
      paidByFriend: transformedPaidByFriend,
      self_amount_owed: myOwed,
      self_amount_paid: myPaid,
      self_receipt_url: myPart?.receipt_url || null,
      participants: transformedParticipants,
    };
  }

  // 1. Listar todas as despesas do utilizador (próprias e compartilhadas por amigos via telefone)
  static async listExpenses(userId: string) {
    const reverseContext = await FriendService.syncReverseLinks(userId);
    const { reverseFriendIds } = reverseContext;

    const expenses = await prisma.expense.findMany({
      where: {
        OR: [
          { user_id: userId },
          ...(reverseFriendIds.length > 0
            ? [
                { participants: { some: { friend_id: { in: reverseFriendIds } } } },
                { paid_by_friend_id: { in: reverseFriendIds } },
              ]
            : []),
        ],
      },
      include: {
        owner: {
          select: { id: true, name: true, phone: true, pix_key: true },
        },
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

    const transformed = [];
    for (const exp of expenses) {
      transformed.push(await this.transformExpenseForUser(exp, userId, reverseContext));
    }

    return transformed;
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
      if (existing) {
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
    const reverseContext = await FriendService.syncReverseLinks(userId);
    const { reverseFriendIds } = reverseContext;

    const existing = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        OR: [
          { user_id: userId },
          ...(reverseFriendIds.length > 0
            ? [
                { participants: { some: { friend_id: { in: reverseFriendIds } } } },
                { paid_by_friend_id: { in: reverseFriendIds } },
              ]
            : []),
        ],
      },
      include: {
        owner: { select: { id: true, name: true, phone: true, pix_key: true } },
        participants: { include: { friend: true } },
      },
    });

    if (!existing) {
      throw new Error('Racha não encontrado.');
    }

    // PERMISSÃO: Somente o criador do racha tem permissão para editá-lo
    if (existing.user_id !== userId) {
      throw new Error('Apenas o criador do racha tem permissão para editá-lo.');
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
    const existingReceiptMap = new Map<string, string | null>();
    existing.participants.forEach((p: any) => {
      existingPaidMap.set(p.friend_id, Number(p.amount_paid));
      existingReceiptMap.set(p.friend_id, p.receipt_url || null);
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
              receipt_url: existingReceiptMap.get(friendId) || null,
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
    const { reverseFriendIds } = await FriendService.syncReverseLinks(userId);
    const existing = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        OR: [
          { user_id: userId },
          ...(reverseFriendIds.length > 0
            ? [
                { participants: { some: { friend_id: { in: reverseFriendIds } } } },
                { paid_by_friend_id: { in: reverseFriendIds } },
              ]
            : []),
        ],
      },
    });
    if (!existing) throw new Error('Racha não encontrado.');

    await prisma.expense.delete({ where: { id: expenseId } });
  }

  // 5. Desfazer ou definir pagamento de um participante numa corrida específica
  // Regras:
  // - Quem pagou a conta ("lesado"/credor) pode confirmar ou desfazer o pagamento de qualquer participante sem precisar de comprovante.
  // - Quem deve (devedor) SÓ pode informar o pagamento da sua própria parte e MEDIANTE comprovante de pagamento (receiptUrl).
  static async setParticipantPayment(
    userId: string,
    expenseId: string,
    friendId: string,
    amountPaid?: number,
    receiptUrl?: string | null
  ) {
    const { reverseFriendIds, myFriends } = await FriendService.syncReverseLinks(userId);
    const expense: any = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        OR: [
          { user_id: userId },
          ...(reverseFriendIds.length > 0
            ? [
                { participants: { some: { friend_id: { in: reverseFriendIds } } } },
                { paid_by_friend_id: { in: reverseFriendIds } },
              ]
            : []),
        ],
      },
      include: {
        owner: { select: { id: true, name: true, phone: true } },
        participants: { include: { friend: true } },
        paidByFriend: true,
      },
    });
    if (!expense) throw new Error('Racha não encontrado.');

    // Caso 1: A despesa foi criada pelo próprio userId
    if (expense.user_id === userId) {
      const userIsCreditor = !expense.paid_by_friend_id;

      if (friendId === 'self') {
        const totalParts = expense.participants.length + 1;
        const selfOwed =
          Number(expense.self_amount_owed) > 0
            ? Number(expense.self_amount_owed)
            : Number(expense.total_amount) / totalParts;
        const target =
          amountPaid !== undefined ? Math.min(selfOwed, Math.max(0, Number(amountPaid))) : 0;

        if (!userIsCreditor) {
          if (target <= 0) {
            throw new Error('Apenas quem pagou a conta pode desfazer o pagamento.');
          }
          if (!receiptUrl && !expense.self_receipt_url) {
            throw new Error('É obrigatório anexar o comprovante de pagamento para informar que pagou.');
          }
        }

        return prisma.expense.update({
          where: { id: expenseId },
          data: {
            self_amount_paid: Number(target.toFixed(2)),
            self_receipt_url: target <= 0 ? null : receiptUrl || expense.self_receipt_url || null,
          } as any,
        });
      }

      if (!userIsCreditor) {
        throw new Error('Apenas quem pagou a conta pode confirmar ou alterar o pagamento de outros participantes.');
      }

      const part = expense.participants.find((p: any) => p.friend_id === friendId);
      if (!part) throw new Error('Participante não encontrado neste racha.');

      const targetAmount =
        amountPaid !== undefined
          ? Math.min(Number(part.amount_owed), Math.max(0, Number(amountPaid)))
          : 0;

      return prisma.expenseParticipant.update({
        where: {
          expense_id_friend_id: {
            expense_id: expenseId,
            friend_id: friendId,
          },
        },
        data: {
          amount_paid: targetAmount,
          receipt_url: targetAmount <= 0 ? null : receiptUrl || part.receipt_url || null,
        } as any,
      });
    }

    // Caso 2: A despesa foi criada por outro usuário (exp.owner) e compartilhada com userId
    const iAmCreditor = Boolean(
      expense.paid_by_friend_id && reverseFriendIds.includes(expense.paid_by_friend_id)
    );
    const myPart = expense.participants.find((p: any) => reverseFriendIds.includes(p.friend_id));
    const localFriendTarget = myFriends.find((f) => f.id === friendId);
    const isTargetTheExpenseOwner =
      localFriendTarget &&
      expense.owner &&
      (phonesMatch(localFriendTarget.phone, expense.owner.phone) ||
        localFriendTarget.name.trim().toLowerCase() === expense.owner.name.trim().toLowerCase());

    // Se friendId === 'self' ou se o criador pagou (!expense.paid_by_friend_id) e estou quitando minha parte com ele
    if (friendId === 'self' || (!expense.paid_by_friend_id && isTargetTheExpenseOwner)) {
      if (!myPart) throw new Error('Participação não encontrada neste racha.');
      const targetAmount =
        amountPaid !== undefined
          ? Math.min(Number(myPart.amount_owed), Math.max(0, Number(amountPaid)))
          : 0;

      if (!iAmCreditor) {
        if (targetAmount <= 0) {
          throw new Error('Apenas quem pagou a conta pode desfazer o pagamento.');
        }
        if (!receiptUrl && !myPart.receipt_url) {
          throw new Error('É obrigatório anexar o comprovante de pagamento para informar que pagou.');
        }
      }

      return prisma.expenseParticipant.update({
        where: {
          expense_id_friend_id: {
            expense_id: expenseId,
            friend_id: myPart.friend_id,
          },
        },
        data: {
          amount_paid: Number(targetAmount.toFixed(2)),
          receipt_url: targetAmount <= 0 ? null : receiptUrl || myPart.receipt_url || null,
        } as any,
      });
    }

    if (!iAmCreditor) {
      throw new Error('Apenas quem pagou a conta pode confirmar ou alterar o pagamento de outros participantes.');
    }

    // Se EU fui o pagador na despesa criada pelo meu amigo, e estou quitando a parte dele (owner)
    if (isTargetTheExpenseOwner) {
      const totalParts = expense.participants.length + 1;
      const ownerOwed =
        Number(expense.self_amount_owed) > 0
          ? Number(expense.self_amount_owed)
          : Number(expense.total_amount) / totalParts;
      const targetAmount =
        amountPaid !== undefined ? Math.min(ownerOwed, Math.max(0, Number(amountPaid))) : 0;

      return prisma.expense.update({
        where: { id: expenseId },
        data: {
          self_amount_paid: Number(targetAmount.toFixed(2)),
          self_receipt_url: targetAmount <= 0 ? null : receiptUrl || expense.self_receipt_url || null,
        } as any,
      });
    }

    // Caso seja um 3º participante (e eu sou o credor)
    const otherPart = expense.participants.find(
      (p: any) =>
        p.friend_id === friendId ||
        (localFriendTarget &&
          p.friend &&
          (phonesMatch(p.friend.phone, localFriendTarget.phone) ||
            p.friend.name.trim().toLowerCase() === localFriendTarget.name.trim().toLowerCase()))
    );
    if (!otherPart) throw new Error('Participante não encontrado neste racha.');

    const targetAmount =
      amountPaid !== undefined
        ? Math.min(Number(otherPart.amount_owed), Math.max(0, Number(amountPaid)))
        : 0;

    return prisma.expenseParticipant.update({
      where: {
        expense_id_friend_id: {
          expense_id: expenseId,
          friend_id: otherPart.friend_id,
        },
      },
      data: {
        amount_paid: Number(targetAmount.toFixed(2)),
        receipt_url: targetAmount <= 0 ? null : receiptUrl || otherPart.receipt_url || null,
      } as any,
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
            owner: { select: { id: true, name: true, pix_key: true, phone: true } },
            participants: { include: { friend: true } },
            paidByFriend: true,
          },
        },
      },
    });

    if (!group) throw new Error('Grupo não encontrado.');

    const effectiveUserId = userId || group.created_by;
    const reverseContext = await FriendService.syncReverseLinks(effectiveUserId);
    const currentUser = reverseContext.currentUser;
    const ownerKey = `user:${effectiveUserId}`;

    const entityMeta: Record<
      string,
      { id: string; name: string; phone?: string | null; pix_key?: string | null; color: string; isOwner?: boolean }
    > = {
      [ownerKey]: {
        id: effectiveUserId,
        name: currentUser?.name || group.owner?.name || 'Você',
        phone: currentUser?.phone || group.owner?.phone,
        pix_key: currentUser?.pix_key || group.owner?.pix_key,
        color: 'bg-[#2DD4BF]',
        isOwner: true,
      },
    };

    if (group.created_by !== effectiveUserId && group.owner) {
      const ownerLocal = await reverseContext.ensureLocalFriendForOwner(group.owner);
      entityMeta[ownerLocal.id] = {
        id: ownerLocal.id,
        name: ownerLocal.name,
        phone: ownerLocal.phone,
        pix_key: ownerLocal.pix_key,
        color: ownerLocal.color || 'bg-teal-500',
      };
    }

    const reverseSet = new Set(reverseContext.reverseFriendIds);

    for (const m of group.members) {
      if (m.friend && !reverseSet.has(m.friend.id)) {
        const localF =
          group.created_by === effectiveUserId
            ? m.friend
            : await reverseContext.ensureLocalFriendForForeign(m.friend);
        entityMeta[localF.id] = {
          id: localF.id,
          name: localF.name,
          phone: localF.phone,
          pix_key: localF.pix_key,
          color: localF.color || 'bg-sky-500',
        };
      }
    }

    const netBalances: Record<string, number> = { [ownerKey]: 0 };
    const memberPendingCount: Record<string, number> = {};
    const memberOwesOwner: Record<string, number> = {};

    Object.keys(entityMeta).forEach((k) => {
      netBalances[k] = 0;
      memberPendingCount[k] = 0;
      memberOwesOwner[k] = 0;
    });

    for (const rawExp of group.expenses) {
      const exp = await this.transformExpenseForUser(rawExp, effectiveUserId, reverseContext);

      exp.participants.forEach((p: any) => {
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
        exp.participants.forEach((part: any) => {
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

        exp.participants.forEach((part: any) => {
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
    }

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

  // 7. Algoritmo de Minimização de Transferências Cruzadas (Melhor Rota com Casamento Exato)
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

    const transfers: Transfer[] = [];

    // 1º Passo: Casamento Exato Direto (se A deve 50 e C tem 50 a receber, quitar em 1 transação)
    for (let d = debtors.length - 1; d >= 0; d--) {
      const debtor = debtors[d];
      const matchIdx = creditors.findIndex((c) => Math.abs(c.amount - debtor.amount) < 0.01);
      if (matchIdx !== -1) {
        const creditor = creditors[matchIdx];
        const fromMeta = entityMeta[debtor.key] || { id: debtor.key, name: 'Participante', color: 'bg-gray-600' };
        const toMeta = entityMeta[creditor.key] || { id: creditor.key, name: 'Credor', color: 'bg-teal-500' };
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
          amount: Number(debtor.amount.toFixed(2)),
        });
        debtors.splice(d, 1);
        creditors.splice(matchIdx, 1);
      }
    }

    // 2º Passo: Guloso para os valores residuais
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    let i = 0;
    let j = 0;

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
    groupId?: string,
    receiptUrl?: string | null
  ) {
    const allExpenses = await this.listExpenses(creditorId);
    const filtered = allExpenses
      .filter((e) => !groupId || e.group_id === groupId)
      .sort((a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime());

    let remainingAmount = Number(amount);

    // 1. Abate nas despesas em que o amigo deve para Você (!paid_by_friend_id)
    for (const expense of filtered) {
      if (remainingAmount <= 0.005) break;
      if (expense.paid_by_friend_id) continue;

      const part = (expense.participants || []).find((p: any) => p.friend_id === debtorFriendId);
      if (!part) continue;

      const owed = Number(part.amount_owed);
      const paid = Number(part.amount_paid);
      const pending = owed - paid;

      if (pending > 0.005) {
        const amountToPayHere = Math.min(pending, remainingAmount);
        await this.setParticipantPayment(
          creditorId,
          expense.id,
          debtorFriendId,
          Number((paid + amountToPayHere).toFixed(2)),
          receiptUrl
        );
        remainingAmount -= amountToPayHere;
      }
    }

    // 2. Se ainda sobrar valor (ou se Você devia para o amigo), abate nas despesas em que o amigo pagou
    for (const expense of filtered) {
      if (remainingAmount <= 0.005) break;
      if (expense.paid_by_friend_id !== debtorFriendId) continue;

      const totalParts = (expense.participants?.length || 0) + 1;
      const selfOwed =
        Number(expense.self_amount_owed) > 0
          ? Number(expense.self_amount_owed)
          : Number(expense.total_amount) / totalParts;
      const selfPaid = Number(expense.self_amount_paid || 0);
      const pending = selfOwed - selfPaid;

      if (pending > 0.005) {
        const amountToPayHere = Math.min(pending, remainingAmount);
        await this.setParticipantPayment(
          creditorId,
          expense.id,
          'self',
          Number((selfPaid + amountToPayHere).toFixed(2)),
          receiptUrl
        );
        remainingAmount -= amountToPayHere;
      }
    }

    return { message: 'Pagamento registado e dívidas atualizadas com sucesso.' };
  }

  // 9. Resumo do Dashboard (Home)
  static async getDashboard(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allExpenses = await this.listExpenses(userId);
    const totalGasto = allExpenses
      .filter((e) => new Date(e.expense_date) >= startOfMonth)
      .reduce((acc, e) => acc + Number(e.total_amount || 0), 0);

    const friends = await FriendService.getAll(userId);

    let totalAReceber = 0;
    let totalAPagar = 0;
    const amigosDevedores: any[] = [];

    friends.forEach((friend: any) => {
      const divida = Number(friend.divida || 0);
      const voceDeve = Number(friend.voceDeve || 0);

      if (divida > 0.01) {
        totalAReceber += divida;
      }
      if (voceDeve > 0.01) {
        totalAPagar += voceDeve;
      }

      if (divida > 0.01 || voceDeve > 0.01) {
        amigosDevedores.push({
          ...friend,
          divida: Number(divida.toFixed(2)),
          voceDeve: Number(voceDeve.toFixed(2)),
        });
      }
    });

    return {
      totalGasto: Number(totalGasto.toFixed(2)),
      totalAReceber: Number(totalAReceber.toFixed(2)),
      totalAPagar: Number(totalAPagar.toFixed(2)),
      amigosDevedores,
    };
  }
}

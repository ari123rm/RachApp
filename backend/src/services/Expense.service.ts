// src/services/Expense.service.ts
import { prisma } from '../config/db';
import { normalizePhoneBackend, phonesMatch } from './Auth.service';
import { FriendService } from './Friend.service';
import { NotificationService } from './Notification.service';
import { notifySync } from './socket.service';

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
      return {
        ...exp,
        is_creator: true,
        created_by_user_id: exp.user_id,
        original_owner_id: exp.user_id,
      };
    }

    const { reverseFriendIds, ensureLocalFriendForOwner, myFriends } = reverseContext;
    const reverseSet = new Set(reverseFriendIds);

    const myPart = (exp.participants || []).find((p: any) => reverseSet.has(p.friend_id));
    const totalPeople = (exp.participants?.length || 0) + 1;
    const defaultShare = Number((Number(exp.total_amount || 0) / totalPeople).toFixed(2));

    const ownerUser = exp.owner || (await prisma.user.findUnique({ where: { id: exp.user_id } }));
    const ownerLocalFriend = ownerUser
      ? await ensureLocalFriendForOwner(ownerUser)
      : { id: exp.user_id, name: 'Amigo', color: 'bg-emerald-500', phone: null, pix_key: null };

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
      // Um terceiro amigo pagou (sem duplicar no banco de dados)
      const localMatch = exp.paidByFriend.phone
        ? myFriends.find((mf) => mf.phone && phonesMatch(mf.phone, exp.paidByFriend.phone))
        : null;
      const thirdLocal = localMatch || {
        id: exp.paidByFriend.id,
        name: exp.paidByFriend.name,
        phone: exp.paidByFriend.phone,
        pix_key: exp.paidByFriend.pix_key,
        color: exp.paidByFriend.color || 'bg-sky-500',
      };
      transformedPaidByFriend = thirdLocal;
      transformedPaidByFriendId = thirdLocal.id;
    }

    const ownerOwed =
      exp.self_amount_owed !== null && exp.self_amount_owed !== undefined && Number(exp.self_amount_owed) > 0
        ? Number(exp.self_amount_owed)
        : ((exp.participants || []).reduce((acc: number, p: any) => acc + Number(p.amount_owed || 0), 0) >= Number(exp.total_amount) - 0.1)
        ? 0
        : defaultShare;
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
        const localMatch = p.friend.phone
          ? myFriends.find((mf) => mf.phone && phonesMatch(mf.phone, p.friend.phone))
          : null;
        const participantFriend = localMatch || {
          id: p.friend.id,
          name: p.friend.name,
          phone: p.friend.phone,
          pix_key: p.friend.pix_key,
          color: p.friend.color || 'bg-sky-500',
        };
        if (participantFriend.id !== ownerLocalFriend.id) {
          transformedParticipants.push({
            expense_id: exp.id,
            friend_id: participantFriend.id,
            amount_owed: Number(p.amount_owed),
            amount_paid: Number(p.amount_paid),
            receipt_url: p.receipt_url || null,
            friend: participantFriend,
          });
        }
      }
    }

    return {
      ...exp,
      user_id: userId,
      original_owner_id: exp.user_id,
      created_by_user_id: exp.user_id,
      is_creator: false,
      paid_by_friend_id: transformedPaidByFriendId,
      paidByFriend: transformedPaidByFriend,
      self_amount_owed: myOwed,
      self_amount_paid: myPaid,
      self_receipt_url: myPart?.receipt_url || null,
      participants: transformedParticipants,
    };
  }

  // 1. Listar todas as despesas do utilizador (próprias e compartilhadas por amigos via telefone)
  static async listExpenses(
    userId: string,
    existingReverseContext?: Awaited<ReturnType<typeof FriendService.syncReverseLinks>>
  ) {
    const reverseContext = existingReverseContext || (await FriendService.syncReverseLinks(userId));
    const { reverseFriendIds } = reverseContext;
    const reverseSet = new Set(reverseFriendIds);

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
          select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true },
        },
        participants: {
          include: {
            friend: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            created_by: true,
            members: {
              select: { user_id: true, friend_id: true, status: true },
            },
          },
        },
        paidByFriend: true,
      },
      orderBy: { expense_date: 'desc' },
    });

    const filteredExpenses = expenses.filter((exp) => {
      if (exp.user_id === userId) return true;
      const isDirectParticipantOrPayer =
        Boolean(exp.paid_by_friend_id && reverseSet.has(exp.paid_by_friend_id)) ||
        (exp.participants || []).some((p) => reverseSet.has(p.friend_id));
      if (isDirectParticipantOrPayer) return true;
      if (!exp.group_id || !exp.group) return true;
      if (exp.group.created_by === userId) return true;
      return exp.group.members.some(
        (m) =>
          (m.user_id === userId || (m.friend_id && reverseSet.has(m.friend_id))) &&
          m.status === 'ACCEPTED'
      );
    });

    const transformed = [];
    for (const exp of filteredExpenses) {
      transformed.push(await this.transformExpenseForUser(exp, userId, reverseContext));
    }

    return transformed;
  }

  /**
   * Garante vínculo de amizade aceito e amigo reverso criado quando um usuário inclui outro em um racha
   */
  private static async ensureParticipantLink(
    creator: { id: string; name: string; phone: string | null; pix_key: string | null; avatar_url?: string | null },
    targetUser: { id: string; name: string; phone: string | null }
  ) {
    try {
      const existingReq = await prisma.friendshipRequest.findFirst({
        where: {
          OR: [
            { sender_id: creator.id, receiver_id: targetUser.id },
            { sender_id: targetUser.id, receiver_id: creator.id },
          ],
        },
      });

      if (existingReq) {
        if (existingReq.status !== 'ACCEPTED') {
          await prisma.friendshipRequest.update({
            where: { id: existingReq.id },
            data: { status: 'ACCEPTED' },
          });
        }
      } else {
        await prisma.friendshipRequest.create({
          data: {
            sender_id: creator.id,
            receiver_id: targetUser.id,
            status: 'ACCEPTED',
          },
        });
      }

      if (creator.phone) {
        const targetFriends = await prisma.friend.findMany({
          where: { user_id: targetUser.id },
        });
        const hasCreator = targetFriends.some(
          (f) => f.phone && phonesMatch(f.phone, creator.phone)
        );
        if (!hasCreator) {
          await prisma.friend.create({
            data: {
              user_id: targetUser.id,
              name: creator.name.trim() || 'Amigo',
              phone: normalizePhoneBackend(creator.phone) || null,
              pix_key: creator.pix_key?.trim() || null,
              avatar_url: creator.avatar_url || null,
              color: 'bg-teal-500',
              is_favorite: false,
            },
          });
        }
      }
    } catch (err) {
      console.warn('Aviso ao garantir vínculo de participante:', err);
    }
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
    if (data.id) {
      const existing = await prisma.expense.findUnique({ where: { id: data.id } });
      if (existing) {
        return this.updateExpense(data.userId, data.id, data);
      }
    }

    let validGroupId: string | null = data.groupId || null;
    if (validGroupId) {
      const grpExists = await prisma.group.findUnique({
        where: { id: validGroupId },
        select: { id: true },
      });
      if (!grpExists) {
        validGroupId = null;
      }
    }

    let rawParticipantIds = Array.from(new Set(data.participantIds || []));

    // Se tiver groupId mas participantIds veio vazio, puxa os membros do grupo automaticamente
    if (rawParticipantIds.length === 0 && validGroupId) {
      const grpMembers = await prisma.groupMember.findMany({
        where: { group_id: validGroupId, friend_id: { not: null } },
      });
      rawParticipantIds = grpMembers
        .map((m) => m.friend_id!)
        .filter(Boolean);
    }

    const userFriends = await prisma.friend.findMany({
      where: { user_id: data.userId },
    });
    const validFriendSet = new Set(userFriends.map((f) => f.id));

    const uniqueParticipantIds = rawParticipantIds.filter((id) => validFriendSet.has(id));
    if (uniqueParticipantIds.length === 0 && rawParticipantIds.length > 0 && userFriends.length === 1) {
      // Fallback caso o único amigo local tenha sido deduplicado com novo ID no servidor
      uniqueParticipantIds.push(userFriends[0].id);
    }

    if (uniqueParticipantIds.length === 0) {
      throw new Error('A despesa precisa ter pelo menos um participante.');
    }

    const totalPeople = uniqueParticipantIds.length + 1;
    const defaultSplitAmount = Number((Number(data.totalAmount) / totalPeople).toFixed(2));
    const selfOwed =
      data.selfAmountOwed !== undefined
        ? Number(Number(data.selfAmountOwed).toFixed(2))
        : defaultSplitAmount;

    const parsedDate = data.expenseDate ? new Date(data.expenseDate) : new Date();
    const paidByFriendId =
      data.paidByFriendId && validFriendSet.has(data.paidByFriendId)
        ? data.paidByFriendId
        : null;

    const expense = await prisma.expense.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        user_id: data.userId,
        group_id: validGroupId,
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

    // Vincula e notifica os participantes cadastrados no RachApp
    (async () => {
      try {
        const creator = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true },
        });
        const creatorName = creator?.name || 'Um amigo';
        const allUsers = await prisma.user.findMany({
          select: { id: true, name: true, phone: true },
        });

        for (const p of expense.participants) {
          const friendPhone = p.friend?.phone;
          if (!friendPhone) continue;

          const targetUser = allUsers.find(
            (u) => u.id !== data.userId && phonesMatch(u.phone, friendPhone)
          );

          if (targetUser) {
            if (creator) {
              await this.ensureParticipantLink(creator, targetUser);
            }

            const amountOwedNum = Number(p.amount_owed);
            const formatted = amountOwedNum.toFixed(2).replace('.', ',');
            await NotificationService.createNotification({
              userId: targetUser.id,
              type: 'EXPENSE_ADDED',
              title: 'Novo racha adicionado',
              message: `${creatorName} adicionou você ao racha "${expense.title}" (sua parte: R$ ${formatted})`,
              data: {
                expenseId: expense.id,
                groupId: expense.group_id,
                amount: amountOwedNum,
              },
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao disparar notificações de nova despesa:', err);
      }
    })();

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

    if (existing.user_id !== userId) {
      throw new Error('Apenas o criador do racha pode editá-lo.');
    }

    const totalAmount =
      data.totalAmount !== undefined ? Number(data.totalAmount) : Number(existing.total_amount);

    const userFriends = await prisma.friend.findMany({
      where: { user_id: userId },
    });
    const validFriendSet = new Set(userFriends.map((f) => f.id));

    const rawParticipantIds = data.participantIds
      ? Array.from(new Set(data.participantIds))
      : existing.participants.map((p) => p.friend_id);

    const participantIds = rawParticipantIds.filter((id) => validFriendSet.has(id));
    if (participantIds.length === 0) {
      throw new Error('A despesa precisa ter pelo menos um participante.');
    }

    let validGroupId: string | null | undefined = undefined;
    if (data.groupId !== undefined) {
      if (!data.groupId) {
        validGroupId = null;
      } else {
        const grpExists = await prisma.group.findUnique({
          where: { id: data.groupId },
          select: { id: true },
        });
        validGroupId = grpExists ? data.groupId : null;
      }
    }

    const totalPeople = participantIds.length + 1;
    const defaultSplitAmount = Number((totalAmount / totalPeople).toFixed(2));
    const selfOwed =
      data.selfAmountOwed !== undefined
        ? Number(Number(data.selfAmountOwed).toFixed(2))
        : defaultSplitAmount;

    const rawPaidBy =
      data.paidByFriendId !== undefined ? data.paidByFriendId || null : existing.paid_by_friend_id;
    const paidByFriendId = rawPaidBy && validFriendSet.has(rawPaidBy) ? rawPaidBy : null;

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
        ...(validGroupId !== undefined ? { group_id: validGroupId } : {}),
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

    (async () => {
      try {
        const creator = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true },
        });
        const allUsers = await prisma.user.findMany({
          select: { id: true, name: true, phone: true },
        });
        for (const p of updated.participants) {
          const friendPhone = p.friend?.phone;
          if (!friendPhone) continue;
          const targetUser = allUsers.find(
            (u) => u.id !== userId && phonesMatch(u.phone, friendPhone)
          );
          if (targetUser) {
            if (creator) {
              await this.ensureParticipantLink(creator, targetUser);
            }
            notifySync(targetUser.id, 'EXPENSE_UPDATED');
          }
        }
      } catch (err) {
        console.warn('Erro ao notificar participantes na edição de racha:', err);
      }
    })();

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
      include: {
        participants: {
          include: { friend: true },
        },
      },
    });
    if (!existing) throw new Error('Racha não encontrado.');

    if (existing.user_id !== userId) {
      throw new Error('Apenas o criador do racha pode excluí-lo.');
    }

    const participantPhones = existing.participants
      .map((p) => p.friend?.phone)
      .filter((ph): ph is string => Boolean(ph));

    await prisma.expense.delete({ where: { id: expenseId } });

    if (participantPhones.length > 0) {
      (async () => {
        try {
          const allUsers = await prisma.user.findMany({
            select: { id: true, phone: true },
          });
          for (const ph of participantPhones) {
            const targetUser = allUsers.find(
              (u) => u.id !== userId && phonesMatch(u.phone, ph)
            );
            if (targetUser) {
              notifySync(targetUser.id, 'EXPENSE_DELETED');
            }
          }
        } catch {
          // Ignora erro
        }
      })();
    }
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
          expense.self_amount_owed !== null && expense.self_amount_owed !== undefined && Number(expense.self_amount_owed) > 0
            ? Number(expense.self_amount_owed)
            : ((expense.participants || []).reduce((acc: number, p: any) => acc + Number(p.amount_owed || 0), 0) >= Number(expense.total_amount) - 0.1)
            ? 0
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

        const updatedSelf = await prisma.expense.update({
          where: { id: expenseId },
          data: {
            self_amount_paid: Number(target.toFixed(2)),
            self_receipt_url: target <= 0 ? null : receiptUrl || expense.self_receipt_url || null,
          } as any,
        });

        if (expense.paidByFriend?.phone) {
          (async () => {
            try {
              const allUsers = await prisma.user.findMany({ select: { id: true, phone: true } });
              const targetUser = allUsers.find(
                (u) => u.id !== userId && phonesMatch(u.phone, expense.paidByFriend.phone)
              );
              if (targetUser) {
                notifySync(targetUser.id, 'PAYMENT_UPDATED');
              }
            } catch {
              // ignore
            }
          })();
        }

        return updatedSelf;
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

      const updatedPart = await prisma.expenseParticipant.update({
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

      if (part.friend?.phone) {
        (async () => {
          try {
            const allUsers = await prisma.user.findMany({ select: { id: true, phone: true } });
            const targetUser = allUsers.find(
              (u) => u.id !== userId && phonesMatch(u.phone, part.friend.phone)
            );
            if (targetUser) {
              notifySync(targetUser.id, 'PAYMENT_UPDATED');
            }
          } catch {
            // ignore
          }
        })();
      }

      return updatedPart;
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

      const updatedPart = await prisma.expenseParticipant.update({
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

      // Notifica o credor (dono da despesa) sobre o pagamento
      if (expense.owner?.id) {
        if (targetAmount > 0) {
          (async () => {
            try {
              const payer = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true },
              });
              const payerName = payer?.name || 'Um amigo';
              const formatted = targetAmount.toFixed(2).replace('.', ',');
              await NotificationService.createNotification({
                userId: expense.owner.id,
                type: 'PAYMENT_RECEIVED',
                title: 'Pagamento recebido',
                message: `${payerName} registrou o pagamento de R$ ${formatted} no racha "${expense.title}"`,
                data: {
                  expenseId: expense.id,
                  amount: targetAmount,
                  receiptUrl: receiptUrl || myPart.receipt_url || null,
                },
              });
            } catch (err) {
              console.warn('Erro ao notificar dono sobre pagamento:', err);
            }
          })();
        } else {
          notifySync(expense.owner.id, 'PAYMENT_UPDATED');
        }
      }

      return updatedPart;
    }

    if (!iAmCreditor) {
      throw new Error('Apenas quem pagou a conta pode confirmar ou alterar o pagamento de outros participantes.');
    }

    // Se EU fui o pagador na despesa criada pelo meu amigo, e estou quitando a parte dele (owner)
    if (isTargetTheExpenseOwner) {
      const totalParts = expense.participants.length + 1;
      const ownerOwed =
        expense.self_amount_owed !== null && expense.self_amount_owed !== undefined && Number(expense.self_amount_owed) > 0
          ? Number(expense.self_amount_owed)
          : ((expense.participants || []).reduce((acc: number, p: any) => acc + Number(p.amount_owed || 0), 0) >= Number(expense.total_amount) - 0.1)
          ? 0
          : Number(expense.total_amount) / totalParts;
      const targetAmount =
        amountPaid !== undefined ? Math.min(ownerOwed, Math.max(0, Number(amountPaid))) : 0;

      const updatedOwnerExp = await prisma.expense.update({
        where: { id: expenseId },
        data: {
          self_amount_paid: Number(targetAmount.toFixed(2)),
          self_receipt_url: targetAmount <= 0 ? null : receiptUrl || expense.self_receipt_url || null,
        } as any,
      });

      if (expense.owner?.id) {
        notifySync(expense.owner.id, 'PAYMENT_UPDATED');
      }

      return updatedOwnerExp;
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

    const updatedOther = await prisma.expenseParticipant.update({
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

    if (expense.owner?.id) {
      notifySync(expense.owner.id, 'PAYMENT_UPDATED');
    }

    return updatedOther;
  }

  // 6. Calcular Saldos do Grupo e Otimizar Transferências Cruzadas
  static async calculateGroupBalances(
    groupId: string,
    userId?: string,
    existingReverseContext?: Awaited<ReturnType<typeof FriendService.syncReverseLinks>>
  ) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: { select: { id: true, name: true, pix_key: true, phone: true, avatar_url: true } },
        members: {
          include: {
            friend: true,
            user: { select: { id: true, name: true, pix_key: true, phone: true, avatar_url: true } },
          },
        },
        expenses: {
          include: {
            owner: { select: { id: true, name: true, pix_key: true, phone: true, avatar_url: true } },
            participants: { include: { friend: true } },
            paidByFriend: true,
          },
        },
      },
    });

    if (!group) throw new Error('Grupo não encontrado.');

    const effectiveUserId = userId || group.created_by;
    const reverseContext =
      existingReverseContext && effectiveUserId === userId
        ? existingReverseContext
        : await FriendService.syncReverseLinks(effectiveUserId);
    const currentUser = reverseContext.currentUser;
    const ownerKey = `user:${effectiveUserId}`;

    const entityMeta: Record<
      string,
      { id: string; name: string; phone?: string | null; pix_key?: string | null; avatar_url?: string | null; color: string; isOwner?: boolean }
    > = {
      [ownerKey]: {
        id: effectiveUserId,
        name: currentUser?.name || group.owner?.name || 'Você',
        phone: currentUser?.phone || group.owner?.phone,
        pix_key: currentUser?.pix_key || group.owner?.pix_key,
        avatar_url: (currentUser as any)?.avatar_url || (group.owner as any)?.avatar_url || null,
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
        avatar_url: (ownerLocal as any).avatar_url || (group.owner as any).avatar_url || null,
        color: ownerLocal.color || 'bg-teal-500',
      };
    }

    const reverseSet = new Set(reverseContext.reverseFriendIds);

    for (const m of group.members) {
      const friendObj = m.friend;
      if (friendObj && !reverseSet.has(friendObj.id)) {
        const localMatch: any =
          group.created_by === effectiveUserId
            ? friendObj
            : (friendObj.phone
                ? reverseContext.myFriends.find((mf) => mf.phone && phonesMatch(mf.phone, friendObj.phone))
                : null) || friendObj;
        entityMeta[localMatch.id] = {
          id: localMatch.id,
          name: localMatch.name,
          phone: localMatch.phone,
          pix_key: localMatch.pix_key,
          avatar_url: localMatch.avatar_url || (friendObj as any).avatar_url || null,
          color: localMatch.color || 'bg-sky-500',
        };
      }
    }

    const netBalances: Record<string, number> = { [ownerKey]: 0 };
    const memberPendingCount: Record<string, number> = {};
    const memberOwesOwner: Record<string, number> = {};
    const pairwiseDebts: Record<string, Record<string, number>> = {};

    const addPairwiseDebt = (from: string, to: string, amount: number) => {
      if (!from || !to || from === to || amount <= 0.005) return;
      if (!pairwiseDebts[from]) pairwiseDebts[from] = {};
      pairwiseDebts[from][to] = (pairwiseDebts[from][to] || 0) + amount;
    };

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
            addPairwiseDebt(part.friend_id, ownerKey, pending);
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
            addPairwiseDebt(part.friend_id, payerFriendId, pending);
          }
        });

        const selfOwed =
          exp.self_amount_owed !== null && exp.self_amount_owed !== undefined && Number(exp.self_amount_owed) > 0
            ? Number(exp.self_amount_owed)
            : ((exp.participants || []).reduce((acc: number, p: any) => acc + Number(p.amount_owed || 0), 0) >= Number(exp.total_amount) - 0.1)
            ? 0
            : Number(exp.total_amount) / (exp.participants.length + 1);
        const selfPaid = Number(exp.self_amount_paid || 0);
        const selfPending = selfOwed - selfPaid;

        if (selfPending > 0.005) {
          netBalances[payerFriendId] = (netBalances[payerFriendId] || 0) + selfPending;
          netBalances[ownerKey] = (netBalances[ownerKey] || 0) - selfPending;
          addPairwiseDebt(ownerKey, payerFriendId, selfPending);
        }
      }
    }

    // Calcula dívida líquida direta entre cada membro e Você
    for (const key of Object.keys(entityMeta)) {
      if (key === ownerKey) continue;
      const debtMemberToOwner = pairwiseDebts[key]?.[ownerKey] || 0;
      const debtOwnerToMember = pairwiseDebts[ownerKey]?.[key] || 0;
      memberOwesOwner[key] = Number((debtMemberToOwner - debtOwnerToMember).toFixed(2));
    }

    const transfers = this.calculateDirectTransfers(pairwiseDebts, entityMeta);

    const memberBalances = Object.entries(entityMeta)
      .filter(([key]) => key !== ownerKey)
      .map(([key, meta]) => ({
        friendId: meta.id,
        name: meta.name,
        phone: meta.phone,
        pix_key: meta.pix_key,
        avatar_url: meta.avatar_url || null,
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

  // 7. Cálculo de Rotas Diretas entre Membros do Grupo (Sem triangulações artificiais)
  private static calculateDirectTransfers(
    pairwiseDebts: Record<string, Record<string, number>>,
    entityMeta: Record<
      string,
      { id: string; name: string; phone?: string | null; pix_key?: string | null; color: string; isOwner?: boolean }
    >
  ): Transfer[] {
    const transfers: Transfer[] = [];
    const keys = Object.keys(entityMeta);

    for (let a = 0; a < keys.length; a++) {
      for (let b = a + 1; b < keys.length; b++) {
        const keyA = keys[a];
        const keyB = keys[b];

        const debtAtoB = pairwiseDebts[keyA]?.[keyB] || 0;
        const debtBtoA = pairwiseDebts[keyB]?.[keyA] || 0;
        const net = Number((debtAtoB - debtBtoA).toFixed(2));

        if (Math.abs(net) < 0.01) continue;

        const fromKey = net > 0 ? keyA : keyB;
        const toKey = net > 0 ? keyB : keyA;
        const amount = Math.abs(net);

        const fromMeta = entityMeta[fromKey] || { id: fromKey, name: 'Participante', color: 'bg-gray-600' };
        const toMeta = entityMeta[toKey] || { id: toKey, name: 'Credor', color: 'bg-teal-500' };

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
          amount,
        });
      }
    }

    transfers.sort((t1, t2) => t2.amount - t1.amount);
    return transfers;
  }

  // 8. Registar o pagamento de um amigo e abater nas despesas mais antigas
  static async registerPayment(
    creditorId: string,
    debtorFriendId: string,
    amount: number,
    groupId?: string,
    receiptUrl?: string | null,
    direction?: 'to_friend' | 'from_friend'
  ) {
    const allExpenses = await this.listExpenses(creditorId);
    const filtered = allExpenses
      .filter((e) => !groupId || e.group_id === groupId)
      .sort((a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime());

    let remainingAmount = Number(amount);

    let effectiveDirection = direction;
    if (!effectiveDirection) {
      let divida = 0;
      let voceDeve = 0;
      for (const expense of filtered) {
        if (!expense.paid_by_friend_id) {
          const part = (expense.participants || []).find((p: any) => p.friend_id === debtorFriendId);
          if (part) {
            const pending = Number(part.amount_owed) - Number(part.amount_paid);
            if (pending > 0.005) divida += pending;
          }
        } else if (expense.paid_by_friend_id === debtorFriendId) {
          const totalParts = (expense.participants?.length || 0) + 1;
          const selfOwed =
            expense.self_amount_owed !== null && expense.self_amount_owed !== undefined && Number(expense.self_amount_owed) > 0
              ? Number(expense.self_amount_owed)
              : ((expense.participants || []).reduce((acc: number, p: any) => acc + Number(p.amount_owed || 0), 0) >= Number(expense.total_amount) - 0.1)
              ? 0
              : Number(expense.total_amount) / totalParts;
          const selfPaid = Number(expense.self_amount_paid || 0);
          const pending = selfOwed - selfPaid;
          if (pending > 0.005) voceDeve += pending;
        }
      }
      effectiveDirection = voceDeve > divida ? 'to_friend' : 'from_friend';
    }

    if (effectiveDirection === 'to_friend') {
      // VOCÊ ESTÁ PAGANDO O AMIGO:
      // Abate nas despesas em que o amigo pagou e Você devia para ele
      for (const expense of filtered) {
        if (remainingAmount <= 0.005) break;
        if (expense.paid_by_friend_id !== debtorFriendId) continue;

        const totalParts = (expense.participants?.length || 0) + 1;
        const selfOwed =
          expense.self_amount_owed !== null && expense.self_amount_owed !== undefined && Number(expense.self_amount_owed) > 0
            ? Number(expense.self_amount_owed)
            : ((expense.participants || []).reduce((acc: number, p: any) => acc + Number(p.amount_owed || 0), 0) >= Number(expense.total_amount) - 0.1)
            ? 0
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
    } else {
      // O AMIGO ESTÁ PAGANDO VOCÊ:
      // Abate nas despesas em que Você pagou e o amigo devia para Você
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
    }

    // Dispara notificação e auto-sync para a outra ponta do pagamento
    (async () => {
      try {
        const debtorFriend = await prisma.friend.findUnique({
          where: { id: debtorFriendId },
          select: { phone: true, name: true },
        });

        if (debtorFriend?.phone) {
          const allUsers = await prisma.user.findMany({
            select: { id: true, name: true, phone: true },
          });
          const targetUser = allUsers.find(
            (u) => u.id !== creditorId && phonesMatch(u.phone, debtorFriend.phone)
          );

          if (targetUser) {
            const payer = await prisma.user.findUnique({
              where: { id: creditorId },
              select: { name: true },
            });
            const payerName = payer?.name || 'Um amigo';
            const formatted = Number(amount).toFixed(2).replace('.', ',');

            if (effectiveDirection === 'to_friend') {
              // Creditor pagou o amigo (targetUser recebeu)
              await NotificationService.createNotification({
                userId: targetUser.id,
                type: 'PAYMENT_RECEIVED',
                title: 'Pagamento recebido',
                message: `${payerName} registrou um pagamento de R$ ${formatted} para você`,
                data: { amount: Number(amount) },
              });
            } else {
              // Creditor deu baixa no pagamento que o amigo fez
              notifySync(targetUser.id, 'PAYMENT_CONFIRMED');
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao notificar no registerPayment:', err);
      }
    })();

    return { message: 'Pagamento registado e dívidas atualizadas com sucesso.' };
  }

  // 9. Resumo do Dashboard (Home)
  static async getDashboard(
    userId: string,
    existingReverseContext?: Awaited<ReturnType<typeof FriendService.syncReverseLinks>>,
    preloadedExpenses?: any[],
    preloadedFriends?: any[]
  ) {
    const reverseContext = existingReverseContext || (await FriendService.syncReverseLinks(userId));
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allExpenses = preloadedExpenses || (await this.listExpenses(userId, reverseContext));
    const totalGasto = allExpenses
      .filter((e) => new Date(e.expense_date) >= startOfMonth)
      .reduce((acc, e) => acc + Number(e.total_amount || 0), 0);

    const friends =
      preloadedFriends || (await FriendService.getAll(userId, reverseContext, allExpenses));

    let totalAReceber = 0;
    let totalAPagar = 0;
    const amigosDevedores: any[] = [];

    friends.forEach((friend: any) => {
      const divida = Number(friend.divida || 0);
      const voceDeve = Number(friend.voceDeve || 0);
      const saldoLiquido = Number((divida - voceDeve).toFixed(2));

      if (saldoLiquido > 0.01) {
        totalAReceber += saldoLiquido;
      } else if (saldoLiquido < -0.01) {
        totalAPagar += Math.abs(saldoLiquido);
      }

      if (Math.abs(saldoLiquido) > 0.01) {
        amigosDevedores.push({
          ...friend,
          divida: saldoLiquido > 0.01 ? saldoLiquido : 0,
          voceDeve: saldoLiquido < -0.01 ? Math.abs(saldoLiquido) : 0,
          saldoLiquido,
        });
      }
    });

    const { reverseFriendIds } = reverseContext;
    const userGroups = await prisma.group.findMany({
      where: {
        OR: [
          { created_by: userId },
          { members: { some: { user_id: userId, status: 'ACCEPTED' } } },
          ...(reverseFriendIds.length > 0
            ? [{ members: { some: { friend_id: { in: reverseFriendIds }, status: 'ACCEPTED' } } }]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        avatar_url: true,
        created_by: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const gruposPendentes: any[] = [];
    for (const g of userGroups) {
      try {
        const bal = await this.calculateGroupBalances(g.id, userId, reverseContext);
        const userNet = Number(bal.userNetBalance || 0);
        const memberBalances = bal.memberBalances || [];

        const totalAReceberGrupo = memberBalances.reduce(
          (acc, m) => (m.owesYou > 0.01 ? acc + m.owesYou : acc),
          0
        );
        const totalAPagarGrupo = memberBalances.reduce(
          (acc, m) => (m.owesYou < -0.01 ? acc + Math.abs(m.owesYou) : acc),
          0
        );

        let saldoLiquido = Number(userNet.toFixed(2));
        if (Math.abs(saldoLiquido) <= 0.01) {
          if (totalAPagarGrupo > 0.01) {
            saldoLiquido = -Number(totalAPagarGrupo.toFixed(2));
          } else if (totalAReceberGrupo > 0.01) {
            saldoLiquido = Number(totalAReceberGrupo.toFixed(2));
          }
        }

        if (Math.abs(saldoLiquido) > 0.01) {
          gruposPendentes.push({
            ...g,
            nome: g.name,
            ...bal,
            divida: saldoLiquido > 0.01 ? saldoLiquido : 0,
            voceDeve: saldoLiquido < -0.01 ? Math.abs(saldoLiquido) : 0,
            saldoLiquido,
          });
        }
      } catch {
        // ignore
      }
    }

    return {
      totalGasto: Number(totalGasto.toFixed(2)),
      totalAReceber: Number(totalAReceber.toFixed(2)),
      totalAPagar: Number(totalAPagar.toFixed(2)),
      amigosDevedores,
      gruposPendentes,
    };
  }
}

// src/services/Friend.service.ts
import { prisma } from '../config/db';
import { normalizePhoneBackend, phonesMatch } from './Auth.service';

export class FriendService {
  /**
   * Sincroniza vínculos reversos pelo número de telefone:
   * Se outro usuário (User B) cadastrou o usuário atual (User A) como amigo usando o telefone de User A,
   * encontra todos os registros Friend que apontam para User A (reverseFriendIds) e garante que User B
   * também exista na lista de amigos de User A, APENAS SE A AMIZADE FOI ACEITA.
   */
  static async syncReverseLinks(userId: string) {
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    let myFriends = await prisma.friend.findMany({ where: { user_id: userId } });

    // Deduplica amigos locais que tenham o mesmo telefone para evitar listas duplicadas
    const seenPhones = new Map<string, string>();
    const toDeleteIds: string[] = [];
    for (const f of myFriends) {
      const norm = normalizePhoneBackend(f.phone);
      if (norm) {
        if (seenPhones.has(norm)) {
          const keepId = seenPhones.get(norm)!;
          await prisma.expenseParticipant.updateMany({
            where: { friend_id: f.id },
            data: { friend_id: keepId },
          });
          await prisma.expense.updateMany({
            where: { paid_by_friend_id: f.id },
            data: { paid_by_friend_id: keepId },
          });
          await prisma.groupMember.deleteMany({
            where: { friend_id: f.id },
          });
          toDeleteIds.push(f.id);
        } else {
          seenPhones.set(norm, f.id);
        }
      }
    }
    if (toDeleteIds.length > 0) {
      await prisma.friend.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
      myFriends = myFriends.filter((f) => !toDeleteIds.includes(f.id));
    }

    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, phone: true, pix_key: true },
    });

    // Enriquece e atualiza amigos locais com a chave Pix do usuário cadastrado (priorizando o que ele cadastrou para si)
    for (let i = 0; i < myFriends.length; i++) {
      const mf = myFriends[i];
      if (mf.phone) {
        const regUser = allUsers.find((u) => u.id !== userId && phonesMatch(u.phone, mf.phone));
        const regPix = regUser?.pix_key?.trim();
        if (regPix && regPix !== mf.pix_key) {
          const updated = await prisma.friend.update({
            where: { id: mf.id },
            data: { pix_key: regPix },
          });
          myFriends[i] = updated;
        }
      }
    }

    const ensureLocalFriendForOwner = async (ownerUser: {
      id: string;
      name: string;
      phone?: string | null;
      pix_key?: string | null;
    }) => {
      const normOwnerPhone = normalizePhoneBackend(ownerUser.phone);
      const cleanOwnerPix = ownerUser.pix_key?.trim() || null;
      let existing = myFriends.find(
        (f) =>
          (normOwnerPhone && phonesMatch(f.phone, normOwnerPhone)) ||
          (!f.phone && f.name.trim().toLowerCase() === ownerUser.name.trim().toLowerCase())
      );

      if (existing) {
        const needsPhone = !existing.phone && normOwnerPhone;
        const needsPix = cleanOwnerPix && existing.pix_key !== cleanOwnerPix;
        if (needsPhone || needsPix) {
          existing = await prisma.friend.update({
            where: { id: existing.id },
            data: {
              ...(needsPhone ? { phone: normOwnerPhone } : {}),
              ...(cleanOwnerPix && needsPix ? { pix_key: cleanOwnerPix } : {}),
            },
          });
          myFriends = myFriends.map((f) => (f.id === existing!.id ? existing! : f));
        }
        return existing;
      }

      const created = await prisma.friend.create({
        data: {
          user_id: userId,
          name: ownerUser.name.trim() || 'Amigo',
          phone: normOwnerPhone || null,
          pix_key: cleanOwnerPix,
          color: 'bg-teal-500',
          is_favorite: false,
        },
      });
      myFriends.push(created);
      return created;
    };

    if (!currentUser || !currentUser.phone) {
      return {
        currentUser,
        myFriends,
        reverseFriends: [],
        reverseFriendIds: [] as string[],
        ensureLocalFriendForOwner,
      };
    }

    // Busca solicitações de amizade já aceitas
    const acceptedRequests = await prisma.friendshipRequest.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ sender_id: userId }, { receiver_id: userId }],
      },
    });

    const acceptedUserIds = new Set<string>();
    for (const req of acceptedRequests) {
      acceptedUserIds.add(req.sender_id === userId ? req.receiver_id : req.sender_id);
    }

    const otherFriendsWithPhone = await prisma.friend.findMany({
      where: {
        user_id: { not: userId },
        phone: { not: null },
      },
      include: {
        user: {
          select: { id: true, name: true, phone: true, pix_key: true },
        },
      },
    });

    // Compatibilidade reversa: se ambos os usuários já se adicionaram mutuamente no passado, considera aceito
    for (const of of otherFriendsWithPhone) {
      if (phonesMatch(of.phone, currentUser.phone) && !acceptedUserIds.has(of.user_id)) {
        const iAlreadyAddedThem = myFriends.some(
          (mf) => mf.phone && phonesMatch(mf.phone, of.user.phone)
        );
        if (iAlreadyAddedThem) {
          acceptedUserIds.add(of.user_id);
          await prisma.friendshipRequest.upsert({
            where: {
              sender_id_receiver_id: {
                sender_id: of.user_id,
                receiver_id: userId,
              },
            },
            update: { status: 'ACCEPTED' },
            create: {
              sender_id: of.user_id,
              receiver_id: userId,
              status: 'ACCEPTED',
            },
          });
        }
      }
    }

    // Apenas amigos com amizade ACEITA entram nos vínculos reversos e nos rachas compartilhados!
    const reverseFriends = otherFriendsWithPhone.filter(
      (f) => phonesMatch(f.phone, currentUser.phone) && acceptedUserIds.has(f.user_id)
    );
    const reverseFriendIds = reverseFriends.map((f) => f.id);

    // Garante que todo usuário que é meu amigo aceito também esteja na minha lista de amigos
    for (const rf of reverseFriends) {
      if (rf.user && rf.user.id !== userId) {
        await ensureLocalFriendForOwner(rf.user);
      }
    }

    return {
      currentUser,
      myFriends,
      reverseFriends,
      reverseFriendIds,
      ensureLocalFriendForOwner,
    };
  }

  static async create(
    userId: string,
    data: {
      id?: string;
      name?: string;
      nome?: string;
      phone?: string;
      telefone?: string;
      pix_key?: string;
      pix?: string;
      color?: string;
      cor?: string;
      is_favorite?: boolean;
      favorito?: boolean;
    }
  ) {
    const name = (data.name || data.nome || '').trim();
    if (!name) throw new Error('O nome do amigo é obrigatório.');

    const rawPhone = (data.phone ?? data.telefone ?? '').trim();
    const normPhone = normalizePhoneBackend(rawPhone);
    if (rawPhone && normPhone.length !== 10 && normPhone.length !== 11) {
      throw new Error('Número de telefone inválido. Informe o DDD + Número.');
    }
    const phone = normPhone || null;

    let pix_key = (data.pix_key ?? data.pix ?? '').trim() || null;
    const color = data.color || data.cor || 'bg-sky-500';
    const is_favorite = data.is_favorite ?? data.favorito ?? false;

    // Se o telefone pertencer a um usuário já cadastrado, prioriza a chave Pix que ele cadastrou para si
    let registeredUser: any = null;
    if (phone) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, phone: true, pix_key: true },
      });
      registeredUser = allUsers.find((u) => phonesMatch(u.phone, phone));
      const registeredPix = registeredUser?.pix_key?.trim();
      if (registeredPix) {
        pix_key = registeredPix;
      }
    }

    // Se o amigo adicionado for um usuário cadastrado no RachApp (e não eu mesmo):
    if (registeredUser && registeredUser.id !== userId) {
      const existingReq = await prisma.friendshipRequest.findFirst({
        where: {
          OR: [
            { sender_id: userId, receiver_id: registeredUser.id },
            { sender_id: registeredUser.id, receiver_id: userId },
          ],
        },
      });

      if (existingReq) {
        if (existingReq.sender_id === registeredUser.id && existingReq.status === 'PENDING') {
          // O outro usuário já havia enviado solicitação pendente; ao adicioná-lo de volta, aceita automaticamente!
          await prisma.friendshipRequest.update({
            where: { id: existingReq.id },
            data: { status: 'ACCEPTED' },
          });
        } else if (existingReq.status === 'REJECTED') {
          await prisma.friendshipRequest.update({
            where: { id: existingReq.id },
            data: { sender_id: userId, receiver_id: registeredUser.id, status: 'PENDING' },
          });
        }
      } else {
        await prisma.friendshipRequest.create({
          data: {
            sender_id: userId,
            receiver_id: registeredUser.id,
            status: 'PENDING',
          },
        });
      }
    }

    if (data.id) {
      const existing = await prisma.friend.findUnique({ where: { id: data.id } });
      if (existing && existing.user_id === userId) {
        return prisma.friend.update({
          where: { id: data.id },
          data: { name, phone, pix_key, color, is_favorite },
        });
      }
    }

    // Se já existir um amigo deste usuário com o mesmo telefone normalizado, evita duplicata
    if (phone) {
      const allFriends = await prisma.friend.findMany({ where: { user_id: userId } });
      const samePhoneFriend = allFriends.find((f) => f.phone && phonesMatch(f.phone, phone));
      if (samePhoneFriend) {
        return prisma.friend.update({
          where: { id: samePhoneFriend.id },
          data: {
            name,
            phone,
            ...(pix_key ? { pix_key } : {}),
            color,
          },
        });
      }
    }

    return prisma.friend.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        user_id: userId,
        name,
        phone,
        pix_key,
        color,
        is_favorite,
      },
    });
  }

  static async listPendingRequests(userId: string) {
    const requests = await prisma.friendshipRequest.findMany({
      where: {
        receiver_id: userId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: { id: true, name: true, phone: true, pix_key: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return requests.map((r) => ({
      id: r.id,
      sender_id: r.sender_id,
      receiver_id: r.receiver_id,
      status: r.status,
      created_at: r.created_at,
      sender: {
        id: r.sender.id,
        name: r.sender.name,
        phone: r.sender.phone,
        pix_key: r.sender.pix_key,
        color: 'bg-teal-500',
      },
    }));
  }

  static async acceptRequest(userId: string, requestId: string) {
    const request = await prisma.friendshipRequest.findFirst({
      where: {
        id: requestId,
        receiver_id: userId,
      },
      include: {
        sender: { select: { id: true, name: true, phone: true, pix_key: true } },
        receiver: { select: { id: true, name: true, phone: true, pix_key: true } },
      },
    });

    if (!request) {
      throw new Error('Solicitação de amizade não encontrada.');
    }

    await prisma.friendshipRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' },
    });

    // Garante que o receptor (userId) tenha o remetente na sua lista de amigos
    const myFriends = await prisma.friend.findMany({ where: { user_id: userId } });
    const hasSender = myFriends.some(
      (f) => f.phone && phonesMatch(f.phone, request.sender.phone)
    );

    if (!hasSender) {
      await prisma.friend.create({
        data: {
          user_id: userId,
          name: request.sender.name,
          phone: normalizePhoneBackend(request.sender.phone) || null,
          pix_key: request.sender.pix_key || null,
          color: 'bg-emerald-500',
          is_favorite: false,
        },
      });
    }

    // Garante que o remetente também tenha o receptor na lista de amigos dele
    const senderFriends = await prisma.friend.findMany({ where: { user_id: request.sender_id } });
    const hasReceiver = senderFriends.some(
      (f) => f.phone && phonesMatch(f.phone, request.receiver.phone)
    );

    if (!hasReceiver) {
      await prisma.friend.create({
        data: {
          user_id: request.sender_id,
          name: request.receiver.name,
          phone: normalizePhoneBackend(request.receiver.phone) || null,
          pix_key: request.receiver.pix_key || null,
          color: 'bg-teal-500',
          is_favorite: false,
        },
      });
    }

    return { message: 'Amizade confirmada com sucesso!' };
  }

  static async rejectRequest(userId: string, requestId: string) {
    const request = await prisma.friendshipRequest.findFirst({
      where: {
        id: requestId,
        receiver_id: userId,
      },
    });

    if (!request) {
      throw new Error('Solicitação de amizade não encontrada.');
    }

    await prisma.friendshipRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
    });

    return { message: 'Solicitação recusada com sucesso.' };
  }

  static async getAll(userId: string) {
    await this.syncReverseLinks(userId);

    const friends = await prisma.friend.findMany({
      where: { user_id: userId },
      include: {
        expenses: {
          include: {
            expense: true,
          },
        },
      },
      orderBy: [{ is_favorite: 'desc' }, { name: 'asc' }],
    });

    // Busca também despesas em que o amigo foi o pagador (ou criador reverso) para calcular saldo completo
    const { ExpenseService } = await import('./Expense.service');
    const allUserExpenses = await ExpenseService.listExpenses(userId);

    // Mapeia todos os usuários para priorizar a chave Pix que o amigo cadastrou para si
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, phone: true, pix_key: true },
    });

    return friends.map((friend) => {
      let divida = 0; // Quanto o amigo deve para Você
      let voceDeve = 0; // Quanto Você deve para o amigo

      for (const exp of allUserExpenses) {
        const part = exp.participants?.find((p: any) => p.friend_id === friend.id);
        if (!exp.paid_by_friend_id) {
          // Você pagou: amigo te deve a parte dele
          if (part) {
            const pending = Number(part.amount_owed) - Number(part.amount_paid);
            if (pending > 0.005) divida += pending;
          }
        } else if (exp.paid_by_friend_id === friend.id) {
          // Este amigo pagou: Você deve a sua parte para ele
          const totalParts = (exp.participants?.length || 0) + 1;
          const selfOwed =
            Number(exp.self_amount_owed) > 0
              ? Number(exp.self_amount_owed)
              : Number(exp.total_amount) / totalParts;
          const selfPaid = Number(exp.self_amount_paid || 0);
          const selfPending = selfOwed - selfPaid;
          if (selfPending > 0.005) voceDeve += selfPending;
        }
      }

      // Prioriza a chave Pix que o próprio amigo cadastrou na conta dele e detecta se possui conta no RachApp
      let effectivePixKey = (friend.pix_key || '').trim();
      let hasAccount = false;
      let registeredUserId: string | null = null;
      if (friend.phone) {
        const regUser = allUsers.find(
          (u) => u.id !== userId && phonesMatch(u.phone, friend.phone)
        );
        if (regUser) {
          hasAccount = true;
          registeredUserId = regUser.id;
          const regPix = regUser.pix_key?.trim();
          if (regPix) {
            effectivePixKey = regPix;
          }
        }
      }

      const { expenses, ...friendData } = friend;
      return {
        ...friendData,
        pix_key: effectivePixKey,
        registered_pix_key: effectivePixKey,
        has_account: hasAccount,
        is_registered: hasAccount,
        registered_user_id: registeredUserId,
        divida: Number(divida.toFixed(2)),
        voceDeve: Number(voceDeve.toFixed(2)),
      };
    });
  }

  static async update(
    userId: string,
    friendId: string,
    data: {
      name?: string;
      nome?: string;
      phone?: string;
      telefone?: string;
      pix_key?: string;
      pix?: string;
      color?: string;
      cor?: string;
      is_favorite?: boolean;
      favorito?: boolean;
    }
  ) {
    const friend = await prisma.friend.findFirst({
      where: { id: friendId, user_id: userId },
    });
    if (!friend) throw new Error('Amigo não encontrado.');

    const name = (data.name ?? data.nome)?.trim();
    const rawPhone = data.phone !== undefined ? data.phone : data.telefone;
    let phoneToSave: string | null | undefined = undefined;
    if (rawPhone !== undefined) {
      const trimmed = rawPhone.trim();
      if (!trimmed) {
        phoneToSave = null;
      } else {
        const norm = normalizePhoneBackend(trimmed);
        if (norm.length !== 10 && norm.length !== 11) {
          throw new Error('Número de telefone inválido. Informe o DDD + Número.');
        }
        phoneToSave = norm;
      }
    }

    let pix_key = data.pix_key !== undefined ? (data.pix_key ? data.pix_key.trim() : null) : (data.pix ? data.pix.trim() : undefined);
    const color = data.color ?? data.cor;
    const is_favorite = data.is_favorite !== undefined ? data.is_favorite : data.favorito;

    // Se o amigo for um usuário registrado com chave Pix própria, prioriza a chave que ele cadastrou para si
    const targetPhone = phoneToSave !== undefined ? phoneToSave : friend.phone;
    if (targetPhone) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, phone: true, pix_key: true },
      });
      const registered = allUsers.find((u) => u.id !== userId && phonesMatch(u.phone, targetPhone));
      const regPix = registered?.pix_key?.trim();
      if (regPix) {
        pix_key = regPix;
      }
    }

    return prisma.friend.update({
      where: { id: friendId },
      data: {
        ...(name ? { name } : {}),
        ...(phoneToSave !== undefined ? { phone: phoneToSave } : {}),
        ...(pix_key !== undefined ? { pix_key } : {}),
        ...(color ? { color } : {}),
        ...(is_favorite !== undefined ? { is_favorite } : {}),
      },
    });
  }

  static async toggleFavorite(userId: string, friendId: string) {
    const friend = await prisma.friend.findFirst({
      where: { id: friendId, user_id: userId },
    });
    if (!friend) throw new Error('Amigo não encontrado.');

    return prisma.friend.update({
      where: { id: friendId },
      data: { is_favorite: !friend.is_favorite },
    });
  }

  static async delete(userId: string, friendId: string) {
    const friend = await prisma.friend.findFirst({
      where: { id: friendId, user_id: userId },
    });
    if (!friend) throw new Error('Amigo não encontrado.');

    await prisma.friend.delete({ where: { id: friendId } });
  }
}

// src/services/Friend.service.ts
import { prisma } from '../config/db';
import { normalizePhoneBackend, phonesMatch } from './Auth.service';

export class FriendService {
  /**
   * Sincroniza vínculos reversos pelo número de telefone:
   * Se outro usuário (User B) cadastrou o usuário atual (User A) como amigo usando o telefone de User A,
   * encontra todos os registros Friend que apontam para User A (reverseFriendIds) e garante que User B
   * também exista na lista de amigos de User A.
   */
  static async syncReverseLinks(userId: string) {
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    let myFriends = await prisma.friend.findMany({ where: { user_id: userId } });

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

      // ISOLAMENTO DE GRUPOS: Membros/donos de grupo que não são amigos NÃO são inseridos em Friend
      return {
        id: ownerUser.id,
        user_id: userId,
        name: ownerUser.name.trim() || 'Criador do Grupo',
        phone: normOwnerPhone || null,
        pix_key: cleanOwnerPix,
        color: 'bg-teal-500',
        is_favorite: false,
        is_group_only: true,
      } as any;
    };

    const ensureLocalFriendForForeign = async (foreignFriend: {
      id: string;
      name: string;
      phone?: string | null;
      pix_key?: string | null;
      color?: string | null;
    }) => {
      const normPhone = normalizePhoneBackend(foreignFriend.phone);
      const cleanForeignPix = foreignFriend.pix_key?.trim() || null;
      let existing = myFriends.find(
        (f) =>
          (normPhone && phonesMatch(f.phone, normPhone)) ||
          f.name.trim().toLowerCase() === foreignFriend.name.trim().toLowerCase()
      );

      if (existing) {
        const needsPhone = !existing.phone && normPhone;
        const needsPix = cleanForeignPix && existing.pix_key !== cleanForeignPix;
        if (needsPhone || needsPix) {
          existing = await prisma.friend.update({
            where: { id: existing.id },
            data: {
              ...(needsPhone ? { phone: normPhone } : {}),
              ...(cleanForeignPix && needsPix ? { pix_key: cleanForeignPix } : {}),
            },
          });
          myFriends = myFriends.map((f) => (f.id === existing!.id ? existing! : f));
        }
        return existing;
      }

      // ISOLAMENTO DE GRUPOS: Membros de grupo que não são amigos NÃO são inseridos em Friend
      return {
        id: foreignFriend.id,
        user_id: userId,
        name: foreignFriend.name.trim() || 'Membro do Grupo',
        phone: normPhone || null,
        pix_key: cleanForeignPix,
        color: foreignFriend.color || 'bg-sky-500',
        is_favorite: false,
        is_group_only: true,
      } as any;
    };

    if (!currentUser || !currentUser.phone) {
      return {
        currentUser,
        myFriends,
        reverseFriends: [],
        reverseFriendIds: [] as string[],
        ensureLocalFriendForOwner,
        ensureLocalFriendForForeign,
      };
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

    const reverseFriends = otherFriendsWithPhone.filter((f) =>
      phonesMatch(f.phone, currentUser.phone)
    );
    const reverseFriendIds = reverseFriends.map((f) => f.id);

    // NOTA: As solicitações reversas ficam visíveis na aba dedicada "Aceitar Amizades",
    // em vez de criar automaticamente registros de amigos na lista principal sem consentimento.

    return {
      currentUser,
      myFriends,
      reverseFriends,
      reverseFriendIds,
      ensureLocalFriendForOwner,
      ensureLocalFriendForForeign,
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
    if (phone) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, phone: true, pix_key: true },
      });
      const registered = allUsers.find((u) => phonesMatch(u.phone, phone));
      const registeredPix = registered?.pix_key?.trim();
      if (registeredPix) {
        pix_key = registeredPix;
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

    // Deduplicação em memória para garantir que não haja amigos duplicados na lista
    const uniqueFriendsMap = new Map<string, typeof friends[0]>();
    for (const f of friends) {
      const normP = normalizePhoneBackend(f.phone);
      const dedupeKey = normP ? `phone_${normP}` : `name_${f.name.trim().toLowerCase()}`;
      if (!uniqueFriendsMap.has(dedupeKey)) {
        uniqueFriendsMap.set(dedupeKey, f);
      } else {
        const existing = uniqueFriendsMap.get(dedupeKey)!;
        if (f.is_favorite && !existing.is_favorite) {
          uniqueFriendsMap.set(dedupeKey, f);
        }
      }
    }
    const deduplicatedFriends = Array.from(uniqueFriendsMap.values());

    return deduplicatedFriends.map((friend) => {
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

      // Selo de verificação: verifica se o usuário possui conta cadastrada no Rachapp
      const hasAccount = friend.phone
        ? allUsers.some((u) => u.id !== userId && phonesMatch(u.phone, friend.phone))
        : false;

      // Prioriza a chave Pix que o próprio amigo cadastrou na conta dele
      let effectivePixKey = (friend.pix_key || '').trim();
      if (friend.phone) {
        const regUser = allUsers.find(
          (u) => u.id !== userId && phonesMatch(u.phone, friend.phone) && u.pix_key?.trim()
        );
        const regPix = regUser?.pix_key?.trim();
        if (regPix) {
          effectivePixKey = regPix;
        }
      }

      const { expenses, ...friendData } = friend;
      return {
        ...friendData,
        is_verified: hasAccount,
        has_account: hasAccount,
        pix_key: effectivePixKey,
        registered_pix_key: effectivePixKey,
        divida: Number(divida.toFixed(2)),
        voceDeve: Number(voceDeve.toFixed(2)),
      };
    });
  }

  // ==========================================
  // SISTEMA DE CONVITES / ACEITAR AMIZADES
  // ==========================================
  static async getPendingRequests(userId: string) {
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser || !currentUser.phone) return [];

    const myFriends = await prisma.friend.findMany({ where: { user_id: userId } });
    const myFriendPhones = new Set(
      myFriends.map((f) => normalizePhoneBackend(f.phone)).filter(Boolean)
    );

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

    const requests: any[] = [];
    const seenUserIds = new Set<string>();

    for (const rf of otherFriendsWithPhone) {
      if (!rf.user || rf.user.id === userId) continue;
      if (seenUserIds.has(rf.user.id)) continue;

      if (phonesMatch(rf.phone, currentUser.phone)) {
        const requesterNormPhone = normalizePhoneBackend(rf.user.phone);
        if (!myFriendPhones.has(requesterNormPhone)) {
          seenUserIds.add(rf.user.id);
          requests.push({
            id: rf.id,
            requesterId: rf.user.id,
            name: rf.user.name,
            phone: rf.user.phone,
            pix_key: rf.user.pix_key,
            created_at: rf.user.id,
          });
        }
      }
    }

    return requests;
  }

  static async acceptFriendRequest(userId: string, requesterUserId: string) {
    const requester = await prisma.user.findUnique({
      where: { id: requesterUserId },
      select: { id: true, name: true, phone: true, pix_key: true },
    });
    if (!requester) throw new Error('Usuário solicitante não encontrado.');

    const normPhone = normalizePhoneBackend(requester.phone);
    let existing = await prisma.friend.findFirst({
      where: {
        user_id: userId,
        OR: [
          ...(normPhone ? [{ phone: normPhone }] : []),
          { name: requester.name },
        ],
      },
    });

    if (!existing) {
      existing = await prisma.friend.create({
        data: {
          user_id: userId,
          name: requester.name,
          phone: normPhone || null,
          pix_key: requester.pix_key || null,
          color: 'bg-teal-500',
          is_favorite: false,
        },
      });
    }

    return existing;
  }

  static async rejectFriendRequest(userId: string, requesterUserId: string) {
    return { success: true };
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

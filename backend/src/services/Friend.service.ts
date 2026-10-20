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

    // Enriquece amigos locais com pix_key de usuários registrados com mesmo telefone, se ainda não tiverem
    for (let i = 0; i < myFriends.length; i++) {
      const mf = myFriends[i];
      if (mf.phone && !mf.pix_key) {
        const regUser = allUsers.find((u) => u.id !== userId && phonesMatch(u.phone, mf.phone));
        if (regUser?.pix_key) {
          const updated = await prisma.friend.update({
            where: { id: mf.id },
            data: { pix_key: regUser.pix_key },
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
      let existing = myFriends.find(
        (f) =>
          (normOwnerPhone && phonesMatch(f.phone, normOwnerPhone)) ||
          (!f.phone && f.name.trim().toLowerCase() === ownerUser.name.trim().toLowerCase())
      );

      if (existing) {
        const needsPhone = !existing.phone && normOwnerPhone;
        const needsPix = !existing.pix_key && ownerUser.pix_key;
        if (needsPhone || needsPix) {
          existing = await prisma.friend.update({
            where: { id: existing.id },
            data: {
              ...(needsPhone ? { phone: normOwnerPhone } : {}),
              ...(needsPix ? { pix_key: ownerUser.pix_key } : {}),
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
          pix_key: ownerUser.pix_key || null,
          color: 'bg-teal-500',
          is_favorite: false,
        },
      });
      myFriends.push(created);
      return created;
    };

    const ensureLocalFriendForForeign = async (foreignFriend: {
      id: string;
      name: string;
      phone?: string | null;
      pix_key?: string | null;
      color?: string | null;
    }) => {
      const normPhone = normalizePhoneBackend(foreignFriend.phone);
      let existing = myFriends.find(
        (f) =>
          (normPhone && phonesMatch(f.phone, normPhone)) ||
          f.name.trim().toLowerCase() === foreignFriend.name.trim().toLowerCase()
      );

      if (existing) {
        const needsPhone = !existing.phone && normPhone;
        const needsPix = !existing.pix_key && foreignFriend.pix_key;
        if (needsPhone || needsPix) {
          existing = await prisma.friend.update({
            where: { id: existing.id },
            data: {
              ...(needsPhone ? { phone: normPhone } : {}),
              ...(needsPix ? { pix_key: foreignFriend.pix_key } : {}),
            },
          });
          myFriends = myFriends.map((f) => (f.id === existing!.id ? existing! : f));
        }
        return existing;
      }

      const created = await prisma.friend.create({
        data: {
          user_id: userId,
          name: foreignFriend.name.trim() || 'Amigo',
          phone: normPhone || null,
          pix_key: foreignFriend.pix_key || null,
          color: foreignFriend.color || 'bg-sky-500',
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

    // Garante que todo usuário que me adicionou pelo meu número também esteja na minha lista de amigos
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

    // Se o telefone pertencer a um usuário já cadastrado e não veio chave Pix, puxa a chave Pix dele
    if (phone && !pix_key) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, phone: true, pix_key: true },
      });
      const registered = allUsers.find((u) => phonesMatch(u.phone, phone));
      if (registered?.pix_key) {
        pix_key = registered.pix_key;
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

      const { expenses, ...friendData } = friend;
      return {
        ...friendData,
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

    const pix_key = data.pix_key !== undefined ? data.pix_key : data.pix;
    const color = data.color ?? data.cor;
    const is_favorite = data.is_favorite !== undefined ? data.is_favorite : data.favorito;

    return prisma.friend.update({
      where: { id: friendId },
      data: {
        ...(name ? { name } : {}),
        ...(phoneToSave !== undefined ? { phone: phoneToSave } : {}),
        ...(pix_key !== undefined ? { pix_key: pix_key.trim() || null } : {}),
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

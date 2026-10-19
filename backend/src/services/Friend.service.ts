// src/services/Friend.service.ts
import { prisma } from '../config/db';
import { normalizePhoneBackend } from './Auth.service';

export class FriendService {
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

    const pix_key = (data.pix_key ?? data.pix ?? '').trim() || null;
    const color = data.color || data.cor || 'bg-sky-500';
    const is_favorite = data.is_favorite ?? data.favorito ?? false;

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
      const samePhoneFriend = allFriends.find(
        (f) => f.phone && normalizePhoneBackend(f.phone) === phone
      );
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

    return friends.map((friend) => {
      let divida = 0;
      friend.expenses.forEach((expPart) => {
        if (expPart.expense.user_id === userId && !expPart.expense.paid_by_friend_id) {
          const pending = Number(expPart.amount_owed) - Number(expPart.amount_paid);
          if (pending > 0.005) divida += pending;
        }
      });

      const { expenses, ...friendData } = friend;
      return {
        ...friendData,
        divida: Number(divida.toFixed(2)),
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

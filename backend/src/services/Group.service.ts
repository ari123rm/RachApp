// src/services/Group.service.ts
import { prisma } from '../config/db';
import { ExpenseService } from './Expense.service';

export class GroupService {
  static async createGroup(
    userId: string,
    data: { id?: string; name: string; friendIds?: string[] }
  ) {
    const name = data.name?.trim();
    if (!name) throw new Error('O nome do grupo é obrigatório.');

    const friendIds = Array.from(new Set(data.friendIds || []));

    if (data.id) {
      const existing = await prisma.group.findUnique({ where: { id: data.id } });
      if (existing && existing.created_by === userId) {
        return this.updateGroup(userId, data.id, { name, friendIds });
      }
    }

    const group = await prisma.group.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        name,
        created_by: userId,
        members: {
          create: [
            { user_id: userId },
            ...friendIds.map((friendId) => ({ friend_id: friendId })),
          ],
        },
      },
      include: {
        owner: { select: { id: true, name: true, pix_key: true, phone: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, pix_key: true, phone: true } },
            friend: true,
          },
        },
        _count: {
          select: { members: true, expenses: true },
        },
      },
    });

    return group;
  }

  static async getUserGroups(userId: string) {
    const groups = await prisma.group.findMany({
      where: {
        OR: [
          { created_by: userId },
          { members: { some: { user_id: userId } } },
        ],
      },
      include: {
        owner: { select: { id: true, name: true, pix_key: true, phone: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, pix_key: true, phone: true } },
            friend: true,
          },
        },
        expenses: {
          include: {
            participants: true,
          },
        },
        _count: {
          select: { members: true, expenses: true },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return groups;
  }

  static async updateGroup(
    userId: string,
    groupId: string,
    data: { name?: string; friendIds?: string[] }
  ) {
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        OR: [{ created_by: userId }, { members: { some: { user_id: userId } } }],
      },
    });
    if (!group) throw new Error('Grupo não encontrado.');

    if (data.name !== undefined && data.name.trim()) {
      await prisma.group.update({
        where: { id: groupId },
        data: { name: data.name.trim() },
      });
    }

    if (Array.isArray(data.friendIds)) {
      const uniqueFriendIds = Array.from(new Set(data.friendIds));
      await prisma.groupMember.deleteMany({
        where: {
          group_id: groupId,
          friend_id: { not: null },
        },
      });

      if (uniqueFriendIds.length > 0) {
        await prisma.groupMember.createMany({
          data: uniqueFriendIds.map((friendId) => ({
            group_id: groupId,
            friend_id: friendId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return this.getGroupById(groupId, userId);
  }

  static async deleteGroup(userId: string, groupId: string) {
    const group = await prisma.group.findFirst({
      where: { id: groupId, created_by: userId },
    });
    if (!group) throw new Error('Grupo não encontrado ou sem permissão.');

    await prisma.group.delete({ where: { id: groupId } });
  }

  static async addMember(
    groupId: string,
    userId: string,
    payload: { friendId?: string; identifier?: string; name?: string; phone?: string; pix_key?: string; color?: string }
  ) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new Error('Grupo não encontrado.');

    let friendToAdd = null;

    if (payload.friendId) {
      friendToAdd = await prisma.friend.findFirst({
        where: { id: payload.friendId, user_id: userId },
      });
    } else if (payload.identifier) {
      const idClean = payload.identifier.trim();
      friendToAdd = await prisma.friend.findFirst({
        where: {
          user_id: userId,
          OR: [
            { name: { equals: idClean, mode: 'insensitive' } },
            { phone: idClean },
            { pix_key: idClean },
          ],
        },
      });

      if (!friendToAdd) {
        // Verifica se existe um User registrado com esse email/telefone para puxar dados
        const registeredUser = await prisma.user.findFirst({
          where: {
            OR: [{ email: idClean.toLowerCase() }, { phone: idClean }],
          },
        });

        friendToAdd = await prisma.friend.create({
          data: {
            user_id: userId,
            name: registeredUser ? registeredUser.name : (payload.name || idClean),
            phone: registeredUser ? registeredUser.phone : (payload.phone || null),
            pix_key: registeredUser ? registeredUser.pix_key : (payload.pix_key || null),
            color: payload.color || 'bg-teal-500',
            is_favorite: false,
          },
        });
      }
    }

    if (!friendToAdd) {
      throw new Error('Amigo não encontrado.');
    }

    const existingMember = await prisma.groupMember.findFirst({
      where: {
        group_id: groupId,
        friend_id: friendToAdd.id,
      },
    });

    if (existingMember) {
      throw new Error('Este amigo já faz parte do grupo.');
    }

    const newMember = await prisma.groupMember.create({
      data: {
        group_id: groupId,
        friend_id: friendToAdd.id,
      },
      include: {
        friend: true,
        user: { select: { id: true, name: true, pix_key: true, phone: true } },
      },
    });

    return newMember;
  }

  static async removeMember(groupId: string, userId: string, memberOrFriendId: string) {
    await prisma.groupMember.deleteMany({
      where: {
        group_id: groupId,
        OR: [{ id: memberOrFriendId }, { friend_id: memberOrFriendId }],
      },
    });
  }

  static async getGroupById(groupId: string, userId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: { select: { id: true, name: true, pix_key: true, phone: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, pix_key: true, phone: true } },
            friend: true,
          },
        },
        expenses: {
          orderBy: { expense_date: 'desc' },
          include: {
            owner: { select: { id: true, name: true, pix_key: true } },
            paidByFriend: true,
            participants: {
              include: {
                friend: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new Error('Grupo não encontrado.');
    }

    const balanceSummary = await ExpenseService.calculateGroupBalances(groupId, userId);

    return {
      ...group,
      ...balanceSummary,
    };
  }
}
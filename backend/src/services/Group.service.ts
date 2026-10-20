// src/services/Group.service.ts
import { prisma } from '../config/db';
import { ExpenseService } from './Expense.service';
import { FriendService } from './Friend.service';
import { getCanonicalPhoneBackend, normalizePhoneBackend, phonesMatch } from './Auth.service';

export class GroupService {
  static async transformGroupForUser(
    group: any,
    userId: string,
    reverseContext: Awaited<ReturnType<typeof FriendService.syncReverseLinks>>
  ) {
    const { currentUser, reverseFriendIds, myFriends, ensureLocalFriendForOwner, ensureLocalFriendForForeign } =
      reverseContext;
    const reverseSet = new Set(reverseFriendIds);

    const resolveLocalFriend = async (foreignFriend: any) => {
      if (!foreignFriend) return null;
      const canonF = getCanonicalPhoneBackend(foreignFriend.phone);
      const matchInMy = myFriends.find(
        (f) =>
          f.id === foreignFriend.id ||
          (canonF && getCanonicalPhoneBackend(f.phone) === canonF) ||
          (foreignFriend.phone && phonesMatch(f.phone, foreignFriend.phone)) ||
          f.name.trim().toLowerCase() === foreignFriend.name.trim().toLowerCase()
      );
      if (matchInMy) return matchInMy;
      return ensureLocalFriendForForeign(foreignFriend);
    };

    let mappedMembers: any[] = [];

    if (group.created_by !== userId) {
      const ownerCanon = getCanonicalPhoneBackend(group.owner?.phone);
      const ownerLocalFriend =
        myFriends.find(
          (f) =>
            (ownerCanon && getCanonicalPhoneBackend(f.phone) === ownerCanon) ||
            (group.owner?.phone && phonesMatch(f.phone, group.owner.phone))
        ) ||
        (group.owner
          ? await ensureLocalFriendForOwner(group.owner)
          : await ensureLocalFriendForForeign({ id: group.created_by, name: 'Amigo' }));

      mappedMembers.push(
        {
          id: `${group.id}_self`,
          group_id: group.id,
          user_id: userId,
          friend_id: null,
          user: currentUser
            ? {
                id: currentUser.id,
                name: currentUser.name,
                pix_key: currentUser.pix_key,
                phone: currentUser.phone,
              }
            : null,
          friend: null,
        },
        {
          id: `${group.id}_${ownerLocalFriend.id}`,
          group_id: group.id,
          user_id: null,
          friend_id: ownerLocalFriend.id,
          user: null,
          friend: ownerLocalFriend,
        }
      );

      for (const m of group.members || []) {
        if (m.friend_id && !reverseSet.has(m.friend_id) && m.friend) {
          const localF = await resolveLocalFriend(m.friend);
          if (localF && localF.id !== ownerLocalFriend.id) {
            mappedMembers.push({
              id: m.id || `${group.id}_${localF.id}`,
              group_id: group.id,
              user_id: null,
              friend_id: localF.id,
              user: null,
              friend: localF,
            });
          }
        }
      }
    } else {
      // O grupo foi criado por userId: prioriza sempre o nome que o usuário deu aos seus amigos
      for (const m of group.members || []) {
        const isSelf = m.user_id === userId || (m.user && m.user.id === userId);
        if (isSelf) {
          mappedMembers.push({
            id: m.id || `${group.id}_self`,
            group_id: group.id,
            user_id: userId,
            friend_id: null,
            user: currentUser
              ? {
                  id: currentUser.id,
                  name: currentUser.name,
                  pix_key: currentUser.pix_key,
                  phone: currentUser.phone,
                }
              : null,
            friend: null,
          });
        } else {
          const rawFriend = m.friend || m.user;
          const localF = await resolveLocalFriend(rawFriend);
          if (localF) {
            mappedMembers.push({
              id: m.id || `${group.id}_${localF.id}`,
              group_id: group.id,
              user_id: null,
              friend_id: localF.id,
              user: null,
              friend: localF,
            });
          }
        }
      }
    }

    // Deduplica membros do grupo pelo telefone canônico para que NINGUÉM apareça duplicado
    const uniqueMembers: any[] = [];
    const seenMemberKeys = new Set<string>();

    for (const m of mappedMembers) {
      const isSelf = m.user_id === userId;
      const canon = getCanonicalPhoneBackend(m.friend?.phone || m.user?.phone);
      const dedupeKey = isSelf
        ? 'self'
        : canon
        ? `phone_${canon}`
        : `id_${m.friend_id || m.friend?.id || m.id}`;

      if (!seenMemberKeys.has(dedupeKey)) {
        seenMemberKeys.add(dedupeKey);
        uniqueMembers.push(m);
      }
    }

    const transformedExpenses = [];
    for (const exp of group.expenses || []) {
      transformedExpenses.push(
        await ExpenseService.transformExpenseForUser(exp, userId, reverseContext)
      );
    }

    return {
      ...group,
      members: uniqueMembers,
      expenses: transformedExpenses,
      _count: {
        members: uniqueMembers.length,
        expenses: transformedExpenses.length,
      },
    };
  }

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
    const reverseContext = await FriendService.syncReverseLinks(userId);
    const { reverseFriendIds } = reverseContext;

    const groups = await prisma.group.findMany({
      where: {
        OR: [
          { created_by: userId },
          { members: { some: { user_id: userId } } },
          ...(reverseFriendIds.length > 0
            ? [
                { members: { some: { friend_id: { in: reverseFriendIds } } } },
                {
                  expenses: {
                    some: { participants: { some: { friend_id: { in: reverseFriendIds } } } },
                  },
                },
              ]
            : []),
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
            owner: { select: { id: true, name: true, pix_key: true, phone: true } },
            participants: { include: { friend: true } },
            paidByFriend: true,
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

    const transformed = [];
    for (const g of groups) {
      transformed.push(await this.transformGroupForUser(g, userId, reverseContext));
    }

    return transformed;
  }

  static async updateGroup(
    userId: string,
    groupId: string,
    data: { name?: string; friendIds?: string[] }
  ) {
    const { reverseFriendIds } = await FriendService.syncReverseLinks(userId);
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        OR: [
          { created_by: userId },
          { members: { some: { user_id: userId } } },
          ...(reverseFriendIds.length > 0
            ? [{ members: { some: { friend_id: { in: reverseFriendIds } } } }]
            : []),
        ],
      },
    });
    if (!group) throw new Error('Grupo não encontrado.');

    if (data.name !== undefined && data.name.trim()) {
      await prisma.group.update({
        where: { id: groupId },
        data: { name: data.name.trim() },
      });
    }

    if (Array.isArray(data.friendIds) && group.created_by === userId) {
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
      const normPhone = normalizePhoneBackend(idClean);
      const userFriends = await prisma.friend.findMany({ where: { user_id: userId } });

      friendToAdd =
        userFriends.find(
          (f) =>
            f.name.trim().toLowerCase() === idClean.toLowerCase() ||
            (normPhone && phonesMatch(f.phone, normPhone)) ||
            f.pix_key === idClean
        ) || null;

      if (!friendToAdd) {
        const allUsers = await prisma.user.findMany();
        const registeredUser = allUsers.find(
          (u) =>
            u.email.toLowerCase() === idClean.toLowerCase() ||
            (normPhone && phonesMatch(u.phone, normPhone))
        );

        friendToAdd = await prisma.friend.create({
          data: {
            user_id: userId,
            name: registeredUser ? registeredUser.name : payload.name || idClean,
            phone: registeredUser
              ? normalizePhoneBackend(registeredUser.phone)
              : normalizePhoneBackend(payload.phone) || null,
            pix_key: registeredUser ? registeredUser.pix_key : payload.pix_key || null,
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
    const reverseContext = await FriendService.syncReverseLinks(userId);
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
            owner: { select: { id: true, name: true, pix_key: true, phone: true } },
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

    const transformedGroup = await this.transformGroupForUser(group, userId, reverseContext);
    const balanceSummary = await ExpenseService.calculateGroupBalances(groupId, userId);

    return {
      ...transformedGroup,
      ...balanceSummary,
    };
  }
}

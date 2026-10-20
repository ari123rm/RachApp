// src/services/Group.service.ts
import { prisma } from '../config/db';
import { ExpenseService } from './Expense.service';
import { FriendService } from './Friend.service';
import { normalizePhoneBackend, phonesMatch } from './Auth.service';

export class GroupService {
  static async transformGroupForUser(
    group: any,
    userId: string,
    reverseContext: Awaited<ReturnType<typeof FriendService.syncReverseLinks>>
  ) {
    const { currentUser, reverseFriendIds, ensureLocalFriendForOwner, myFriends } = reverseContext;
    const reverseSet = new Set(reverseFriendIds);

    let transformedMembers = group.members || [];

    if (group.created_by !== userId) {
      const ownerLocalFriend = group.owner
        ? await ensureLocalFriendForOwner(group.owner)
        : { id: group.created_by, name: 'Amigo', phone: null, pix_key: null, color: 'bg-emerald-500' };

      const newMembers: any[] = [
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
          status: 'ACCEPTED',
        },
        {
          id: `${group.id}_${ownerLocalFriend.id}`,
          group_id: group.id,
          user_id: null,
          friend_id: ownerLocalFriend.id,
          user: null,
          friend: ownerLocalFriend,
          status: 'ACCEPTED',
        },
      ];

      const seenFriendIds = new Set<string>([ownerLocalFriend.id]);

      for (const m of group.members || []) {
        if (m.friend_id && !reverseSet.has(m.friend_id) && m.friend) {
          const localMatch = m.friend.phone
            ? myFriends.find((mf) => mf.phone && phonesMatch(mf.phone, m.friend.phone))
            : null;
          const memberFriend = localMatch || {
            id: m.friend.id,
            name: m.friend.name,
            phone: m.friend.phone,
            color: m.friend.color || 'bg-sky-500',
          };
          if (!seenFriendIds.has(memberFriend.id)) {
            seenFriendIds.add(memberFriend.id);
            newMembers.push({
              id: m.id || `${group.id}_${memberFriend.id}`,
              group_id: group.id,
              user_id: m.user_id || null,
              friend_id: memberFriend.id,
              user: m.user || null,
              friend: memberFriend,
              status: m.status || 'ACCEPTED',
            });
          }
        }
      }

      transformedMembers = newMembers;
    }

    const transformedExpenses = [];
    for (const exp of group.expenses || []) {
      transformedExpenses.push(
        await ExpenseService.transformExpenseForUser(exp, userId, reverseContext)
      );
    }

    return {
      ...group,
      members: transformedMembers,
      expenses: transformedExpenses,
      _count: {
        members: transformedMembers.length,
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

    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, phone: true, pix_key: true },
    });
    const friends = await prisma.friend.findMany({
      where: { id: { in: friendIds }, user_id: userId },
    });

    const memberCreates: any[] = [{ user_id: userId, status: 'ACCEPTED' }];

    for (const friendId of friendIds) {
      const f = friends.find((x) => x.id === friendId);
      const regUser = f?.phone
        ? allUsers.find((u) => u.id !== userId && phonesMatch(u.phone, f.phone))
        : null;

      if (regUser) {
        // Amigo é usuário do RachApp: recebe convite pendente
        memberCreates.push({
          user_id: regUser.id,
          friend_id: friendId,
          status: 'PENDING',
        });
      } else {
        // Amigo offline: aceito diretamente
        memberCreates.push({
          friend_id: friendId,
          status: 'ACCEPTED',
        });
      }
    }

    const group = await prisma.group.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        name,
        created_by: userId,
        members: {
          create: memberCreates,
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

    const groups = await prisma.group.findMany({
      where: {
        OR: [
          { created_by: userId },
          { members: { some: { user_id: userId, status: 'ACCEPTED' } } },
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

  static async listPendingInvitations(userId: string) {
    const invitations = await prisma.groupMember.findMany({
      where: {
        user_id: userId,
        status: 'PENDING',
      },
      include: {
        group: {
          include: {
            owner: { select: { id: true, name: true, phone: true } },
            _count: { select: { members: true, expenses: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      group_id: inv.group_id,
      status: inv.status,
      group: {
        id: inv.group.id,
        name: inv.group.name,
        creator_name: inv.group.owner?.name || 'Amigo',
        members_count: inv.group._count.members,
        expenses_count: inv.group._count.expenses,
      },
    }));
  }

  static async acceptInvitation(userId: string, invitationId: string) {
    const member = await prisma.groupMember.findFirst({
      where: {
        id: invitationId,
        user_id: userId,
      },
    });

    if (!member) {
      throw new Error('Convite de grupo não encontrado.');
    }

    await prisma.groupMember.update({
      where: { id: invitationId },
      data: { status: 'ACCEPTED' },
    });

    return { message: 'Convite aceito com sucesso!' };
  }

  static async rejectInvitation(userId: string, invitationId: string) {
    const member = await prisma.groupMember.findFirst({
      where: {
        id: invitationId,
        user_id: userId,
      },
    });

    if (!member) {
      throw new Error('Convite de grupo não encontrado.');
    }

    await prisma.groupMember.delete({
      where: { id: invitationId },
    });

    return { message: 'Convite recusado com sucesso.' };
  }

  static async updateGroup(
    userId: string,
    groupId: string,
    data: { name?: string; friendIds?: string[] }
  ) {
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        OR: [
          { created_by: userId },
          { members: { some: { user_id: userId, status: 'ACCEPTED' } } },
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
        const allUsers = await prisma.user.findMany({
          select: { id: true, name: true, phone: true, pix_key: true },
        });
        const friends = await prisma.friend.findMany({
          where: { id: { in: uniqueFriendIds }, user_id: userId },
        });

        const newMembersData = uniqueFriendIds.map((friendId) => {
          const f = friends.find((x) => x.id === friendId);
          const regUser = f?.phone
            ? allUsers.find((u) => u.id !== userId && phonesMatch(u.phone, f.phone))
            : null;

          return {
            group_id: groupId,
            friend_id: friendId,
            user_id: regUser ? regUser.id : null,
            status: regUser ? 'PENDING' : 'ACCEPTED',
          };
        });

        await prisma.groupMember.createMany({
          data: newMembersData,
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

    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, phone: true, pix_key: true },
    });
    const regUser = friendToAdd.phone
      ? allUsers.find((u) => u.id !== userId && phonesMatch(u.phone, friendToAdd.phone))
      : null;

    const newMember = await prisma.groupMember.create({
      data: {
        group_id: groupId,
        friend_id: friendToAdd.id,
        user_id: regUser ? regUser.id : null,
        status: regUser ? 'PENDING' : 'ACCEPTED',
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

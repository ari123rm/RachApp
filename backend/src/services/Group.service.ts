// src/services/Group.service.ts
import { prisma } from '../config/db';
import { ExpenseService } from './Expense.service';
import { FriendService } from './Friend.service';
import { normalizePhoneBackend, phonesMatch } from './Auth.service';
import { NotificationService } from './Notification.service';
import { notifySync } from './socket.service';

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
                avatar_url: (currentUser as any).avatar_url || null,
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
            avatar_url: m.friend.avatar_url || null,
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
    data: { id?: string; name: string; friendIds?: string[]; avatar_url?: string | null }
  ) {
    const name = data.name?.trim();
    if (!name) throw new Error('O nome do grupo é obrigatório.');

    const friendIds = Array.from(new Set(data.friendIds || []));

    if (data.id) {
      const existing = await prisma.group.findUnique({ where: { id: data.id } });
      if (existing && existing.created_by === userId) {
        return this.updateGroup(userId, data.id, { name, friendIds, avatar_url: data.avatar_url });
      }
    }

    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true },
    });
    const friends = await prisma.friend.findMany({
      where: { id: { in: friendIds }, user_id: userId },
    });

    const memberCreates: any[] = [{ user_id: userId, status: 'ACCEPTED' }];

    for (const friendId of friendIds) {
      const f = friends.find((x) => x.id === friendId);
      if (!f) continue;
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
        avatar_url: data.avatar_url || null,
        created_by: userId,
        members: {
          create: memberCreates,
        },
      },
      include: {
        owner: { select: { id: true, name: true, pix_key: true, phone: true, avatar_url: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, pix_key: true, phone: true, avatar_url: true } },
            friend: true,
          },
        },
        _count: {
          select: { members: true, expenses: true },
        },
      },
    });

    // Notifica membros registrados que foram adicionados ao grupo
    (async () => {
      try {
        const creator = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        const creatorName = creator?.name || 'Um amigo';

        for (const m of group.members) {
          if (m.user_id && m.user_id !== userId) {
            await NotificationService.createNotification({
              userId: m.user_id,
              type: 'GROUP_INVITE',
              title: 'Novo grupo',
              message: `${creatorName} adicionou você ao grupo "${group.name}"`,
              data: { groupId: group.id, groupName: group.name },
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao disparar notificações de grupo:', err);
      }
    })();

    return group;
  }

  static async getUserGroups(
    userId: string,
    existingReverseContext?: Awaited<ReturnType<typeof FriendService.syncReverseLinks>>
  ) {
    const reverseContext = existingReverseContext || (await FriendService.syncReverseLinks(userId));
    const { reverseFriendIds } = reverseContext;

    const groups = await prisma.group.findMany({
      where: {
        OR: [
          { created_by: userId },
          { members: { some: { user_id: userId, status: 'ACCEPTED' } } },
          ...(reverseFriendIds.length > 0
            ? [{ members: { some: { friend_id: { in: reverseFriendIds }, status: 'ACCEPTED' } } }]
            : []),
        ],
      },
      include: {
        owner: { select: { id: true, name: true, pix_key: true, phone: true, avatar_url: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, pix_key: true, phone: true, avatar_url: true } },
            friend: true,
          },
        },
        expenses: {
          include: {
            owner: { select: { id: true, name: true, pix_key: true, phone: true, avatar_url: true } },
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
            owner: {
              select: { id: true, name: true, phone: true, pix_key: true },
            },
            _count: {
              select: { members: true, expenses: true },
            },
          },
        },
      },
      orderBy: { group: { created_at: 'desc' } },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      group_id: inv.group_id,
      status: inv.status,
      group: {
        id: inv.group.id,
        name: inv.group.name,
        created_by: inv.group.created_by,
        created_at: inv.group.created_at,
        creator_name: inv.group.owner?.name || 'Amigo',
        members_count: inv.group._count?.members || 1,
        expenses_count: inv.group._count?.expenses || 0,
      },
    }));
  }

  static async acceptInvitation(userId: string, invitationId: string) {
    const member = await prisma.groupMember.findFirst({
      where: {
        id: invitationId,
        user_id: userId,
      },
      include: {
        group: { select: { created_by: true } },
      },
    });

    if (!member) {
      throw new Error('Convite de grupo não encontrado.');
    }

    await prisma.groupMember.update({
      where: { id: invitationId },
      data: { status: 'ACCEPTED' },
    });

    if (member.group?.created_by) {
      notifySync(member.group.created_by, 'GROUP_INVITE_ACCEPTED');
    }

    return { message: 'Convite aceito com sucesso!' };
  }

  static async removeFriendsFromGroupExpenses(groupId: string, friendIds: string[]) {
    if (!groupId || !friendIds.length) return;

    const friendIdSet = new Set(friendIds);

    const expenses = await prisma.expense.findMany({
      where: { group_id: groupId },
      include: {
        participants: true,
      },
    });

    for (const exp of expenses) {
      const hasParticipant = exp.participants.some((p) => friendIdSet.has(p.friend_id));
      const hasPayer = exp.paid_by_friend_id && friendIdSet.has(exp.paid_by_friend_id);

      if (!hasParticipant && !hasPayer) {
        continue;
      }

      if (hasPayer) {
        await prisma.expense.update({
          where: { id: exp.id },
          data: { paid_by_friend_id: null },
        });
      }

      if (hasParticipant) {
        await prisma.expenseParticipant.deleteMany({
          where: {
            expense_id: exp.id,
            friend_id: { in: friendIds },
          },
        });

        const remainingParticipants = exp.participants.filter(
          (p) => !friendIdSet.has(p.friend_id)
        );

        if (remainingParticipants.length === 0) {
          await prisma.expense.delete({
            where: { id: exp.id },
          });
        } else {
          const totalPeople = remainingParticipants.length + 1;
          const newSplitAmount = Number((Number(exp.total_amount) / totalPeople).toFixed(2));

          await prisma.expense.update({
            where: { id: exp.id },
            data: {
              self_amount_owed: newSplitAmount,
              self_amount_paid: hasPayer ? newSplitAmount : (exp.paid_by_friend_id ? 0 : newSplitAmount),
            },
          });

          for (const rem of remainingParticipants) {
            await prisma.expenseParticipant.update({
              where: {
                expense_id_friend_id: {
                  expense_id: exp.id,
                  friend_id: rem.friend_id,
                },
              },
              data: {
                amount_owed: newSplitAmount,
              },
            });
          }
        }
      }
    }
  }

  static async rejectInvitation(userId: string, invitationId: string) {
    const member = await prisma.groupMember.findFirst({
      where: {
        id: invitationId,
        user_id: userId,
      },
      include: {
        group: { select: { created_by: true } },
      },
    });

    if (!member) {
      throw new Error('Convite de grupo não encontrado.');
    }

    const groupId = member.group_id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const targetFriendIds = new Set<string>();
    if (member.friend_id) {
      targetFriendIds.add(member.friend_id);
    }
    if (user?.phone) {
      const allFriends = await prisma.friend.findMany({
        where: { phone: { not: null } },
      });
      for (const f of allFriends) {
        if (phonesMatch(f.phone, user.phone)) {
          targetFriendIds.add(f.id);
        }
      }
    }

    if (targetFriendIds.size > 0) {
      await this.removeFriendsFromGroupExpenses(groupId, Array.from(targetFriendIds));
    }

    await prisma.groupMember.delete({
      where: { id: invitationId },
    });

    if (member.group?.created_by) {
      notifySync(member.group.created_by, 'GROUP_INVITE_REJECTED');
    }

    return { message: 'Convite recusado com sucesso.' };
  }

  static async updateGroup(
    userId: string,
    groupId: string,
    data: { name?: string; friendIds?: string[]; avatar_url?: string | null }
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

    const updateData: any = {};
    if (data.name !== undefined && data.name.trim()) {
      updateData.name = data.name.trim();
    }
    if (data.avatar_url !== undefined && group.created_by === userId) {
      updateData.avatar_url = data.avatar_url || null;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.group.update({
        where: { id: groupId },
        data: updateData,
      });
    }

    if (Array.isArray(data.friendIds) && group.created_by === userId) {
      const uniqueFriendIds = Array.from(new Set(data.friendIds));
      const uniqueFriendIdSet = new Set(uniqueFriendIds);

      const existingMembers = await prisma.groupMember.findMany({
        where: {
          group_id: groupId,
          friend_id: { not: null },
        },
        include: {
          user: true,
        },
      });

      const existingFriendIds = new Set(
        existingMembers.map((m) => m.friend_id).filter((id): id is string => Boolean(id))
      );
      const existingUserIds = new Set(
        existingMembers.map((m) => m.user_id).filter((id): id is string => Boolean(id))
      );

      // 1. Remove apenas os membros que foram desmarcados pelo criador
      const removedMembers = existingMembers.filter(
        (m) => m.friend_id && !uniqueFriendIdSet.has(m.friend_id)
      );

      if (removedMembers.length > 0) {
        const friendIdsToRemove: string[] = [];
        for (const rem of removedMembers) {
          if (rem.friend_id) {
            friendIdsToRemove.push(rem.friend_id);
          }
          if (rem.user?.phone) {
            const allFriends = await prisma.friend.findMany({ where: { phone: { not: null } } });
            for (const f of allFriends) {
              if (phonesMatch(f.phone, rem.user.phone)) {
                friendIdsToRemove.push(f.id);
              }
            }
          }
        }

        if (friendIdsToRemove.length > 0) {
          await this.removeFriendsFromGroupExpenses(groupId, Array.from(new Set(friendIdsToRemove)));
        }

        await prisma.groupMember.deleteMany({
          where: {
            id: { in: removedMembers.map((m) => m.id) },
          },
        });
      }

      // 2. Adiciona apenas os novos amigos que ainda não estavam no grupo (preservando o status ACCEPTED dos atuais)
      const addedFriendIds = uniqueFriendIds.filter((fId) => !existingFriendIds.has(fId));

      if (addedFriendIds.length > 0) {
        const allUsers = await prisma.user.findMany({
          select: { id: true, name: true, phone: true, pix_key: true },
        });
        const friends = await prisma.friend.findMany({
          where: { id: { in: addedFriendIds }, user_id: userId },
        });

        const newMembersData = addedFriendIds
          .map((friendId) => {
            const f = friends.find((x) => x.id === friendId);
            if (!f) return null;
            const regUser = f?.phone
              ? allUsers.find((u) => u.id !== userId && phonesMatch(u.phone, f.phone))
              : null;

            if (regUser && existingUserIds.has(regUser.id)) {
              return null;
            }

            return {
              group_id: groupId,
              friend_id: friendId,
              user_id: regUser ? regUser.id : null,
              status: regUser ? 'PENDING' : 'ACCEPTED',
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (newMembersData.length > 0) {
          await prisma.groupMember.createMany({
            data: newMembersData,
            skipDuplicates: true,
          });
        }
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

    if (newMember.user_id) {
      (async () => {
        try {
          const inviter = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          });
          const inviterName = inviter?.name || 'Um amigo';
          await NotificationService.createNotification({
            userId: newMember.user_id!,
            type: 'GROUP_INVITE',
            title: 'Novo grupo',
            message: `${inviterName} adicionou você ao grupo "${group.name}"`,
            data: { groupId: group.id, groupName: group.name },
          });
        } catch (err) {
          console.warn('Erro ao notificar novo membro do grupo:', err);
        }
      })();
    }

    return newMember;
  }

  static async removeMember(groupId: string, userId: string, memberOrFriendId: string) {
    const member = await prisma.groupMember.findFirst({
      where: {
        group_id: groupId,
        OR: [{ id: memberOrFriendId }, { friend_id: memberOrFriendId }, { user_id: memberOrFriendId }],
      },
      include: {
        user: true,
      },
    });

    const friendIdsToRemove: string[] = [];
    if (member?.friend_id) {
      friendIdsToRemove.push(member.friend_id);
    }
    if (member?.user?.phone) {
      const allFriends = await prisma.friend.findMany({ where: { phone: { not: null } } });
      for (const f of allFriends) {
        if (phonesMatch(f.phone, member.user.phone)) {
          friendIdsToRemove.push(f.id);
        }
      }
    } else if (memberOrFriendId) {
      friendIdsToRemove.push(memberOrFriendId);
    }

    if (friendIdsToRemove.length > 0) {
      await this.removeFriendsFromGroupExpenses(groupId, Array.from(new Set(friendIdsToRemove)));
    }

    await prisma.groupMember.deleteMany({
      where: {
        group_id: groupId,
        OR: [{ id: memberOrFriendId }, { friend_id: memberOrFriendId }, { user_id: memberOrFriendId }],
      },
    });
  }

  static async getGroupById(groupId: string, userId: string) {
    const reverseContext = await FriendService.syncReverseLinks(userId);
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: { select: { id: true, name: true, pix_key: true, phone: true, avatar_url: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, pix_key: true, phone: true, avatar_url: true } },
            friend: true,
          },
        },
        expenses: {
          orderBy: { expense_date: 'desc' },
          include: {
            owner: { select: { id: true, name: true, pix_key: true, phone: true, avatar_url: true } },
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
    const balanceSummary = await ExpenseService.calculateGroupBalances(groupId, userId, reverseContext);

    return {
      ...transformedGroup,
      ...balanceSummary,
    };
  }
}

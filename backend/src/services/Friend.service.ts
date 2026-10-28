// src/services/Friend.service.ts
import { prisma } from '../config/db';
import { normalizePhoneBackend, phonesMatch } from './Auth.service';
import { notifySync } from './socket.service';

type SyncReverseLinksResult = Awaited<ReturnType<typeof FriendService['_runSyncReverseLinks']>>;
const syncReverseLinksLocks = new Map<string, Promise<SyncReverseLinksResult>>();

export class FriendService {
  /**
   * Sincroniza vínculos reversos pelo número de telefone:
   * Se outro usuário (User B) cadastrou o usuário atual (User A) como amigo usando o telefone de User A,
   * encontra todos os registros Friend que apontam para User A (reverseFriendIds) e garante que User B
   * também exista na lista de amigos de User A quando a amizade é aceita ou há racha compartilhado.
   */
  static async syncReverseLinks(userId: string): Promise<SyncReverseLinksResult> {
    const existingLock = syncReverseLinksLocks.get(userId);
    if (existingLock) {
      try {
        return await existingLock;
      } catch {
        // Prossegue caso a chamada anterior tenha falhado
      }
    }

    const promise = this._runSyncReverseLinks(userId).finally(() => {
      if (syncReverseLinksLocks.get(userId) === promise) {
        syncReverseLinksLocks.delete(userId);
      }
    });

    syncReverseLinksLocks.set(userId, promise);
    return promise;
  }

  private static async _runSyncReverseLinks(userId: string) {
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    let myFriends = await prisma.friend.findMany({
      where: { user_id: userId },
      orderBy: { id: 'asc' },
    });

    // Deduplica amigos locais que tenham o mesmo telefone de forma segura (sem violar constraint composta)
    const seenPhones = new Map<string, string>();
    const toDeleteIds: string[] = [];
    for (const f of myFriends) {
      const norm = normalizePhoneBackend(f.phone);
      if (norm) {
        if (seenPhones.has(norm)) {
          const keepId = seenPhones.get(norm)!;
          try {
            const dupParticipants = await prisma.expenseParticipant.findMany({
              where: { friend_id: f.id },
            });
            for (const dp of dupParticipants) {
              const existingKeep = await prisma.expenseParticipant.findUnique({
                where: {
                  expense_id_friend_id: {
                    expense_id: dp.expense_id,
                    friend_id: keepId,
                  },
                },
              });
              if (existingKeep) {
                const mergedPaid = Math.max(
                  Number(existingKeep.amount_paid || 0),
                  Number(dp.amount_paid || 0)
                );
                await prisma.expenseParticipant.update({
                  where: {
                    expense_id_friend_id: {
                      expense_id: dp.expense_id,
                      friend_id: keepId,
                    },
                  },
                  data: {
                    amount_paid: mergedPaid,
                    receipt_url: existingKeep.receipt_url || dp.receipt_url || null,
                  },
                });
                await prisma.expenseParticipant.delete({
                  where: {
                    expense_id_friend_id: {
                      expense_id: dp.expense_id,
                      friend_id: f.id,
                    },
                  },
                });
              } else {
                await prisma.expenseParticipant.update({
                  where: {
                    expense_id_friend_id: {
                      expense_id: dp.expense_id,
                      friend_id: f.id,
                    },
                  },
                  data: { friend_id: keepId },
                });
              }
            }

            await prisma.expense.updateMany({
              where: { paid_by_friend_id: f.id },
              data: { paid_by_friend_id: keepId },
            });

            const dupGroupMembers = await prisma.groupMember.findMany({
              where: { friend_id: f.id },
            });
            for (const dgm of dupGroupMembers) {
              const existingGroupKeep = await prisma.groupMember.findFirst({
                where: { group_id: dgm.group_id, friend_id: keepId },
              });
              if (existingGroupKeep) {
                await prisma.groupMember.delete({ where: { id: dgm.id } });
              } else {
                await prisma.groupMember.update({
                  where: { id: dgm.id },
                  data: { friend_id: keepId },
                });
              }
            }

            toDeleteIds.push(f.id);
          } catch (err) {
            console.warn('Aviso ao deduplicar amigo local:', err);
          }
        } else {
          seenPhones.set(norm, f.id);
        }
      }
    }
    if (toDeleteIds.length > 0) {
      try {
        await prisma.friend.deleteMany({
          where: { id: { in: toDeleteIds } },
        });
        myFriends = myFriends.filter((f) => !toDeleteIds.includes(f.id));
      } catch (err) {
        console.warn('Aviso ao remover amigos duplicados:', err);
      }
    }

    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true },
    });

    // Enriquece e atualiza amigos locais com a chave Pix e foto do usuário cadastrado (priorizando o que ele cadastrou para si)
    for (let i = 0; i < myFriends.length; i++) {
      const mf = myFriends[i];
      if (mf.phone) {
        const regUser = allUsers.find((u) => u.id !== userId && phonesMatch(u.phone, mf.phone));
        if (regUser) {
          const regPix = regUser?.pix_key?.trim();
          const regAvatar = regUser?.avatar_url || null;
          const needsPix = Boolean(regPix && regPix !== mf.pix_key);
          const needsAvatar = (mf.avatar_url || null) !== regAvatar;
          if (needsPix || needsAvatar) {
            const updated = await prisma.friend.update({
              where: { id: mf.id },
              data: {
                ...(needsPix ? { pix_key: regPix } : {}),
                ...(needsAvatar ? { avatar_url: regAvatar } : {}),
              },
            });
            myFriends[i] = updated;
          }
        }
      }
    }

    let ensureOwnerLock: Promise<any> = Promise.resolve();

    const ensureLocalFriendForOwner = async (ownerUser: {
      id: string;
      name: string;
      phone?: string | null;
      pix_key?: string | null;
      avatar_url?: string | null;
      color?: string | null;
    }) => {
      const run = async () => {
        const normOwnerPhone = normalizePhoneBackend(ownerUser.phone);
        const cleanOwnerPix = ownerUser.pix_key?.trim() || null;
        const cleanOwnerAvatar = ownerUser.avatar_url || null;
        const ownerNameLower = (ownerUser.name || 'Amigo').trim().toLowerCase();

        let existing = myFriends.find(
          (f) =>
            (normOwnerPhone && f.phone && phonesMatch(f.phone, normOwnerPhone)) ||
            (f.name.trim().toLowerCase() === ownerNameLower &&
              (!normOwnerPhone || !f.phone || phonesMatch(f.phone, normOwnerPhone)))
        );

        if (!existing) {
          const freshFriends = await prisma.friend.findMany({ where: { user_id: userId } });
          existing = freshFriends.find(
            (f) =>
              (normOwnerPhone && f.phone && phonesMatch(f.phone, normOwnerPhone)) ||
              (f.name.trim().toLowerCase() === ownerNameLower &&
                (!normOwnerPhone || !f.phone || phonesMatch(f.phone, normOwnerPhone)))
          );
          if (existing && !myFriends.some((mf) => mf.id === existing!.id)) {
            myFriends.push(existing);
          }
        }

        if (existing) {
          const needsPhone = !existing.phone && normOwnerPhone;
          const needsPix = cleanOwnerPix && existing.pix_key !== cleanOwnerPix;
          const needsAvatar = cleanOwnerAvatar && (existing.avatar_url || null) !== cleanOwnerAvatar;
          if (needsPhone || needsPix || needsAvatar) {
            existing = await prisma.friend.update({
              where: { id: existing.id },
              data: {
                ...(needsPhone ? { phone: normOwnerPhone } : {}),
                ...(cleanOwnerPix && needsPix ? { pix_key: cleanOwnerPix } : {}),
                ...(needsAvatar ? { avatar_url: cleanOwnerAvatar } : {}),
              },
            });
            const idx = myFriends.findIndex((f) => f.id === existing!.id);
            if (idx >= 0) {
              myFriends[idx] = existing;
            } else {
              myFriends.push(existing);
            }
          }
          return existing;
        }

        const created = await prisma.friend.create({
          data: {
            user_id: userId,
            name: (ownerUser.name || 'Amigo').trim() || 'Amigo',
            phone: normOwnerPhone || null,
            pix_key: cleanOwnerPix,
            avatar_url: cleanOwnerAvatar,
            color: ownerUser.color || 'bg-teal-500',
            is_favorite: false,
          },
        });
        myFriends.push(created);
        return created;
      };

      const next = ensureOwnerLock.then(run, run);
      ensureOwnerLock = next.catch(() => {});
      return next;
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

    // Busca todas as solicitações de amizade envolvendo o usuário atual
    const allRequests = await prisma.friendshipRequest.findMany({
      where: {
        OR: [{ sender_id: userId }, { receiver_id: userId }],
      },
    });

    const acceptedUserIds = new Set<string>();
    const requestByOtherUserId = new Map<string, (typeof allRequests)[number]>();
    for (const req of allRequests) {
      const otherId = req.sender_id === userId ? req.receiver_id : req.sender_id;
      requestByOtherUserId.set(otherId, req);
      if (req.status === 'ACCEPTED') {
        acceptedUserIds.add(otherId);
      }
    }

    const otherFriendsWithPhone = await prisma.friend.findMany({
      where: {
        user_id: { not: userId },
        phone: { not: null },
      },
      include: {
        user: {
          select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true },
        },
        expenses: {
          select: { expense_id: true },
          take: 1,
        },
        expensesPaid: {
          select: { id: true },
          take: 1,
        },
      },
    });

    // Sincroniza solicitações e vínculos:
    // - Se ambos os usuários já se adicionaram mutuamente OU se já existe um racha compartilhado com este registro Friend
    //   (e a solicitação não foi explicitamente recusada), garante vínculo ACCEPTED para que o racha seja visível.
    // - Se não houver solicitação ainda, cria a solicitação para não ficar invisível.
    for (const of of otherFriendsWithPhone) {
      if (!phonesMatch(of.phone, currentUser.phone)) continue;

      const existingReq = requestByOtherUserId.get(of.user_id);
      const iAlreadyAddedThem = myFriends.some(
        (mf) => mf.phone && phonesMatch(mf.phone, of.user.phone)
      );
      const hasSharedExpense =
        (of.expenses && of.expenses.length > 0) ||
        (of.expensesPaid && of.expensesPaid.length > 0);

      if (!acceptedUserIds.has(of.user_id)) {
        const shouldAutoAccept =
          iAlreadyAddedThem ||
          (hasSharedExpense && (!existingReq || existingReq.status !== 'REJECTED'));

        if (shouldAutoAccept) {
          acceptedUserIds.add(of.user_id);
          try {
            if (existingReq) {
              const updatedReq = await prisma.friendshipRequest.update({
                where: { id: existingReq.id },
                data: { status: 'ACCEPTED' },
              });
              requestByOtherUserId.set(of.user_id, updatedReq);
            } else {
              const createdReq = await prisma.friendshipRequest.create({
                data: {
                  sender_id: of.user_id,
                  receiver_id: userId,
                  status: 'ACCEPTED',
                },
              });
              requestByOtherUserId.set(of.user_id, createdReq);
            }
          } catch {
            // Ignora conflito concorrente caso já tenha sido criado/atualizado
          }
        } else if (!existingReq) {
          try {
            const createdPending = await prisma.friendshipRequest.create({
              data: {
                sender_id: of.user_id,
                receiver_id: userId,
                status: 'PENDING',
              },
            });
            requestByOtherUserId.set(of.user_id, createdPending);
          } catch {
            // Ignora conflito concorrente
          }
        }
      }
    }

    // Amigos com amizade ACEITA (ou racha ativo vinculado) entram nos vínculos reversos e nos rachas compartilhados
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
      avatar_url?: string | null;
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
        select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true },
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

    let canUseProvidedId = Boolean(data.id);
    if (data.id) {
      const existing = await prisma.friend.findUnique({ where: { id: data.id } });
      if (existing) {
        if (existing.user_id === userId) {
          const updatedById = await prisma.friend.update({
            where: { id: data.id },
            data: { name, phone, pix_key, color, is_favorite },
          });
          if (registeredUser && registeredUser.id !== userId) {
            notifySync(registeredUser.id, 'FRIEND_UPDATED');
          }
          return updatedById;
        }
        canUseProvidedId = false;
      }
    }

    // Se já existir um amigo deste usuário com o mesmo telefone normalizado, evita duplicata
    if (phone) {
      const allFriends = await prisma.friend.findMany({ where: { user_id: userId } });
      const samePhoneFriend = allFriends.find((f) => f.phone && phonesMatch(f.phone, phone));
      if (samePhoneFriend) {
        const updatedSamePhone = await prisma.friend.update({
          where: { id: samePhoneFriend.id },
          data: {
            name,
            phone,
            ...(pix_key ? { pix_key } : {}),
            color,
          },
        });
        if (registeredUser && registeredUser.id !== userId) {
          notifySync(registeredUser.id, 'FRIEND_UPDATED');
        }
        return updatedSamePhone;
      }
    }

    const createdFriend = await prisma.friend.create({
      data: {
        ...(canUseProvidedId && data.id ? { id: data.id } : {}),
        user_id: userId,
        name,
        phone,
        pix_key,
        color,
        is_favorite,
      },
    });

    if (registeredUser && registeredUser.id !== userId) {
      notifySync(registeredUser.id, 'FRIEND_UPDATED');
    }

    return createdFriend;
  }

  static async resolveFriendIdsForUser(
    userId: string,
    rawFriendIds: string[],
    friendsMeta?: Record<
      string,
      {
        name?: string;
        nome?: string;
        phone?: string;
        telefone?: string;
        pix_key?: string;
        pix?: string;
        color?: string;
        cor?: string;
      }
    >
  ): Promise<Map<string, string>> {
    const resolvedMap = new Map<string, string>();
    const uniqueRawIds = Array.from(new Set((rawFriendIds || []).filter((id) => Boolean(id && id !== 'self'))));
    if (uniqueRawIds.length === 0) return resolvedMap;

    const [currentUser, myFriends] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true },
      }),
      prisma.friend.findMany({
        where: { user_id: userId },
      }),
    ]);

    for (const rawId of uniqueRawIds) {
      const directMatch = myFriends.find((f) => f.id === rawId);
      if (directMatch) {
        resolvedMap.set(rawId, directMatch.id);
        continue;
      }

      const meta = friendsMeta?.[rawId];
      if (meta) {
        const metaName = (meta.name || meta.nome || '').trim();
        const metaPhone = normalizePhoneBackend(meta.phone || meta.telefone || '');
        const metaPix = (meta.pix_key || meta.pix || '').trim() || undefined;
        const metaColor = meta.color || meta.cor || 'bg-sky-500';

        const existingByMeta = myFriends.find(
          (f) =>
            (metaPhone && f.phone && phonesMatch(f.phone, metaPhone)) ||
            (metaName &&
              f.name.trim().toLowerCase() === metaName.toLowerCase() &&
              (!metaPhone || !f.phone || phonesMatch(f.phone, metaPhone)))
        );
        if (existingByMeta) {
          resolvedMap.set(rawId, existingByMeta.id);
          continue;
        }

        if (metaName || metaPhone) {
          try {
            const created = await this.create(userId, {
              id: rawId,
              name: metaName || 'Amigo',
              phone: metaPhone || undefined,
              pix_key: metaPix,
              color: metaColor,
            });
            myFriends.push(created);
            resolvedMap.set(rawId, created.id);
            continue;
          } catch {
            // fallback para próximas tentativas
          }
        }
      }

      const otherFriend = await prisma.friend.findUnique({ where: { id: rawId } });
      if (otherFriend) {
        if (currentUser?.phone && otherFriend.phone && phonesMatch(otherFriend.phone, currentUser.phone)) {
          continue;
        }
        const otherPhone = normalizePhoneBackend(otherFriend.phone);
        const otherName = (otherFriend.name || 'Amigo').trim();
        const existingMatch = myFriends.find(
          (f) =>
            (otherPhone && f.phone && phonesMatch(f.phone, otherPhone)) ||
            (otherName &&
              f.name.trim().toLowerCase() === otherName.toLowerCase() &&
              (!otherPhone || !f.phone || phonesMatch(f.phone, otherPhone)))
        );
        if (existingMatch) {
          resolvedMap.set(rawId, existingMatch.id);
          continue;
        }

        const createdFromOther = await prisma.friend.create({
          data: {
            user_id: userId,
            name: otherName || 'Amigo',
            phone: otherPhone || null,
            pix_key: otherFriend.pix_key || null,
            avatar_url: otherFriend.avatar_url || null,
            color: otherFriend.color || 'bg-sky-500',
            is_favorite: false,
          },
        });
        myFriends.push(createdFromOther);
        resolvedMap.set(rawId, createdFromOther.id);
        continue;
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: rawId },
        select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true },
      });
      if (targetUser && targetUser.id !== userId) {
        const targetPhone = normalizePhoneBackend(targetUser.phone);
        const targetName = (targetUser.name || 'Amigo').trim();
        const existingMatch = myFriends.find(
          (f) =>
            (targetPhone && f.phone && phonesMatch(f.phone, targetPhone)) ||
            (targetName &&
              f.name.trim().toLowerCase() === targetName.toLowerCase() &&
              (!targetPhone || !f.phone || phonesMatch(f.phone, targetPhone)))
        );
        if (existingMatch) {
          resolvedMap.set(rawId, existingMatch.id);
          continue;
        }

        const createdFromUser = await prisma.friend.create({
          data: {
            user_id: userId,
            name: targetName || 'Amigo',
            phone: targetPhone || null,
            pix_key: targetUser.pix_key || null,
            avatar_url: targetUser.avatar_url || null,
            color: 'bg-teal-500',
            is_favorite: false,
          },
        });
        myFriends.push(createdFromUser);
        resolvedMap.set(rawId, createdFromUser.id);
      }
    }

    return resolvedMap;
  }

  static async listPendingRequests(userId: string) {
    const requests = await prisma.friendshipRequest.findMany({
      where: {
        receiver_id: userId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true },
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
        avatar_url: r.sender.avatar_url || null,
        color: 'bg-teal-500',
      },
    }));
  }

  static async discoverRegisteredUsers(
    userId: string,
    rawContacts?: Array<{ name?: string; phone?: string }>
  ) {
    const [myFriends, allRequests, allUsers] = await Promise.all([
      prisma.friend.findMany({
        where: { user_id: userId },
        select: { id: true, name: true, phone: true },
      }),
      prisma.friendshipRequest.findMany({
        where: {
          OR: [{ sender_id: userId }, { receiver_id: userId }],
        },
      }),
      prisma.user.findMany({
        where: { id: { not: userId } },
        select: {
          id: true,
          name: true,
          phone: true,
          pix_key: true,
          avatar_url: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const contactsList = (Array.isArray(rawContacts) ? rawContacts : []).filter(
      (c) => c && c.phone
    );

    // Se o usuário não tiver contatos informados ou sincronizados, não há contatos com conta a exibir
    if (contactsList.length === 0) {
      return [];
    }

    const results = allUsers
      .map((u) => {
        if (!u.phone) return null;

        // O usuário cadastrado DEVE estar na lista de contatos do usuário
        const matchedContact = contactsList.find(
          (c) => c.phone && phonesMatch(c.phone, u.phone)
        );
        if (!matchedContact) return null;

        // Se já é amigo adicionado na lista de amigos, não deve aparecer aqui
        const alreadyFriend = myFriends.some(
          (f) => f.phone && phonesMatch(f.phone, u.phone)
        );
        if (alreadyFriend) return null;

        const existingReq = allRequests.find(
          (r) =>
            (r.sender_id === userId && r.receiver_id === u.id) ||
            (r.sender_id === u.id && r.receiver_id === userId)
        );

        return {
          id: u.id,
          name: u.name,
          contact_name: matchedContact?.name?.trim() || null,
          phone: u.phone,
          pix_key: u.pix_key?.trim() || null,
          avatar_url: u.avatar_url || null,
          has_account: true,
          is_registered: true,
          is_in_contacts: true,
          request_status: existingReq?.status || null,
          color: 'bg-teal-500',
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    results.sort((a, b) => {
      const nameA = a.contact_name || a.name || '';
      const nameB = b.contact_name || b.name || '';
      return nameA.localeCompare(nameB, 'pt-BR');
    });

    return results;
  }

  static async acceptRequest(userId: string, requestId: string) {
    const request = await prisma.friendshipRequest.findFirst({
      where: {
        id: requestId,
        receiver_id: userId,
      },
      include: {
        sender: { select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true } },
        receiver: { select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true } },
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
          avatar_url: request.sender.avatar_url || null,
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
          avatar_url: request.receiver.avatar_url || null,
          color: 'bg-teal-500',
          is_favorite: false,
        },
      });
    }

    notifySync(request.sender_id, 'FRIEND_REQUEST_ACCEPTED');
    notifySync(userId, 'FRIEND_REQUEST_ACCEPTED');

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

    notifySync(request.sender_id, 'FRIEND_REQUEST_REJECTED');

    return { message: 'Solicitação recusada com sucesso.' };
  }

  static async getAll(
    userId: string,
    existingReverseContext?: Awaited<ReturnType<typeof FriendService.syncReverseLinks>>,
    preloadedExpenses?: any[]
  ) {
    const reverseContext = existingReverseContext || (await this.syncReverseLinks(userId));

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
    let allUserExpenses = preloadedExpenses;
    if (!allUserExpenses) {
      const { ExpenseService } = await import('./Expense.service');
      allUserExpenses = await ExpenseService.listExpenses(userId, reverseContext);
    }

    // Mapeia todos os usuários para priorizar a chave Pix e foto que o amigo cadastrou para si
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true, phone: true, pix_key: true, avatar_url: true },
    });

    return friends.map((friend: any) => {
      let divida = 0; // Quanto o amigo deve para Você
      let voceDeve = 0; // Quanto Você deve para o amigo

      for (const exp of allUserExpenses!) {
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
            exp.self_amount_owed !== null && exp.self_amount_owed !== undefined && Number(exp.self_amount_owed) > 0
              ? Number(exp.self_amount_owed)
              : ((exp.participants || []).reduce((acc: number, p: any) => acc + Number(p.amount_owed || 0), 0) >= Number(exp.total_amount) - 0.1)
              ? 0
              : Number(exp.total_amount) / totalParts;
          const selfPaid = Number(exp.self_amount_paid || 0);
          const selfPending = selfOwed - selfPaid;
          if (selfPending > 0.005) voceDeve += selfPending;
        }
      }

      // Prioriza a chave Pix e foto que o próprio amigo cadastrou na conta dele e detecta se possui conta no RachApp
      let effectivePixKey = (friend.pix_key || '').trim();
      let effectiveAvatarUrl = friend.avatar_url || null;
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
          effectiveAvatarUrl = regUser.avatar_url || null;
        }
      }

      const saldoLiquido = Number((divida - voceDeve).toFixed(2));
      const dividaLiquida = saldoLiquido > 0.005 ? saldoLiquido : 0;
      const voceDeveLiquido = saldoLiquido < -0.005 ? Math.abs(saldoLiquido) : 0;

      const { expenses, ...friendData } = friend;
      return {
        ...friendData,
        pix_key: effectivePixKey,
        avatar_url: effectiveAvatarUrl,
        registered_pix_key: effectivePixKey,
        has_account: hasAccount,
        is_registered: hasAccount,
        registered_user_id: registeredUserId,
        divida: dividaLiquida,
        voceDeve: voceDeveLiquido,
        saldoLiquido,
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

      if (registered) {
        const existingReq = await prisma.friendshipRequest.findFirst({
          where: {
            OR: [
              { sender_id: userId, receiver_id: registered.id },
              { sender_id: registered.id, receiver_id: userId },
            ],
          },
        });
        if (!existingReq) {
          try {
            await prisma.friendshipRequest.create({
              data: {
                sender_id: userId,
                receiver_id: registered.id,
                status: 'PENDING',
              },
            });
            notifySync(registered.id, 'FRIEND_UPDATED');
          } catch {
            // Ignora conflito
          }
        }
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

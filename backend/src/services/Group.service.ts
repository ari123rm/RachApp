// src/services/GroupService.ts
import { prisma } from '../config/db';

export class GroupService {
  // 1. Criar um novo grupo
  static async createGroup(userId: string, name: string) {
    // Cria o grupo e já adiciona o criador como membro na mesma transação
    const group = await prisma.group.create({
      data: {
        name,
        created_by: userId,
        members: {
          create: {
            user_id: userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, pix_key: true, phone: true }
            }
          }
        }
      }
    });
    return group;
  }

  // 2. Listar os grupos do utilizador logado
  static async getUserGroups(userId: string) {
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            user_id: userId,
          },
        },
      },
      include: {
        // Traz uma contagem rápida para mostrar na interface (ex: "4 participantes")
        _count: {
          select: { members: true, expenses: true }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    return groups;
  }

  // 3. Adicionar um amigo ao grupo
  static async addMember(groupId: string, identifier: string) {
    // Busca o amigo no banco pelo email ou telefone
    const userToAdd = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier }
        ]
      }
    });

    if (!userToAdd) {
      throw new Error('Usuário não encontrado com este email ou telefone.');
    }

    // Verifica se a pessoa já está no grupo para evitar duplicidade
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        group_id_user_id: {
          group_id: groupId,
          user_id: userToAdd.id,
        }
      }
    });

    if (existingMember) {
      throw new Error('Este usuário já é membro do grupo.');
    }

    // Vincula o amigo ao grupo
    const newMember = await prisma.groupMember.create({
      data: {
        group_id: groupId,
        user_id: userToAdd.id,
      },
      include: {
        user: {
          select: { id: true, name: true, pix_key: true, phone: true }
        }
      }
    });

    return newMember;
  }
  // 4. Obter detalhes completos de um grupo específico
  static async getGroupById(groupId: string, userId: string) {
    // Garantir que o utilizador pertence ao grupo para evitar acessos indevidos
    const isMember = await prisma.groupMember.findUnique({
      where: {
        group_id_user_id: { group_id: groupId, user_id: userId }
      }
    });

    if (!isMember) {
      throw new Error('Não tem permissão para aceder a este grupo.');
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, pix_key: true, phone: true } }
          }
        },
        expenses: {
          orderBy: { expense_date: 'desc' },
          include: {
            owner: { select: { id: true, name: true } }, // 🟢 CORRIGIDO de "payer" para "owner"
            participants: { select: { friend_id: true, amount_owed: true, amount_paid: true } } // 🟢 CORRIGIDO de "user_id" para "friend_id"
          }
        }
      }
    });

    return group;
  }
}
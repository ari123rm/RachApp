// src/services/database.ts
import axios from 'axios';
import { getSQLiteDB, runSQL, queryAll, queryOne, flushSQLite } from './sqlite';
import { stripCountryCode } from '../utils/phoneFormatter';
import type { Amigo, Corrida, Grupo, MembroSaldo, SyncStatus, Transferencia, UserProfile } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
});

let memoryToken: string | null = null;
let isSyncing = false;
let lastSyncedAt: string | null = null;
let syncListeners: Array<(status: SyncStatus) => void> = [];

api.interceptors.request.use(async (config) => {
  if (!memoryToken) {
    try {
      const session = await queryOne<{ token: string }>('SELECT token FROM auth_session WHERE id = 1');
      if (session?.token) {
        memoryToken = session.token;
      }
    } catch {
      // ignore if not ready
    }
  }
  if (memoryToken && config.headers) {
    config.headers.Authorization = `Bearer ${memoryToken}`;
  }
  return config;
});

async function notifySyncListeners(stateOverride?: SyncStatus['state']) {
  try {
    const queueCountRow = await queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM sync_queue');
    const pendingCount = Number(queueCountRow?.cnt || 0);
    const state: SyncStatus['state'] =
      stateOverride || (isSyncing ? 'syncing' : pendingCount > 0 ? 'pending' : 'synced');
    const status: SyncStatus = { state, pendingCount, lastSyncedAt };
    syncListeners.forEach((cb) => cb(status));
  } catch {
    // ignore
  }
}

async function enqueueSync(entity: string, action: string, entityId: string, payload?: any) {
  await runSQL(
    `INSERT INTO sync_queue (entity, action, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
    [entity, action, entityId, payload ? JSON.stringify(payload) : null, new Date().toISOString()]
  );
  await notifySyncListeners('pending');
}

function toIsoDateOnly(dateInput?: string | Date | null): string {
  if (!dateInput) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (typeof dateInput === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return dateInput;
    if (dateInput.includes('T')) return dateInput.split('T')[0];
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function saveRemoteSnapshotToSQLite(data: {
  user?: any;
  friends?: any[];
  groups?: any[];
  expenses?: any[];
}) {
  const db = await getSQLiteDB();

  const pendingRows = await queryAll<{ entity_id: string }>('SELECT entity_id FROM sync_queue');
  const pendingIds = new Set(pendingRows.map((r) => r.entity_id));
  const localFriends = await queryAll<{ id: string }>('SELECT id FROM friends WHERE synced = 1');
  const localGroups = await queryAll<{ id: string }>('SELECT id FROM groups_table WHERE synced = 1');
  const localExps = await queryAll<{ id: string }>('SELECT id FROM expenses WHERE synced = 1');
  const currentSession = await queryOne<any>('SELECT * FROM auth_session WHERE id = 1');

  db.run('BEGIN TRANSACTION');
  try {
    if (data.user) {
      // Se o utilizador tiver acabado de editar o pix localmente (pendente na fila), preserva o local
      const hasPendingProfile = pendingIds.has('me') || pendingIds.has(data.user.id);
      if (!hasPendingProfile) {
        const preservedPix = data.user.pix_key || currentSession?.pix_key || '';
        db.run(
          `UPDATE auth_session SET name = ?, email = ?, phone = ?, pix_key = ?, phone_verified = ?, updated_at = ? WHERE id = 1`,
          [
            data.user.name || currentSession?.name || '',
            data.user.email || currentSession?.email || '',
            stripCountryCode(data.user.phone || currentSession?.phone || ''),
            preservedPix,
            data.user.phone_verified ? 1 : 0,
            new Date().toISOString(),
          ]
        );
      }
    }

    if (Array.isArray(data.friends)) {
      const remoteFriendIds = new Set(data.friends.map((f) => f.id));
      for (const lf of localFriends) {
        if (!remoteFriendIds.has(lf.id) && !pendingIds.has(lf.id)) {
          db.run('DELETE FROM friends WHERE id = ?', [lf.id]);
        }
      }

      for (const f of data.friends) {
        if (pendingIds.has(f.id)) continue;
        db.run(
          `INSERT OR REPLACE INTO friends (id, user_id, name, phone, pix_key, color, is_favorite, synced, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            f.id,
            f.user_id || data.user?.id || '',
            f.name || f.nome || '',
            stripCountryCode(f.phone || f.telefone || ''),
            f.pix_key || f.pix || '',
            f.color || f.cor || 'bg-sky-500',
            f.is_favorite || f.favorito ? 1 : 0,
            new Date().toISOString(),
          ]
        );
      }
    }

    if (Array.isArray(data.groups)) {
      const remoteGroupIds = new Set(data.groups.map((g) => g.id));
      for (const lg of localGroups) {
        if (!remoteGroupIds.has(lg.id) && !pendingIds.has(lg.id)) {
          db.run('DELETE FROM groups_table WHERE id = ?', [lg.id]);
          db.run('DELETE FROM group_members WHERE group_id = ?', [lg.id]);
        }
      }

      for (const g of data.groups) {
        if (pendingIds.has(g.id)) continue;
        db.run(
          `INSERT OR REPLACE INTO groups_table (id, name, created_by, created_at, synced)
           VALUES (?, ?, ?, ?, 1)`,
          [g.id, g.name, g.created_by || data.user?.id || '', g.created_at || new Date().toISOString()]
        );

        if (Array.isArray(g.members)) {
          db.run('DELETE FROM group_members WHERE group_id = ?', [g.id]);
          for (const m of g.members) {
            const memberId = m.id || `${g.id}_${m.friend_id || m.user_id || Math.random()}`;
            db.run(
              `INSERT OR REPLACE INTO group_members (id, group_id, user_id, friend_id, synced)
               VALUES (?, ?, ?, ?, 1)`,
              [memberId, g.id, m.user_id || m.user?.id || null, m.friend_id || m.friend?.id || null]
            );
          }
        }
      }
    }

    if (Array.isArray(data.expenses)) {
      const remoteExpIds = new Set(data.expenses.map((e) => e.id));
      for (const le of localExps) {
        if (!remoteExpIds.has(le.id) && !pendingIds.has(le.id)) {
          db.run('DELETE FROM expenses WHERE id = ?', [le.id]);
          db.run('DELETE FROM expense_participants WHERE expense_id = ?', [le.id]);
        }
      }

      for (const e of data.expenses) {
        if (pendingIds.has(e.id)) continue;
        db.run(
          `INSERT OR REPLACE INTO expenses (
            id, user_id, group_id, paid_by_friend_id, title, tag, total_amount, self_amount_owed, self_amount_paid, expense_date, synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            e.id,
            e.user_id || data.user?.id || '',
            e.group_id || null,
            e.paid_by_friend_id || null,
            e.title || '',
            e.tag || 'Uber',
            Number(e.total_amount || 0),
            Number(e.self_amount_owed || 0),
            Number(e.self_amount_paid || 0),
            toIsoDateOnly(e.expense_date),
          ]
        );

        if (Array.isArray(e.participants)) {
          db.run('DELETE FROM expense_participants WHERE expense_id = ?', [e.id]);
          for (const p of e.participants) {
            db.run(
              `INSERT OR REPLACE INTO expense_participants (expense_id, friend_id, amount_owed, amount_paid)
               VALUES (?, ?, ?, ?)`,
              [e.id, p.friend_id, Number(p.amount_owed || 0), Number(p.amount_paid || 0)]
            );
          }
        }
      }
    }

    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }

  await flushSQLite();
}

export async function syncWithBackend(pullAfterPush = true): Promise<boolean> {
  if (isSyncing) return false;

  const session = await queryOne<{ token: string; user_id: string }>('SELECT token, user_id FROM auth_session WHERE id = 1');
  if (!session?.token) return false;
  memoryToken = session.token;

  isSyncing = true;
  await notifySyncListeners('syncing');

  try {
    const queue = await queryAll<{
      id: number;
      entity: string;
      action: string;
      entity_id: string;
      payload: string | null;
    }>('SELECT * FROM sync_queue ORDER BY id ASC');

    for (const item of queue) {
      const payload = item.payload ? JSON.parse(item.payload) : {};
      try {
        if (item.entity === 'profile' && item.action === 'update') {
          await api.put('/auth/profile', payload);
        } else if (item.entity === 'friend') {
          if (item.action === 'create') {
            await api.post('/friends', payload);
            await runSQL('UPDATE friends SET synced = 1 WHERE id = ?', [item.entity_id], false);
          } else if (item.action === 'update') {
            await api.put(`/friends/${item.entity_id}`, payload);
            await runSQL('UPDATE friends SET synced = 1 WHERE id = ?', [item.entity_id], false);
          } else if (item.action === 'favorite') {
            await api.patch(`/friends/${item.entity_id}/favorite`);
            await runSQL('UPDATE friends SET synced = 1 WHERE id = ?', [item.entity_id], false);
          } else if (item.action === 'delete') {
            await api.delete(`/friends/${item.entity_id}`);
          }
        } else if (item.entity === 'group') {
          if (item.action === 'create') {
            await api.post('/groups', payload);
            await runSQL('UPDATE groups_table SET synced = 1 WHERE id = ?', [item.entity_id], false);
          } else if (item.action === 'update') {
            await api.put(`/groups/${item.entity_id}`, payload);
            await runSQL('UPDATE groups_table SET synced = 1 WHERE id = ?', [item.entity_id], false);
          } else if (item.action === 'delete') {
            await api.delete(`/groups/${item.entity_id}`);
          } else if (item.action === 'add_member') {
            await api.post(`/groups/${item.entity_id}/members`, payload);
          } else if (item.action === 'remove_member') {
            await api.delete(`/groups/${item.entity_id}/members/${payload.memberId}`);
          }
        } else if (item.entity === 'expense') {
          if (item.action === 'create') {
            await api.post('/finances/expenses', payload);
            await runSQL('UPDATE expenses SET synced = 1 WHERE id = ?', [item.entity_id], false);
          } else if (item.action === 'update') {
            await api.put(`/finances/expenses/${item.entity_id}`, payload);
            await runSQL('UPDATE expenses SET synced = 1 WHERE id = ?', [item.entity_id], false);
          } else if (item.action === 'delete') {
            await api.delete(`/finances/expenses/${item.entity_id}`);
          }
        } else if (item.entity === 'payment') {
          if (item.action === 'register') {
            await api.post('/finances/payments', payload);
          } else if (item.action === 'set_participant') {
            await api.post(`/finances/expenses/${item.entity_id}/payment`, payload);
          }
        }

        await runSQL('DELETE FROM sync_queue WHERE id = ?', [item.id], false);
      } catch (itemError: any) {
        if (itemError?.response?.status === 404 && item.action === 'delete') {
          await runSQL('DELETE FROM sync_queue WHERE id = ?', [item.id], false);
        } else if (!itemError?.response) {
          throw itemError;
        } else {
          console.warn(`Aviso ao sincronizar item ${item.entity}:${item.action}`, itemError?.response?.data || itemError.message);
          await runSQL('DELETE FROM sync_queue WHERE id = ?', [item.id], false);
        }
      }
    }

    await flushSQLite();

    if (pullAfterPush) {
      const { data } = await api.get('/finances/sync');
      await saveRemoteSnapshotToSQLite(data);
    }

    lastSyncedAt = new Date().toISOString();
    isSyncing = false;
    await notifySyncListeners('synced');
    return true;
  } catch (err) {
    isSyncing = false;
    await notifySyncListeners('offline');
    return false;
  }
}

function simplifyDebtsLocal(
  balances: Record<string, number>,
  entityMeta: Record<
    string,
    { id: string; name: string; phone?: string | null; pix_key?: string | null; color: string; isOwner?: boolean }
  >
): Transferencia[] {
  const debtors: { key: string; amount: number }[] = [];
  const creditors: { key: string; amount: number }[] = [];

  for (const [key, balance] of Object.entries(balances)) {
    if (balance < -0.01) debtors.push({ key, amount: Math.abs(balance) });
    else if (balance > 0.01) creditors.push({ key, amount: balance });
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let i = 0;
  let j = 0;
  const transfers: Transferencia[] = [];

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const transferAmount = Math.min(debtor.amount, creditor.amount);
    const fromMeta = entityMeta[debtor.key] || { id: debtor.key, name: 'Participante', color: 'bg-gray-600' };
    const toMeta = entityMeta[creditor.key] || { id: creditor.key, name: 'Credor', color: 'bg-teal-500' };

    if (transferAmount >= 0.01) {
      transfers.push({
        fromId: fromMeta.id,
        fromName: fromMeta.isOwner ? 'Você' : fromMeta.name,
        fromPhone: fromMeta.phone,
        fromColor: fromMeta.color,
        toId: toMeta.id,
        toName: toMeta.isOwner ? 'Você' : toMeta.name,
        toPhone: toMeta.phone,
        toPixKey: toMeta.pix_key,
        toColor: toMeta.color,
        amount: Number(transferAmount.toFixed(2)),
      });
    }

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return transfers;
}

export const dbService = {
  sync: {
    now: () => syncWithBackend(true),
    subscribe: (listener: (status: SyncStatus) => void) => {
      syncListeners.push(listener);
      notifySyncListeners();
      return () => {
        syncListeners = syncListeners.filter((l) => l !== listener);
      };
    },
  },

  // ==========================================
  // AUTENTICAÇÃO E SESSÃO
  // ==========================================
  auth: {
    initSession: async (): Promise<{ isAuthenticated: boolean; user: UserProfile | null }> => {
      await getSQLiteDB();
      const row = await queryOne<any>('SELECT * FROM auth_session WHERE id = 1');
      if (row && row.token) {
        memoryToken = row.token;
        syncWithBackend(true).catch(() => {});
        return {
          isAuthenticated: true,
          user: {
            id: row.user_id,
            name: row.name,
            nome: row.name,
            email: row.email,
            phone: row.phone,
            pix_key: row.pix_key || '',
            pix: row.pix_key || '',
            phone_verified: !!row.phone_verified,
          },
        };
      }
      return { isAuthenticated: false, user: null };
    },

    login: async (email: string, password_plain: string) => {
      const { data } = await api.post('/auth/login', { email, password: password_plain });
      memoryToken = data.token;

      const prevSession = await queryOne<any>('SELECT user_id FROM auth_session WHERE id = 1');
      if (prevSession && prevSession.user_id && prevSession.user_id !== data.user.id) {
        await runSQL('DELETE FROM friends', [], false);
        await runSQL('DELETE FROM groups_table', [], false);
        await runSQL('DELETE FROM group_members', [], false);
        await runSQL('DELETE FROM expenses', [], false);
        await runSQL('DELETE FROM expense_participants', [], false);
        await runSQL('DELETE FROM sync_queue', [], false);
      }

      await runSQL(
        `INSERT OR REPLACE INTO auth_session (id, token, user_id, name, email, phone, pix_key, phone_verified, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.token,
          data.user.id,
          data.user.name || '',
          data.user.email || '',
          stripCountryCode(data.user.phone || ''),
          data.user.pix_key || '',
          data.user.phone_verified ? 1 : 0,
          new Date().toISOString(),
        ]
      );

      await syncWithBackend(true);
      return data;
    },

    register: async (userData: any) => {
      const payload = {
        ...userData,
        phone: stripCountryCode(userData.phone) || userData.phone,
      };
      const { data } = await api.post('/auth/register', payload);
      if (data.token && data.user) {
        memoryToken = data.token;
        await runSQL(
          `INSERT OR REPLACE INTO auth_session (id, token, user_id, name, email, phone, pix_key, phone_verified, updated_at)
           VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.token,
            data.user.id,
            data.user.name || '',
            data.user.email || '',
            stripCountryCode(data.user.phone || ''),
            data.user.pix_key || userData.pix_key || '',
            data.user.phone_verified ? 1 : 0,
            new Date().toISOString(),
          ]
        );
      }
      return data;
    },

    verify: async (email: string, code: string) => {
      const { data } = await api.post('/auth/verify', { email, code });
      if (data.token && data.user) {
        memoryToken = data.token;
        await runSQL(
          `INSERT OR REPLACE INTO auth_session (id, token, user_id, name, email, phone, pix_key, phone_verified, updated_at)
           VALUES (1, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            data.token,
            data.user.id,
            data.user.name || '',
            data.user.email || '',
            stripCountryCode(data.user.phone || ''),
            data.user.pix_key || '',
            new Date().toISOString(),
          ]
        );
        await syncWithBackend(true);
      }
      return data;
    },

    resetPassword: async (identifier: string, newPassword: string) => {
      const { data } = await api.post('/auth/reset-password', { identifier, newPassword });
      return data;
    },

    logout: async () => {
      memoryToken = null;
      await runSQL('DELETE FROM auth_session', [], false);
      await runSQL('DELETE FROM friends', [], false);
      await runSQL('DELETE FROM groups_table', [], false);
      await runSQL('DELETE FROM group_members', [], false);
      await runSQL('DELETE FROM expenses', [], false);
      await runSQL('DELETE FROM expense_participants', [], false);
      await runSQL('DELETE FROM sync_queue', [], true);
    },

    updateProfile: async (data: { name?: string; phone?: string; pix_key?: string }) => {
      const session = await queryOne<any>('SELECT * FROM auth_session WHERE id = 1');
      const newName = data.name !== undefined ? data.name.trim() : session?.name || '';
      const newPhone =
        data.phone !== undefined
          ? stripCountryCode(data.phone) || data.phone.trim()
          : session?.phone || '';
      const newPix = data.pix_key !== undefined ? data.pix_key.trim() : session?.pix_key || '';

      // 1. Grava imediatamente na tabela auth_session
      await runSQL(
        `INSERT OR REPLACE INTO auth_session (id, token, user_id, name, email, phone, pix_key, phone_verified, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session?.token || memoryToken || '',
          session?.user_id || 'me',
          newName,
          session?.email || '',
          newPhone,
          newPix,
          session?.phone_verified ? 1 : 0,
          new Date().toISOString(),
        ]
      );

      // 2. Sincroniza com o backend imediatamente (ou enfileira se offline)
      try {
        await api.put('/auth/profile', {
          name: newName,
          phone: newPhone,
          pix_key: newPix,
        });
      } catch {
        await enqueueSync('profile', 'update', session?.user_id || 'me', {
          name: newName,
          phone: newPhone,
          pix_key: newPix,
        });
      }

      return {
        id: session?.user_id,
        name: newName,
        nome: newName,
        phone: newPhone,
        pix_key: newPix,
        pix: newPix,
      };
    },

    updatePassword: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await api.put('/auth/password', data);
      return res.data;
    },
  },

  // ==========================================
  // SERVIÇOS DE AMIGOS
  // ==========================================
  amigos: {
    getAll: async (): Promise<Amigo[]> => {
      const rows = await queryAll<any>(
        `SELECT * FROM friends ORDER BY is_favorite DESC, name ASC`
      );

      const amigos: Amigo[] = [];
      for (const r of rows) {
        const normPhone = stripCountryCode(r.phone || '');
        // Busca todas as participações desse amigo (avulsas E de grupos!)
        const dividaRows = await queryAll<{ amount_owed: number; amount_paid: number }>(
          `SELECT ep.amount_owed, ep.amount_paid
           FROM expense_participants ep
           JOIN expenses e ON e.id = ep.expense_id
           LEFT JOIN friends f ON f.id = ep.friend_id
           WHERE (
             ep.friend_id = ?
             OR (? != '' AND f.phone = ?)
             OR LOWER(TRIM(f.name)) = LOWER(TRIM(?))
           )
           AND (e.paid_by_friend_id IS NULL OR e.paid_by_friend_id = '')`,
          [r.id, normPhone, normPhone, r.name || '']
        );

        let dividaNum = 0;
        let pendingCount = 0;
        for (const dr of dividaRows) {
          const pend = Number(dr.amount_owed) - Number(dr.amount_paid);
          if (pend > 0.005) {
            dividaNum += pend;
            pendingCount += 1;
          }
        }

        amigos.push({
          id: r.id,
          nome: r.name,
          name: r.name,
          telefone: stripCountryCode(r.phone || ''),
          phone: stripCountryCode(r.phone || ''),
          pix_key: r.pix_key || '',
          pix: r.pix_key || '',
          cor: r.color || 'bg-sky-500',
          color: r.color || 'bg-sky-500',
          favorito: !!r.is_favorite,
          is_favorite: !!r.is_favorite,
          dividaNumerica: Number(dividaNum.toFixed(2)),
          pendingExpensesCount: pendingCount,
        });
      }

      return amigos;
    },

    create: async (novoAmigo: {
      nome?: string;
      name?: string;
      telefone?: string;
      phone?: string;
      pix_key?: string;
      pix?: string;
      cor?: string;
      color?: string;
      favorito?: boolean;
      is_favorite?: boolean;
    }): Promise<Amigo> => {
      const session = await queryOne<any>('SELECT user_id FROM auth_session WHERE id = 1');
      const name = (novoAmigo.nome || novoAmigo.name || '').trim();
      const rawPhone = (novoAmigo.telefone ?? novoAmigo.phone ?? '').trim();
      const phone = stripCountryCode(rawPhone);
      const pix_key = (novoAmigo.pix_key ?? novoAmigo.pix ?? '').trim();
      const color = novoAmigo.cor || novoAmigo.color || 'bg-sky-500';
      const is_favorite = novoAmigo.favorito ?? novoAmigo.is_favorite ?? false;

      // Se já existir amigo com mesmo telefone no banco local, atualiza e reutiliza o ID
      if (phone) {
        const existingByPhone = await queryOne<any>('SELECT * FROM friends WHERE phone = ?', [phone]);
        if (existingByPhone) {
          return dbService.amigos.update(existingByPhone.id, {
            nome: name,
            telefone: phone,
            pix_key: pix_key || existingByPhone.pix_key,
            cor: color,
            favorito: is_favorite,
          });
        }
      }

      const id = crypto.randomUUID();

      await runSQL(
        `INSERT INTO friends (id, user_id, name, phone, pix_key, color, is_favorite, synced, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [id, session?.user_id || '', name, phone, pix_key, color, is_favorite ? 1 : 0, new Date().toISOString()]
      );

      const payload = { id, name, phone, pix_key, color, is_favorite };
      await enqueueSync('friend', 'create', id, payload);
      syncWithBackend(false).catch(() => {});

      return {
        id,
        nome: name,
        name,
        telefone: phone,
        phone,
        pix_key,
        pix: pix_key,
        cor: color,
        color,
        favorito: is_favorite,
        is_favorite,
      };
    },

    update: async (
      id: string,
      dados: {
        nome?: string;
        name?: string;
        telefone?: string;
        phone?: string;
        pix_key?: string;
        pix?: string;
        cor?: string;
        color?: string;
        favorito?: boolean;
        is_favorite?: boolean;
      }
    ): Promise<Amigo> => {
      const existing = await queryOne<any>('SELECT * FROM friends WHERE id = ?', [id]);
      if (!existing) throw new Error('Amigo não encontrado.');

      const name = (dados.nome ?? dados.name ?? existing.name).trim();
      const rawPhone = (dados.telefone ?? dados.phone ?? existing.phone ?? '').trim();
      const phone = stripCountryCode(rawPhone);
      const pix_key = (dados.pix_key ?? dados.pix ?? existing.pix_key ?? '').trim();
      const color = dados.cor ?? dados.color ?? existing.color ?? 'bg-sky-500';
      const is_favorite =
        dados.favorito !== undefined
          ? dados.favorito
          : dados.is_favorite !== undefined
          ? dados.is_favorite
          : !!existing.is_favorite;

      await runSQL(
        `UPDATE friends
         SET name = ?, phone = ?, pix_key = ?, color = ?, is_favorite = ?, synced = 0, updated_at = ?
         WHERE id = ?`,
        [name, phone, pix_key, color, is_favorite ? 1 : 0, new Date().toISOString(), id]
      );

      const payload = { name, phone, pix_key, color, is_favorite };
      await enqueueSync('friend', 'update', id, payload);
      syncWithBackend(false).catch(() => {});

      return {
        id,
        nome: name,
        name,
        telefone: phone,
        phone,
        pix_key,
        pix: pix_key,
        cor: color,
        color,
        favorito: is_favorite,
        is_favorite,
      };
    },

    toggleFavorito: async (id: string): Promise<void> => {
      const existing = await queryOne<any>('SELECT is_favorite FROM friends WHERE id = ?', [id]);
      if (!existing) return;
      const nextFav = existing.is_favorite ? 0 : 1;

      await runSQL('UPDATE friends SET is_favorite = ?, synced = 0 WHERE id = ?', [nextFav, id]);
      await enqueueSync('friend', 'favorite', id);
      syncWithBackend(false).catch(() => {});
    },

    delete: async (id: string): Promise<void> => {
      await runSQL('DELETE FROM expense_participants WHERE friend_id = ?', [id], false);
      await runSQL('DELETE FROM group_members WHERE friend_id = ?', [id], false);
      await runSQL('DELETE FROM friends WHERE id = ?', [id], true);

      await enqueueSync('friend', 'delete', id);
      syncWithBackend(false).catch(() => {});
    },
  },

  // ==========================================
  // SERVIÇOS DE CORRIDAS / RACHAS
  // ==========================================
  corridas: {
    getAll: async (): Promise<Corrida[]> => {
      const expRows = await queryAll<any>(
        `SELECT e.*, g.name as group_name, f.name as payer_friend_name
         FROM expenses e
         LEFT JOIN groups_table g ON g.id = e.group_id
         LEFT JOIN friends f ON f.id = e.paid_by_friend_id
         ORDER BY e.expense_date DESC, e.rowid DESC`
      );

      const corridas: Corrida[] = [];
      for (const e of expRows) {
        const partRows = await queryAll<{
          friend_id: string;
          amount_owed: number;
          amount_paid: number;
        }>('SELECT friend_id, amount_owed, amount_paid FROM expense_participants WHERE expense_id = ?', [e.id]);

        const participantesIds = partRows.map((p) => p.friend_id);
        const pagamentos: Record<string, number> = {};
        const valoresDevidos: Record<string, number> = {};
        let allPaid = partRows.length > 0;

        for (const p of partRows) {
          pagamentos[p.friend_id] = Number(p.amount_paid || 0);
          valoresDevidos[p.friend_id] = Number(p.amount_owed || 0);
          if (Number(p.amount_owed) - Number(p.amount_paid) > 0.01) {
            allPaid = false;
          }
        }

        const defaultShare = Number(e.total_amount) / (partRows.length + 1);
        const selfAmountOwed =
          Number(e.self_amount_owed) > 0 ? Number(e.self_amount_owed) : Number(defaultShare.toFixed(2));

        corridas.push({
          id: e.id,
          titulo: e.title,
          title: e.title,
          valorTotal: Number(e.total_amount),
          total_amount: Number(e.total_amount),
          selfAmountOwed,
          data: toIsoDateOnly(e.expense_date),
          expense_date: toIsoDateOnly(e.expense_date),
          tag: e.tag || 'Uber',
          groupId: e.group_id || null,
          groupName: e.group_name || null,
          paidByFriendId: e.paid_by_friend_id || null,
          paidByName: e.paid_by_friend_id ? e.payer_friend_name || 'Amigo' : 'Você',
          participantesIds,
          isPaied: allPaid,
          pagamentos,
          valoresDevidos,
        });
      }

      return corridas;
    },

    create: async (novaCorrida: {
      titulo: string;
      valorTotal: number;
      data: string;
      tag: string;
      participantesIds: string[];
      groupId?: string | null;
      paidByFriendId?: string | null;
      pagamentos?: Record<string, number>;
      valoresDevidos?: Record<string, number>;
      selfAmountOwed?: number;
    }): Promise<Corrida> => {
      const session = await queryOne<any>('SELECT user_id FROM auth_session WHERE id = 1');
      const id = crypto.randomUUID();
      const uniqueParticipants = Array.from(new Set(novaCorrida.participantesIds));
      const totalPeople = uniqueParticipants.length + 1;
      const defaultSplit = Number((Number(novaCorrida.valorTotal) / totalPeople).toFixed(2));
      const selfOwed =
        novaCorrida.selfAmountOwed !== undefined
          ? Number(Number(novaCorrida.selfAmountOwed).toFixed(2))
          : defaultSplit;
      const dateStr = toIsoDateOnly(novaCorrida.data);
      const paidByFriendId = novaCorrida.paidByFriendId || null;

      await runSQL(
        `INSERT INTO expenses (
          id, user_id, group_id, paid_by_friend_id, title, tag, total_amount, self_amount_owed, self_amount_paid, expense_date, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          id,
          session?.user_id || '',
          novaCorrida.groupId || null,
          paidByFriendId,
          novaCorrida.titulo.trim(),
          (novaCorrida.tag || 'Uber').trim(),
          Number(novaCorrida.valorTotal),
          selfOwed,
          paidByFriendId ? 0 : selfOwed,
          dateStr,
        ],
        false
      );

      const pagamentos: Record<string, number> = {};
      const valoresDevidos: Record<string, number> = {};

      for (const friendId of uniqueParticipants) {
        const owedVal =
          novaCorrida.valoresDevidos?.[friendId] !== undefined
            ? Number(Number(novaCorrida.valoresDevidos[friendId]).toFixed(2))
            : defaultSplit;
        valoresDevidos[friendId] = owedVal;

        const isPayer = paidByFriendId === friendId;
        const paidVal = isPayer
          ? owedVal
          : novaCorrida.pagamentos?.[friendId] !== undefined
          ? Number(novaCorrida.pagamentos[friendId])
          : 0;
        pagamentos[friendId] = paidVal;

        await runSQL(
          `INSERT OR REPLACE INTO expense_participants (expense_id, friend_id, amount_owed, amount_paid)
           VALUES (?, ?, ?, ?)`,
          [id, friendId, owedVal, paidVal],
          false
        );
      }

      await flushSQLite();

      await enqueueSync('expense', 'create', id, {
        id,
        groupId: novaCorrida.groupId || null,
        paidByFriendId,
        title: novaCorrida.titulo.trim(),
        tag: (novaCorrida.tag || 'Uber').trim(),
        totalAmount: Number(novaCorrida.valorTotal),
        expenseDate: dateStr,
        participantIds: uniqueParticipants,
        pagamentos,
        valoresDevidos,
        selfAmountOwed: selfOwed,
      });
      syncWithBackend(false).catch(() => {});

      return {
        id,
        titulo: novaCorrida.titulo.trim(),
        valorTotal: Number(novaCorrida.valorTotal),
        selfAmountOwed: selfOwed,
        data: dateStr,
        tag: (novaCorrida.tag || 'Uber').trim(),
        groupId: novaCorrida.groupId || null,
        paidByFriendId,
        participantesIds: uniqueParticipants,
        isPaied: false,
        pagamentos,
        valoresDevidos,
      };
    },

    update: async (
      id: string,
      dados: {
        titulo: string;
        valorTotal: number;
        data: string;
        tag: string;
        participantesIds: string[];
        groupId?: string | null;
        paidByFriendId?: string | null;
        pagamentos?: Record<string, number>;
        valoresDevidos?: Record<string, number>;
        selfAmountOwed?: number;
      }
    ): Promise<Corrida> => {
      const existing = await queryOne<any>('SELECT * FROM expenses WHERE id = ?', [id]);
      if (!existing) throw new Error('Racha não encontrado.');

      const existingParts = await queryAll<{ friend_id: string; amount_paid: number }>(
        'SELECT friend_id, amount_paid FROM expense_participants WHERE expense_id = ?',
        [id]
      );
      const prevPaidMap = new Map<string, number>();
      existingParts.forEach((p) => prevPaidMap.set(p.friend_id, Number(p.amount_paid || 0)));

      const uniqueParticipants = Array.from(new Set(dados.participantesIds));
      const totalPeople = uniqueParticipants.length + 1;
      const defaultSplit = Number((Number(dados.valorTotal) / totalPeople).toFixed(2));
      const selfOwed =
        dados.selfAmountOwed !== undefined
          ? Number(Number(dados.selfAmountOwed).toFixed(2))
          : defaultSplit;
      const dateStr = toIsoDateOnly(dados.data);
      const paidByFriendId =
        dados.paidByFriendId !== undefined ? dados.paidByFriendId || null : existing.paid_by_friend_id;

      await runSQL(
        `UPDATE expenses
         SET group_id = ?, paid_by_friend_id = ?, title = ?, tag = ?, total_amount = ?, self_amount_owed = ?, expense_date = ?, synced = 0
         WHERE id = ?`,
        [
          dados.groupId !== undefined ? dados.groupId || null : existing.group_id,
          paidByFriendId,
          dados.titulo.trim(),
          (dados.tag || 'Uber').trim(),
          Number(dados.valorTotal),
          selfOwed,
          dateStr,
          id,
        ],
        false
      );

      await runSQL('DELETE FROM expense_participants WHERE expense_id = ?', [id], false);

      const pagamentos: Record<string, number> = {};
      const valoresDevidos: Record<string, number> = {};

      for (const friendId of uniqueParticipants) {
        const owedVal =
          dados.valoresDevidos?.[friendId] !== undefined
            ? Number(Number(dados.valoresDevidos[friendId]).toFixed(2))
            : defaultSplit;
        valoresDevidos[friendId] = owedVal;

        const isPayer = paidByFriendId === friendId;
        const prevPaid =
          dados.pagamentos?.[friendId] !== undefined
            ? Number(dados.pagamentos[friendId])
            : prevPaidMap.get(friendId) || 0;
        const paidVal = isPayer ? owedVal : Math.min(owedVal, prevPaid);
        pagamentos[friendId] = paidVal;

        await runSQL(
          `INSERT INTO expense_participants (expense_id, friend_id, amount_owed, amount_paid)
           VALUES (?, ?, ?, ?)`,
          [id, friendId, owedVal, paidVal],
          false
        );
      }

      await flushSQLite();

      await enqueueSync('expense', 'update', id, {
        groupId: dados.groupId !== undefined ? dados.groupId || null : existing.group_id,
        paidByFriendId,
        title: dados.titulo.trim(),
        tag: (dados.tag || 'Uber').trim(),
        totalAmount: Number(dados.valorTotal),
        expenseDate: dateStr,
        participantIds: uniqueParticipants,
        pagamentos,
        valoresDevidos,
        selfAmountOwed: selfOwed,
      });
      syncWithBackend(false).catch(() => {});

      return {
        id,
        titulo: dados.titulo.trim(),
        valorTotal: Number(dados.valorTotal),
        selfAmountOwed: selfOwed,
        data: dateStr,
        tag: (dados.tag || 'Uber').trim(),
        groupId: dados.groupId !== undefined ? dados.groupId || null : existing.group_id,
        paidByFriendId,
        participantesIds: uniqueParticipants,
        pagamentos,
        valoresDevidos,
      };
    },

    setPaied: async (id: string, isPaied: boolean = true): Promise<void> => {
      const parts = await queryAll<{ friend_id: string; amount_owed: number }>(
        'SELECT friend_id, amount_owed FROM expense_participants WHERE expense_id = ?',
        [id]
      );
      for (const p of parts) {
        const target = isPaied ? Number(p.amount_owed) : 0;
        await runSQL(
          'UPDATE expense_participants SET amount_paid = ? WHERE expense_id = ? AND friend_id = ?',
          [target, id, p.friend_id],
          false
        );
        await enqueueSync('payment', 'set_participant', id, {
          friendId: p.friend_id,
          amountPaid: target,
        });
      }
      await flushSQLite();
      syncWithBackend(false).catch(() => {});
    },

    delete: async (id: string): Promise<void> => {
      await runSQL('DELETE FROM expense_participants WHERE expense_id = ?', [id], false);
      await runSQL('DELETE FROM expenses WHERE id = ?', [id], true);

      await enqueueSync('expense', 'delete', id);
      syncWithBackend(false).catch(() => {});
    },
  },

  // ==========================================
  // SERVIÇOS DE GRUPOS
  // ==========================================
  grupos: {
    getAll: async (): Promise<Grupo[]> => {
      const groupRows = await queryAll<any>('SELECT * FROM groups_table ORDER BY created_at DESC');
      const session = await queryOne<any>('SELECT * FROM auth_session WHERE id = 1');

      const result: Grupo[] = [];
      for (const g of groupRows) {
        const memberRows = await queryAll<any>(
          `SELECT gm.*, f.name as friend_name, f.phone as friend_phone, f.pix_key as friend_pix, f.color as friend_color
           FROM group_members gm
           LEFT JOIN friends f ON f.id = gm.friend_id
           WHERE gm.group_id = ?`,
          [g.id]
        );

        const expCountRow = await queryOne<{ cnt: number }>(
          'SELECT COUNT(*) as cnt FROM expenses WHERE group_id = ?',
          [g.id]
        );

        const members = memberRows.map((m) => ({
          id: m.id,
          user: m.user_id
            ? {
                id: m.user_id,
                name: session?.name || 'Você',
                pix_key: session?.pix_key || '',
                phone: session?.phone || '',
              }
            : null,
          friend: m.friend_id
            ? {
                id: m.friend_id,
                name: m.friend_name || 'Amigo',
                phone: m.friend_phone || '',
                pix_key: m.friend_pix || '',
                color: m.friend_color || 'bg-sky-500',
              }
            : null,
        }));

        const hasSelf = members.some((m) => m.user !== null);
        const totalMembersCount = hasSelf ? members.length : members.length + 1;

        result.push({
          id: g.id,
          name: g.name,
          created_by: g.created_by,
          created_at: g.created_at,
          members,
          _count: {
            members: totalMembersCount,
            expenses: Number(expCountRow?.cnt || 0),
          },
        });
      }

      return result;
    },

    create: async (nameOrPayload: string | { name: string; friendIds?: string[] }): Promise<Grupo> => {
      const session = await queryOne<any>('SELECT * FROM auth_session WHERE id = 1');
      const id = crypto.randomUUID();
      const name = typeof nameOrPayload === 'string' ? nameOrPayload.trim() : nameOrPayload.name.trim();
      const friendIds =
        typeof nameOrPayload === 'string' ? [] : Array.from(new Set(nameOrPayload.friendIds || []));
      const createdAt = new Date().toISOString();
      const userId = session?.user_id || 'me';

      await runSQL(
        `INSERT INTO groups_table (id, name, created_by, created_at, synced) VALUES (?, ?, ?, ?, 0)`,
        [id, name, userId, createdAt],
        false
      );

      await runSQL(
        `INSERT INTO group_members (id, group_id, user_id, friend_id, synced) VALUES (?, ?, ?, NULL, 0)`,
        [`${id}_self`, id, userId],
        false
      );

      for (const fId of friendIds) {
        await runSQL(
          `INSERT INTO group_members (id, group_id, user_id, friend_id, synced) VALUES (?, ?, NULL, ?, 0)`,
          [`${id}_${fId}`, id, fId],
          false
        );
      }

      await flushSQLite();

      await enqueueSync('group', 'create', id, { id, name, friendIds });
      syncWithBackend(false).catch(() => {});

      return dbService.grupos.getById(id);
    },

    update: async (id: string, data: { name?: string; friendIds?: string[] }): Promise<Grupo> => {
      const session = await queryOne<any>('SELECT * FROM auth_session WHERE id = 1');
      const userId = session?.user_id || 'me';

      if (data.name !== undefined && data.name.trim()) {
        await runSQL('UPDATE groups_table SET name = ?, synced = 0 WHERE id = ?', [data.name.trim(), id], false);
      }

      if (Array.isArray(data.friendIds)) {
        const uniqueFriends = Array.from(new Set(data.friendIds));
        await runSQL('DELETE FROM group_members WHERE group_id = ?', [id], false);
        await runSQL(
          `INSERT INTO group_members (id, group_id, user_id, friend_id, synced) VALUES (?, ?, ?, NULL, 0)`,
          [`${id}_self`, id, userId],
          false
        );
        for (const fId of uniqueFriends) {
          await runSQL(
            `INSERT INTO group_members (id, group_id, user_id, friend_id, synced) VALUES (?, ?, NULL, ?, 0)`,
            [`${id}_${fId}`, id, fId],
            false
          );
        }
      }

      await flushSQLite();
      await enqueueSync('group', 'update', id, data);
      syncWithBackend(false).catch(() => {});

      return dbService.grupos.getById(id);
    },

    delete: async (id: string): Promise<void> => {
      await runSQL('UPDATE expenses SET group_id = NULL WHERE group_id = ?', [id], false);
      await runSQL('DELETE FROM group_members WHERE group_id = ?', [id], false);
      await runSQL('DELETE FROM groups_table WHERE id = ?', [id], true);

      await enqueueSync('group', 'delete', id);
      syncWithBackend(false).catch(() => {});
    },

    addMember: async (
      groupId: string,
      identifierOrPayload: string | { friendId?: string; identifier?: string; name?: string; phone?: string; pix_key?: string; color?: string }
    ) => {
      let friendIdToUse: string | null = null;
      const payload =
        typeof identifierOrPayload === 'string'
          ? { identifier: identifierOrPayload }
          : identifierOrPayload;

      if (payload.friendId) {
        friendIdToUse = payload.friendId;
      } else if (payload.identifier) {
        const clean = payload.identifier.trim();
        const cleanPhone = stripCountryCode(clean);
        const existingFriend = await queryOne<any>(
          'SELECT * FROM friends WHERE LOWER(name) = LOWER(?) OR (phone != "" AND phone = ?) OR (pix_key != "" AND pix_key = ?)',
          [clean, cleanPhone || clean, clean]
        );
        if (existingFriend) {
          friendIdToUse = existingFriend.id;
        } else {
          const createdFriend = await dbService.amigos.create({
            nome: payload.name || clean,
            telefone: payload.phone || cleanPhone,
            pix_key: payload.pix_key || '',
            cor: payload.color || 'bg-teal-500',
          });
          friendIdToUse = createdFriend.id;
        }
      }

      if (!friendIdToUse) throw new Error('Selecione ou informe um amigo válido.');

      const alreadyInGroup = await queryOne<any>(
        'SELECT id FROM group_members WHERE group_id = ? AND friend_id = ?',
        [groupId, friendIdToUse]
      );
      if (alreadyInGroup) throw new Error('Este amigo já faz parte do grupo.');

      await runSQL(
        `INSERT INTO group_members (id, group_id, user_id, friend_id, synced) VALUES (?, ?, NULL, ?, 0)`,
        [`${groupId}_${friendIdToUse}`, groupId, friendIdToUse],
        true
      );

      await enqueueSync('group', 'add_member', groupId, { friendId: friendIdToUse });
      syncWithBackend(false).catch(() => {});
    },

    removeMember: async (groupId: string, friendId: string) => {
      await runSQL('DELETE FROM group_members WHERE group_id = ? AND friend_id = ?', [groupId, friendId], true);
      await enqueueSync('group', 'remove_member', groupId, { memberId: friendId });
      syncWithBackend(false).catch(() => {});
    },

    getById: async (id: string): Promise<Grupo> => {
      const g = await queryOne<any>('SELECT * FROM groups_table WHERE id = ?', [id]);
      if (!g) throw new Error('Grupo não encontrado.');

      const session = await queryOne<any>('SELECT * FROM auth_session WHERE id = 1');
      const ownerId = session?.user_id || g.created_by || 'me';
      const ownerKey = `user:${ownerId}`;

      const memberRows = await queryAll<any>(
        `SELECT gm.*, f.name as friend_name, f.phone as friend_phone, f.pix_key as friend_pix, f.color as friend_color
         FROM group_members gm
         LEFT JOIN friends f ON f.id = gm.friend_id
         WHERE gm.group_id = ?`,
        [id]
      );

      const entityMeta: Record<
        string,
        { id: string; name: string; phone?: string | null; pix_key?: string | null; color: string; isOwner?: boolean }
      > = {
        [ownerKey]: {
          id: ownerId,
          name: session?.name || 'Você',
          phone: session?.phone || '',
          pix_key: session?.pix_key || '',
          color: 'bg-[#2DD4BF]',
          isOwner: true,
        },
      };

      const members: Grupo['members'] = [
        {
          id: `${id}_self`,
          user: {
            id: ownerId,
            name: session?.name || 'Você',
            pix_key: session?.pix_key || '',
            phone: session?.phone || '',
          },
          friend: null,
        },
      ];

      for (const m of memberRows) {
        if (m.friend_id) {
          entityMeta[m.friend_id] = {
            id: m.friend_id,
            name: m.friend_name || 'Amigo',
            phone: m.friend_phone || '',
            pix_key: m.friend_pix || '',
            color: m.friend_color || 'bg-sky-500',
          };
          members.push({
            id: m.id,
            user: null,
            friend: {
              id: m.friend_id,
              name: m.friend_name || 'Amigo',
              phone: m.friend_phone || '',
              pix_key: m.friend_pix || '',
              color: m.friend_color || 'bg-sky-500',
            },
          });
        }
      }

      const expRows = await queryAll<any>(
        `SELECT e.*, f.name as payer_friend_name, f.color as payer_friend_color, f.pix_key as payer_friend_pix, f.phone as payer_friend_phone
         FROM expenses e
         LEFT JOIN friends f ON f.id = e.paid_by_friend_id
         WHERE e.group_id = ?
         ORDER BY e.expense_date DESC, e.rowid DESC`,
        [id]
      );

      const netBalances: Record<string, number> = { [ownerKey]: 0 };
      const memberPendingCount: Record<string, number> = {};
      const memberOwesOwner: Record<string, number> = {};

      Object.keys(entityMeta).forEach((k) => {
        netBalances[k] = 0;
        memberPendingCount[k] = 0;
        memberOwesOwner[k] = 0;
      });

      const expensesWithDetails: any[] = [];

      for (const exp of expRows) {
        const parts = await queryAll<any>(
          `SELECT ep.*, f.name as friend_name, f.color as friend_color, f.phone as friend_phone, f.pix_key as friend_pix
           FROM expense_participants ep
           LEFT JOIN friends f ON f.id = ep.friend_id
           WHERE ep.expense_id = ?`,
          [exp.id]
        );

        for (const p of parts) {
          if (!entityMeta[p.friend_id]) {
            entityMeta[p.friend_id] = {
              id: p.friend_id,
              name: p.friend_name || 'Amigo',
              phone: p.friend_phone || '',
              pix_key: p.friend_pix || '',
              color: p.friend_color || 'bg-sky-500',
            };
            netBalances[p.friend_id] = 0;
            memberPendingCount[p.friend_id] = 0;
            memberOwesOwner[p.friend_id] = 0;
          }
        }

        const payerFriendId = exp.paid_by_friend_id;
        if (!payerFriendId) {
          for (const p of parts) {
            const pending = Number(p.amount_owed) - Number(p.amount_paid);
            if (pending > 0.005) {
              netBalances[ownerKey] = (netBalances[ownerKey] || 0) + pending;
              netBalances[p.friend_id] = (netBalances[p.friend_id] || 0) - pending;
              memberPendingCount[p.friend_id] = (memberPendingCount[p.friend_id] || 0) + 1;
              memberOwesOwner[p.friend_id] = (memberOwesOwner[p.friend_id] || 0) + pending;
            }
          }
        } else {
          if (!entityMeta[payerFriendId]) {
            entityMeta[payerFriendId] = {
              id: payerFriendId,
              name: exp.payer_friend_name || 'Amigo',
              phone: exp.payer_friend_phone || '',
              pix_key: exp.payer_friend_pix || '',
              color: exp.payer_friend_color || 'bg-purple-500',
            };
          }

          for (const p of parts) {
            if (p.friend_id === payerFriendId) continue;
            const pending = Number(p.amount_owed) - Number(p.amount_paid);
            if (pending > 0.005) {
              netBalances[payerFriendId] = (netBalances[payerFriendId] || 0) + pending;
              netBalances[p.friend_id] = (netBalances[p.friend_id] || 0) - pending;
              memberPendingCount[p.friend_id] = (memberPendingCount[p.friend_id] || 0) + 1;
            }
          }

          const selfOwed =
            Number(exp.self_amount_owed) > 0
              ? Number(exp.self_amount_owed)
              : Number(exp.total_amount) / (parts.length + 1);
          const selfPaid = Number(exp.self_amount_paid || 0);
          const selfPending = selfOwed - selfPaid;
          if (selfPending > 0.005) {
            netBalances[payerFriendId] = (netBalances[payerFriendId] || 0) + selfPending;
            netBalances[ownerKey] = (netBalances[ownerKey] || 0) - selfPending;
            memberOwesOwner[payerFriendId] = (memberOwesOwner[payerFriendId] || 0) - selfPending;
          }
        }

        expensesWithDetails.push({
          ...exp,
          owner: { id: ownerId, name: session?.name || 'Você' },
          paidByFriend: payerFriendId ? { id: payerFriendId, name: exp.payer_friend_name } : null,
          participants: parts,
        });
      }

      const transfers = simplifyDebtsLocal(netBalances, entityMeta);
      const memberBalances: MembroSaldo[] = Object.entries(entityMeta)
        .filter(([key]) => key !== ownerKey)
        .map(([key, meta]) => ({
          friendId: meta.id,
          name: meta.name,
          phone: meta.phone,
          pix_key: meta.pix_key,
          color: meta.color,
          netBalance: Number((netBalances[key] || 0).toFixed(2)),
          owesYou: Number((memberOwesOwner[key] || 0).toFixed(2)),
          pendingCount: memberPendingCount[key] || 0,
        }));

      return {
        id: g.id,
        name: g.name,
        created_by: g.created_by,
        created_at: g.created_at,
        members,
        expenses: expensesWithDetails,
        userNetBalance: Number((netBalances[ownerKey] || 0).toFixed(2)),
        memberBalances,
        transfers,
      };
    },
  },

  // ==========================================
  // SERVIÇOS FINANCEIROS E DASHBOARD
  // ==========================================
  dashboard: {
    get: async () => {
      const now = new Date();
      const ymPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const monthRow = await queryOne<{ total: number }>(
        `SELECT SUM(total_amount) as total FROM expenses WHERE substr(expense_date, 1, 7) = ?`,
        [ymPrefix]
      );
      const totalGasto = Number((monthRow?.total || 0).toFixed(2));

      const amigos = await dbService.amigos.getAll();
      let totalAReceber = 0;
      const amigosDevedores: any[] = [];

      for (const amigo of amigos) {
        const divida = Number(amigo.dividaNumerica || 0);
        if (divida > 0.01) {
          totalAReceber += divida;
          amigosDevedores.push({
            ...amigo,
            divida: Number(divida.toFixed(2)),
          });
        }
      }

      return {
        totalGasto,
        totalAReceber: Number(totalAReceber.toFixed(2)),
        amigosDevedores,
      };
    },
  },

  financeiro: {
    calcularDividaDoAmigo: async (amigoId: string): Promise<number> => {
      const friendRow = await queryOne<any>('SELECT * FROM friends WHERE id = ?', [amigoId]);
      const normPhone = stripCountryCode(friendRow?.phone || '');
      const friendName = friendRow?.name || '';

      const rows = await queryAll<{ amount_owed: number; amount_paid: number }>(
        `SELECT ep.amount_owed, ep.amount_paid
         FROM expense_participants ep
         JOIN expenses e ON e.id = ep.expense_id
         LEFT JOIN friends f ON f.id = ep.friend_id
         WHERE (
           ep.friend_id = ?
           OR (? != '' AND f.phone = ?)
           OR (? != '' AND LOWER(TRIM(f.name)) = LOWER(TRIM(?)))
         )
         AND (e.paid_by_friend_id IS NULL OR e.paid_by_friend_id = '')`,
        [amigoId, normPhone, normPhone, friendName, friendName]
      );

      let totalDevido = 0;
      for (const r of rows) {
        const pendente = Number(r.amount_owed) - Number(r.amount_paid);
        if (pendente > 0.005) {
          totalDevido += pendente;
        }
      }
      return Number(totalDevido.toFixed(2));
    },

    desfazerPagamentoDaCorrida: async (corridaId: string, amigoId: string): Promise<void> => {
      await runSQL(
        `UPDATE expense_participants SET amount_paid = 0 WHERE expense_id = ? AND friend_id = ?`,
        [corridaId, amigoId],
        true
      );
      await enqueueSync('payment', 'set_participant', corridaId, {
        friendId: amigoId,
        amountPaid: 0,
      });
      syncWithBackend(false).catch(() => {});
    },

    definirPagamentoParticipante: async (corridaId: string, amigoId: string, valorPago: number): Promise<void> => {
      await runSQL(
        `UPDATE expense_participants SET amount_paid = ? WHERE expense_id = ? AND friend_id = ?`,
        [Number(valorPago.toFixed(2)), corridaId, amigoId],
        true
      );
      await enqueueSync('payment', 'set_participant', corridaId, {
        friendId: amigoId,
        amountPaid: Number(valorPago.toFixed(2)),
      });
      syncWithBackend(false).catch(() => {});
    },

    registrarPagamento: async (amigoId: string, valorPago: number, groupId?: string): Promise<void> => {
      const rows = await queryAll<{
        expense_id: string;
        friend_id: string;
        amount_owed: number;
        amount_paid: number;
      }>(
        `SELECT ep.expense_id, ep.friend_id, ep.amount_owed, ep.amount_paid
         FROM expense_participants ep
         JOIN expenses e ON e.id = ep.expense_id
         WHERE ep.friend_id = ?
           AND (e.paid_by_friend_id IS NULL OR e.paid_by_friend_id = '')
           ${groupId ? 'AND e.group_id = ?' : ''}
         ORDER BY e.expense_date ASC, e.rowid ASC`,
        groupId ? [amigoId, groupId] : [amigoId]
      );

      let saldoRestante = Number(valorPago);

      for (const r of rows) {
        if (saldoRestante <= 0.005) break;
        const faltaPagar = Number(r.amount_owed) - Number(r.amount_paid);
        if (faltaPagar > 0.005) {
          const abater = Math.min(faltaPagar, saldoRestante);
          const novoPago = Number((Number(r.amount_paid) + abater).toFixed(2));
          await runSQL(
            `UPDATE expense_participants SET amount_paid = ? WHERE expense_id = ? AND friend_id = ?`,
            [novoPago, r.expense_id, r.friend_id],
            false
          );
          saldoRestante -= abater;
        }
      }

      await flushSQLite();
      await enqueueSync('payment', 'register', amigoId, {
        debtorId: amigoId,
        amount: Number(valorPago),
        groupId,
      });
      syncWithBackend(false).catch(() => {});
    },
  },

  // ==========================================
  // CONFIGURAÇÕES / PERFIL
  // ==========================================
  settings: {
    get: async () => {
      let row = await queryOne<any>('SELECT * FROM auth_session WHERE id = 1');

      // Se o utilizador estiver autenticado mas ainda não tiver o pix_key carregado no cache local, busca do servidor
      if (row && row.token && !row.pix_key) {
        try {
          const { data: me } = await api.get('/auth/me');
          if (me && me.id) {
            await runSQL(
              `UPDATE auth_session SET name = ?, email = ?, phone = ?, pix_key = ?, updated_at = ? WHERE id = 1`,
              [
                me.name || row.name || '',
                me.email || row.email || '',
                stripCountryCode(me.phone || row.phone || ''),
                me.pix_key || '',
                new Date().toISOString(),
              ]
            );
            row = await queryOne<any>('SELECT * FROM auth_session WHERE id = 1');
          }
        } catch {
          // ignore if offline
        }
      }

      if (row) {
        return {
          id: row.user_id,
          name: row.name || 'Usuário',
          nome: row.name || 'Usuário',
          email: row.email || '',
          phone: row.phone || '',
          telefone: row.phone || '',
          pix_key: row.pix_key || '',
          pix: row.pix_key || '',
          notificacoes: true,
        };
      }
      return {
        name: 'Usuário',
        nome: 'Usuário',
        email: '',
        phone: '',
        telefone: '',
        pix_key: '',
        pix: '',
        notificacoes: true,
      };
    },

    save: async (config: { nome?: string; name?: string; pix?: string; pix_key?: string; phone?: string }) => {
      return dbService.auth.updateProfile({
        name: config.name ?? config.nome,
        pix_key: config.pix_key ?? config.pix,
        phone: config.phone,
      });
    },

    updateProfile: async (data: { name?: string; phone?: string; pix_key?: string }) => {
      return dbService.auth.updateProfile(data);
    },

    updatePassword: async (data: { currentPassword: string; newPassword: string }) => {
      return dbService.auth.updatePassword(data);
    },

    clearAllData: async () => {
      await dbService.auth.logout();
    },
  },
};
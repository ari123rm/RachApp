// src/types/index.ts

export interface UserProfile {
  id: string;
  name: string;
  nome?: string;
  email: string;
  phone: string;
  pix_key?: string;
  pix?: string;
  phone_verified?: boolean;
}

export interface Amigo {
  id: string;
  nome: string;
  name?: string;
  telefone: string;
  phone?: string;
  pix_key?: string;
  pix?: string;
  cor: string;
  color?: string;
  favorito: boolean;
  is_favorite?: boolean;
  divida?: string | number;
  dividaNumerica?: number;
  voceDeve?: string | number;
  voceDeveNumerico?: number;
  pendingExpensesCount?: number;
}

export interface Corrida {
  id: string;
  titulo: string;
  title?: string;
  valorTotal: number;
  total_amount?: number;
  selfAmountOwed?: number;
  selfAmountPaid?: number;
  data: string; // YYYY-MM-DD
  expense_date?: string;
  tag: string;
  groupId?: string | null;
  groupName?: string | null;
  paidByFriendId?: string | null;
  paidByName?: string | null;
  participantesIds: string[];
  isPaied?: boolean;
  pagamentos?: Record<string, number>; // { amigoId: valorPago }
  valoresDevidos?: Record<string, number>; // { amigoId: valorDevido }
  selfReceiptUrl?: string | null;
  comprovantes?: Record<string, string>; // { amigoId: base64ReceiptUrl }
}

export interface Transferencia {
  fromId: string;
  fromName: string;
  fromPhone?: string | null;
  fromColor?: string;
  toId: string;
  toName: string;
  toPhone?: string | null;
  toPixKey?: string | null;
  toColor?: string;
  amount: number;
}

export interface MembroSaldo {
  friendId: string;
  name: string;
  phone?: string | null;
  pix_key?: string | null;
  color: string;
  netBalance: number;
  owesYou: number;
  pendingCount: number;
}

export interface Grupo {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  members: {
    id?: string;
    user?: { id: string; name: string; pix_key?: string | null; phone?: string | null } | null;
    friend?: {
      id: string;
      name: string;
      phone?: string | null;
      pix_key?: string | null;
      color: string;
    } | null;
  }[];
  expenses?: any[];
  _count?: {
    members: number;
    expenses: number;
  };
  userNetBalance?: number;
  memberBalances?: MembroSaldo[];
  transfers?: Transferencia[];
}

export interface SyncStatus {
  state: 'synced' | 'syncing' | 'offline' | 'pending';
  pendingCount: number;
  lastSyncedAt: string | null;
}

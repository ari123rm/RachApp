// src/components/GroupDetailsModal.tsx
import { createPortal } from 'react-dom';
import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  UserPlus,
  LoaderCircle,
  Plus,
  QrCode,
  CheckCircle2,
  ArrowRight,
  Pencil,
  Trash2,
  DollarSign,
  Users,
  Upload,
  BadgeCheck,
  TrendingDown,
  TrendingUp,
  Share2,
} from 'lucide-react';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';
import { AddRideModal } from './AddRideModal';
import { AddGroupModal } from './AddGroupModal';
import { AddFriendModal } from './AddFriendModal';
import { AvatarEditModal } from './AvatarEditModal';
import { PixModal } from './PixModal';
import { PayWithReceiptModal } from './ReceiptModals';
import { RideDetailsModal } from './RideDetailsModal';
import { RideCard } from './RideCard';
import { formatPhoneBR, openWhatsApp, phonesMatchBR, stripCountryCode } from '../utils/phoneFormatter';
import { generatePixCopiaECola } from '../utils/pixGenerator';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { getAvatarColor } from '../utils/avatarColor';
import { getRideStatusForUser } from '../utils/rideStatus';
import type { CorridaNettingInfo } from '../utils/netting';
import type { Amigo, Corrida, Grupo, Transferencia } from '../types';

interface GroupDetailsProps {
  grupoId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export function GroupDetailsModal({ grupoId, isOpen, onClose, onChanged }: GroupDetailsProps) {
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [todosAmigos, setTodosAmigos] = useState<Amigo[]>([]);
  const [todasCorridas, setTodasCorridas] = useState<Corrida[]>([]);
  const [myConfig, setMyConfig] = useState<{
    id?: string;
    nome: string;
    pix: string;
    avatar_url?: string | null;
  }>({ nome: 'Você', pix: '', avatar_url: null });

  const [isLoading, setIsLoading] = useState(false);
  const [isAddingMemberId, setIsAddingMemberId] = useState<string | null>(null);
  const [showAddMemberSection, setShowAddMemberSection] = useState(false);

  const [isAddRideOpen, setIsAddRideOpen] = useState(false);
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [isEditAvatarOpen, setIsEditAvatarOpen] = useState(false);
  const [isCreateFriendOpen, setIsCreateFriendOpen] = useState(false);
  const [corridaSelecionada, setCorridaSelecionada] = useState<Corrida | null>(null);
  const [filtroStatusGrupo, setFiltroStatusGrupo] = useState<'tudo' | 'a_pagar' | 'a_receber' | 'quitados'>('tudo');

  const nettingCache = useMemo(
    () => new Map<string, Map<string, CorridaNettingInfo>>(),
    [todasCorridas, todosAmigos]
  );

  const [payMemberTarget, setPayMemberTarget] = useState<{
    isOpen: boolean;
    friendId: string;
    friendName: string;
    pixKey: string;
    amount: number;
  }>({
    isOpen: false,
    friendId: '',
    friendName: '',
    pixKey: '',
    amount: 0,
  });

  const [pixModalData, setPixModalData] = useState<{
    isOpen: boolean;
    pixKey: string;
    recipientName: string;
    amount: number;
    description: string;
    whatsappPhone?: string;
    whatsappCustomMessage?: string;
  }>({
    isOpen: false,
    pixKey: '',
    recipientName: '',
    amount: 0,
    description: '',
  });

  const sheetRef = useModalBackHandler(isOpen, onClose);

  const carregarDetalhes = async () => {
    if (!grupoId) return;
    setIsLoading(true);
    try {
      const [dadosGrupo, amigos, corridas, config] = await Promise.all([
        dbService.grupos.getById(grupoId),
        dbService.amigos.getAll(),
        dbService.corridas.getAll(),
        dbService.settings.get(),
      ]);
      setGrupo(dadosGrupo);
      setTodosAmigos(amigos);
      setTodasCorridas(corridas);
      setCorridaSelecionada((prev) =>
        prev ? corridas.find((c) => c.id === prev.id) || prev : null
      );
      setMyConfig({
        id: config.id,
        nome: config.nome || config.name || 'Você',
        pix: config.pix_key || config.pix || '',
        avatar_url: config.avatar_url || null,
      });
    } catch (error) {
      console.error('Erro ao carregar detalhes do grupo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && grupoId) {
      setShowAddMemberSection(false);
      carregarDetalhes();
    }
  }, [isOpen, grupoId]);

  const handleSelectExistingFriend = async (friendId: string) => {
    if (!grupoId) return;
    setIsAddingMemberId(friendId);
    try {
      await dbService.grupos.addMember(grupoId, { friendId });
      await carregarDetalhes();
      if (onChanged) onChanged();
    } catch (error: any) {
      alert(error.response?.data?.error || error.message || 'Erro ao adicionar amigo ao grupo.');
    } finally {
      setIsAddingMemberId(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!grupo) return;
    if (!window.confirm(`Deseja realmente excluir o grupo "${grupo.name}"?`)) return;
    try {
      await dbService.grupos.delete(grupo.id);
      if (onChanged) onChanged();
      onClose();
    } catch {
      alert('Erro ao excluir grupo.');
    }
  };

  const handleQuitarMembroNoGrupo = async (friendId: string, amount: number, friendName: string) => {
    if (!grupo) return;
    if (!window.confirm(`Confirmar recebimento de R$ ${moneyConverter(amount)} de ${friendName} neste grupo?`)) {
      return;
    }
    try {
      await dbService.financeiro.registrarPagamento(friendId, amount, grupo.id, null, 'from_friend');
      await carregarDetalhes();
      if (onChanged) onChanged();
    } catch {
      alert('Erro ao registrar pagamento.');
    }
  };

  const handleConfirmPayMemberWithReceipt = async (amount: number, receiptBase64: string) => {
    if (!grupo || !payMemberTarget.friendId) return;
    await dbService.financeiro.registrarPagamento(
      payMemberTarget.friendId,
      amount,
      grupo.id,
      receiptBase64,
      'to_friend'
    );
    await carregarDetalhes();
    if (onChanged) onChanged();
  };

  const montarMensagemResumoGrupo = (cfg?: { nome: string; pix: string }) => {
    if (!grupo) return '';
    const myName = (cfg?.nome || myConfig.nome || 'Você').trim();
    const myPix = (cfg?.pix || myConfig.pix || '').trim();
    const membersList = grupo.memberBalances || [];

    const allKnownNames = Array.from(
      new Set(
        [
          myName,
          ...membersList.map((m) => (m.name || '').trim()),
          ...(grupo.expenses || []).flatMap((e: any) => [
            (e.paidByFriend?.name || e.payer_friend_name || '').trim(),
            ...(e.participants || []).map((p: any) => (p.friend?.name || p.friend_name || '').trim()),
          ]),
        ].filter(Boolean)
      )
    );

    const getShortName = (rawName?: string | null): string => {
      const clean = (rawName || '').trim();
      if (!clean) return 'Amigo';
      if (clean === 'Você') return getShortName(myName);
      const parts = clean.split(/\s+/);
      const first = parts[0];
      const hasDuplicateFirst = allKnownNames.some(
        (other) =>
          other.toLowerCase() !== clean.toLowerCase() &&
          other.split(/\s+/)[0]?.toLowerCase() === first.toLowerCase()
      );
      if (hasDuplicateFirst && parts.length > 1) {
        return `${parts[0]} ${parts[1][0]}.`;
      }
      return first;
    };

    const resolveMemberFullName = (friendId?: string | null, fallbackName?: string | null): string => {
      if (
        !friendId ||
        friendId === 'self' ||
        friendId === 'me' ||
        (myConfig.id && friendId === myConfig.id) ||
        fallbackName === 'Você'
      ) {
        return myName;
      }
      const fromBalance = membersList.find((m) => m.friendId === friendId);
      if (fromBalance?.name) return fromBalance.name.trim();
      const fromGroup = (grupo.members || []).find((m) => m.friend?.id === friendId);
      if (fromGroup?.friend?.name) return fromGroup.friend.name.trim();
      const fromFriends = todosAmigos.find((a) => a.id === friendId);
      if (fromFriends) return (fromFriends.nome || fromFriends.name || fallbackName || 'Amigo').trim();
      return (fallbackName || 'Amigo').trim();
    };

    const resolveMemberPix = (
      friendId?: string | null,
      rawName?: string | null,
      fallbackPix?: string | null
    ): string => {
      if (
        !friendId ||
        friendId === 'self' ||
        friendId === 'me' ||
        (myConfig.id && friendId === myConfig.id) ||
        rawName === 'Você' ||
        (rawName && rawName.trim().toLowerCase() === myName.toLowerCase())
      ) {
        return myPix;
      }
      if (fallbackPix?.trim()) return fallbackPix.trim();

      const fromBalance = membersList.find((m) => m.friendId === friendId);
      if (fromBalance?.pix_key?.trim()) return fromBalance.pix_key.trim();

      const fromGroup = (grupo.members || []).find((m) => m.friend?.id === friendId);
      if (fromGroup?.friend?.pix_key?.trim()) return fromGroup.friend.pix_key.trim();

      const targetPhone = stripCountryCode(fromBalance?.phone || fromGroup?.friend?.phone || '');
      const targetName = (rawName || fromBalance?.name || '').trim().toLowerCase();

      const friendMatch =
        todosAmigos.find((a) => a.id === friendId) ||
        todosAmigos.find((a) => {
          const aPhone = stripCountryCode(a.telefone || a.phone || '');
          if (targetPhone && aPhone && phonesMatchBR(targetPhone, aPhone)) return true;
          const aName = (a.nome || a.name || '').trim().toLowerCase();
          return Boolean(targetName && aName && targetName === aName);
        });

      const friendPix = (
        (friendMatch as any)?.registered_pix_key ||
        friendMatch?.pix_key ||
        friendMatch?.pix ||
        ''
      ).trim();
      if (friendPix) return friendPix;

      const rachaComPix = todasCorridas.find(
        (c) => c.paidByFriendId === friendId && c.payerPixKey?.trim()
      );
      if (rachaComPix?.payerPixKey?.trim()) return rachaComPix.payerPixKey.trim();

      return '';
    };

    const formatarDataCurta = (iso?: string) => {
      if (!iso) return '';
      const datePart = iso.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length !== 3) return datePart;
      return `${parts[2]}/${parts[1]}`;
    };

    // 1. Rachas Pendentes do Grupo (quem precisa pagar o quê e quanto)
    const sortedExpenses = [...(grupo.expenses || [])].sort((a: any, b: any) => {
      const da = String(a.expense_date || '');
      const db = String(b.expense_date || '');
      return da.localeCompare(db);
    });

    const linhasRachasPendentes: string[] = [];

    for (const exp of sortedExpenses) {
      const valorTotal = Number(exp.total_amount || 0);
      const payerFriendId = exp.paid_by_friend_id || null;
      const payerFullName = payerFriendId
        ? resolveMemberFullName(payerFriendId, exp.paidByFriend?.name || exp.payer_friend_name)
        : myName;
      const payerShort = getShortName(payerFullName);
      const parts = exp.participants || [];

      const devedores: { nome: string; valor: number }[] = [];

      if (!payerFriendId) {
        for (const p of parts) {
          const pend = Number(p.amount_owed || 0) - Number(p.amount_paid || 0);
          if (pend > 0.005) {
            const pFull = resolveMemberFullName(p.friend_id, p.friend?.name || p.friend_name);
            devedores.push({ nome: getShortName(pFull), valor: Number(pend.toFixed(2)) });
          }
        }
      } else {
        for (const p of parts) {
          if (p.friend_id === payerFriendId) continue;
          const pend = Number(p.amount_owed || 0) - Number(p.amount_paid || 0);
          if (pend > 0.005) {
            const pFull = resolveMemberFullName(p.friend_id, p.friend?.name || p.friend_name);
            devedores.push({ nome: getShortName(pFull), valor: Number(pend.toFixed(2)) });
          }
        }

        const partSum = parts.reduce((acc: number, p: any) => acc + Number(p.amount_owed || 0), 0);
        const selfOwed =
          exp.self_amount_owed !== null &&
          exp.self_amount_owed !== undefined &&
          Number(exp.self_amount_owed) > 0
            ? Number(exp.self_amount_owed)
            : Math.abs(partSum - valorTotal) <= 0.1 || partSum >= valorTotal - 0.1
            ? 0
            : valorTotal / (parts.length + 1);
        const selfPaid = Number(exp.self_amount_paid || 0);
        const selfPend = Number((selfOwed - selfPaid).toFixed(2));
        if (selfPend > 0.005) {
          devedores.push({ nome: getShortName(myName), valor: selfPend });
        }
      }

      if (devedores.length > 0) {
        const mesmoValor =
          devedores.length >= 2 &&
          devedores.every((d) => Math.abs(d.valor - devedores[0].valor) < 0.01);
        const textoDevedores = mesmoValor
          ? `${devedores.map((d) => d.nome).join(', ')}: R$ ${moneyConverter(devedores[0].valor)} cada`
          : devedores.map((d) => `${d.nome}: R$ ${moneyConverter(d.valor)}`).join(' | ');

        const dataCurta = formatarDataCurta(exp.expense_date);
        const titulo = (exp.title || exp.tag || 'Racha').trim();
        linhasRachasPendentes.push(
          `• ${dataCurta ? `${dataCurta} ` : ''}*${titulo}* (R$ ${moneyConverter(valorTotal)} • pg: ${payerShort})\n  ↳ ${textoDevedores}`
        );
      }
    }

    // 2. Transferências e Proposta de Envio Otimizado
    const rawTransfers = grupo.transfers || [];
    const directTransfers = rawTransfers.map((t) => {
      const isFromMe = t.fromName === 'Você' || (myConfig.id && t.fromId === myConfig.id);
      const isToMe = t.toName === 'Você' || (myConfig.id && t.toId === myConfig.id);
      const fromKey = isFromMe ? 'self' : t.fromId;
      const toKey = isToMe ? 'self' : t.toId;
      const fromFull = isFromMe ? myName : resolveMemberFullName(t.fromId, t.fromName);
      const toFull = isToMe ? myName : resolveMemberFullName(t.toId, t.toName);
      const toPix = resolveMemberPix(toKey, toFull, t.toPixKey);
      return {
        fromKey,
        toKey,
        fromShort: getShortName(fromFull),
        fromFull,
        toShort: getShortName(toFull),
        toFull,
        toPix,
        amount: Number(t.amount.toFixed(2)),
      };
    });

    // Algoritmo guloso para proposta de envio otimizado (mínimo de transferências no grupo)
    const netByKey = new Map<
      string,
      { key: string; shortName: string; fullName: string; pix: string; net: number }
    >();

    for (const dt of directTransfers) {
      if (!netByKey.has(dt.fromKey)) {
        netByKey.set(dt.fromKey, {
          key: dt.fromKey,
          shortName: dt.fromShort,
          fullName: dt.fromFull,
          pix: '',
          net: 0,
        });
      }
      if (!netByKey.has(dt.toKey)) {
        netByKey.set(dt.toKey, {
          key: dt.toKey,
          shortName: dt.toShort,
          fullName: dt.toFull,
          pix: dt.toPix,
          net: 0,
        });
      } else if (dt.toPix && !netByKey.get(dt.toKey)!.pix) {
        netByKey.get(dt.toKey)!.pix = dt.toPix;
      }

      netByKey.get(dt.fromKey)!.net = Number((netByKey.get(dt.fromKey)!.net - dt.amount).toFixed(2));
      netByKey.get(dt.toKey)!.net = Number((netByKey.get(dt.toKey)!.net + dt.amount).toFixed(2));
    }

    const debtors = Array.from(netByKey.values())
      .filter((x) => x.net < -0.01)
      .map((x) => ({ ...x, amount: Math.abs(x.net) }))
      .sort((a, b) => b.amount - a.amount);

    const creditors = Array.from(netByKey.values())
      .filter((x) => x.net > 0.01)
      .map((x) => ({ ...x, amount: x.net }))
      .sort((a, b) => b.amount - a.amount);

    const optimizedTransfers: {
      fromKey: string;
      toKey: string;
      fromShort: string;
      toShort: string;
      toFull: string;
      toPix: string;
      amount: number;
    }[] = [];

    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const amt = Number(Math.min(d.amount, c.amount).toFixed(2));
      if (amt >= 0.01) {
        optimizedTransfers.push({
          fromKey: d.key,
          toKey: c.key,
          fromShort: d.shortName,
          toShort: c.shortName,
          toFull: c.fullName,
          toPix: c.pix || resolveMemberPix(c.key, c.fullName),
          amount: amt,
        });
      }
      d.amount = Number((d.amount - amt).toFixed(2));
      c.amount = Number((c.amount - amt).toFixed(2));
      if (d.amount < 0.01) i++;
      if (c.amount < 0.01) j++;
    }

    if (linhasRachasPendentes.length === 0 && directTransfers.length === 0) {
      return `Fala grupo *${grupo.name}*! Segue o resumo dos nossos rachas pelo RachApp:\n\n✅ Todos os rachas do grupo estão quitados!\n\nValeu!`;
    }

    const serializeTransfers = (list: { fromKey: string; toKey: string; amount: number }[]) =>
      list
        .map((x) => `${x.fromKey}->${x.toKey}:${x.amount.toFixed(2)}`)
        .sort()
        .join('|');

    const hasDifferenceInOptimization =
      optimizedTransfers.length > 0 &&
      serializeTransfers(directTransfers) !== serializeTransfers(optimizedTransfers);

    const activeTransfers = optimizedTransfers.length > 0 ? optimizedTransfers : directTransfers;

    const linhasOtimizadas = activeTransfers
      .map((t) => `• ${t.fromShort} ➔ ${t.toShort}: *R$ ${moneyConverter(t.amount)}*`)
      .join('\n');

    const linhasDiretas = directTransfers
      .map((t) => `• ${t.fromShort} ➔ ${t.toShort}: R$ ${moneyConverter(t.amount)}`)
      .join('\n');

    // 3. Chaves Pix e Pix Copia e Cola (sem valor) apenas de quem vai receber
    const receiversMap = new Map<string, { name: string; fullName: string; pix: string }>();
    for (const t of activeTransfers) {
      if (!receiversMap.has(t.toKey)) {
        const pix = t.toPix || resolveMemberPix(t.toKey, t.toFull || t.toShort);
        receiversMap.set(t.toKey, {
          name: t.toShort,
          fullName: t.toFull || t.toShort,
          pix,
        });
      }
    }

    const linhasPix = Array.from(receiversMap.values())
      .map((r) => `• *${r.name}:* ${r.pix || 'Não informada'}`)
      .join('\n');

    const linhasCopiaECola = Array.from(receiversMap.values())
      .map((r) => {
        if (!r.pix) return '';
        const payload = generatePixCopiaECola({
          pixKey: r.pix,
          merchantName: r.fullName || r.name || 'RachApp',
          amount: undefined,
        });
        if (!payload) return '';
        return `*Pix Copia e Cola (${r.name}):*\n${payload}`;
      })
      .filter(Boolean)
      .join('\n\n');

    const secoes: string[] = [
      `Fala grupo *${grupo.name}*! Segue o resumo dos nossos rachas pelo RachApp:`,
    ];

    if (linhasRachasPendentes.length > 0) {
      secoes.push(`🧾 *Rachas Pendentes:*\n${linhasRachasPendentes.join('\n')}`);
    }

    if (hasDifferenceInOptimization && linhasDiretas) {
      secoes.push(`📌 *Saldos Diretos:*\n${linhasDiretas}`);
    }

    if (linhasOtimizadas) {
      secoes.push(`⚡ *Envio Otimizado:*\n${linhasOtimizadas}`);
    }

    if (linhasPix) {
      secoes.push(`🔑 *Chaves Pix:*\n${linhasPix}`);
    }

    if (linhasCopiaECola) {
      secoes.push(linhasCopiaECola);
    }

    secoes.push('Valeu!');

    return secoes.join('\n\n');
  };

  const handleCompartilharResumoGrupo = async () => {
    if (!grupo) return;
    const freshConfig = await dbService.settings.get();
    const myPix = (freshConfig.pix_key || freshConfig.pix || myConfig.pix || '').trim();
    const myName = (freshConfig.nome || freshConfig.name || myConfig.nome || 'Você').trim();
    const msg = montarMensagemResumoGrupo({ nome: myName, pix: myPix });
    openWhatsApp(undefined, msg);
  };

  const handleCobrarGrupo = async () => {
    if (!grupo) return;
    const freshConfig = await dbService.settings.get();
    const myPix = (freshConfig.pix_key || freshConfig.pix || myConfig.pix || '').trim();
    const myName = (freshConfig.nome || freshConfig.name || myConfig.nome || 'Você').trim();
    const userNet = Number(grupo.userNetBalance || 0);
    const msg = montarMensagemResumoGrupo({ nome: myName, pix: myPix });

    setPixModalData({
      isOpen: true,
      pixKey: myPix,
      recipientName: myName,
      amount: Math.max(0, userNet),
      description: `Grupo ${grupo.name}`,
      whatsappPhone: undefined,
      whatsappCustomMessage: msg,
    });
  };

  const handleOpenTransferPix = async (t: Transferencia) => {
    const freshConfig = await dbService.settings.get();
    const myPix = freshConfig.pix_key || freshConfig.pix || myConfig.pix || '';
    const myName = freshConfig.nome || freshConfig.name || myConfig.nome || 'Você';

    if (t.fromName === 'Você') {
      setPayMemberTarget({
        isOpen: true,
        friendId: t.toId,
        friendName: t.toName,
        pixKey: t.toPixKey || '',
        amount: t.amount,
      });
      return;
    }

    const isToMe = t.toName === 'Você';
    const pixKey = isToMe ? myPix : t.toPixKey || '';
    const recipient = isToMe ? myName : t.toName;
    const msg = `Fala ${t.fromName}! Pelo acerto de contas do grupo *${grupo?.name}* no RachApp, o acerto ficou:\n\n• *${t.fromName} -> ${t.toName}: R$ ${moneyConverter(t.amount)}*\n${
      pixKey ? `Chave Pix: ${pixKey}` : ''
    }`;

    setPixModalData({
      isOpen: true,
      pixKey,
      recipientName: recipient,
      amount: t.amount,
      description: `Grupo ${grupo?.name || 'RachApp'}`,
      whatsappPhone: t.fromPhone || undefined,
      whatsappCustomMessage: msg,
    });
  };

  const memberBalances = grupo?.memberBalances || [];
  const memberIdsInGroup = new Set(memberBalances.map((m) => m.friendId));
  const amigosForaDoGrupo = todosAmigos.filter((a) => !memberIdsInGroup.has(a.id));

  const pendenciasCount = memberBalances.filter((m) => Math.abs(m.netBalance) > 0.01).length;
  const userNet = Number(grupo?.userNetBalance || 0);
  const isGroupCreator =
    !grupo?.created_by ||
    !myConfig.id ||
    grupo.created_by === myConfig.id ||
    grupo.created_by === 'me';

  const expensesWithStatus = useMemo(() => {
    if (!grupo?.expenses) return [];
    return grupo.expenses.map((expense: any) => {
      const valorTotalExp = Number(expense.total_amount || 0);
      const corridaCompleta: Corrida =
        todasCorridas.find((c) => c.id === expense.id) || {
          id: expense.id,
          titulo: expense.title || 'Racha',
          valorTotal: valorTotalExp,
          selfAmountOwed:
            expense.self_amount_owed !== undefined &&
            expense.self_amount_owed !== null
              ? Number(expense.self_amount_owed)
              : undefined,
          selfAmountPaid: Number(expense.self_amount_paid || 0),
          selfReceiptUrl: expense.self_receipt_url || null,
          data: expense.expense_date?.split('T')[0] || '',
          tag: expense.tag || 'Uber',
          groupId: grupo.id,
          groupName: grupo.name,
          paidByFriendId: expense.paid_by_friend_id || null,
          paidByName: expense.paidByFriend?.name || 'Amigo',
          participantesIds: (expense.participants || []).map(
            (p: any) => p.friend_id
          ),
          pagamentos: Object.fromEntries(
            (expense.participants || []).map((p: any) => [
              p.friend_id,
              Number(p.amount_paid || 0),
            ])
          ),
          valoresDevidos: Object.fromEntries(
            (expense.participants || []).map((p: any) => [
              p.friend_id,
              Number(p.amount_owed || 0),
            ])
          ),
        };

      const userStatus = getRideStatusForUser(
        corridaCompleta,
        todasCorridas,
        todosAmigos,
        nettingCache
      );

      const corridaParticipantes = [
        { id: 0, nome: 'Você', cor: '#0F766E', avatar_url: myConfig.avatar_url },
        ...(corridaCompleta.participantesIds || []).map((pid: string, idx: number) => {
          const f = todosAmigos.find((a) => a.id === pid);
          return {
            id: pid || idx + 1,
            nome: f?.nome || f?.name || 'Amigo',
            cor: f?.cor || f?.color || '#0ea5e9',
            avatar_url: f?.avatar_url || null,
          };
        }),
      ];

      return {
        expense,
        corridaCompleta,
        userStatus,
        corridaParticipantes,
      };
    });
  }, [grupo?.expenses, todasCorridas, todosAmigos, nettingCache, grupo?.id, grupo?.name, myConfig.avatar_url]);

  const contagensGrupo = useMemo(() => {
    let aPagar = 0;
    let aReceber = 0;
    let quitados = 0;

    for (const item of expensesWithStatus) {
      if (item.userStatus.amountYouOwe > 0.005) {
        aPagar++;
      } else if (item.userStatus.amountOwedToYou > 0.005) {
        aReceber++;
      } else {
        quitados++;
      }
    }

    return {
      tudo: expensesWithStatus.length,
      aPagar,
      aReceber,
      quitados,
    };
  }, [expensesWithStatus]);

  const botoesFiltroGrupo = [
    { id: 'tudo' as const, label: 'Tudo', count: contagensGrupo.tudo },
    {
      id: 'a_pagar' as const,
      label: 'A Pagar',
      count: contagensGrupo.aPagar,
      icon: TrendingDown,
      color: 'text-[#F43F5E]',
    },
    {
      id: 'a_receber' as const,
      label: 'A Receber',
      count: contagensGrupo.aReceber,
      icon: TrendingUp,
      color: 'text-[#10B981]',
    },
    {
      id: 'quitados' as const,
      label: 'Quitados',
      count: contagensGrupo.quitados,
      icon: CheckCircle2,
      color: 'text-[var(--primary)]',
    },
  ];

  const expensesFiltradas = useMemo(() => {
    return expensesWithStatus.filter((item) => {
      if (filtroStatusGrupo === 'a_pagar') {
        return item.userStatus.amountYouOwe > 0.005;
      }
      if (filtroStatusGrupo === 'a_receber') {
        return item.userStatus.amountOwedToYou > 0.005;
      }
      if (filtroStatusGrupo === 'quitados') {
        return (
          item.userStatus.status === 'quitado' ||
          (item.userStatus.status === 'pagante' && item.userStatus.amountOwedToYou <= 0.005)
        );
      }
      return true;
    });
  }, [expensesWithStatus, filtroStatusGrupo]);

  const handleSaveGroupAvatar = async (croppedUrl: string) => {
    if (!grupo) return;
    try {
      await dbService.grupos.update(grupo.id, { avatar_url: croppedUrl });
      setGrupo((prev) => (prev ? { ...prev, avatar_url: croppedUrl } : prev));
      carregarDetalhes();
      if (onChanged) onChanged();
    } catch {
      alert('Erro ao atualizar ícone do grupo.');
    }
  };

  const handleDeleteGroupAvatar = async () => {
    if (!grupo) return;
    try {
      await dbService.grupos.update(grupo.id, { avatar_url: null });
      setGrupo((prev) => (prev ? { ...prev, avatar_url: null } : prev));
      carregarDetalhes();
      if (onChanged) onChanged();
    } catch {
      alert('Erro ao remover ícone do grupo.');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="bg-[var(--bg-app)] w-full max-w-md rounded-t-2xl sm:rounded-2xl border-t sm:border border-[var(--border-color)] shadow-xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] pb-safe overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle de arrastar para baixo */}
        <div
          data-sheet-handle="true"
          className="w-full pt-2.5 pb-1 bg-[var(--bg-surface)] flex justify-center items-center cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
        >
          <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full" />
        </div>

        {/* Cabeçalho */}
        <div
          data-sheet-handle="true"
          className="flex items-center justify-between p-4 pt-2 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 select-none"
        >
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded-full transition-colors"
          >
            <ChevronLeft size={24} strokeWidth={2} />
          </button>
          <h2 className="text-h2 text-[var(--text-primary)] truncate px-2">Detalhes do Grupo</h2>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsEditGroupOpen(true)}
              className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] rounded-full transition-colors"
              title="Editar Grupo"
            >
              <Pencil size={18} strokeWidth={2} />
            </button>
            <button
              onClick={handleDeleteGroup}
              className="p-2 text-[#F43F5E] hover:bg-[var(--rose-bg)] rounded-full transition-colors"
              title="Excluir Grupo"
            >
              <Trash2 size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {isLoading || !grupo ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20">
            <LoaderCircle size={36} strokeWidth={2} className="animate-spin text-[var(--primary)]" />
          </div>
        ) : (
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
            {/* Card Principal do Grupo */}
            <div className="ds-card">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  {/* Ícone Circular do Grupo */}
                  <div className="relative shrink-0">
                    <div
                      onClick={() => {
                        if (isGroupCreator) setIsEditAvatarOpen(true);
                      }}
                      className={`w-12 h-12 rounded-full overflow-hidden bg-[var(--primary)]/10 border border-[var(--primary)]/30 flex items-center justify-center text-[var(--primary)] transition-colors ${
                        isGroupCreator ? 'cursor-pointer hover:border-[var(--primary)]' : ''
                      }`}
                    >
                      {grupo.avatar_url ? (
                        <img
                          src={grupo.avatar_url}
                          alt={grupo.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users size={22} strokeWidth={2} />
                      )}
                    </div>
                    {isGroupCreator && (
                      <button
                        type="button"
                        onClick={() => setIsEditAvatarOpen(true)}
                        title="Editar ícone do grupo"
                        className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white flex items-center justify-center shadow-sm border border-[var(--bg-surface)] active:scale-90 transition-transform"
                      >
                        <Pencil size={10} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>

                  <div>
                    <h3 className="text-[var(--text-primary)] text-h2 leading-tight">{grupo.name}</h3>
                    <div className="flex items-center mt-1.5">
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--primary)] text-white font-bold text-caption flex items-center justify-center border-2 border-[var(--bg-surface)]">
                          {myConfig.avatar_url ? (
                            <img
                              src={myConfig.avatar_url}
                              alt="Você"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            'V'
                          )}
                        </div>
                        {memberBalances.slice(0, 4).map((m) => {
                          const friendObj = todosAmigos.find((a) => a.id === m.friendId);
                          const memberAvatar = m.avatar_url || friendObj?.avatar_url;
                          return (
                            <div
                              key={m.friendId}
                              style={
                                memberAvatar ? undefined : { backgroundColor: getAvatarColor(m.color) }
                              }
                              className="w-8 h-8 rounded-full overflow-hidden text-white font-bold text-caption flex items-center justify-center border-2 border-[var(--bg-surface)]"
                            >
                              {memberAvatar ? (
                                <img
                                  src={memberAvatar}
                                  alt={m.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                m.name[0]?.toUpperCase()
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <span className="text-caption text-[var(--text-secondary)] ml-2">
                        {memberBalances.length + 1} participantes
                      </span>
                    </div>
                  </div>
                </div>

                <span className="text-caption font-semibold bg-[var(--emerald-bg)] text-[#10B981] border border-[var(--emerald-border)] px-2.5 py-1 rounded-full shrink-0">
                  • ATIVO
                </span>
              </div>

              <p className="text-caption text-[var(--text-secondary)] mb-1">
                Seu saldo em <strong className="text-[var(--text-primary)]">{grupo.name}</strong>
              </p>
              <div className="flex items-baseline gap-2 mb-5">
                <span
                  className={`text-display ${
                    userNet > 0.01
                      ? 'text-[#10B981]'
                      : userNet < -0.01
                      ? 'text-[#F43F5E]'
                      : 'text-[var(--primary)]'
                  }`}
                >
                  R$ {moneyConverter(Math.abs(userNet))}
                </span>
                <span className="text-caption text-[var(--text-secondary)] font-semibold">
                  {userNet > 0.01 ? 'a receber' : userNet < -0.01 ? 'a pagar' : 'tudo quitado'}
                </span>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => setIsAddRideOpen(true)}
                  className="w-full ds-btn-primary"
                >
                  <Plus size={18} strokeWidth={2} /> Novo Racha
                </button>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handleCompartilharResumoGrupo}
                    className="h-12 bg-[#10B981] hover:bg-[#059669] text-white font-semibold px-3.5 rounded-xl text-body2 flex items-center justify-center gap-1.5 transition-all active:scale-95 truncate shadow-sm"
                    title="Compartilhar resumo completo do grupo no WhatsApp"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                    >
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                    <span className="truncate">Resumo Zap</span>
                  </button>
                  <button
                    onClick={handleCobrarGrupo}
                    className="ds-btn-secondary px-3.5 truncate"
                  >
                    <QrCode size={16} strokeWidth={2} className="shrink-0 text-[var(--primary)]" />
                    <span className="truncate">QR Code Pix</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Membros e Saldos Individuais */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-[var(--text-primary)] text-h2">Membros</h4>
                  <span className="text-caption text-[var(--text-secondary)] uppercase font-semibold tracking-wider bg-[var(--bg-subtle)] border border-[var(--border-color)] px-2.5 py-0.5 rounded-full">
                    {pendenciasCount} {pendenciasCount === 1 ? 'PENDÊNCIA' : 'PENDÊNCIAS'}
                  </span>
                </div>

                <button
                  onClick={() => setShowAddMemberSection(!showAddMemberSection)}
                  className="text-caption bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 text-[var(--primary)] px-3 py-1.5 rounded-full font-semibold flex items-center gap-1 transition-colors"
                >
                  <UserPlus size={14} strokeWidth={2} /> Adicionar Amigo
                </button>
              </div>

              {showAddMemberSection && (
                <div className="mb-4 ds-card-sm space-y-3 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <p className="text-caption font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Selecionar dos seus Amigos
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCreateFriendOpen(true)}
                      className="text-caption text-[var(--primary)] font-semibold flex items-center gap-1 hover:underline"
                    >
                      <Plus size={14} strokeWidth={2} /> Criar Novo Amigo
                    </button>
                  </div>

                  {amigosForaDoGrupo.length === 0 ? (
                    <div className="bg-[var(--bg-subtle)] rounded-xl p-4 text-center border border-[var(--border-color)]">
                      <p className="text-caption text-[var(--text-secondary)] mb-3">
                        Todos os seus amigos cadastrados já estão neste grupo!
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsCreateFriendOpen(true)}
                        className="ds-btn-primary px-4 text-caption"
                      >
                        <UserPlus size={15} strokeWidth={2} /> Cadastrar Novo Amigo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {amigosForaDoGrupo.map((amigo) => {
                        const nomeAmigo = amigo.nome || amigo.name || 'Amigo';
                        const corAmigo = amigo.cor || amigo.color || 'bg-sky-500';
                        const tel = formatPhoneBR(amigo.telefone || amigo.phone || '');
                        const adding = isAddingMemberId === amigo.id;
                        return (
                          <div
                            key={amigo.id}
                            className="bg-[var(--bg-subtle)] p-2.5 rounded-xl flex items-center justify-between border border-[var(--border-color)]"
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                style={
                                  amigo.avatar_url
                                    ? undefined
                                    : { backgroundColor: getAvatarColor(corAmigo) }
                                }
                                className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-caption shrink-0"
                              >
                                {amigo.avatar_url ? (
                                  <img
                                    src={amigo.avatar_url}
                                    alt={nomeAmigo}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  nomeAmigo[0]?.toUpperCase()
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1">
                                  <p className="text-body2 font-semibold text-[var(--text-primary)]">
                                    {nomeAmigo}
                                  </p>
                                  {(amigo.has_account || amigo.is_registered) && (
                                    <BadgeCheck size={13} strokeWidth={2} className="text-[var(--primary)] shrink-0" />
                                  )}
                                </div>
                                {tel && <p className="text-caption text-[var(--text-secondary)]">{tel}</p>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleSelectExistingFriend(amigo.id)}
                              disabled={adding}
                              className="bg-[var(--primary)]/10 hover:bg-[var(--primary)] text-[var(--primary)] hover:text-white px-3 py-1.5 rounded-xl text-caption font-semibold transition-colors flex items-center gap-1"
                            >
                              {adding ? (
                                <LoaderCircle size={13} strokeWidth={2} className="animate-spin" />
                              ) : (
                                <>
                                  <Plus size={13} strokeWidth={2} /> Incluir
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2.5">
                {memberBalances.length === 0 ? (
                  <div className="ds-card text-center">
                    <Users size={24} strokeWidth={2} className="text-[var(--text-secondary)] mx-auto mb-2" />
                    <p className="text-[var(--text-secondary)] text-caption mb-3">
                      Nenhum amigo adicionado a este grupo ainda.
                    </p>
                    <button
                      onClick={() => setShowAddMemberSection(true)}
                      className="text-caption text-[var(--primary)] font-semibold hover:underline"
                    >
                      + Selecionar ou cadastrar amigos
                    </button>
                  </div>
                ) : (
                  memberBalances.map((m) => {
                    const deveVoce = m.owesYou > 0.01;
                    const voceDeve = m.owesYou < -0.01;
                    const friendObj = todosAmigos.find((a) => a.id === m.friendId);
                    const memberAvatar = m.avatar_url || friendObj?.avatar_url;
                    return (
                      <div
                        key={m.friendId}
                        className="ds-card-sm flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-1">
                          <div
                            style={
                              memberAvatar ? undefined : { backgroundColor: getAvatarColor(m.color) }
                            }
                            className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-body2 shrink-0"
                          >
                            {memberAvatar ? (
                              <img
                                src={memberAvatar}
                                alt={m.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              m.name[0]?.toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="font-semibold text-[var(--text-primary)] text-body2 truncate">
                                {m.name}
                              </p>
                            </div>
                            <p className="text-caption text-[var(--text-secondary)] truncate">
                              {m.pendingCount > 0
                                ? 'Dividindo despesas do grupo'
                                : 'Sem pendências abertas'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div>
                            {deveVoce ? (
                              <>
                                <p className="text-body2 font-display font-bold text-[#10B981] tabular-nums">
                                  Deve R$ {moneyConverter(m.owesYou)}
                                </p>
                                <p className="text-caption text-[var(--text-secondary)]">
                                  {m.pendingCount}{' '}
                                  {m.pendingCount === 1 ? 'pendente' : 'pendentes'}
                                </p>
                              </>
                            ) : voceDeve ? (
                              <p className="text-body2 font-display font-bold text-[#F43F5E] tabular-nums">
                                Você deve R$ {moneyConverter(Math.abs(m.owesYou))}
                              </p>
                            ) : (
                              <span className="text-caption text-[#10B981] flex items-center gap-1 font-semibold">
                                <CheckCircle2 size={14} strokeWidth={2} /> Quitado
                              </span>
                            )}
                          </div>

                          {deveVoce && (
                            <button
                              onClick={() => handleQuitarMembroNoGrupo(m.friendId, m.owesYou, m.name)}
                              className="p-2 bg-[var(--emerald-bg)] text-[#10B981] border border-[var(--emerald-border)] hover:opacity-90 rounded-xl transition-colors shrink-0"
                              title="Confirmar que este membro te pagou"
                            >
                              <DollarSign size={16} strokeWidth={2} />
                            </button>
                          )}

                          {voceDeve && (
                            <button
                              onClick={() =>
                                setPayMemberTarget({
                                  isOpen: true,
                                  friendId: m.friendId,
                                  friendName: m.name,
                                  pixKey: m.pix_key || '',
                                  amount: Math.abs(m.owesYou),
                                })
                              }
                              className="px-3 py-1.5 bg-[var(--rose-bg)] text-[#F43F5E] border border-[var(--rose-border)] hover:opacity-90 rounded-xl text-caption font-semibold flex items-center gap-1 transition-colors shrink-0"
                              title="Pagar mediante comprovante"
                            >
                              <Upload size={13} strokeWidth={2} /> Pagar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Rotas de Acerto Direto entre Participantes */}
            {grupo.transfers && grupo.transfers.length > 0 && (
              <div className="ds-card-sm">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[var(--text-primary)] font-semibold text-body2 flex items-center gap-2">
                    <QrCode size={16} strokeWidth={2} className="text-[var(--primary)]" />
                    Rotas de Acerto (Pix)
                  </h4>
                  <span className="text-caption bg-[var(--primary)]/10 text-[var(--primary)] px-2.5 py-0.5 rounded-full font-semibold">
                    {grupo.transfers.length} {grupo.transfers.length === 1 ? 'repasse' : 'repasses'}
                  </span>
                </div>
                <div className="space-y-2">
                  {grupo.transfers.map((t, idx) => (
                    <div
                      key={idx}
                      className="bg-[var(--bg-subtle)] p-3 rounded-xl flex items-center justify-between border border-[var(--border-color)]"
                    >
                      <div className="flex items-center gap-2 text-caption font-medium">
                        <span className="font-semibold text-[#F43F5E]">{t.fromName}</span>
                        <ArrowRight size={14} strokeWidth={2} className="text-[var(--text-secondary)]" />
                        <span className="font-semibold text-[#10B981]">{t.toName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-body2 font-display font-bold text-[var(--text-primary)]">
                          R$ {moneyConverter(t.amount)}
                        </span>
                        <button
                          onClick={() => handleOpenTransferPix(t)}
                          className="bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] px-3 py-1.5 rounded-xl text-caption font-semibold transition-colors"
                        >
                          {t.fromName === 'Você' ? 'Pagar' : 'Pix'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleCompartilharResumoGrupo}
                  className="mt-3 w-full h-11 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 font-semibold rounded-xl text-caption flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Share2 size={15} strokeWidth={2} />
                  <span>Compartilhar Resumo Completo no WhatsApp</span>
                </button>
              </div>
            )}

            {/* Rachas no Grupo */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-[var(--text-primary)] text-h2">Rachas no Grupo</h4>
                <span className="text-caption text-[var(--primary)] font-semibold">
                  {expensesFiltradas.length}{' '}
                  {expensesFiltradas.length === 1 ? 'racha' : 'rachas'}
                </span>
              </div>

              {/* Botões de Filtros Rápidos de Status no Grupo */}
              {expensesWithStatus.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide mb-2.5">
                  {botoesFiltroGrupo.map((btn) => {
                    const isActive = filtroStatusGrupo === btn.id;
                    const Icon = btn.icon;
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => setFiltroStatusGrupo(btn.id)}
                        className={`px-3.5 py-2 rounded-xl text-caption font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                          isActive
                            ? 'bg-[var(--primary)] text-white shadow-sm'
                            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
                        }`}
                      >
                        {Icon && (
                          <Icon
                            size={14}
                            strokeWidth={2}
                            className={isActive ? 'text-white' : btn.color}
                          />
                        )}
                        <span>{btn.label}</span>
                        <span
                          className={`text-caption px-1.5 py-0.2 rounded-full font-semibold ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {btn.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {expensesWithStatus.length === 0 ? (
                <div className="ds-card text-center">
                  <p className="text-[var(--text-secondary)] text-body2">
                    Nenhuma despesa registrada neste grupo. Clique em "+ Novo Racha" acima!
                  </p>
                </div>
              ) : expensesFiltradas.length === 0 ? (
                <div className="ds-card text-center">
                  <p className="text-[var(--text-secondary)] text-caption">
                    Nenhum racha encontrado com o filtro{' '}
                    <span className="text-[var(--primary)] font-semibold">
                      {filtroStatusGrupo === 'a_pagar'
                        ? 'A Pagar'
                        : filtroStatusGrupo === 'a_receber'
                        ? 'A Receber'
                        : 'Quitados'}
                    </span>
                    .
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expensesFiltradas.map(({ expense, corridaCompleta, userStatus, corridaParticipantes }) => (
                    <RideCard
                      key={expense.id}
                      data={corridaCompleta.data}
                      tag={corridaCompleta.tag}
                      titulo={corridaCompleta.titulo}
                      valorTotal={moneyConverter(corridaCompleta.valorTotal)}
                      paidByName={corridaCompleta.paidByName}
                      userStatus={userStatus}
                      participantes={corridaParticipantes}
                      onClick={() => setCorridaSelecionada(corridaCompleta)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Pagar Membro com Comprovante */}
      <PayWithReceiptModal
        isOpen={payMemberTarget.isOpen}
        onClose={() => setPayMemberTarget((prev) => ({ ...prev, isOpen: false }))}
        recipientName={payMemberTarget.friendName}
        pixKey={payMemberTarget.pixKey}
        defaultAmount={payMemberTarget.amount}
        allowCustomAmount={false}
        description={`Grupo ${grupo?.name || 'RachApp'}`}
        onConfirm={handleConfirmPayMemberWithReceipt}
      />

      {/* Modal Adicionar Racha dentro do Grupo */}
      <AddRideModal
        isOpen={isAddRideOpen}
        defaultGroupId={grupoId}
        onClose={() => setIsAddRideOpen(false)}
        onSuccess={() => {
          carregarDetalhes();
          if (onChanged) onChanged();
        }}
      />

      {/* Modal Editar Grupo */}
      <AddGroupModal
        isOpen={isEditGroupOpen}
        groupToEdit={grupo}
        onClose={() => setIsEditGroupOpen(false)}
        onSuccess={() => {
          carregarDetalhes();
          if (onChanged) onChanged();
        }}
      />

      {/* Modal Cadastrar Novo Amigo e já adicionar ao Grupo */}
      <AddFriendModal
        isOpen={isCreateFriendOpen}
        onClose={() => setIsCreateFriendOpen(false)}
        onSuccess={async (novoAmigo) => {
          if (novoAmigo?.id && grupoId) {
            await dbService.grupos.addMember(grupoId, { friendId: novoAmigo.id });
          }
          await carregarDetalhes();
          if (onChanged) onChanged();
        }}
      />

      {/* Modal Detalhes/Edição de Racha do Grupo */}
      <RideDetailsModal
        isOpen={!!corridaSelecionada}
        ride={corridaSelecionada || undefined}
        participantes={todosAmigos.filter((a) =>
          corridaSelecionada?.participantesIds.includes(a.id)
        )}
        onClose={() => setCorridaSelecionada(null)}
        onDelete={async (id) => {
          await dbService.corridas.delete(id);
          setCorridaSelecionada(null);
          await carregarDetalhes();
          if (onChanged) onChanged();
        }}
        onUpdated={async () => {
          await carregarDetalhes();
          if (corridaSelecionada) {
            const all = await dbService.corridas.getAll();
            const fresh = all.find((c) => c.id === corridaSelecionada.id);
            if (fresh) setCorridaSelecionada(fresh);
          }
          if (onChanged) onChanged();
        }}
      />

      {/* Modal de Recorte e Edição do Ícone do Grupo */}
      <AvatarEditModal
        isOpen={isEditAvatarOpen}
        onClose={() => setIsEditAvatarOpen(false)}
        currentAvatarUrl={grupo?.avatar_url}
        title="Ícone do Grupo"
        maskShape="circle"
        onSave={handleSaveGroupAvatar}
        onDelete={grupo?.avatar_url ? handleDeleteGroupAvatar : undefined}
      />

      {/* Modal Pix do Grupo */}
      <PixModal
        isOpen={pixModalData.isOpen}
        onClose={() => setPixModalData((prev) => ({ ...prev, isOpen: false }))}
        pixKey={pixModalData.pixKey}
        recipientName={pixModalData.recipientName}
        amount={pixModalData.amount}
        description={pixModalData.description}
        whatsappPhone={pixModalData.whatsappPhone}
        whatsappCustomMessage={pixModalData.whatsappCustomMessage}
      />
    </div>,
    document.body
  );
}

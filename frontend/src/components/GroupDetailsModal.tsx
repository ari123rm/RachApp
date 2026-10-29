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
import { formatPhoneBR } from '../utils/phoneFormatter';
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

  useModalBackHandler(isOpen, onClose);

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

  // Quando o membro te deve (você é o lesado), você pode confirmar recebimento sem comprovante
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

  // Quando Você deve ao membro no grupo, confirma enviando comprovante
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

  const handleCobrarGrupo = async () => {
    if (!grupo) return;
    const freshConfig = await dbService.settings.get();
    const myPix = freshConfig.pix_key || freshConfig.pix || myConfig.pix || '';
    const myName = freshConfig.nome || freshConfig.name || myConfig.nome || 'Você';

    const userNet = Number(grupo.userNetBalance || 0);
    const transfers = grupo.transfers || [];

    const linhasTransferencias = transfers
      .map((t) => `• ${t.fromName} -> ${t.toName}: R$ ${moneyConverter(t.amount)}`)
      .join('\n');

    const msg =
      `*Resumo do Grupo: ${grupo.name} (RachApp)*\n\n` +
      (linhasTransferencias
        ? `*Transferências Otimizadas:*\n${linhasTransferencias}\n\n`
        : 'Todas as contas estão em dia!\n\n') +
      (myPix ? `*Meu Pix (${myName}):* ${myPix}` : '');

    setPixModalData({
      isOpen: true,
      pixKey: myPix,
      recipientName: myName,
      amount: Math.max(0, userNet),
      description: `Grupo ${grupo.name}`,
      whatsappCustomMessage: msg,
    });
  };

  const handleOpenTransferPix = async (t: Transferencia) => {
    const freshConfig = await dbService.settings.get();
    const myPix = freshConfig.pix_key || freshConfig.pix || myConfig.pix || '';
    const myName = freshConfig.nome || freshConfig.name || myConfig.nome || 'Você';

    // Se a transferência parte de "Você" para um amigo, abre o modal de Pagar com Comprovante!
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
        { id: 0, nome: 'Você', cor: '#2DD4BF', avatar_url: myConfig.avatar_url },
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
      color: 'text-red-400',
    },
    {
      id: 'a_receber' as const,
      label: 'A Receber',
      count: contagensGrupo.aReceber,
      icon: TrendingUp,
      color: 'text-amber-400',
    },
    {
      id: 'quitados' as const,
      label: 'Quitados',
      count: contagensGrupo.quitados,
      icon: CheckCircle2,
      color: 'text-emerald-400',
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
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0f19] w-full max-w-md rounded-t-[28px] sm:rounded-3xl border-t sm:border border-white/10 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] pb-safe overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-white/10 bg-[#0b0f19]/95 backdrop-blur-md shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-sm sm:text-base font-semibold text-white truncate px-2">Detalhes Do Grupo</h2>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsEditGroupOpen(true)}
              className="p-1.5 sm:p-2 text-gray-300 hover:bg-white/10 hover:text-white rounded-full transition-colors"
              title="Editar Grupo"
            >
              <Pencil size={17} />
            </button>
            <button
              onClick={handleDeleteGroup}
              className="p-1.5 sm:p-2 text-red-500 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors"
              title="Excluir Grupo"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {isLoading || !grupo ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20">
            <LoaderCircle size={40} className="animate-spin text-[#2DD4BF]" />
          </div>
        ) : (
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5 sm:space-y-6">
            {/* Card Principal do Grupo */}
            <div className="bg-[#141923] rounded-3xl p-5 border border-white/10 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  {/* Ícone do Grupo */}
                  <div className="relative shrink-0">
                    <div
                      onClick={() => {
                        if (isGroupCreator) setIsEditAvatarOpen(true);
                      }}
                      className={`w-12 h-12 rounded-2xl overflow-hidden bg-[#2DD4BF]/15 border border-[#2DD4BF]/30 flex items-center justify-center text-[#2DD4BF] transition-colors ${
                        isGroupCreator ? 'cursor-pointer hover:border-[#2DD4BF]' : ''
                      }`}
                    >
                      {grupo.avatar_url ? (
                        <img
                          src={grupo.avatar_url}
                          alt={grupo.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Users size={22} />
                      )}
                    </div>
                    {isGroupCreator && (
                      <button
                        type="button"
                        onClick={() => setIsEditAvatarOpen(true)}
                        title="Editar ícone do grupo"
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] flex items-center justify-center shadow border border-[#141923] active:scale-90 transition-transform"
                      >
                        <Pencil size={10} className="stroke-[2.5px]" />
                      </button>
                    )}
                  </div>

                  <div>
                    <h3 className="text-white font-bold text-base leading-tight">{grupo.name}</h3>
                    <div className="flex items-center mt-1">
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-[#2DD4BF] text-[#05080f] font-black text-[10px] flex items-center justify-center border-2 border-[#141923]">
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
                              className="w-6 h-6 rounded-full overflow-hidden text-white font-bold text-[10px] flex items-center justify-center border-2 border-[#141923]"
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
                      <span className="text-[11px] text-gray-400 ml-2 font-medium">
                        {memberBalances.length + 1} participantes
                      </span>
                    </div>
                  </div>
                </div>

                <span className="text-[10px] font-bold bg-[#2DD4BF]/15 text-[#2DD4BF] px-2.5 py-1 rounded-full shrink-0">
                  • ATIVO
                </span>
              </div>

              <p className="text-xs text-gray-400 mb-1">
                Seu saldo em <strong className="text-white">{grupo.name}</strong>
              </p>
              <div className="flex items-baseline gap-2 mb-5">
                <span
                  className={`text-3xl font-black ${
                    userNet >= 0 ? 'text-[#2DD4BF]' : 'text-red-400'
                  }`}
                >
                  R$ {moneyConverter(Math.abs(userNet))}
                </span>
                <span className="text-xs text-gray-400 font-semibold">
                  {userNet > 0.01 ? 'a receber' : userNet < -0.01 ? 'a pagar' : 'tudo quitado'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsAddRideOpen(true)}
                  className="bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                >
                  <Plus size={18} strokeWidth={2.5} /> Novo Racha
                </button>
                <button
                  onClick={handleCobrarGrupo}
                  className="bg-[#1c2230] hover:bg-[#252d3f] text-white border border-white/10 font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <QrCode size={16} className="text-[#2DD4BF]" /> Cobrar
                </button>
              </div>
            </div>

            {/* Membros e Saldos Individuais */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-bold text-base">Membros</h4>
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider bg-white/5 px-2 py-0.5 rounded-full">
                    {pendenciasCount} {pendenciasCount === 1 ? 'PENDÊNCIA' : 'PENDÊNCIAS'}
                  </span>
                </div>

                <button
                  onClick={() => setShowAddMemberSection(!showAddMemberSection)}
                  className="text-xs bg-[#2DD4BF]/15 hover:bg-[#2DD4BF]/25 text-[#2DD4BF] px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition-colors"
                >
                  <UserPlus size={14} /> Adicionar Amigo
                </button>
              </div>

              {showAddMemberSection && (
                <div className="mb-4 bg-[#141923] rounded-2xl p-4 border border-[#2DD4BF]/30 space-y-3 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                      Selecionar dos seus Amigos
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCreateFriendOpen(true)}
                      className="text-xs text-[#2DD4BF] font-bold flex items-center gap-1 hover:underline"
                    >
                      <Plus size={14} /> Criar Novo Amigo
                    </button>
                  </div>

                  {amigosForaDoGrupo.length === 0 ? (
                    <div className="bg-[#1c1c1e] rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 mb-2">
                        Todos os seus amigos cadastrados já estão neste grupo!
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsCreateFriendOpen(true)}
                        className="bg-[#2DD4BF] text-[#05080f] px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <UserPlus size={14} /> Cadastrar Novo Amigo
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
                            className="bg-[#1c1c1e] p-2.5 rounded-xl flex items-center justify-between border border-white/5"
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                style={
                                  amigo.avatar_url
                                    ? undefined
                                    : { backgroundColor: getAvatarColor(corAmigo) }
                                }
                                className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-xs shrink-0"
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
                                  <p className="text-xs font-bold text-white">{nomeAmigo}</p>
                                  {(amigo.has_account || amigo.is_registered) && (
                                    <BadgeCheck size={12} className="text-[#2DD4BF] fill-[#2DD4BF]/20 shrink-0" />
                                  )}
                                </div>
                                {tel && <p className="text-[10px] text-gray-500">{tel}</p>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleSelectExistingFriend(amigo.id)}
                              disabled={adding}
                              className="bg-[#2DD4BF]/20 hover:bg-[#2DD4BF] text-[#2DD4BF] hover:text-[#05080f] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                            >
                              {adding ? (
                                <LoaderCircle size={13} className="animate-spin" />
                              ) : (
                                <>
                                  <Plus size={13} /> Incluir
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
                  <div className="bg-[#1c1c1e] p-5 rounded-2xl border border-white/5 text-center">
                    <Users size={24} className="text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-xs mb-3">
                      Nenhum amigo adicionado a este grupo ainda.
                    </p>
                    <button
                      onClick={() => setShowAddMemberSection(true)}
                      className="text-xs text-[#2DD4BF] font-bold hover:underline"
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
                        className="bg-[#1c1c1e] p-3 sm:p-3.5 rounded-2xl border border-white/5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 pr-1">
                          <div
                            style={
                              memberAvatar ? undefined : { backgroundColor: getAvatarColor(m.color) }
                            }
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-xs sm:text-sm shrink-0"
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
                              <p className="font-semibold text-white text-xs sm:text-sm truncate">{m.name}</p>
                              {Boolean(
                                (m as any).has_account ||
                                  (m as any).is_registered ||
                                  friendObj?.has_account
                              )}
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-gray-500 truncate">
                              {m.pendingCount > 0
                                ? 'Dividindo despesas do grupo'
                                : 'Sem pendências abertas'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-1.5 sm:gap-2">
                          <div>
                            {deveVoce ? (
                              <>
                                <p className="text-xs font-bold text-[#2DD4BF] tabular-nums">
                                  Deve R$ {moneyConverter(m.owesYou)}
                                </p>
                                <p className="text-[10px] text-gray-500">
                                  {m.pendingCount}{' '}
                                  {m.pendingCount === 1 ? 'pendente' : 'pendentes'}
                                </p>
                              </>
                            ) : voceDeve ? (
                              <p className="text-xs font-bold text-red-400 tabular-nums">
                                Você deve R$ {moneyConverter(Math.abs(m.owesYou))}
                              </p>
                            ) : (
                              <span className="text-xs text-[#2DD4BF] flex items-center gap-1 font-medium">
                                <CheckCircle2 size={13} /> Quitado
                              </span>
                            )}
                          </div>

                          {deveVoce && (
                            <button
                              onClick={() => handleQuitarMembroNoGrupo(m.friendId, m.owesYou, m.name)}
                              className="p-1.5 sm:p-2 bg-[#2DD4BF]/15 text-[#2DD4BF] hover:bg-[#2DD4BF]/25 rounded-xl transition-colors shrink-0"
                              title="Confirmar que este membro te pagou"
                            >
                              <DollarSign size={14} />
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
                              className="px-2.5 py-1.5 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
                              title="Pagar mediante comprovante"
                            >
                              <Upload size={12} /> Pagar
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
              <div className="bg-[#141923] rounded-2xl p-4 border border-[#2DD4BF]/20">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-white font-bold text-sm flex items-center gap-2">
                    <QrCode size={16} className="text-[#2DD4BF]" />
                    Rotas de Acerto (Pix)
                  </h4>
                  <span className="text-[10px] bg-[#2DD4BF]/15 text-[#2DD4BF] px-2 py-0.5 rounded-full font-bold">
                    {grupo.transfers.length} {grupo.transfers.length === 1 ? 'repasse' : 'repasses'}
                  </span>
                </div>
                <div className="space-y-2">
                  {grupo.transfers.map((t, idx) => (
                    <div
                      key={idx}
                      className="bg-[#1c1c1e] p-3 rounded-xl flex items-center justify-between border border-white/5"
                    >
                      <div className="flex items-center gap-2 text-xs text-white font-medium">
                        <span className="font-bold text-red-400">{t.fromName}</span>
                        <ArrowRight size={14} className="text-gray-500" />
                        <span className="font-bold text-[#2DD4BF]">{t.toName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          R$ {moneyConverter(t.amount)}
                        </span>
                        <button
                          onClick={() => handleOpenTransferPix(t)}
                          className="bg-[#2DD4BF]/20 text-[#2DD4BF] hover:bg-[#2DD4BF]/30 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                        >
                          {t.fromName === 'Você' ? 'Pagar' : 'Pix'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rachas no Grupo */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-white font-bold text-base">Rachas no Grupo</h4>
                <span className="text-xs text-[#2DD4BF] font-medium">
                  {expensesFiltradas.length}{' '}
                  {expensesFiltradas.length === 1 ? 'racha' : 'rachas'}
                </span>
              </div>

              {/* Botões de Filtros Rápidos de Status no Grupo */}
              {expensesWithStatus.length > 0 && (
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide overscroll-x-contain touch-pan-x mb-2.5">
                  {botoesFiltroGrupo.map((btn) => {
                    const isActive = filtroStatusGrupo === btn.id;
                    const Icon = btn.icon;
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => setFiltroStatusGrupo(btn.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                          isActive
                            ? 'bg-[#2DD4BF] text-[#05080f] font-bold shadow-sm'
                            : 'bg-[#1c1c1e] text-gray-400 hover:text-white border border-white/5'
                        }`}
                      >
                        {Icon && (
                          <Icon
                            size={13}
                            className={isActive ? 'text-[#05080f]' : btn.color}
                          />
                        )}
                        <span>{btn.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isActive
                              ? 'bg-[#05080f]/20 text-[#05080f]'
                              : 'bg-white/5 text-gray-400'
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
                <div className="bg-[#1c1c1e] p-6 rounded-2xl border border-white/5 text-center">
                  <p className="text-gray-500 text-sm italic">
                    Nenhuma despesa registrada neste grupo. Clique em "+ Novo Racha" acima!
                  </p>
                </div>
              ) : expensesFiltradas.length === 0 ? (
                <div className="bg-[#1c1c1e] p-5 rounded-2xl border border-white/5 text-center">
                  <p className="text-gray-400 text-xs">
                    Nenhum racha encontrado com o filtro{' '}
                    <span className="text-[#2DD4BF] font-semibold">
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
                <div className="space-y-2.5">
                  {expensesFiltradas.map(({ expense, corridaCompleta, userStatus, corridaParticipantes }) => (
                    <RideCard
                      key={expense.id}
                      data={corridaCompleta.data}
                      tag={corridaCompleta.tag}
                      titulo={corridaCompleta.titulo}
                      valorTotal={moneyConverter(corridaCompleta.valorTotal)}
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
        maskShape="square"
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

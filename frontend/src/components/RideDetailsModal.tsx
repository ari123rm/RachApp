// src/components/RideDetailsModal.tsx
import { createPortal } from 'react-dom';
import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  Receipt,
  Calendar,
  Users,
  Trash2,
  Pencil,
  Check,
  UsersRound,
  Upload,
  FileCheck2,
  BadgeCheck,
  LoaderCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import type { Corrida } from '../types';
import moneyConverter from '../utils/moneyConverter';
import { AddRideModal } from './AddRideModal';
import { PayWithReceiptModal, ReceiptViewerModal } from './ReceiptModals';
import { dbService } from '../services/database';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { getAvatarColor } from '../utils/avatarColor';
import { applyBilateralNetting } from '../utils/netting';
import { parseReceiptUrls } from '../utils/receiptShare';

interface RideDetailsProps {
  ride?: Corrida;
  participantes: any[];
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdated?: () => void;
}

export function RideDetailsModal({
  ride,
  participantes,
  isOpen,
  onClose,
  onDelete,
  onUpdated,
}: RideDetailsProps) {
  const [currentRide, setCurrentRide] = useState<Corrida | null>(ride || null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPaySelfOpen, setIsPaySelfOpen] = useState(false);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [nettingMap, setNettingMap] = useState<Map<string, any>>(new Map());
  const [updatingFriendId, setUpdatingFriendId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [receiptToView, setReceiptToView] = useState<{
    isOpen: boolean;
    url: string | null;
    title: string;
    initialIndex?: number;
  }>({
    isOpen: false,
    url: null,
    title: '',
    initialIndex: 0,
  });

  useModalBackHandler(isOpen, onClose);

  useEffect(() => {
    setCurrentRide(ride || null);
  }, [ride]);

  useEffect(() => {
    if (!feedbackMsg) return;
    const timer = setTimeout(() => {
      setFeedbackMsg(null);
    }, 3200);
    return () => clearTimeout(timer);
  }, [feedbackMsg]);

  const atualizarNettingEModal = useCallback(
    async (targetRide: Corrida) => {
      try {
        const [allRides, allFriends] = await Promise.all([
          dbService.corridas.getAll(),
          dbService.amigos.getAll(),
        ]);
        const fresh = allRides.find((c) => c.id === targetRide.id);
        if (fresh) {
          setCurrentRide(fresh);
        }
        const r = fresh || targetRide;
        const map = new Map<string, any>();
        if (r.paidByFriendId) {
          const friendPayer = allFriends.find((f) => f.id === r.paidByFriendId);
          if (friendPayer) {
            const res = applyBilateralNetting(allRides, friendPayer, allFriends);
            const info = res.get(r.id);
            if (info) map.set('self', info);
          }
        } else {
          for (const p of participantes) {
            const res = applyBilateralNetting(allRides, p, allFriends);
            const info = res.get(r.id);
            if (info) map.set(p.id, info);
          }
        }
        setNettingMap(map);
      } catch (err) {
        console.warn('Erro ao atualizar netting:', err);
      }
    },
    [participantes]
  );

  useEffect(() => {
    if (isOpen) {
      dbService.auth
        .getSessionUser()
        .then((u) => setMyAvatarUrl(u?.avatar_url || null))
        .catch(() => {});

      if (ride) {
        dbService.notifications
          .markAsReadByExpenseId(ride.id)
          .then((marked) => {
            if (marked.length > 0 && onUpdated) {
              onUpdated();
            }
          })
          .catch((err) => {
            console.warn('Erro ao marcar notificações do racha como lidas:', err);
          });

        atualizarNettingEModal(ride);
      }
    }
  }, [isOpen, ride?.id, atualizarNettingEModal]);

  const activeRide = currentRide || ride;
  if (!isOpen || !activeRide) return null;

  const valorNumerico = Number(activeRide.valorTotal || 0);
  const totalPessoas = (activeRide.participantesIds?.length || participantes.length) + 1;
  const valorDivididoPadrao = totalPessoas > 0 ? valorNumerico / totalPessoas : valorNumerico;

  const obterParteAmigo = (amigoId: string): number => {
    if (activeRide.valoresDevidos && activeRide.valoresDevidos[amigoId] !== undefined) {
      return Number(activeRide.valoresDevidos[amigoId]);
    }
    return valorDivididoPadrao;
  };

  const minhaParte =
    activeRide.selfAmountOwed !== undefined ? Number(activeRide.selfAmountOwed) : valorDivididoPadrao;
  const meuValorPago = Number(activeRide.selfAmountPaid || 0);

  const formatarDataBR = (iso: string) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const voceEhPagador = !activeRide.paidByFriendId;
  const selfNetting = nettingMap.get('self');
  const isSelfQuitado = voceEhPagador || meuValorPago >= minhaParte - 0.01 || !!selfNetting?.isQuitada;
  const pagadorAmigo = participantes.find((p: any) => p.id === activeRide.paidByFriendId);
  const pagadorNome = pagadorAmigo?.nome || pagadorAmigo?.name || activeRide.paidByName || 'Amigo';
  const pagadorPix =
    activeRide.payerPixKey?.trim() ||
    pagadorAmigo?.registered_pix_key?.trim() ||
    pagadorAmigo?.pix_key?.trim() ||
    pagadorAmigo?.pix?.trim() ||
    '';

  const handleCreditorTogglePaid = async (
    amigoId: string,
    jaPago: boolean,
    valorParte: number
  ) => {
    if (!voceEhPagador || updatingFriendId) return;

    const amigoObj = participantes.find((p: any) => p.id === amigoId);
    const amigoNome = amigoObj?.nome || amigoObj?.name || 'Amigo';
    const novoValor = jaPago ? 0 : valorParte;

    setUpdatingFriendId(amigoId);

    setCurrentRide((prev) => {
      const base = prev || activeRide;
      if (!base) return base;
      const novosPagamentos = { ...(base.pagamentos || {}), [amigoId]: novoValor };
      const allPaid = (base.participantesIds || []).every((pid) => {
        const owed = base.valoresDevidos?.[pid] ?? valorDivididoPadrao;
        return (novosPagamentos[pid] || 0) >= owed - 0.01;
      });
      return {
        ...base,
        pagamentos: novosPagamentos,
        isPaied: allPaid,
      };
    });

    try {
      await dbService.financeiro.definirPagamentoParticipante(
        activeRide.id,
        amigoId,
        novoValor
      );

      await atualizarNettingEModal(activeRide);

      if (jaPago) {
        setFeedbackMsg({
          text: `Pagamento de ${amigoNome} desfeito (marcado como pendente).`,
          type: 'info',
        });
      } else {
        setFeedbackMsg({
          text: `Pagamento de ${amigoNome} registrado como quitado!`,
          type: 'success',
        });
      }

      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Erro ao atualizar pagamento:', err);
      await atualizarNettingEModal(activeRide);
      alert('Não foi possível atualizar o pagamento. Tente novamente.');
    } finally {
      setUpdatingFriendId(null);
    }
  };

  const handleDebtorConfirmSelfPayment = async (amount: number, receiptBase64: string) => {
    const novoTotalPago = Math.min(minhaParte, Number((meuValorPago + amount).toFixed(2)));
    try {
      await dbService.financeiro.definirPagamentoParticipante(
        activeRide.id,
        'self',
        novoTotalPago > 0 ? novoTotalPago : amount,
        receiptBase64
      );
      await atualizarNettingEModal(activeRide);
      setFeedbackMsg({
        text: 'Seu pagamento com comprovante foi registrado com sucesso!',
        type: 'success',
      });
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Erro ao registrar comprovante:', err);
      alert('Erro ao registrar comprovante.');
    }
  };

  const nonPayerFriendsCount = participantes.filter(
    (item: any) => item.id !== activeRide.paidByFriendId
  ).length;

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-app)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-[var(--border-color)] shadow-xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-slide-up pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-[var(--border-color)] rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Cabeçalho com Editar e Excluir */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0">
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] rounded-full transition-colors active:scale-95"
          >
            <ChevronLeft size={24} strokeWidth={2} />
          </button>

          <h2 className="text-h2 text-[var(--text-primary)]">Detalhes do Racha</h2>

          {activeRide.isCreator !== false ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsEditOpen(true)}
                className="p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] rounded-full transition-colors active:scale-95"
                title="Editar Racha"
              >
                <Pencil size={18} strokeWidth={2} />
              </button>
              <button
                onClick={() => {
                  if (activeRide.isCreator === false) {
                    alert('Apenas o criador do racha pode excluí-lo.');
                    return;
                  }
                  onDelete(activeRide.id);
                  onClose();
                }}
                className="p-2 text-[#F43F5E] hover:bg-[var(--rose-bg)] rounded-full transition-colors active:scale-95"
                title="Excluir Racha"
              >
                <Trash2 size={18} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <span className="text-caption text-[var(--text-secondary)] bg-[var(--bg-subtle)] border border-[var(--border-color)] px-2.5 py-1 rounded-full font-medium">
              Criado por amigo
            </span>
          )}
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Card de Resumo (Valor e Título) */}
          <div className="ds-card text-center">
            <p className="text-[var(--text-secondary)] text-caption uppercase font-semibold tracking-wider mb-1">
              {activeRide.tag || 'UBER'}
            </p>
            <h3 className="text-h1 text-[var(--text-primary)] mb-2">{activeRide.titulo}</h3>

            {activeRide.groupName && (
              <div className="inline-flex items-center gap-1.5 bg-[var(--primary)]/10 text-[var(--primary)] text-caption font-semibold px-3 py-1 rounded-full mb-3">
                <UsersRound size={13} strokeWidth={2} /> {activeRide.groupName}
              </div>
            )}

            <p className="text-[var(--text-secondary)] text-caption uppercase font-semibold">
              Valor Total
            </p>
            <div className="text-display text-[var(--primary)] mt-1">
              R$ {moneyConverter(valorNumerico)}
            </div>
          </div>

          {/* Informações Extras */}
          <div className="ds-card-sm space-y-3">
            <div className="flex items-center text-[var(--text-secondary)]">
              <Calendar size={17} strokeWidth={2} className="text-[var(--primary)] mr-3" />
              <span className="text-body2">
                Data: <strong className="text-[var(--text-primary)] ml-1">{formatarDataBR(activeRide.data)}</strong>
              </span>
            </div>
            <div className="flex items-center text-[var(--text-secondary)]">
              <Receipt size={17} strokeWidth={2} className="text-[var(--primary)] mr-3" />
              <span className="text-body2">
                Categoria: <strong className="text-[var(--text-primary)] ml-1">{activeRide.tag || 'Uber'}</strong>
              </span>
            </div>
          </div>

          {/* Mensagem de Feedback em Tempo Real de Pagamento */}
          {feedbackMsg && (
            <div
              className={`p-3.5 rounded-2xl border text-caption font-semibold flex items-center justify-between animate-fade-in shadow-sm transition-all ${
                feedbackMsg.type === 'success'
                  ? 'bg-[var(--emerald-bg)] border-[var(--emerald-border)] text-[#10B981]'
                  : 'bg-[var(--amber-bg)] border-[var(--amber-border)] text-[#F59E0B]'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} strokeWidth={2} className="shrink-0" />
                <span>{feedbackMsg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackMsg(null)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
                title="Fechar aviso"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          )}

          {/* Divisão da Conta */}
          <div>
            <div className="flex items-center justify-between mb-3 text-[var(--text-primary)]">
              <div className="flex items-center">
                <Users size={18} strokeWidth={2} className="text-[var(--primary)] mr-2" />
                <h3 className="text-h2">Divisão ({totalPessoas} pessoas)</h3>
              </div>
            </div>

            <div className="space-y-2.5">
              {participantes.map((p: any) => {
                const nome = p.nome || p.name || 'Amigo';
                const cor = p.cor || p.color || 'bg-sky-500';
                const valorParte = obterParteAmigo(p.id);
                const pctParte =
                  valorNumerico > 0 ? ((valorParte / valorNumerico) * 100).toFixed(1) : '0';
                const valorPago = activeRide.pagamentos?.[p.id] || 0;
                const isFriendPayer = activeRide.paidByFriendId === p.id;
                const pNetting = nettingMap.get(p.id);
                const isQuitado = isFriendPayer || valorPago >= valorParte - 0.01 || !!pNetting?.isQuitada;
                const receiptDoAmigo = isFriendPayer
                  ? null
                  : activeRide.comprovantes?.[p.id] ||
                    (nonPayerFriendsCount === 1 && activeRide.comprovantes
                      ? Object.entries(activeRide.comprovantes).find(
                          ([k, v]) => k !== activeRide.paidByFriendId && Boolean(v)
                        )?.[1] || null
                      : null);
                const receiptsDoAmigo = parseReceiptUrls(receiptDoAmigo);
                const isUpdatingThisFriend = updatingFriendId === p.id;

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (receiptDoAmigo) {
                        setReceiptToView({
                          isOpen: true,
                          url: receiptDoAmigo,
                          title: `Comprovante de ${nome}`,
                          initialIndex: 0,
                        });
                      }
                    }}
                    className={`flex justify-between items-center bg-[var(--bg-surface)] p-3.5 rounded-2xl border transition-all gap-2.5 ${
                      receiptDoAmigo
                        ? 'border-[var(--primary)]/40 hover:border-[var(--primary)] cursor-pointer active:scale-[0.99]'
                        : 'border-[var(--border-color)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        style={p.avatar_url ? undefined : { backgroundColor: getAvatarColor(cor) }}
                        className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-white shrink-0"
                      >
                        {p.avatar_url ? (
                          <img
                            src={p.avatar_url}
                            alt={nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          nome[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-[var(--text-primary)] text-body2 truncate max-w-[140px] sm:max-w-none">
                            {nome}
                          </span>
                          {(p.has_account || p.is_registered) && (
                            <BadgeCheck size={14} strokeWidth={2} className="text-[var(--primary)] shrink-0" />
                          )}
                          {isFriendPayer && (
                            <span className="text-caption bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 rounded-full font-semibold shrink-0">
                              Pagador
                            </span>
                          )}
                          {receiptsDoAmigo.length === 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReceiptToView({
                                  isOpen: true,
                                  url: receiptDoAmigo,
                                  title: `Comprovante de ${nome}`,
                                  initialIndex: 0,
                                });
                              }}
                              className="text-caption bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 shrink-0"
                            >
                              <FileCheck2 size={12} strokeWidth={2} /> Ver Comprovante
                            </button>
                          )}
                          {receiptsDoAmigo.length > 1 &&
                            receiptsDoAmigo.map((_, rIdx) => (
                              <button
                                key={rIdx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReceiptToView({
                                    isOpen: true,
                                    url: receiptDoAmigo,
                                    title: `Comprovante de ${nome}`,
                                    initialIndex: rIdx,
                                  });
                                }}
                                className="text-caption bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 shrink-0"
                              >
                                <FileCheck2 size={12} strokeWidth={2} /> Comprovante {rIdx + 1}
                              </button>
                            ))}
                        </div>

                        {!isFriendPayer &&
                          (voceEhPagador ? (
                            isUpdatingThisFriend ? (
                              <span className="text-caption text-[var(--text-secondary)] flex items-center gap-1 mt-0.5 animate-pulse">
                                <LoaderCircle size={12} strokeWidth={2} className="animate-spin text-[var(--primary)]" />
                                <span>Atualizando...</span>
                              </span>
                            ) : isQuitado && receiptDoAmigo ? (
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-caption font-semibold text-[#10B981] flex items-center gap-1">
                                  <Check size={12} strokeWidth={2.5} /> Pago (toque p/ ver)
                                </span>
                                <button
                                  type="button"
                                  disabled={!!updatingFriendId}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreditorTogglePaid(p.id, isQuitado, valorParte);
                                  }}
                                  className="text-caption text-[var(--text-secondary)] hover:text-[#F43F5E] underline active:scale-95 transition-transform disabled:opacity-50"
                                >
                                  Desfazer
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!!updatingFriendId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreditorTogglePaid(p.id, isQuitado, valorParte);
                                }}
                                className={`text-caption font-semibold mt-0.5 flex items-center gap-1 active:scale-95 transition-all disabled:opacity-50 ${
                                  isQuitado ? 'text-[#10B981] hover:underline' : 'text-[#F59E0B] hover:underline'
                                }`}
                              >
                                {isQuitado ? (
                                  <>
                                    <Check size={12} strokeWidth={2.5} /> Pago (desfazer)
                                  </>
                                ) : (
                                  '• Pendente (clique p/ quitar)'
                                )}
                              </button>
                            )
                          ) : (
                            <span
                              className={`text-caption font-semibold mt-0.5 flex items-center gap-1 ${
                                isQuitado ? 'text-[#10B981]' : 'text-[#F59E0B]'
                              }`}
                            >
                              {isQuitado ? (
                                <>
                                  <Check size={12} strokeWidth={2.5} />{' '}
                                  {receiptDoAmigo ? 'Pago (toque p/ ver)' : 'Pago'}
                                </>
                              ) : (
                                '• Pendente'
                              )}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-caption text-[var(--text-secondary)] mb-0.5">
                        Parte dele(a) ({pctParte}%)
                      </p>
                      <p className="font-display font-bold text-[var(--text-primary)] text-body2 tabular-nums">
                        R$ {moneyConverter(valorParte)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Card Você */}
              {(() => {
                const selfReceiptUrl = voceEhPagador ? null : activeRide.selfReceiptUrl || null;
                const selfReceipts = parseReceiptUrls(selfReceiptUrl);
                return (
                  <div
                    onClick={() => {
                      if (selfReceiptUrl) {
                        setReceiptToView({
                          isOpen: true,
                          url: selfReceiptUrl,
                          title: 'Seu Comprovante de Pagamento',
                          initialIndex: 0,
                        });
                      }
                    }}
                    className={`flex justify-between items-center bg-[var(--bg-surface)] p-3.5 rounded-2xl border transition-all gap-2.5 ${
                      selfReceiptUrl
                        ? 'border-[var(--primary)]/40 hover:border-[var(--primary)] cursor-pointer active:scale-[0.99]'
                        : 'border-[var(--border-color)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--primary)] flex items-center justify-center font-bold text-white shrink-0">
                        {myAvatarUrl ? (
                          <img src={myAvatarUrl} alt="Você" className="w-full h-full object-cover" />
                        ) : (
                          'V'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-[var(--text-primary)] text-body2">Você</span>
                          {voceEhPagador && (
                            <span className="text-caption bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 rounded-full font-semibold shrink-0">
                              Pagador
                            </span>
                          )}
                          {selfReceipts.length === 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReceiptToView({
                                  isOpen: true,
                                  url: selfReceiptUrl,
                                  title: 'Seu Comprovante de Pagamento',
                                  initialIndex: 0,
                                });
                              }}
                              className="text-caption bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 shrink-0"
                            >
                              <FileCheck2 size={12} strokeWidth={2} /> Ver Comprovante
                            </button>
                          )}
                          {selfReceipts.length > 1 &&
                            selfReceipts.map((_, rIdx) => (
                              <button
                                key={rIdx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReceiptToView({
                                    isOpen: true,
                                    url: selfReceiptUrl,
                                    title: 'Seu Comprovante de Pagamento',
                                    initialIndex: rIdx,
                                  });
                                }}
                                className="text-caption bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1 shrink-0"
                              >
                                <FileCheck2 size={12} strokeWidth={2} /> Comprovante {rIdx + 1}
                              </button>
                            ))}
                        </div>
                        {!voceEhPagador &&
                          (isSelfQuitado ? (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-caption font-semibold flex items-center gap-1 text-[#10B981]">
                                <Check size={12} strokeWidth={2.5} />{' '}
                                {selfReceiptUrl ? 'Pago (toque p/ ver)' : 'Pago'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPaySelfOpen(true);
                                }}
                                className="text-caption bg-[var(--bg-subtle)] hover:bg-[var(--border-color)] text-[var(--text-secondary)] border border-[var(--border-color)] px-2 py-0.5 rounded-lg font-semibold"
                              >
                                + Comprovante
                              </button>
                            </div>
                          ) : (
                            <div className="mt-1 space-y-1">
                              {meuValorPago > 0.005 && (
                                <p className="text-caption text-[var(--primary)] font-semibold">
                                  Já pago: R$ {moneyConverter(meuValorPago)} • Falta: R${' '}
                                  {moneyConverter(Math.max(0, minhaParte - meuValorPago))}
                                </p>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPaySelfOpen(true);
                                }}
                                className="text-caption bg-[var(--amber-bg)] text-[#F59E0B] border border-[var(--amber-border)] hover:opacity-90 px-2.5 py-1 rounded-xl font-semibold flex items-center gap-1 transition-colors"
                              >
                                <Upload size={12} strokeWidth={2} />{' '}
                                {meuValorPago > 0.005
                                  ? 'Pagar Restante c/ Comprovante'
                                  : 'Pagar c/ Comprovante'}
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-caption text-[var(--text-secondary)] mb-0.5">
                        Sua parte (
                        {valorNumerico > 0 ? ((minhaParte / valorNumerico) * 100).toFixed(1) : '0'}%)
                      </p>
                      <p className="font-display font-bold text-[var(--text-primary)] text-body2 tabular-nums">
                        R$ {moneyConverter(minhaParte)}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Pagar sua parte com Comprovante (quando o amigo pagou o racha) */}
      <PayWithReceiptModal
        isOpen={isPaySelfOpen}
        onClose={() => setIsPaySelfOpen(false)}
        recipientName={pagadorNome}
        pixKey={pagadorPix}
        defaultAmount={
          Math.max(0, Number((minhaParte - meuValorPago).toFixed(2))) > 0.005
            ? Number((minhaParte - meuValorPago).toFixed(2))
            : Number(minhaParte.toFixed(2))
        }
        allowCustomAmount={true}
        description={`${activeRide.tag || 'Uber'} - ${activeRide.titulo}`}
        onConfirm={handleDebtorConfirmSelfPayment}
      />

      {/* Modal de Visualização de Comprovante */}
      <ReceiptViewerModal
        isOpen={receiptToView.isOpen}
        onClose={() => setReceiptToView({ isOpen: false, url: null, title: '', initialIndex: 0 })}
        receiptUrl={receiptToView.url}
        title={receiptToView.title}
        initialIndex={receiptToView.initialIndex}
      />

      <AddRideModal
        isOpen={isEditOpen}
        rideToEdit={activeRide}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => {
          setIsEditOpen(false);
          if (onUpdated) onUpdated();
        }}
      />
    </div>,
    document.body
  );
}

import { createPortal } from 'react-dom';
// src/components/RideDetailsModal.tsx
import { useState, useEffect } from 'react';
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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPaySelfOpen, setIsPaySelfOpen] = useState(false);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [nettingMap, setNettingMap] = useState<Map<string, any>>(new Map());
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

        Promise.all([dbService.corridas.getAll(), dbService.amigos.getAll()])
          .then(([allRides, allFriends]) => {
            const map = new Map<string, any>();
            if (ride.paidByFriendId) {
              const friendPayer = allFriends.find((f) => f.id === ride.paidByFriendId);
              if (friendPayer) {
                const res = applyBilateralNetting(allRides, friendPayer, allFriends);
                const info = res.get(ride.id);
                if (info) map.set('self', info);
              }
            } else {
              for (const p of participantes) {
                const res = applyBilateralNetting(allRides, p, allFriends);
                const info = res.get(ride.id);
                if (info) map.set(p.id, info);
              }
            }
            setNettingMap(map);
          })
          .catch(() => {});
      }
    }
  }, [isOpen, ride?.id]);

  if (!isOpen || !ride) return null;

  const valorNumerico = Number(ride.valorTotal || 0);
  const totalPessoas = (ride.participantesIds?.length || participantes.length) + 1;
  const valorDivididoPadrao = totalPessoas > 0 ? valorNumerico / totalPessoas : valorNumerico;

  const obterParteAmigo = (amigoId: string): number => {
    if (ride.valoresDevidos && ride.valoresDevidos[amigoId] !== undefined) {
      return Number(ride.valoresDevidos[amigoId]);
    }
    return valorDivididoPadrao;
  };

  const minhaParte =
    ride.selfAmountOwed !== undefined ? Number(ride.selfAmountOwed) : valorDivididoPadrao;
  const meuValorPago = Number(ride.selfAmountPaid || 0);

  const formatarDataBR = (iso: string) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const voceEhPagador = !ride.paidByFriendId;
  const selfNetting = nettingMap.get('self');
  const isSelfQuitado = voceEhPagador || meuValorPago >= minhaParte - 0.01 || !!selfNetting?.isQuitada;
  const pagadorAmigo = participantes.find((p: any) => p.id === ride.paidByFriendId);
  const pagadorNome = pagadorAmigo?.nome || pagadorAmigo?.name || ride.paidByName || 'Amigo';
  const pagadorPix =
    ride.payerPixKey?.trim() ||
    pagadorAmigo?.registered_pix_key?.trim() ||
    pagadorAmigo?.pix_key?.trim() ||
    pagadorAmigo?.pix?.trim() ||
    '';

  // Apenas o pagador (credor/"lesado") pode marcar/desmarcar diretamente sem comprovante
  const handleCreditorTogglePaid = async (
    amigoId: string,
    jaPago: boolean,
    valorParte: number
  ) => {
    if (!voceEhPagador) return;
    try {
      await dbService.financeiro.definirPagamentoParticipante(
        ride.id,
        amigoId,
        jaPago ? 0 : valorParte
      );
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Erro ao atualizar pagamento:', err);
    }
  };

  // Devedor ("Você", quando um amigo pagou a conta) envia o comprovante para dar baixa na sua parte
  const handleDebtorConfirmSelfPayment = async (amount: number, receiptBase64: string) => {
    const novoTotalPago = Math.min(minhaParte, Number((meuValorPago + amount).toFixed(2)));
    await dbService.financeiro.definirPagamentoParticipante(
      ride.id,
      'self',
      novoTotalPago > 0 ? novoTotalPago : amount,
      receiptBase64
    );
    if (onUpdated) onUpdated();
  };

  if (!isOpen || !ride) return null;

  const nonPayerFriendsCount = participantes.filter(
    (item: any) => item.id !== ride.paidByFriendId
  ).length;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0f19] w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-slide-up pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Cabeçalho com Editar e Excluir */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0b0f19]/95 backdrop-blur-md shrink-0">
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-gray-800 rounded-full transition-colors active:scale-95"
          >
            <ChevronLeft size={26} />
          </button>

          <h2 className="text-base font-semibold text-white">Detalhes do Racha</h2>

          {ride.isCreator !== false ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsEditOpen(true)}
                className="p-2 text-gray-300 hover:bg-white/10 hover:text-white rounded-full transition-colors active:scale-95"
                title="Editar Racha"
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={() => {
                  if (ride.isCreator === false) {
                    alert('Apenas o criador do racha pode excluí-lo.');
                    return;
                  }
                  onDelete(ride.id);
                  onClose();
                }}
                className="p-2 text-red-500 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors active:scale-95"
                title="Excluir Racha"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-gray-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full font-medium">
              Criado por amigo
            </span>
          )}
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Card de Resumo (Valor e Título) */}
          <div className="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e] p-5 rounded-3xl text-center shadow-lg border border-white/5">
            <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">
              {ride.tag || 'UBER'}
            </p>
            <h3 className="text-xl font-bold text-white mb-2">{ride.titulo}</h3>

            {ride.groupName && (
              <div className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full mb-2">
                <UsersRound size={13} /> {ride.groupName}
              </div>
            )}

            <p className="text-gray-500 text-xs uppercase font-bold">Valor Total</p>
            <div className="text-3xl font-black text-[#2DD4BF] mt-1">
              R$ {moneyConverter(valorNumerico)}
            </div>
          </div>

          {/* Informações Extras */}
          <div className="bg-[#1c1c1e] rounded-2xl p-4 space-y-3 border border-white/5">
            <div className="flex items-center text-gray-300">
              <Calendar size={17} className="text-gray-500 mr-3" />
              <span className="text-sm">
                Data: <strong className="text-white ml-1">{formatarDataBR(ride.data)}</strong>
              </span>
            </div>
            <div className="flex items-center text-gray-300">
              <Receipt size={17} className="text-gray-500 mr-3" />
              <span className="text-sm">
                Categoria: <strong className="text-white ml-1">{ride.tag || 'Uber'}</strong>
              </span>
            </div>
          </div>

          {/* Divisão da Conta */}
          <div>
            <div className="flex items-center justify-between mb-3 text-gray-300">
              <div className="flex items-center">
                <Users size={17} className="text-gray-500 mr-2" />
                <h3 className="font-semibold text-sm">Divisão ({totalPessoas} pessoas)</h3>
              </div>
            </div>

            <div className="space-y-2.5">
              {participantes.map((p: any) => {
                const nome = p.nome || p.name || 'Amigo';
                const cor = p.cor || p.color || 'bg-sky-500';
                const valorParte = obterParteAmigo(p.id);
                const pctParte =
                  valorNumerico > 0 ? ((valorParte / valorNumerico) * 100).toFixed(1) : '0';
                const valorPago = ride.pagamentos?.[p.id] || 0;
                const isFriendPayer = ride.paidByFriendId === p.id;
                const pNetting = nettingMap.get(p.id);
                const isQuitado = isFriendPayer || valorPago >= valorParte - 0.01 || !!pNetting?.isQuitada;
                const receiptDoAmigo = isFriendPayer
                  ? null
                  : ride.comprovantes?.[p.id] ||
                    (nonPayerFriendsCount === 1 && ride.comprovantes
                      ? Object.entries(ride.comprovantes).find(
                          ([k, v]) => k !== ride.paidByFriendId && Boolean(v)
                        )?.[1] || null
                      : null);
                const receiptsDoAmigo = parseReceiptUrls(receiptDoAmigo);

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
                    className={`flex justify-between items-center bg-[#1c1c1e] p-3 sm:p-3.5 rounded-xl border transition-all gap-2.5 ${
                      receiptDoAmigo
                        ? 'border-sky-500/30 hover:border-[#2DD4BF]/50 cursor-pointer active:scale-[0.99]'
                        : 'border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
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
                          <span className="font-medium text-white text-sm truncate max-w-[140px] sm:max-w-none">{nome}</span>
                          {(p.has_account || p.is_registered) && (
                            <BadgeCheck size={14} className="text-[#2DD4BF] fill-[#2DD4BF]/20 shrink-0" />
                          )}
                          {isFriendPayer && (
                            <span className="text-[10px] bg-[#2DD4BF]/20 text-[#2DD4BF] px-2 py-0.5 rounded-md font-bold shrink-0">
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
                              className="text-[10px] bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 shrink-0"
                            >
                              <FileCheck2 size={11} /> Ver Comprovante
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
                                className="text-[10px] bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 shrink-0"
                              >
                                <FileCheck2 size={11} /> Comprovante {rIdx + 1}
                              </button>
                            ))}
                        </div>

                        {!isFriendPayer &&
                          (voceEhPagador ? (
                            isQuitado && receiptDoAmigo ? (
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[11px] font-semibold text-[#34C759] flex items-center gap-1">
                                  <Check size={12} /> Pago (toque p/ ver)
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreditorTogglePaid(p.id, isQuitado, valorParte);
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-red-400 underline"
                                >
                                  Desfazer
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreditorTogglePaid(p.id, isQuitado, valorParte);
                                }}
                                className={`text-[11px] font-semibold mt-0.5 flex items-center gap-1 ${
                                  isQuitado ? 'text-[#34C759]' : 'text-amber-400 hover:underline'
                                }`}
                              >
                                {isQuitado ? (
                                  <>
                                    <Check size={12} /> Pago (desfazer)
                                  </>
                                ) : (
                                  '• Pendente (clique p/ quitar)'
                                )}
                              </button>
                            )
                          ) : (
                            <span
                              className={`text-[11px] font-semibold mt-0.5 flex items-center gap-1 ${
                                isQuitado ? 'text-[#34C759]' : 'text-amber-400'
                              }`}
                            >
                              {isQuitado ? (
                                <>
                                  <Check size={12} /> {receiptDoAmigo ? 'Pago (toque p/ ver)' : 'Pago'}
                                </>
                              ) : (
                                '• Pendente'
                              )}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-gray-500 mb-0.5">
                        Parte dele(a) ({pctParte}%)
                      </p>
                      <p className="font-bold text-white text-sm tabular-nums">
                        R$ {moneyConverter(valorParte)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Card Você */}
              {(() => {
                const selfReceiptUrl = voceEhPagador ? null : ride.selfReceiptUrl || null;
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
                    className={`flex justify-between items-center bg-[#1c1c1e] p-3 sm:p-3.5 rounded-xl border transition-all gap-2.5 ${
                      selfReceiptUrl
                        ? 'border-sky-500/30 hover:border-[#2DD4BF]/50 cursor-pointer active:scale-[0.99]'
                        : 'border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2DD4BF] flex items-center justify-center font-bold text-[#05080f] shrink-0">
                        {myAvatarUrl ? (
                          <img src={myAvatarUrl} alt="Você" className="w-full h-full object-cover" />
                        ) : (
                          'V'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-white text-sm">Você</span>
                          {voceEhPagador && (
                            <span className="text-[10px] bg-[#2DD4BF]/20 text-[#2DD4BF] px-2 py-0.5 rounded-md font-bold shrink-0">
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
                              className="text-[10px] bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 shrink-0"
                            >
                              <FileCheck2 size={11} /> Ver Comprovante
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
                                className="text-[10px] bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 shrink-0"
                              >
                                <FileCheck2 size={11} /> Comprovante {rIdx + 1}
                              </button>
                            ))}
                        </div>
                        {!voceEhPagador &&
                          (isSelfQuitado ? (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] font-semibold flex items-center gap-1 text-[#34C759]">
                                <Check size={12} />{' '}
                                {selfReceiptUrl ? 'Pago (toque p/ ver)' : 'Pago'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPaySelfOpen(true);
                                }}
                                className="text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 px-2 py-0.5 rounded-md font-semibold"
                              >
                                + Comprovante
                              </button>
                            </div>
                          ) : (
                            <div className="mt-1 space-y-1">
                              {meuValorPago > 0.005 && (
                                <p className="text-[10px] text-[#2DD4BF] font-semibold">
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
                                className="text-[11px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                              >
                                <Upload size={11} />{' '}
                                {meuValorPago > 0.005
                                  ? 'Pagar Restante c/ Comprovante'
                                  : 'Pagar c/ Comprovante'}
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-gray-500 mb-0.5">
                        Sua parte (
                        {valorNumerico > 0 ? ((minhaParte / valorNumerico) * 100).toFixed(1) : '0'}%)
                      </p>
                      <p className="font-bold text-white text-sm tabular-nums">R$ {moneyConverter(minhaParte)}</p>
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
        description={`${ride.tag || 'Uber'} - ${ride.titulo}`}
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
        rideToEdit={ride}
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

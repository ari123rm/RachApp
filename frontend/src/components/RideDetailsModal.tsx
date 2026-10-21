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
  const [receiptToView, setReceiptToView] = useState<{
    isOpen: boolean;
    url: string | null;
    title: string;
  }>({
    isOpen: false,
    url: null,
    title: '',
  });

  useModalBackHandler(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      dbService.auth
        .getSessionUser()
        .then((u) => setMyAvatarUrl(u?.avatar_url || null))
        .catch(() => {});
    }
  }, [isOpen]);

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
  const isSelfQuitado = voceEhPagador || meuValorPago >= minhaParte - 0.01;
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
    await dbService.financeiro.definirPagamentoParticipante(
      ride.id,
      'self',
      amount,
      receiptBase64
    );
    if (onUpdated) onUpdated();
  };

  if (!isOpen || !ride) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0f19] w-full max-w-md rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho com Editar e Excluir */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0b0f19]/95 backdrop-blur-md shrink-0">
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <ChevronLeft size={26} />
          </button>

          <h2 className="text-base font-semibold text-white">Detalhes do Racha</h2>

          {ride.isCreator !== false ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsEditOpen(true)}
                className="p-2 text-gray-300 hover:bg-white/10 hover:text-white rounded-full transition-colors"
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
                className="p-2 text-red-500 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors"
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
                const isQuitado = isFriendPayer || valorPago >= valorParte - 0.01;
                const receiptDoAmigo = ride.comprovantes?.[p.id] || null;

                return (
                  <div
                    key={p.id}
                    className="flex justify-between items-center bg-[#1c1c1e] p-3.5 rounded-xl border border-white/5"
                  >
                    <div className="flex items-center gap-3">
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
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-white text-sm">{nome}</span>
                          {(p.has_account || p.is_registered) && (
                            <BadgeCheck size={14} className="text-[#2DD4BF] fill-[#2DD4BF]/20 shrink-0" />
                          )}
                          {isFriendPayer && (
                            <span className="text-[10px] bg-[#2DD4BF]/20 text-[#2DD4BF] px-2 py-0.5 rounded-md font-bold">
                              Pagador
                            </span>
                          )}
                          {receiptDoAmigo && (
                            <button
                              type="button"
                              onClick={() =>
                                setReceiptToView({
                                  isOpen: true,
                                  url: receiptDoAmigo,
                                  title: `Comprovante de ${nome}`,
                                })
                              }
                              className="text-[10px] bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1"
                            >
                              <FileCheck2 size={11} /> Ver Comprovante
                            </button>
                          )}
                        </div>

                        {!isFriendPayer &&
                          (voceEhPagador ? (
                            <button
                              onClick={() =>
                                handleCreditorTogglePaid(p.id, isQuitado, valorParte)
                              }
                              className={`text-[11px] font-semibold mt-0.5 flex items-center gap-1 ${
                                isQuitado ? 'text-[#34C759]' : 'text-amber-400 hover:underline'
                              }`}
                            >
                              {isQuitado ? (
                                <>
                                  <Check size={12} /> Pago (clique p/ desfazer)
                                </>
                              ) : (
                                '• Pendente (clique p/ quitar)'
                              )}
                            </button>
                          ) : (
                            <span
                              className={`text-[11px] font-semibold mt-0.5 flex items-center gap-1 ${
                                isQuitado ? 'text-[#34C759]' : 'text-amber-400'
                              }`}
                            >
                              {isQuitado ? (
                                <>
                                  <Check size={12} /> Pago
                                </>
                              ) : (
                                '• Pendente'
                              )}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500 mb-0.5">
                        Parte dele(a) ({pctParte}%)
                      </p>
                      <p className="font-bold text-white text-sm">
                        R$ {moneyConverter(valorParte)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Card Você */}
              <div className="flex justify-between items-center bg-[#1c1c1e] p-3.5 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2DD4BF] flex items-center justify-center font-bold text-[#05080f] shrink-0">
                    {myAvatarUrl ? (
                      <img src={myAvatarUrl} alt="Você" className="w-full h-full object-cover" />
                    ) : (
                      'V'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">Você</span>
                      {voceEhPagador && (
                        <span className="text-[10px] bg-[#2DD4BF]/20 text-[#2DD4BF] px-2 py-0.5 rounded-md font-bold">
                          Pagador
                        </span>
                      )}
                      {ride.selfReceiptUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setReceiptToView({
                              isOpen: true,
                              url: ride.selfReceiptUrl || null,
                              title: 'Seu Comprovante de Pagamento',
                            })
                          }
                          className="text-[10px] bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1"
                        >
                          <FileCheck2 size={11} /> Ver Comprovante
                        </button>
                      )}
                    </div>
                    {!voceEhPagador &&
                      (isSelfQuitado ? (
                        <span className="text-[11px] font-semibold mt-0.5 flex items-center gap-1 text-[#34C759]">
                          <Check size={12} /> Pago
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsPaySelfOpen(true)}
                          className="text-[11px] bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-2.5 py-1 rounded-lg font-bold mt-1 flex items-center gap-1 transition-colors"
                        >
                          <Upload size={11} /> Pagar c/ Comprovante
                        </button>
                      ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500 mb-0.5">
                    Sua parte (
                    {valorNumerico > 0 ? ((minhaParte / valorNumerico) * 100).toFixed(1) : '0'}%)
                  </p>
                  <p className="font-bold text-white text-sm">R$ {moneyConverter(minhaParte)}</p>
                </div>
              </div>
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
        defaultAmount={Math.max(0, Number((minhaParte - meuValorPago).toFixed(2)))}
        allowCustomAmount={false}
        description={`${ride.tag || 'Uber'} - ${ride.titulo}`}
        onConfirm={handleDebtorConfirmSelfPayment}
      />

      {/* Modal de Visualização de Comprovante */}
      <ReceiptViewerModal
        isOpen={receiptToView.isOpen}
        onClose={() => setReceiptToView({ isOpen: false, url: null, title: '' })}
        receiptUrl={receiptToView.url}
        title={receiptToView.title}
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

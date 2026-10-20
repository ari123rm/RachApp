// src/components/RideDetailsModal.tsx
import { useState } from 'react';
import {
  ChevronLeft,
  Receipt,
  Calendar,
  Users,
  Trash2,
  Pencil,
  Check,
  UsersRound,
} from 'lucide-react';
import type { Corrida } from '../types';
import moneyConverter from '../utils/moneyConverter';
import { AddRideModal } from './AddRideModal';
import { dbService } from '../services/database';

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

  const handleTogglePaid = async (amigoId: string, jaPago: boolean, valorParte: number) => {
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

  const voceEhPagador = !ride.paidByFriendId;
  const isSelfQuitado = voceEhPagador || meuValorPago >= minhaParte - 0.01;

  return (
    <div className="fixed inset-0 bg-[#05080f] z-50 flex flex-col animate-slide-up overflow-y-auto pb-10">
      {/* Cabeçalho com Editar e Excluir */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 sticky top-0 bg-[#05080f]/95 backdrop-blur-md z-10">
        <button
          onClick={onClose}
          className="p-2 text-white hover:bg-gray-800 rounded-full transition-colors"
        >
          <ChevronLeft size={28} />
        </button>

        <h2 className="text-lg font-semibold text-white">Detalhes do Racha</h2>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditOpen(true)}
            className="p-2 text-gray-300 hover:bg-white/10 hover:text-white rounded-full transition-colors"
            title="Editar Racha"
          >
            <Pencil size={20} />
          </button>
          <button
            onClick={() => {
              onDelete(ride.id);
              onClose();
            }}
            className="p-2 text-red-500 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors"
            title="Excluir Racha"
          >
            <Trash2 size={22} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 flex-1">
        {/* Card de Resumo (Valor e Título) */}
        <div className="bg-gradient-to-br from-[#1c1c1e] to-[#2c2c2e] p-6 rounded-3xl text-center shadow-lg border border-white/5">
          <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">
            {ride.tag || 'UBER'}
          </p>
          <h3 className="text-2xl font-bold text-white mb-3">{ride.titulo}</h3>

          {ride.groupName && (
            <div className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full mb-3">
              <UsersRound size={13} /> {ride.groupName}
            </div>
          )}

          <p className="text-gray-500 text-xs uppercase font-bold">Valor Total</p>
          <div className="text-4xl font-black text-[#2DD4BF] mt-1">
            R$ {moneyConverter(valorNumerico)}
          </div>
        </div>

        {/* Informações Extras */}
        <div className="bg-[#1c1c1e] rounded-2xl p-4 space-y-3.5 border border-white/5">
          <div className="flex items-center text-gray-300">
            <Calendar size={18} className="text-gray-500 mr-3" />
            <span className="text-sm">
              Data: <strong className="text-white ml-1">{formatarDataBR(ride.data)}</strong>
            </span>
          </div>
          <div className="flex items-center text-gray-300">
            <Receipt size={18} className="text-gray-500 mr-3" />
            <span className="text-sm">
              Categoria: <strong className="text-white ml-1">{ride.tag || 'Uber'}</strong>
            </span>
          </div>
        </div>

        {/* Divisão da Conta */}
        <div>
          <div className="flex items-center justify-between mb-4 text-gray-300">
            <div className="flex items-center">
              <Users size={18} className="text-gray-500 mr-2" />
              <h3 className="font-semibold text-base">Divisão ({totalPessoas} pessoas)</h3>
            </div>
          </div>

          <div className="space-y-3">
            {participantes.map((p: any) => {
              const nome = p.nome || p.name || 'Amigo';
              const cor = p.cor || p.color || 'bg-sky-500';
              const valorParte = obterParteAmigo(p.id);
              const pctParte =
                valorNumerico > 0 ? ((valorParte / valorNumerico) * 100).toFixed(1) : '0';
              const valorPago = ride.pagamentos?.[p.id] || 0;
              const isFriendPayer = ride.paidByFriendId === p.id;
              const isQuitado = isFriendPayer || valorPago >= valorParte - 0.01;

              return (
                <div
                  key={p.id}
                  className="flex justify-between items-center bg-[#1c1c1e] p-4 rounded-xl border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full ${cor} flex items-center justify-center font-bold text-white`}
                    >
                      {nome[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{nome}</span>
                        {isFriendPayer && (
                          <span className="text-[10px] bg-[#2DD4BF]/20 text-[#2DD4BF] px-2 py-0.5 rounded-md font-bold">
                            Pagador
                          </span>
                        )}
                      </div>
                      {!isFriendPayer && (
                        <button
                          onClick={() => handleTogglePaid(p.id, isQuitado, valorParte)}
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
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-0.5">
                      Parte dele(a) ({pctParte}%)
                    </p>
                    <p className="font-bold text-white">R$ {moneyConverter(valorParte)}</p>
                  </div>
                </div>
              );
            })}

            {/* Card Você */}
            <div className="flex justify-between items-center bg-[#1c1c1e] p-4 rounded-xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2DD4BF] flex items-center justify-center font-bold text-[#05080f]">
                  V
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">Você</span>
                    {voceEhPagador && (
                      <span className="text-[10px] bg-[#2DD4BF]/20 text-[#2DD4BF] px-2 py-0.5 rounded-md font-bold">
                        Pagador
                      </span>
                    )}
                  </div>
                  {!voceEhPagador && (
                    <button
                      onClick={() => handleTogglePaid('self', isSelfQuitado, minhaParte)}
                      className={`text-[11px] font-semibold mt-0.5 flex items-center gap-1 ${
                        isSelfQuitado ? 'text-[#34C759]' : 'text-amber-400 hover:underline'
                      }`}
                    >
                      {isSelfQuitado ? (
                        <>
                          <Check size={12} /> Pago (clique p/ desfazer)
                        </>
                      ) : (
                        '• Pendente (clique p/ quitar)'
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-0.5">
                  Sua parte (
                  {valorNumerico > 0 ? ((minhaParte / valorNumerico) * 100).toFixed(1) : '0'}%)
                </p>
                <p className="font-bold text-white">R$ {moneyConverter(minhaParte)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddRideModal
        isOpen={isEditOpen}
        rideToEdit={ride}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => {
          setIsEditOpen(false);
          if (onUpdated) onUpdated();
        }}
      />
    </div>
  );
}

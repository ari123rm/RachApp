// src/components/AssignReceiptModal.tsx
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileCheck2,
  Check,
  LoaderCircle,
  Eye,
  AlertCircle,
  Clock,
  Sparkles,
  User,
  Car,
  Search,
} from 'lucide-react';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { clearSharedReceipt } from '../utils/receiptShare';
import { ReceiptViewerModal } from './ReceiptModals';
import type { Amigo, Corrida } from '../types';

interface AssignReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptDataUrl: string | null;
  onSuccess?: () => void;
}

export function AssignReceiptModal({
  isOpen,
  onClose,
  receiptDataUrl,
  onSuccess,
}: AssignReceiptModalProps) {
  useModalBackHandler(isOpen, onClose);

  // 'friend' é a opção primária padrão solicitada pelo usuário
  const [targetType, setTargetType] = useState<'friend' | 'ride'>('friend');

  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Amigo | null>(null);
  const [searchFriend, setSearchFriend] = useState('');

  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [selectedRide, setSelectedRide] = useState<Corrida | null>(null);

  const [amountStr, setAmountStr] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (isOpen && receiptDataUrl) {
      setIsLoading(true);
      setErrorMsg('');
      setSelectedFriend(null);
      setSelectedRide(null);
      setAmountStr('');
      setSearchFriend('');
      setTargetType('friend');

      Promise.all([dbService.amigos.getAll(), dbService.corridas.getAll()])
        .then(([todosAmigos, todasCorridas]) => {
          setAmigos(todosAmigos);
          setCorridas(todasCorridas);

          // 1. Tenta pré-selecionar o primeiro amigo que você deve ou que te deve
          const amigoComDivida = todosAmigos.find(
            (a) => Number(a.voceDeveNumerico || 0) > 0.01 || Number(a.dividaNumerica || 0) > 0.01
          );

          if (amigoComDivida) {
            setSelectedFriend(amigoComDivida);
            const val =
              Number(amigoComDivida.voceDeveNumerico || 0) > 0.01
                ? Number(amigoComDivida.voceDeveNumerico)
                : Number(amigoComDivida.dividaNumerica || 0);
            setAmountStr(moneyConverter(val));
          } else if (todosAmigos.length > 0) {
            setSelectedFriend(todosAmigos[0]);
            setAmountStr('0,00');
          }

          // Pré-seleciona também racha pendente caso o usuário alterne para a aba de racha
          const pendingRide = todasCorridas.find((c) => {
            const owed = Number(c.selfAmountOwed || 0);
            const paid = Number(c.selfAmountPaid || 0);
            return owed - paid > 0.01;
          });
          if (pendingRide) {
            setSelectedRide(pendingRide);
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar dados para o comprovante:', err);
          setErrorMsg('Não foi possível carregar os amigos e rachas.');
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, receiptDataUrl]);

  if (!isOpen || !receiptDataUrl) return null;

  const handleClose = () => {
    clearSharedReceipt();
    onClose();
  };

  // Filtro de amigos
  const amigosFiltrados = amigos.filter((a) => {
    if (!searchFriend.trim()) return true;
    const q = searchFriend.toLowerCase();
    const nome = (a.nome || a.name || '').toLowerCase();
    const tel = (a.telefone || a.phone || '').toLowerCase();
    return nome.includes(q) || tel.includes(q);
  });

  // Amigos com pendências financeiras (você deve para ele ou ele deve para você)
  const amigosComPendencias = amigosFiltrados.filter(
    (a) => Number(a.voceDeveNumerico || 0) > 0.01 || Number(a.dividaNumerica || 0) > 0.01
  );
  const outrosAmigos = amigosFiltrados.filter(
    (a) => Number(a.voceDeveNumerico || 0) <= 0.01 && Number(a.dividaNumerica || 0) <= 0.01
  );

  // Rachas
  const rachasPendentes = corridas.filter((c) => {
    const owed = Number(c.selfAmountOwed || 0);
    const paid = Number(c.selfAmountPaid || 0);
    return owed - paid > 0.01;
  });

  const outrosRachas = corridas.filter((c) => {
    const owed = Number(c.selfAmountOwed || 0);
    const paid = Number(c.selfAmountPaid || 0);
    return owed - paid <= 0.01;
  });

  const handleSelectFriend = (friend: Amigo) => {
    setSelectedFriend(friend);
    const voceDeve = Number(friend.voceDeveNumerico || 0);
    const eleDeve = Number(friend.dividaNumerica || 0);
    const saldo = voceDeve > 0.01 ? voceDeve : eleDeve > 0.01 ? eleDeve : 0;
    setAmountStr(saldo > 0 ? moneyConverter(saldo) : '0,00');
    setErrorMsg('');
  };

  const handleSelectRide = (ride: Corrida) => {
    setSelectedRide(ride);
    const owed = Number(ride.selfAmountOwed || 0);
    const paid = Number(ride.selfAmountPaid || 0);
    const saldo = Math.max(0, owed - paid);
    setAmountStr(saldo > 0 ? moneyConverter(saldo) : moneyConverter(ride.valorTotal || 0));
    setErrorMsg('');
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    const num = (parseFloat(digits) || 0) / 100;
    setAmountStr(moneyConverter(num));
  };

  const handleConfirm = async () => {
    const valorNumerico = parseFloat(amountStr.replace(/\./g, '').replace(',', '.')) || 0;
    if (valorNumerico <= 0) {
      setErrorMsg('Informe um valor de pagamento válido.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (targetType === 'friend') {
        if (!selectedFriend) {
          setErrorMsg('Por favor, selecione um amigo para quitar.');
          setIsSubmitting(false);
          return;
        }

        // Quita com o amigo (abate nas despesas pendentes e anexa o comprovante)
        await dbService.financeiro.registrarPagamento(
          selectedFriend.id,
          valorNumerico,
          undefined,
          receiptDataUrl,
          'to_friend'
        );
      } else {
        if (!selectedRide) {
          setErrorMsg('Por favor, selecione um racha para vincular o comprovante.');
          setIsSubmitting(false);
          return;
        }

        // Devedor envia comprovante da sua parte no racha específico
        await dbService.financeiro.definirPagamentoParticipante(
          selectedRide.id,
          'self',
          valorNumerico,
          receiptDataUrl
        );
      }

      clearSharedReceipt();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao vincular comprovante:', err);
      setErrorMsg(
        err.response?.data?.error || err.message || 'Erro ao vincular comprovante.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[90] flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="bg-[#0b0f19] w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center shadow">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Comprovante Recebido!</h2>
              <p className="text-xs text-gray-400">Escolha como deseja quitar o pagamento</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas de Navegação (Quitar com Amigo = Primária) */}
        <div className="px-5 pt-3">
          <div className="flex bg-[#121622] p-1 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => {
                setTargetType('friend');
                setErrorMsg('');
                if (selectedFriend) {
                  const voceDeve = Number(selectedFriend.voceDeveNumerico || 0);
                  const eleDeve = Number(selectedFriend.dividaNumerica || 0);
                  const saldo = voceDeve > 0.01 ? voceDeve : eleDeve > 0.01 ? eleDeve : 0;
                  setAmountStr(saldo > 0 ? moneyConverter(saldo) : '0,00');
                }
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                targetType === 'friend'
                  ? 'bg-[#2DD4BF] text-[#05080f] shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <User size={15} />
              Quitar com Amigo
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetType('ride');
                setErrorMsg('');
                if (selectedRide) {
                  const owed = Number(selectedRide.selfAmountOwed || 0);
                  const paid = Number(selectedRide.selfAmountPaid || 0);
                  const saldo = Math.max(0, owed - paid);
                  setAmountStr(saldo > 0 ? moneyConverter(saldo) : moneyConverter(selectedRide.valorTotal || 0));
                }
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                targetType === 'ride'
                  ? 'bg-[#2DD4BF] text-[#05080f] shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Car size={15} />
              Vincular a Racha
            </button>
          </div>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
          {/* Card de Preview do Comprovante */}
          <div className="bg-[#121622] rounded-2xl p-3 border border-white/5 flex items-center gap-3">
            <div
              onClick={() => setIsPreviewOpen(true)}
              className="relative w-16 h-20 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 cursor-pointer group"
            >
              <img
                src={receiptDataUrl}
                alt="Comprovante"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Eye size={16} className="text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#2DD4BF]">
                <FileCheck2 size={14} />
                <span>Comprovante pronto para envio</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                Toque na imagem para ampliar em tela cheia.
              </p>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="text-[11px] font-semibold text-gray-300 hover:text-white underline mt-1 block"
              >
                Expandir comprovante
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ABA 1: QUITAR COM AMIGO (OPÇÃO PRIMÁRIA) */}
          {targetType === 'friend' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <User size={13} className="text-[#2DD4BF]" />
                  Selecione o amigo a quitar
                </h3>
                <span className="text-[11px] text-[#2DD4BF] font-semibold">
                  Opção Recomendada
                </span>
              </div>

              {/* Busca rápida de amigos */}
              {amigos.length > 5 && (
                <div className="bg-[#121622] rounded-xl px-3 py-2 flex items-center gap-2 border border-white/5">
                  <Search size={14} className="text-gray-400" />
                  <input
                    type="text"
                    value={searchFriend}
                    onChange={(e) => setSearchFriend(e.target.value)}
                    placeholder="Buscar amigo por nome ou telefone..."
                    className="bg-transparent text-xs text-white outline-none w-full"
                  />
                  {searchFriend && (
                    <button
                      onClick={() => setSearchFriend('')}
                      className="text-gray-400 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-[#2DD4BF]">
                  <LoaderCircle size={28} className="animate-spin mr-2" />
                  <span className="text-xs text-gray-400">Carregando amigos...</span>
                </div>
              ) : amigos.length === 0 ? (
                <div className="bg-[#121622] p-4 rounded-2xl text-center border border-white/5">
                  <p className="text-xs text-gray-400">Nenhum amigo cadastrado ainda.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Amigos com débitos pendentes */}
                  {amigosComPendencias.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                        Com pendências em aberto ({amigosComPendencias.length})
                      </span>
                      {amigosComPendencias.map((amigo) => {
                        const isSelected = selectedFriend?.id === amigo.id;
                        const voceDeve = Number(amigo.voceDeveNumerico || 0);
                        const eleDeve = Number(amigo.dividaNumerica || 0);
                        const corAmigo = amigo.cor || amigo.color || 'bg-sky-500';
                        const nomeAmigo = amigo.nome || amigo.name || 'Amigo';

                        return (
                          <div
                            key={amigo.id}
                            onClick={() => handleSelectFriend(amigo)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-[#2DD4BF]/15 border-[#2DD4BF] shadow-lg shadow-teal-500/10'
                                : 'bg-[#121622] border-white/5 hover:bg-[#181d2c]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${corAmigo}`}
                              >
                                {nomeAmigo[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-white truncate">{nomeAmigo}</h4>
                                <p className="text-xs text-gray-400 truncate">
                                  {amigo.telefone || 'Sem telefone'}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {voceDeve > 0.01 ? (
                                <>
                                  <span className="text-[10px] text-amber-300 font-bold block">
                                    Você deve
                                  </span>
                                  <span className="text-sm font-bold text-amber-400">
                                    R$ {moneyConverter(voceDeve)}
                                  </span>
                                </>
                              ) : eleDeve > 0.01 ? (
                                <>
                                  <span className="text-[10px] text-[#2DD4BF] font-bold block">
                                    Te deve
                                  </span>
                                  <span className="text-sm font-bold text-[#2DD4BF]">
                                    R$ {moneyConverter(eleDeve)}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Outros amigos */}
                  {outrosAmigos.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {amigosComPendencias.length > 0 && (
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block">
                          Outros amigos ({outrosAmigos.length})
                        </span>
                      )}
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
                        {outrosAmigos.map((amigo) => {
                          const isSelected = selectedFriend?.id === amigo.id;
                          const corAmigo = amigo.cor || amigo.color || 'bg-sky-500';
                          const nomeAmigo = amigo.nome || amigo.name || 'Amigo';

                          return (
                            <div
                              key={amigo.id}
                              onClick={() => handleSelectFriend(amigo)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                isSelected
                                  ? 'bg-[#2DD4BF]/15 border-[#2DD4BF]'
                                  : 'bg-[#121622]/60 border-white/5 hover:bg-[#121622]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${corAmigo}`}
                                >
                                  {nomeAmigo[0].toUpperCase()}
                                </div>
                                <span className="text-xs font-semibold text-gray-200 truncate">
                                  {nomeAmigo}
                                </span>
                              </div>
                              <span className="text-[11px] text-gray-500 font-medium">Quitado</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: VINCULAR A RACHA ESPECÍFICO */}
          {targetType === 'ride' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Clock size={13} className="text-[#2DD4BF]" />
                Rachas com pagamentos pendentes ({rachasPendentes.length})
              </h3>

              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-[#2DD4BF]">
                  <LoaderCircle size={28} className="animate-spin mr-2" />
                  <span className="text-xs text-gray-400">Carregando rachas...</span>
                </div>
              ) : rachasPendentes.length === 0 ? (
                <div className="bg-[#121622] p-4 rounded-2xl text-center border border-white/5">
                  <p className="text-xs text-gray-400">
                    Você não possui pendências registradas nos seus rachas.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rachasPendentes.map((ride) => {
                    const isSelected = selectedRide?.id === ride.id;
                    const owed = Number(ride.selfAmountOwed || 0);
                    const paid = Number(ride.selfAmountPaid || 0);
                    const restante = Math.max(0, owed - paid);

                    return (
                      <div
                        key={ride.id}
                        onClick={() => handleSelectRide(ride)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#2DD4BF]/10 border-[#2DD4BF] shadow-lg shadow-teal-500/10'
                            : 'bg-[#121622] border-white/5 hover:bg-[#181d2c]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white truncate">{ride.titulo}</h4>
                            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400 shrink-0">
                              {ride.tag || 'Racha'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Pago por: <span className="text-gray-200">{ride.paidByName || 'Amigo'}</span> •{' '}
                            {ride.data ? ride.data.slice(0, 10) : 'Data não informada'}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-gray-400">Você deve</p>
                          <p className="text-sm font-bold text-amber-400">
                            R$ {moneyConverter(restante)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {outrosRachas.length > 0 && (
                <details className="pt-2 group">
                  <summary className="text-xs font-semibold text-gray-500 hover:text-gray-300 cursor-pointer transition-colors list-none flex items-center justify-between">
                    <span>Outros rachas já quitados ({outrosRachas.length})</span>
                    <span className="text-[10px] text-gray-600 group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <div className="space-y-2 pt-2">
                    {outrosRachas.slice(0, 5).map((ride) => {
                      const isSelected = selectedRide?.id === ride.id;
                      return (
                        <div
                          key={ride.id}
                          onClick={() => handleSelectRide(ride)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#2DD4BF]/10 border-[#2DD4BF]'
                              : 'bg-[#121622]/60 border-white/5 hover:bg-[#121622]'
                          }`}
                        >
                          <span className="text-gray-300 font-medium truncate">{ride.titulo}</span>
                          <span className="text-gray-500 font-bold shrink-0">
                            R$ {moneyConverter(ride.valorTotal || 0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Campo de Valor a Quitar */}
          {((targetType === 'friend' && selectedFriend) || (targetType === 'ride' && selectedRide)) && (
            <div className="bg-[#121622] rounded-2xl p-4 border border-white/5 space-y-2">
              <label className="text-xs font-bold text-gray-300 block">
                Valor comprovado para:{' '}
                <span className="text-[#2DD4BF]">
                  {targetType === 'friend'
                    ? selectedFriend?.nome || selectedFriend?.name
                    : selectedRide?.titulo}
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#2DD4BF]">
                  R$
                </span>
                <input
                  type="text"
                  value={amountStr}
                  onChange={handleAmountChange}
                  className="w-full bg-[#05080f] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white font-bold text-base outline-none focus:border-[#2DD4BF]"
                  placeholder="0,00"
                />
              </div>
              <p className="text-[11px] text-gray-500">
                {targetType === 'friend'
                  ? `O comprovante será anexado e o valor será abatido diretamente das despesas pendentes com ${
                      selectedFriend?.nome || selectedFriend?.name || 'o amigo'
                    }.`
                  : `O comprovante será anexado ao racha selecionado.`}
              </p>
            </div>
          )}
        </div>

        {/* Footer com Ações */}
        <div className="p-4 border-t border-white/5 bg-[#0b0f19] flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 bg-[#1c1c1e] hover:bg-[#2c2c2e] text-gray-300 font-bold py-3 rounded-2xl transition-colors text-sm disabled:opacity-50"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              (targetType === 'friend' ? !selectedFriend : !selectedRide)
            }
            className="flex-1 bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-3 rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle size={18} className="animate-spin" />
                <span>Vinculando...</span>
              </>
            ) : (
              <>
                <Check size={18} strokeWidth={2.5} />
                <span>
                  {targetType === 'friend'
                    ? `Quitar com ${selectedFriend?.nome?.split(' ')[0] || 'Amigo'}`
                    : 'Confirmar e Vincular'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Visualizador de Imagem Expandida */}
      <ReceiptViewerModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        receiptUrl={receiptDataUrl}
        title="Comprovante Compartilhado"
      />
    </div>,
    document.body
  );
}

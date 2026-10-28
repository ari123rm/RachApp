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
  Sparkles,
  User,
  Search,
  ArrowRight,
  ChevronLeft,
  DollarSign,
  ShieldCheck,
  BadgeCheck,
} from 'lucide-react';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { clearSharedReceipt } from '../utils/receiptShare';
import { getAvatarColor } from '../utils/avatarColor';
import { ReceiptViewerModal } from './ReceiptModals';
import type { Amigo } from '../types';

interface AssignReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptDataUrl: string | null;
  onSuccess?: () => void;
}

type WizardStep = 1 | 2 | 3;

export function AssignReceiptModal({
  isOpen,
  onClose,
  receiptDataUrl,
  onSuccess,
}: AssignReceiptModalProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Amigo | null>(null);
  const [searchFriend, setSearchFriend] = useState('');

  const [amountStr, setAmountStr] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handleClose = () => {
    clearSharedReceipt();
    onClose();
  };

  useModalBackHandler(isOpen, () => {
    if (step > 1 && !isSubmitting) {
      setErrorMsg('');
      setStep((prev) => (prev === 3 ? 2 : 1));
      return;
    }
    handleClose();
  });

  useEffect(() => {
    if (isOpen && receiptDataUrl) {
      setStep(1);
      setIsLoading(true);
      setErrorMsg('');
      setSelectedFriend(null);
      setAmountStr('');
      setSearchFriend('');

      dbService.amigos
        .getAll()
        .then((todosAmigos) => {
          // Ordena priorizando quem você deve primeiro, depois quem te deve, depois alfabético
          const ordenados = [...todosAmigos].sort((a, b) => {
            const aVoceDeve = Number(a.voceDeveNumerico || 0);
            const bVoceDeve = Number(b.voceDeveNumerico || 0);
            if (Math.abs(bVoceDeve - aVoceDeve) > 0.01) {
              return bVoceDeve - aVoceDeve;
            }
            const aEleDeve = Number(a.dividaNumerica || 0);
            const bEleDeve = Number(b.dividaNumerica || 0);
            if (Math.abs(bEleDeve - aEleDeve) > 0.01) {
              return bEleDeve - aEleDeve;
            }
            return (a.nome || a.name || '').localeCompare(b.nome || b.name || '');
          });

          setAmigos(ordenados);

          const primeiroComDivida = ordenados.find(
            (a) => Number(a.voceDeveNumerico || 0) > 0.01 || Number(a.dividaNumerica || 0) > 0.01
          );

          if (primeiroComDivida) {
            setSelectedFriend(primeiroComDivida);
            const val =
              Number(primeiroComDivida.voceDeveNumerico || 0) > 0.01
                ? Number(primeiroComDivida.voceDeveNumerico)
                : Number(primeiroComDivida.dividaNumerica || 0);
            setAmountStr(moneyConverter(val));
          }
        })
        .catch((err) => {
          console.error('Erro ao carregar amigos para o comprovante:', err);
          setErrorMsg('Não foi possível carregar sua lista de amigos.');
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, receiptDataUrl]);

  if (!isOpen || !receiptDataUrl) return null;

  const amigosFiltrados = amigos.filter((a) => {
    if (!searchFriend.trim()) return true;
    const q = searchFriend.toLowerCase();
    const nome = (a.nome || a.name || '').toLowerCase();
    const tel = (a.telefone || a.phone || '').toLowerCase();
    return nome.includes(q) || tel.includes(q);
  });

  const amigosQueVoceDeve = amigosFiltrados.filter(
    (a) => Number(a.voceDeveNumerico || 0) > 0.01
  );
  const amigosQueTeDevem = amigosFiltrados.filter(
    (a) => Number(a.voceDeveNumerico || 0) <= 0.01 && Number(a.dividaNumerica || 0) > 0.01
  );
  const outrosAmigos = amigosFiltrados.filter(
    (a) => Number(a.voceDeveNumerico || 0) <= 0.01 && Number(a.dividaNumerica || 0) <= 0.01
  );

  const valorNumerico = parseFloat(amountStr.replace(/\./g, '').replace(',', '.')) || 0;

  const handleChooseFriend = (friend: Amigo, advanceImmediately = true) => {
    setSelectedFriend(friend);
    const voceDeve = Number(friend.voceDeveNumerico || 0);
    const eleDeve = Number(friend.dividaNumerica || 0);
    const saldo = voceDeve > 0.01 ? voceDeve : eleDeve > 0.01 ? eleDeve : 0;
    setAmountStr(saldo > 0 ? moneyConverter(saldo) : '');
    setErrorMsg('');
    if (advanceImmediately) {
      setStep(2);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (!digits) {
      setAmountStr('');
      return;
    }
    const num = (parseFloat(digits) || 0) / 100;
    setAmountStr(moneyConverter(num));
    setErrorMsg('');
  };

  const handleGoToStep2 = () => {
    if (!selectedFriend) {
      setErrorMsg('Selecione um amigo para continuar.');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleGoToStep3 = () => {
    if (!selectedFriend) {
      setErrorMsg('Selecione um amigo primeiro.');
      setStep(1);
      return;
    }
    if (valorNumerico <= 0) {
      setErrorMsg('Informe o valor que este comprovante representa.');
      return;
    }
    setErrorMsg('');
    setStep(3);
  };

  const handleConfirmPayment = async () => {
    if (!selectedFriend) {
      setErrorMsg('Selecione um amigo para quitar.');
      setStep(1);
      return;
    }
    if (valorNumerico <= 0) {
      setErrorMsg('Informe um valor válido.');
      setStep(2);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const voceDeve = Number(selectedFriend.voceDeveNumerico || 0);
      const eleDeve = Number(selectedFriend.dividaNumerica || 0);
      const direction: 'to_friend' | 'from_friend' =
        voceDeve >= eleDeve ? 'to_friend' : 'from_friend';

      await dbService.financeiro.registrarPagamento(
        selectedFriend.id,
        valorNumerico,
        undefined,
        receiptDataUrl,
        direction
      );

      clearSharedReceipt();
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (err: any) {
      console.error('Erro ao vincular comprovante:', err);
      setErrorMsg(
        err.response?.data?.error || err.message || 'Erro ao vincular comprovante.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedName = selectedFriend?.nome || selectedFriend?.name || 'Amigo';
  const selectedColor = selectedFriend?.cor || selectedFriend?.color || 'bg-sky-500';
  const selectedVoceDeve = Number(selectedFriend?.voceDeveNumerico || 0);
  const selectedEleDeve = Number(selectedFriend?.dividaNumerica || 0);
  const selectedSaldoReferencia =
    selectedVoceDeve > 0.01 ? selectedVoceDeve : selectedEleDeve > 0.01 ? selectedEleDeve : 0;
  const restanteAposPagamento = Math.max(
    0,
    Number((selectedSaldoReferencia - valorNumerico).toFixed(2))
  );

  const renderFriendItem = (amigo: Amigo) => {
    const isSelected = selectedFriend?.id === amigo.id;
    const voceDeve = Number(amigo.voceDeveNumerico || 0);
    const eleDeve = Number(amigo.dividaNumerica || 0);
    const corAmigo = amigo.cor || amigo.color || 'bg-sky-500';
    const nomeAmigo = amigo.nome || amigo.name || 'Amigo';

    return (
      <div
        key={amigo.id}
        onClick={() => handleChooseFriend(amigo, true)}
        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99] ${
          isSelected
            ? 'bg-[#2DD4BF]/15 border-[#2DD4BF] shadow-lg shadow-teal-500/10'
            : 'bg-[#121622] border-white/5 hover:bg-[#181d2c]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            style={amigo.avatar_url ? undefined : { backgroundColor: getAvatarColor(corAmigo) }}
            className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm shrink-0"
          >
            {amigo.avatar_url ? (
              <img src={amigo.avatar_url} alt={nomeAmigo} className="w-full h-full object-cover" />
            ) : (
              nomeAmigo[0]?.toUpperCase() || '?'
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-white truncate">{nomeAmigo}</h4>
              {(amigo.has_account || amigo.is_registered) && (
                <BadgeCheck size={14} className="text-[#2DD4BF] fill-[#2DD4BF]/20 shrink-0" />
              )}
            </div>
            <p className="text-xs text-gray-400 truncate">
              {amigo.telefone || amigo.phone || 'Toque para selecionar'}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0 flex items-center gap-2">
          <div>
            {voceDeve > 0.01 ? (
              <>
                <span className="text-[10px] text-amber-300 font-bold block">Você deve</span>
                <span className="text-sm font-bold text-amber-400">
                  R$ {moneyConverter(voceDeve)}
                </span>
              </>
            ) : eleDeve > 0.01 ? (
              <>
                <span className="text-[10px] text-[#2DD4BF] font-bold block">Te deve</span>
                <span className="text-sm font-bold text-[#2DD4BF]">
                  R$ {moneyConverter(eleDeve)}
                </span>
              </>
            ) : (
              <span className="text-xs text-gray-500 font-medium">Quitado</span>
            )}
          </div>
          <ArrowRight size={15} className="text-gray-500" />
        </div>
      </div>
    );
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
        {/* Header + Stepper */}
        <div className="p-5 pb-4 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setStep((prev) => (prev === 3 ? 2 : 1));
                  }}
                  className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                  title="Voltar etapa"
                >
                  <ChevronLeft size={22} />
                </button>
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-[#2DD4BF]/20 text-[#2DD4BF] flex items-center justify-center shadow">
                  <Sparkles size={20} />
                </div>
              )}
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">
                  {step === 1
                    ? '1. Selecione o Amigo'
                    : step === 2
                    ? '2. Valor do Comprovante'
                    : '3. Confirmar Pagamento'}
                </h2>
                <p className="text-xs text-gray-400">
                  {step === 1
                    ? 'Para quem é este comprovante de pagamento?'
                    : step === 2
                    ? `Informe o valor pago para ${selectedName.split(' ')[0]}`
                    : 'Confira os dados antes de concluir'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Indicador visual das 3 etapas */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { num: 1, label: '1. Amigo' },
              { num: 2, label: '2. Valor' },
              { num: 3, label: '3. Confirmação' },
            ].map((item) => {
              const isCurrent = step === item.num;
              const isDone = step > item.num;
              return (
                <div
                  key={item.num}
                  className={`py-1.5 px-2 rounded-xl text-center text-[11px] font-bold border transition-all flex items-center justify-center gap-1 ${
                    isCurrent
                      ? 'bg-[#2DD4BF]/20 border-[#2DD4BF] text-[#2DD4BF]'
                      : isDone
                      ? 'bg-[#2DD4BF]/10 border-[#2DD4BF]/30 text-[#2DD4BF]/80'
                      : 'bg-[#121622] border-white/5 text-gray-500'
                  }`}
                >
                  {isDone && <Check size={12} strokeWidth={3} />}
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conteúdo das Etapas */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ETAPA 1: SELECIONAR O AMIGO */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              {/* Mini barra do comprovante */}
              <div
                onClick={() => setIsPreviewOpen(true)}
                className="bg-[#121622] rounded-2xl p-3 border border-white/5 flex items-center justify-between gap-3 cursor-pointer hover:border-white/15 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                    <img
                      src={receiptDataUrl}
                      alt="Comprovante"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#2DD4BF] flex items-center gap-1">
                      <FileCheck2 size={13} /> Comprovante carregado
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      Toque aqui se quiser ampliar a imagem
                    </p>
                  </div>
                </div>
                <Eye size={16} className="text-gray-400 shrink-0" />
              </div>

              {/* Busca de amigos */}
              {amigos.length > 3 && (
                <div className="bg-[#121622] rounded-xl px-3.5 py-2.5 flex items-center gap-2 border border-white/5">
                  <Search size={15} className="text-gray-400" />
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
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {isLoading ? (
                <div className="flex items-center justify-center py-10 text-[#2DD4BF]">
                  <LoaderCircle size={28} className="animate-spin mr-2" />
                  <span className="text-xs text-gray-400">Carregando amigos...</span>
                </div>
              ) : amigos.length === 0 ? (
                <div className="bg-[#121622] p-6 rounded-2xl text-center border border-white/5">
                  <p className="text-xs text-gray-400">Nenhum amigo cadastrado ainda.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Amigos que você está devendo */}
                  {amigosQueVoceDeve.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] text-amber-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                        <User size={13} /> Amigos que você está devendo ({amigosQueVoceDeve.length})
                      </span>
                      <div className="space-y-2">{amigosQueVoceDeve.map(renderFriendItem)}</div>
                    </div>
                  )}

                  {/* Amigos que te devem */}
                  {amigosQueTeDevem.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] text-[#2DD4BF] uppercase font-bold tracking-wider block">
                        Amigos que te devem ({amigosQueTeDevem.length})
                      </span>
                      <div className="space-y-2">{amigosQueTeDevem.map(renderFriendItem)}</div>
                    </div>
                  )}

                  {/* Outros amigos */}
                  {outrosAmigos.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] text-gray-500 uppercase font-bold tracking-wider block">
                        Outros amigos ({outrosAmigos.length})
                      </span>
                      <div className="space-y-2">{outrosAmigos.map(renderFriendItem)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ETAPA 2: VALOR QUE O COMPROVANTE REPRESENTA */}
          {step === 2 && selectedFriend && (
            <div className="space-y-4 animate-fade-in">
              {/* Amigo selecionado */}
              <div className="bg-[#121622] p-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={
                      selectedFriend.avatar_url
                        ? undefined
                        : { backgroundColor: getAvatarColor(selectedColor) }
                    }
                    className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm shrink-0"
                  >
                    {selectedFriend.avatar_url ? (
                      <img
                        src={selectedFriend.avatar_url}
                        alt={selectedName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      selectedName[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-bold text-gray-400">Amigo selecionado</p>
                    <h4 className="text-sm font-bold text-white truncate">{selectedName}</h4>
                    {selectedVoceDeve > 0.01 ? (
                      <p className="text-xs text-amber-400 font-semibold">
                        Você deve R$ {moneyConverter(selectedVoceDeve)}
                      </p>
                    ) : selectedEleDeve > 0.01 ? (
                      <p className="text-xs text-[#2DD4BF] font-semibold">
                        Te deve R$ {moneyConverter(selectedEleDeve)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">Sem pendências abertas</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-[#2DD4BF] hover:underline px-2.5 py-1.5 rounded-xl bg-[#2DD4BF]/10 shrink-0"
                >
                  Trocar
                </button>
              </div>

              {/* Input de Valor em destaque */}
              <div className="bg-[#121622] rounded-3xl p-5 border border-[#2DD4BF]/30 text-center space-y-3 shadow-inner">
                <label className="text-xs uppercase font-bold tracking-wider text-gray-400 flex items-center justify-center gap-1">
                  <DollarSign size={14} className="text-[#2DD4BF]" />
                  Qual o valor deste comprovante?
                </label>

                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-2xl font-black text-[#2DD4BF]">R$</span>
                  <input
                    type="tel"
                    value={amountStr}
                    onChange={handleAmountChange}
                    placeholder="0,00"
                    autoFocus
                    className="bg-[#05080f] border border-white/10 focus:border-[#2DD4BF] rounded-2xl py-3 px-4 text-3xl font-black text-white text-center w-48 outline-none transition-colors"
                  />
                </div>

                {/* Atalhos rápidos de valor */}
                {selectedSaldoReferencia > 0.01 && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAmountStr(moneyConverter(selectedSaldoReferencia))}
                      className="text-[11px] font-bold bg-[#2DD4BF]/15 hover:bg-[#2DD4BF]/25 text-[#2DD4BF] px-3 py-1.5 rounded-full transition-colors"
                    >
                      Total (R$ {moneyConverter(selectedSaldoReferencia)})
                    </button>
                    {selectedSaldoReferencia >= 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setAmountStr(
                            moneyConverter(Number((selectedSaldoReferencia / 2).toFixed(2)))
                          )
                        }
                        className="text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-full transition-colors"
                      >
                        Metade (R${' '}
                        {moneyConverter(Number((selectedSaldoReferencia / 2).toFixed(2)))})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Preview do comprovante para consulta rápida do valor */}
              <div
                onClick={() => setIsPreviewOpen(true)}
                className="bg-[#121622] rounded-2xl p-3 border border-white/5 flex items-center gap-3 cursor-pointer hover:border-white/15 transition-colors"
              >
                <div className="w-14 h-16 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                  <img
                    src={receiptDataUrl}
                    alt="Comprovante"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                    <Eye size={14} className="text-[#2DD4BF]" /> Conferir imagem do comprovante
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Toque para abrir o comprovante em tela cheia e verificar o valor exato.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 3: CONFIRMAÇÃO */}
          {step === 3 && selectedFriend && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-gradient-to-br from-[#121622] to-[#172033] rounded-3xl p-5 border border-[#2DD4BF]/30 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs text-gray-400 font-semibold">Amigo</span>
                  <div className="flex items-center gap-2">
                    <div
                      style={
                        selectedFriend.avatar_url
                          ? undefined
                          : { backgroundColor: getAvatarColor(selectedColor) }
                      }
                      className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-xs"
                    >
                      {selectedFriend.avatar_url ? (
                        <img
                          src={selectedFriend.avatar_url}
                          alt={selectedName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        selectedName[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <span className="text-sm font-bold text-white">{selectedName}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs text-gray-400 font-semibold">Valor do Comprovante</span>
                  <span className="text-xl font-black text-[#2DD4BF]">
                    R$ {moneyConverter(valorNumerico)}
                  </span>
                </div>

                {selectedSaldoReferencia > 0.01 && (
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-xs text-gray-400 font-semibold">
                      Saldo após confirmação
                    </span>
                    {restanteAposPagamento <= 0.01 ? (
                      <span className="text-xs font-bold bg-[#34C759]/20 text-[#34C759] px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Check size={12} /> Tudo Quitado!
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-amber-400">
                        Restará R$ {moneyConverter(restanteAposPagamento)}
                      </span>
                    )}
                  </div>
                )}

                {/* Imagem do comprovante */}
                <div className="pt-1">
                  <p className="text-[11px] text-gray-400 font-semibold mb-2">
                    Comprovante anexado (toque para ampliar):
                  </p>
                  <div
                    onClick={() => setIsPreviewOpen(true)}
                    className="relative h-36 w-full rounded-2xl overflow-hidden bg-black/50 border border-white/10 cursor-pointer group flex items-center justify-center"
                  >
                    <img
                      src={receiptDataUrl}
                      alt="Comprovante"
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Eye size={11} /> Ampliar
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#2DD4BF]/10 border border-[#2DD4BF]/25 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-gray-200">
                <ShieldCheck size={18} className="text-[#2DD4BF] shrink-0" />
                <span>
                  Ao confirmar, o comprovante ficará salvo nos rachas quitados com{' '}
                  <strong className="text-white">{selectedName.split(' ')[0]}</strong> e você será
                  direcionado para a Home.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer com Ações por Etapa */}
        <div className="p-4 border-t border-white/5 bg-[#0b0f19] flex gap-3">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 bg-[#1c1c1e] hover:bg-[#2c2c2e] text-gray-300 font-bold py-3 rounded-2xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGoToStep2}
                disabled={!selectedFriend}
                className="flex-1 bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-3 rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 disabled:opacity-50"
              >
                <span>Continuar</span>
                <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setStep(1);
                }}
                className="flex-1 bg-[#1c1c1e] hover:bg-[#2c2c2e] text-gray-300 font-bold py-3 rounded-2xl transition-colors text-sm"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleGoToStep3}
                disabled={valorNumerico <= 0}
                className="flex-1 bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-3 rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 disabled:opacity-50"
              >
                <span>Revisar e Confirmar</span>
                <ArrowRight size={17} strokeWidth={2.5} />
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setStep(2);
                }}
                disabled={isSubmitting}
                className="flex-1 bg-[#1c1c1e] hover:bg-[#2c2c2e] text-gray-300 font-bold py-3 rounded-2xl transition-colors text-sm disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={isSubmitting}
                className="flex-1 bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] font-bold py-3 rounded-2xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    <span>Confirmando...</span>
                  </>
                ) : (
                  <>
                    <Check size={18} strokeWidth={2.5} />
                    <span>Confirmar Pagamento</span>
                  </>
                )}
              </button>
            </>
          )}
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

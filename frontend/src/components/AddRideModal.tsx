// src/components/AddRideModal.tsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, LoaderCircle, UsersRound, Wallet, Percent, DollarSign, Equal, BadgeCheck } from 'lucide-react';
import { dbService } from '../services/database';
import type { Amigo, Corrida, Grupo } from '../types';
import moneyConverter from '../utils/moneyConverter';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { getAvatarColor } from '../utils/avatarColor';

interface AddRideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  rideToEdit?: Corrida | null;
  defaultGroupId?: string | null;
}

type SplitMode = 'equal' | 'percent' | 'amount';

const getTodayDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function AddRideModal({
  isOpen,
  onClose,
  onSuccess,
  rideToEdit,
  defaultGroupId,
}: AddRideModalProps) {
  const [valor, setValor] = useState('');
  const [data, setData] = useState(getTodayDate());
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [titulo, setTitulo] = useState('');
  const [tag, setTag] = useState('');
  const [groupId, setGroupId] = useState<string>('');
  const [paidByFriendId, setPaidByFriendId] = useState<string>('');

  // Custom Split State
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [friendPercents, setFriendPercents] = useState<Record<string, string>>({});
  const [selfPercent, setSelfPercent] = useState<string>('');
  const [friendAmounts, setFriendAmounts] = useState<Record<string, string>>({});
  const [selfAmount, setSelfAmount] = useState<string>('');

  const [amigosReais, setAmigosReais] = useState<Amigo[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [isLoadingAmigos, setIsLoadingAmigos] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useModalBackHandler(isOpen, onClose);

  const isEditing = !!rideToEdit;
  const valorNumerico = valor ? parseFloat(valor.replace(/\./g, '').replace(',', '.')) : 0;

  const inicializarDivisaoIgual = (ids: string[], total: number) => {
    const qtd = ids.length + 1;
    const pctIgual = qtd > 0 ? (100 / qtd).toFixed(1) : '100';
    const vlrIgual = qtd > 0 && total > 0 ? (total / qtd).toFixed(2) : '0.00';

    const nextPct: Record<string, string> = {};
    const nextAmt: Record<string, string> = {};
    ids.forEach((id) => {
      nextPct[id] = pctIgual;
      nextAmt[id] = vlrIgual;
    });
    setFriendPercents(nextPct);
    setSelfPercent(pctIgual);
    setFriendAmounts(nextAmt);
    setSelfAmount(vlrIgual);
  };

  useEffect(() => {
    if (isOpen) {
      const carregarDados = async () => {
        setIsLoadingAmigos(true);
        try {
          const [dadosAmigos, dadosGrupos] = await Promise.all([
            dbService.amigos.getAll(),
            dbService.grupos.getAll(),
          ]);
          setAmigosReais(dadosAmigos);
          setGrupos(dadosGrupos);

          if (rideToEdit) {
            const totalNum = Number(rideToEdit.valorTotal || 0);
            setTitulo(rideToEdit.titulo || '');
            setTag(rideToEdit.tag || 'Uber');
            setData(rideToEdit.data || getTodayDate());
            setValor(
              totalNum.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            );
            const pIds = rideToEdit.participantesIds || [];
            setSelecionados(pIds);
            setGroupId(rideToEdit.groupId || '');
            setPaidByFriendId(rideToEdit.paidByFriendId || '');

            const qtd = pIds.length + 1;
            const partePadrao = qtd > 0 ? totalNum / qtd : totalNum;
            const devidos = rideToEdit.valoresDevidos || {};
            const selfOwed =
              rideToEdit.selfAmountOwed !== undefined ? rideToEdit.selfAmountOwed : partePadrao;

            const temCustom =
              pIds.some(
                (id) => devidos[id] !== undefined && Math.abs(devidos[id] - partePadrao) > 0.05
              ) || Math.abs(selfOwed - partePadrao) > 0.05;

            const nextPct: Record<string, string> = {};
            const nextAmt: Record<string, string> = {};
            pIds.forEach((id) => {
              const v = devidos[id] !== undefined ? devidos[id] : partePadrao;
              nextAmt[id] = v.toFixed(2);
              nextPct[id] = totalNum > 0 ? ((v / totalNum) * 100).toFixed(1) : '0';
            });

            setFriendAmounts(nextAmt);
            setSelfAmount(selfOwed.toFixed(2));
            setFriendPercents(nextPct);
            setSelfPercent(totalNum > 0 ? ((selfOwed / totalNum) * 100).toFixed(1) : '0');
            setSplitMode(temCustom ? 'amount' : 'equal');
          } else {
            setTitulo('');
            setTag('');
            setData(getTodayDate());
            setValor('');
            setPaidByFriendId('');
            setSplitMode('equal');
            if (defaultGroupId) {
              setGroupId(defaultGroupId);
              const g = dadosGrupos.find((grp) => grp.id === defaultGroupId);
              if (g && g.members) {
                const fIds = g.members
                  .filter((m) => m.friend?.id)
                  .map((m) => m.friend!.id);
                setSelecionados(fIds);
                inicializarDivisaoIgual(fIds, 0);
              } else {
                setSelecionados([]);
              }
            } else {
              setGroupId('');
              setSelecionados([]);
            }
          }
        } finally {
          setIsLoadingAmigos(false);
        }
      };
      carregarDados();
    }
  }, [isOpen, rideToEdit, defaultGroupId]);

  const sugestoesTitulos = ['Eletra', 'IFCE', 'Casa', 'Cinema', 'Pizza', 'Internet', 'Mercado'];
  const sugestoesTags = ['Uber', 'Pizza', 'Trabalho', 'Contas', 'Mercado'];

  const handleGroupChange = (newGroupId: string) => {
    setGroupId(newGroupId);
    if (newGroupId) {
      const g = grupos.find((grp) => grp.id === newGroupId);
      if (g && g.members) {
        const fIds = g.members.filter((m) => m.friend?.id).map((m) => m.friend!.id);
        if (fIds.length > 0) {
          setSelecionados(fIds);
          inicializarDivisaoIgual(fIds, valorNumerico);
        }
      }
    }
  };

  const toggleAmigo = (id: string) => {
    let next: string[];
    if (selecionados.includes(id)) {
      next = selecionados.filter((item) => item !== id);
      if (paidByFriendId === id) setPaidByFriendId('');
    } else {
      next = [...selecionados, id];
    }
    setSelecionados(next);
    inicializarDivisaoIgual(next, valorNumerico);
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const apenasNumeros = e.target.value.replace(/\D/g, '');
    if (apenasNumeros === '') {
      setValor('');
      return;
    }
    const valorEmCentavos = Number(apenasNumeros) / 100;
    const valorFormatado = valorEmCentavos.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setValor(valorFormatado);

    if (selecionados.length > 0) {
      if (splitMode === 'equal') {
        const qtd = selecionados.length + 1;
        const vlrIgual = (valorEmCentavos / qtd).toFixed(2);
        const nextAmt: Record<string, string> = {};
        selecionados.forEach((id) => {
          nextAmt[id] = vlrIgual;
        });
        setFriendAmounts(nextAmt);
        setSelfAmount(vlrIgual);
      } else if (splitMode === 'percent') {
        const nextAmt: Record<string, string> = {};
        selecionados.forEach((id) => {
          const pct = parseFloat(friendPercents[id] || '0') || 0;
          nextAmt[id] = ((valorEmCentavos * pct) / 100).toFixed(2);
        });
        setFriendAmounts(nextAmt);
        const sPct = parseFloat(selfPercent || '0') || 0;
        setSelfAmount(((valorEmCentavos * sPct) / 100).toFixed(2));
      }
    }
  };

  const handleModeSwitch = (mode: SplitMode) => {
    setSplitMode(mode);
    if (mode === 'equal') {
      inicializarDivisaoIgual(selecionados, valorNumerico);
    } else if (mode === 'percent') {
      if (valorNumerico > 0) {
        const nextPct: Record<string, string> = {};
        selecionados.forEach((id) => {
          const v =
            splitMode === 'amount' && friendAmounts[id] !== undefined
              ? parseFloat(friendAmounts[id] || '0') || 0
              : valorNumerico / (selecionados.length + 1);
          const pct = (v / valorNumerico) * 100;
          nextPct[id] = pct.toFixed(1);
        });
        setFriendPercents(nextPct);
        const selfV =
          splitMode === 'amount' && selfAmount !== undefined
            ? parseFloat(selfAmount || '0') || 0
            : valorNumerico / (selecionados.length + 1);
        const sPct = (selfV / valorNumerico) * 100;
        setSelfPercent(sPct.toFixed(1));
      } else {
        inicializarDivisaoIgual(selecionados, 0);
      }
    } else if (mode === 'amount') {
      if (valorNumerico > 0) {
        const nextAmt: Record<string, string> = {};
        selecionados.forEach((id) => {
          const pct =
            splitMode === 'percent' && friendPercents[id] !== undefined
              ? parseFloat(friendPercents[id] || '0') || 0
              : 100 / (selecionados.length + 1);
          const v = (valorNumerico * pct) / 100;
          nextAmt[id] = v.toFixed(2);
        });
        setFriendAmounts(nextAmt);
        const sPct =
          splitMode === 'percent' && selfPercent !== undefined
            ? parseFloat(selfPercent || '0') || 0
            : 100 / (selecionados.length + 1);
        const sAmt = (valorNumerico * sPct) / 100;
        setSelfAmount(sAmt.toFixed(2));
      }
    }
  };

  const handleFriendPercentChange = (friendId: string, rawVal: string) => {
    const cleaned = rawVal.replace(',', '.');
    setFriendPercents((prev) => ({ ...prev, [friendId]: cleaned }));
  };

  const handleFriendAmountChange = (friendId: string, rawVal: string) => {
    const cleaned = rawVal.replace(',', '.');
    setFriendAmounts((prev) => ({ ...prev, [friendId]: cleaned }));
  };

  const handleAjustarRestanteEmVoce = () => {
    if (splitMode === 'percent') {
      const somaAmigos = selecionados.reduce(
        (acc, id) => acc + (parseFloat(friendPercents[id] || '0') || 0),
        0
      );
      const restante = Math.max(0, Number((100 - somaAmigos).toFixed(1)));
      setSelfPercent(String(restante));
    } else if (splitMode === 'amount' && valorNumerico > 0) {
      const somaAmigos = selecionados.reduce(
        (acc, id) => acc + (parseFloat(friendAmounts[id] || '0') || 0),
        0
      );
      const restante = Math.max(0, Number((valorNumerico - somaAmigos).toFixed(2)));
      setSelfAmount(restante.toFixed(2));
    }
  };

  const qtdTotalPessoas = selecionados.length + 1;
  const valorPorPessoaIgual = valorNumerico > 0 ? valorNumerico / qtdTotalPessoas : 0;

  const obterValoresCalculados = (): {
    valoresDevidos: Record<string, number>;
    selfAmountOwed: number;
    somaTotal: number;
    somaPercentual: number;
  } => {
    const valoresDevidos: Record<string, number> = {};
    if (splitMode === 'equal') {
      const parte = valorNumerico / (selecionados.length + 1);
      selecionados.forEach((id) => {
        valoresDevidos[id] = Number(parte.toFixed(2));
      });
      const selfOwed = Number(parte.toFixed(2));
      return {
        valoresDevidos,
        selfAmountOwed: selfOwed,
        somaTotal: valorNumerico,
        somaPercentual: 100,
      };
    }

    if (splitMode === 'percent') {
      let somaPct = 0;
      let somaReais = 0;
      selecionados.forEach((id) => {
        const pct = parseFloat(friendPercents[id] || '0') || 0;
        somaPct += pct;
        const vlr = Number(((valorNumerico * pct) / 100).toFixed(2));
        valoresDevidos[id] = vlr;
        somaReais += vlr;
      });
      const sPct = parseFloat(selfPercent || '0') || 0;
      somaPct += sPct;
      const selfOwed = Number(((valorNumerico * sPct) / 100).toFixed(2));
      somaReais += selfOwed;
      return {
        valoresDevidos,
        selfAmountOwed: selfOwed,
        somaTotal: Number(somaReais.toFixed(2)),
        somaPercentual: Number(somaPct.toFixed(1)),
      };
    }

    let somaReais = 0;
    selecionados.forEach((id) => {
      const vlr = Number((parseFloat(friendAmounts[id] || '0') || 0).toFixed(2));
      valoresDevidos[id] = vlr;
      somaReais += vlr;
    });
    const selfOwed = Number((parseFloat(selfAmount || '0') || 0).toFixed(2));
    somaReais += selfOwed;
    const somaPct = valorNumerico > 0 ? Number(((somaReais / valorNumerico) * 100).toFixed(1)) : 0;

    return {
      valoresDevidos,
      selfAmountOwed: selfOwed,
      somaTotal: Number(somaReais.toFixed(2)),
      somaPercentual: somaPct,
    };
  };

  const { valoresDevidos, selfAmountOwed, somaTotal, somaPercentual } = obterValoresCalculados();

  const handleSalvarCorrida = async () => {
    if (!titulo.trim() || !valor || selecionados.length === 0) {
      alert('Por favor, preencha o título, valor e selecione ao menos um amigo.');
      return;
    }

    const valorLimpo = parseFloat(valor.replace(/\./g, '').replace(',', '.'));
    if (valorLimpo <= 0) {
      alert('O valor total deve ser maior que zero.');
      return;
    }

    if (splitMode === 'percent' && Math.abs(somaPercentual - 100) > 0.5) {
      alert(
        `A soma das porcentagens está em ${somaPercentual}%. Ajuste para fechar em 100% antes de salvar.`
      );
      return;
    }

    if (splitMode === 'amount' && Math.abs(somaTotal - valorLimpo) > 0.1) {
      alert(
        `A soma dos valores individuais (R$ ${moneyConverter(somaTotal)}) difere do valor total da conta (R$ ${moneyConverter(valorLimpo)}).`
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        tag: (tag || 'Uber').trim(),
        data,
        valorTotal: valorLimpo,
        participantesIds: selecionados,
        valoresDevidos,
        selfAmountOwed,
        groupId: groupId || null,
        paidByFriendId: paidByFriendId || null,
      };

      if (isEditing && rideToEdit) {
        await dbService.corridas.update(rideToEdit.id, payload);
      } else {
        await dbService.corridas.create(payload);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      alert('Erro ao salvar o racha.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#1c1c1e] w-full sm:max-w-md rounded-t-[28px] sm:rounded-3xl p-5 sm:p-6 animate-slide-up relative overflow-y-auto max-h-[92dvh] sm:max-h-[90vh] border border-white/10 shadow-2xl pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3.5 sm:hidden shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors active:scale-95"
        >
          <X size={24} />
        </button>

        <h2 className="text-xl font-bold text-white mb-5 pr-8">
          {isEditing ? 'Editar Racha' : 'Adicionar Novo Racha'}
        </h2>

        {/* Campo: Título / Descrição */}
        <div className="mb-4">
          <label className="block text-gray-400 text-xs uppercase font-bold mb-1.5">
            Título / Descrição
          </label>
          <div className="bg-[#2c2c2e] rounded-xl p-3.5 flex items-center text-white mb-2 focus-within:ring-2 focus-within:ring-[#2DD4BF]">
            <input
              type="text"
              placeholder="Ex: Eletra, Internet Fibra, Jantar..."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="bg-transparent w-full text-white text-base outline-none placeholder:text-gray-600"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide touch-pan-x overscroll-x-contain">
            {sugestoesTitulos.map((sugestao) => (
              <button
                key={sugestao}
                type="button"
                onClick={() => setTitulo(sugestao)}
                className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 active:scale-95 ${
                  titulo === sugestao
                    ? 'bg-[#2DD4BF]/20 border-[#2DD4BF] text-[#2DD4BF]'
                    : 'bg-[#3a3a3c] border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {sugestao}
              </button>
            ))}
          </div>
        </div>

        {/* Campo: Valor Total */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-gray-400 text-xs uppercase font-bold">Valor Total</label>
            {splitMode === 'equal' && valorPorPessoaIgual > 0 && (
              <span className="text-xs text-[#2DD4BF] font-semibold tabular-nums">
                R$ {moneyConverter(valorPorPessoaIgual)} / pessoa ({qtdTotalPessoas}x)
              </span>
            )}
          </div>
          <div className="bg-[#2c2c2e] rounded-xl p-3.5 flex items-center focus-within:ring-2 focus-within:ring-[#2DD4BF]">
            <span className="text-gray-400 text-xl mr-2 font-medium">R$</span>
            <input
              type="tel"
              placeholder="0,00"
              value={valor}
              onChange={handleValorChange}
              className="bg-transparent w-full text-white text-2xl font-bold outline-none tabular-nums"
            />
          </div>
        </div>

        {/* Grid para Data e Tag */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-gray-400 text-xs uppercase font-bold mb-1.5">Data</label>
            <div className="bg-[#2c2c2e] rounded-xl p-3.5 flex items-center text-white">
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="bg-transparent w-full outline-none text-white text-base sm:text-sm"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-xs uppercase font-bold mb-1.5">
              Categoria / Tag
            </label>
            <div className="bg-[#2c2c2e] rounded-xl p-3.5 flex items-center text-white mb-1.5">
              <input
                type="text"
                placeholder="Uber"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="bg-transparent w-full text-white text-base sm:text-sm outline-none placeholder:text-gray-600"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {sugestoesTags.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => setTag(sugestao)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors active:scale-95 ${
                    tag === sugestao
                      ? 'bg-[#2DD4BF]/20 border-[#2DD4BF] text-[#2DD4BF]'
                      : 'bg-[#3a3a3c] border-gray-600 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Seleção de Grupo (Opcional) */}
        {grupos.length > 0 && (
          <div className="mb-4">
            <label className="text-gray-400 text-xs uppercase font-bold mb-1.5 flex items-center gap-1.5">
              <UsersRound size={13} className="text-[#2DD4BF]" /> Grupo (Opcional)
            </label>
            <select
              value={groupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="w-full bg-[#2c2c2e] text-white rounded-xl p-3 text-sm outline-none border border-white/5 focus:border-[#2DD4BF]"
            >
              <option value="">Racha Avulso (Sem Grupo)</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Campo: Quem estava com você */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <label className="text-gray-400 text-xs uppercase font-bold">
              Participantes ({selecionados.length} amigos + Você)
            </label>
            {amigosReais.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (selecionados.length === amigosReais.length) {
                    setSelecionados([]);
                  } else {
                    const todosIds = amigosReais.map((a) => a.id);
                    setSelecionados(todosIds);
                    inicializarDivisaoIgual(todosIds, valorNumerico);
                  }
                }}
                className="text-[11px] text-[#2DD4BF] font-semibold hover:underline"
              >
                {selecionados.length === amigosReais.length ? 'Limpar' : 'Selecionar todos'}
              </button>
            )}
          </div>

          {isLoadingAmigos ? (
            <div className="flex justify-center p-4">
              <LoaderCircle className="animate-spin text-gray-500" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {amigosReais.length === 0 ? (
                <p className="text-xs text-gray-500 italic">
                  Cadastre amigos na aba "Amigos" primeiro!
                </p>
              ) : (
                amigosReais.map((amigo) => {
                  const isSelected = selecionados.includes(amigo.id);
                  const nomeAmigo = amigo.nome || amigo.name || 'Amigo';
                  const corAmigo = amigo.cor || amigo.color || 'bg-sky-500';
                  return (
                    <button
                      key={amigo.id}
                      type="button"
                      onClick={() => toggleAmigo(amigo.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${
                        isSelected
                          ? 'border-[#2DD4BF] bg-[#2DD4BF]/15 text-white'
                          : 'border-gray-700 bg-[#2c2c2e] text-gray-400'
                      }`}
                    >
                      <div
                        style={{ backgroundColor: getAvatarColor(corAmigo) }}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
                      >
                        {nomeAmigo[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm">{nomeAmigo}</span>
                      {(amigo.has_account || amigo.is_registered) && (
                        <BadgeCheck size={14} className="text-[#2DD4BF] fill-[#2DD4BF]/20 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Modo de Divisão: Igual, Por % ou Por Valor (R$) */}
        {selecionados.length > 0 && (
          <div className="mb-5 bg-[#2c2c2e]/70 p-3.5 rounded-2xl border border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <label className="text-gray-300 text-xs uppercase font-bold">
                Como dividir a conta?
              </label>
              <div className="flex bg-[#1c1c1e] p-1 rounded-xl border border-white/5 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('equal')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors active:scale-95 ${
                    splitMode === 'equal'
                      ? 'bg-[#2DD4BF] text-[#05080f]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Equal size={12} /> Igual
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('percent')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors active:scale-95 ${
                    splitMode === 'percent'
                      ? 'bg-[#2DD4BF] text-[#05080f]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Percent size={12} /> Por %
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('amount')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors active:scale-95 ${
                    splitMode === 'amount'
                      ? 'bg-[#2DD4BF] text-[#05080f]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <DollarSign size={12} /> Valor R$
                </button>
              </div>
            </div>

            {splitMode === 'equal' ? (
              <p className="text-xs text-gray-400">
                Divisão igualitária entre <strong className="text-white">{qtdTotalPessoas} pessoas</strong>:{' '}
                <strong className="text-[#2DD4BF] tabular-nums">
                  R$ {moneyConverter(valorPorPessoaIgual)}
                </strong>{' '}
                ({(100 / qtdTotalPessoas).toFixed(1)}%) para cada.
              </p>
            ) : (
              <div className="space-y-2.5 mt-2">
                {amigosReais
                  .filter((a) => selecionados.includes(a.id))
                  .map((amigo) => {
                    const nomeAmigo = amigo.nome || amigo.name || 'Amigo';
                    const corAmigo = amigo.cor || amigo.color || 'bg-sky-500';
                    const valorCalculado = valoresDevidos[amigo.id] || 0;
                    const pctCalculada =
                      valorNumerico > 0 ? ((valorCalculado / valorNumerico) * 100).toFixed(1) : '0';

                    return (
                      <div
                        key={amigo.id}
                        className="flex items-center justify-between bg-[#1c1c1e] px-3 py-2 rounded-xl border border-white/5 gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            style={{ backgroundColor: getAvatarColor(corAmigo) }}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold shrink-0"
                          >
                            {nomeAmigo[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="text-xs font-semibold text-white truncate">{nomeAmigo}</p>
                            <p className="text-[10px] text-gray-400 tabular-nums">
                              {splitMode === 'percent'
                                ? `R$ ${moneyConverter(valorCalculado)}`
                                : `${pctCalculada}%`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 bg-[#2c2c2e] px-2.5 py-1.5 rounded-lg border border-white/10 focus-within:border-[#2DD4BF] shrink-0">
                          {splitMode === 'amount' && (
                            <span className="text-xs text-gray-400 font-semibold">R$</span>
                          )}
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={
                              splitMode === 'percent'
                                ? friendPercents[amigo.id] ?? ''
                                : friendAmounts[amigo.id] ?? ''
                            }
                            onChange={(e) =>
                              splitMode === 'percent'
                                ? handleFriendPercentChange(amigo.id, e.target.value)
                                : handleFriendAmountChange(amigo.id, e.target.value)
                            }
                            className="w-16 sm:w-20 bg-transparent text-right text-white text-xs font-bold outline-none tabular-nums"
                          />
                          {splitMode === 'percent' && (
                            <span className="text-xs text-[#2DD4BF] font-bold">%</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {/* Linha Você */}
                <div className="flex items-center justify-between bg-[#1c1c1e] px-3 py-2 rounded-xl border border-[#2DD4BF]/20 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-6 h-6 rounded-full bg-[#2DD4BF] flex items-center justify-center text-[10px] text-[#05080f] font-bold shrink-0">
                      V
                    </div>
                    <div className="min-w-0 truncate">
                      <p className="text-xs font-semibold text-white truncate">Você (Sua parte)</p>
                      <p className="text-[10px] text-gray-400 tabular-nums">
                        {splitMode === 'percent'
                          ? `R$ ${moneyConverter(selfAmountOwed)}`
                          : `${valorNumerico > 0 ? ((selfAmountOwed / valorNumerico) * 100).toFixed(1) : '0'}%`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#2c2c2e] px-2.5 py-1.5 rounded-lg border border-white/10 focus-within:border-[#2DD4BF] shrink-0">
                    {splitMode === 'amount' && (
                      <span className="text-xs text-gray-400 font-semibold">R$</span>
                    )}
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={splitMode === 'percent' ? selfPercent : selfAmount}
                      onChange={(e) =>
                        splitMode === 'percent'
                          ? setSelfPercent(e.target.value.replace(',', '.'))
                          : setSelfAmount(e.target.value.replace(',', '.'))
                      }
                      className="w-16 sm:w-20 bg-transparent text-right text-white text-xs font-bold outline-none tabular-nums"
                    />
                    {splitMode === 'percent' && (
                      <span className="text-xs text-[#2DD4BF] font-bold">%</span>
                    )}
                  </div>
                </div>

                {/* Resumo da Soma e Botão Auxiliar */}
                <div className="flex flex-col gap-1.5 pt-2 px-1 border-t border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Soma da divisão:</span>
                    <span
                      className={`font-bold tabular-nums ${
                        (splitMode === 'percent' && Math.abs(somaPercentual - 100) <= 0.5) ||
                        (splitMode === 'amount' && Math.abs(somaTotal - valorNumerico) <= 0.1)
                          ? 'text-[#34C759]'
                          : 'text-amber-400'
                      }`}
                    >
                      R$ {moneyConverter(somaTotal)} ({somaPercentual}%)
                    </span>
                  </div>

                  {splitMode === 'percent' && Math.abs(somaPercentual - 100) > 0.5 && (
                    <div className="flex items-center justify-between text-[11px] bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                      <span className="text-amber-300">
                        {somaPercentual < 100
                          ? `Falta fechar ${(100 - somaPercentual).toFixed(1)}%`
                          : `Passou ${(somaPercentual - 100).toFixed(1)}%`}
                      </span>
                      <button
                        type="button"
                        onClick={handleAjustarRestanteEmVoce}
                        className="text-[11px] text-[#2DD4BF] hover:underline font-bold active:scale-95"
                      >
                        Ajustar em Você
                      </button>
                    </div>
                  )}

                  {splitMode === 'amount' && Math.abs(somaTotal - valorNumerico) > 0.1 && valorNumerico > 0 && (
                    <div className="flex items-center justify-between text-[11px] bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
                      <span className="text-amber-300">
                        {somaTotal < valorNumerico
                          ? `Falta R$ ${moneyConverter(valorNumerico - somaTotal)}`
                          : `Passou R$ ${moneyConverter(somaTotal - valorNumerico)}`}
                      </span>
                      <button
                        type="button"
                        onClick={handleAjustarRestanteEmVoce}
                        className="text-[11px] text-[#2DD4BF] hover:underline font-bold active:scale-95"
                      >
                        Ajustar em Você
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quem Pagou a Conta? */}
        {selecionados.length > 0 && (
          <div className="mb-6">
            <label className="text-gray-400 text-xs uppercase font-bold mb-1.5 flex items-center gap-1.5">
              <Wallet size={13} className="text-[#2DD4BF]" /> Quem pagou esta conta?
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide touch-pan-x overscroll-x-contain">
              <button
                type="button"
                onClick={() => setPaidByFriendId('')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors shrink-0 active:scale-95 ${
                  paidByFriendId === ''
                    ? 'bg-[#2DD4BF] text-[#05080f] border-[#2DD4BF]'
                    : 'bg-[#2c2c2e] text-gray-300 border-white/10'
                }`}
              >
                Você (Credor)
              </button>
              {amigosReais
                .filter((a) => selecionados.includes(a.id))
                .map((amigo) => {
                  const nomeAmigo = amigo.nome || amigo.name || 'Amigo';
                  const isPayer = paidByFriendId === amigo.id;
                  return (
                    <button
                      key={amigo.id}
                      type="button"
                      onClick={() => setPaidByFriendId(amigo.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors shrink-0 active:scale-95 ${
                        isPayer
                          ? 'bg-[#2DD4BF] text-[#05080f] border-[#2DD4BF]'
                          : 'bg-[#2c2c2e] text-gray-300 border-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <span className="truncate max-w-[120px]">{nomeAmigo}</span>
                        {(amigo.has_account || amigo.is_registered) && (
                          <BadgeCheck size={12} className={isPayer ? "text-[#05080f] shrink-0" : "text-[#2DD4BF] shrink-0"} />
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Botão Salvar */}
        <button
          onClick={handleSalvarCorrida}
          disabled={isSaving}
          className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] disabled:opacity-50 text-[#05080f] font-bold py-4 rounded-xl text-base flex items-center justify-center gap-2 transition-all active:scale-95"
        >
          {isSaving ? (
            <LoaderCircle className="animate-spin" />
          ) : isEditing ? (
            'Salvar Alterações'
          ) : (
            'Rachar Despesa'
          )}
        </button>
      </div>
    </div>,
    document.body
  );
}

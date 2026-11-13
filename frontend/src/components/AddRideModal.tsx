// src/components/AddRideModal.tsx
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  LoaderCircle,
  UsersRound,
  Wallet,
  Percent,
  DollarSign,
  Equal,
  BadgeCheck,
  Plus,
  Pencil,
  Check,
  Trash2,
  RotateCcw,
  Sparkles,
  Search,
  Star,
} from 'lucide-react';
import { dbService } from '../services/database';
import type { Amigo, Corrida, Grupo } from '../types';
import moneyConverter from '../utils/moneyConverter';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { getAvatarColor } from '../utils/avatarColor';
import {
  TAG_ICON_CATEGORIES,
  TAG_ICON_PRESETS,
  getCustomTags,
  upsertCustomTag,
  deleteCustomTag,
  resetCustomTagsToDefault,
  getPresetTitles,
  addPresetTitle,
  removePresetTitle,
  resetPresetTitlesToDefault,
  getTagIconKey,
  getIconByKey,
  inferIconKeyFromText,
  type CustomTagItem,
  type TagIconPreset,
} from '../utils/ridePresets';

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
  const [selectedTagIconKey, setSelectedTagIconKey] = useState<string>('car');
  const [groupId, setGroupId] = useState<string>('');
  const [paidByFriendId, setPaidByFriendId] = useState<string>('');

  // Estados de Títulos Pré-configurados e Tags Customizadas do Usuário
  const [presetTitles, setPresetTitles] = useState<string[]>(() => getPresetTitles());
  const [isManagingTitles, setIsManagingTitles] = useState(false);
  const [newPresetTitleInput, setNewPresetTitleInput] = useState('');

  const [customTags, setCustomTags] = useState<CustomTagItem[]>(() => getCustomTags());
  const [isManagingTags, setIsManagingTags] = useState(false);
  const [isTagEditorOpen, setIsTagEditorOpen] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagEditorName, setTagEditorName] = useState('');
  const [tagEditorIconKey, setTagEditorIconKey] = useState('car');
  const [iconCategoryFilter, setIconCategoryFilter] = useState<
    'todos' | TagIconPreset['category']
  >('todos');

  // Busca e filtro rápido de participantes
  const [buscaParticipante, setBuscaParticipante] = useState('');
  const [filtroParticipante, setFiltroParticipante] = useState<
    'todos' | 'favoritos' | 'selecionados'
  >('todos');

  // Custom Split State
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [hasCustomEdits, setHasCustomEdits] = useState(false);
  const [friendPercents, setFriendPercents] = useState<Record<string, string>>({});
  const [selfPercent, setSelfPercent] = useState<string>('');
  const [friendAmounts, setFriendAmounts] = useState<Record<string, string>>({});
  const [selfAmount, setSelfAmount] = useState<string>('');

  const [amigosReais, setAmigosReais] = useState<Amigo[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [isLoadingAmigos, setIsLoadingAmigos] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const initializedKeyRef = useRef<string | null>(null);
  const sheetRef = useModalBackHandler(isOpen, onClose);

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
    if (!isOpen) {
      initializedKeyRef.current = null;
      setIsManagingTitles(false);
      setIsManagingTags(false);
      setIsTagEditorOpen(false);
      setBuscaParticipante('');
      setFiltroParticipante('todos');
      return;
    }

    setPresetTitles(getPresetTitles());
    setCustomTags(getCustomTags());

    const sessionKey = rideToEdit ? `edit:${rideToEdit.id}` : `new:${defaultGroupId || ''}`;
    if (initializedKeyRef.current === sessionKey) {
      // Já inicializado nesta sessão de abertura: apenas atualiza listas de referência sem sobrescrever edições do usuário
      Promise.all([dbService.amigos.getAll(), dbService.grupos.getAll()])
        .then(([dadosAmigos, dadosGrupos]) => {
          setAmigosReais(dadosAmigos);
          setGrupos(dadosGrupos);
        })
        .catch(() => {});
      return;
    }

    initializedKeyRef.current = sessionKey;

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
          const editTag = rideToEdit.tag || 'Uber';
          setTitulo(rideToEdit.titulo || '');
          setTag(editTag);
          setSelectedTagIconKey(getTagIconKey(editTag));
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
          setHasCustomEdits(temCustom);
        } else {
          const loadedTags = getCustomTags();
          const initialTag = loadedTags[0]?.name || 'Uber';
          const initialIcon = loadedTags[0]?.iconKey || 'car';
          setTitulo('');
          setTag(initialTag);
          setSelectedTagIconKey(initialIcon);
          setData(getTodayDate());
          setValor('');
          setPaidByFriendId('');
          setSplitMode('equal');
          setHasCustomEdits(false);
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
  }, [isOpen, rideToEdit?.id, defaultGroupId]);

  const handleAddPresetTitle = (rawTitle?: string) => {
    const target = (rawTitle ?? newPresetTitleInput).trim();
    if (!target) return;
    const updated = addPresetTitle(target);
    setPresetTitles(updated);
    setTitulo(target);
    setNewPresetTitleInput('');
  };

  const handleRemovePresetTitle = (titleToRemove: string) => {
    const updated = removePresetTitle(titleToRemove);
    setPresetTitles(updated);
  };

  const handleResetPresetTitles = () => {
    const updated = resetPresetTitlesToDefault();
    setPresetTitles(updated);
  };

  const handleOpenNewTagEditor = (prefillName = '') => {
    const initialName = prefillName.trim();
    setEditingTagId(null);
    setTagEditorName(initialName);
    setTagEditorIconKey(initialName ? inferIconKeyFromText(initialName) : selectedTagIconKey || 'car');
    setIconCategoryFilter('todos');
    setIsTagEditorOpen(true);
  };

  const handleOpenEditTagEditor = (tagItem: CustomTagItem) => {
    setEditingTagId(tagItem.id);
    setTagEditorName(tagItem.name);
    setTagEditorIconKey(tagItem.iconKey);
    setIconCategoryFilter('todos');
    setIsTagEditorOpen(true);
  };

  const handleSaveTagFromEditor = () => {
    const cleanName = tagEditorName.trim();
    if (!cleanName) {
      alert('Digite um nome para a tag.');
      return;
    }
    const updated = upsertCustomTag(cleanName, tagEditorIconKey, editingTagId || undefined);
    setCustomTags(updated);
    setTag(cleanName);
    setSelectedTagIconKey(tagEditorIconKey);
    setIsTagEditorOpen(false);
    setEditingTagId(null);
  };

  const handleDeleteCustomTag = (tagItem: CustomTagItem) => {
    const updated = deleteCustomTag(tagItem.id);
    setCustomTags(updated);
    if (tag.toLowerCase() === tagItem.name.toLowerCase()) {
      const nextTag = updated[0]?.name || 'Uber';
      const nextIcon = updated[0]?.iconKey || 'car';
      setTag(nextTag);
      setSelectedTagIconKey(nextIcon);
    }
  };

  const handleResetCustomTags = () => {
    const updated = resetCustomTagsToDefault();
    setCustomTags(updated);
  };

  const handleGroupChange = (newGroupId: string) => {
    setGroupId(newGroupId);
    if (newGroupId) {
      const g = grupos.find((grp) => grp.id === newGroupId);
      if (g && g.members) {
        const fIds = g.members.filter((m) => m.friend?.id).map((m) => m.friend!.id);
        if (fIds.length > 0) {
          setSelecionados(fIds);
          if (splitMode === 'equal' || !hasCustomEdits) {
            inicializarDivisaoIgual(fIds, valorNumerico);
          }
        }
      }
    }
  };

  const toggleAmigo = (id: string) => {
    const isRemoving = selecionados.includes(id);
    let next: string[];
    if (isRemoving) {
      next = selecionados.filter((item) => item !== id);
      if (paidByFriendId === id) setPaidByFriendId('');
    } else {
      next = [...selecionados, id];
    }
    setSelecionados(next);

    if (splitMode === 'equal' || !hasCustomEdits) {
      inicializarDivisaoIgual(next, valorNumerico);
    } else {
      // Preserva valores personalizados já digitados pelos outros participantes
      const nextAmt: Record<string, string> = {};
      const nextPct: Record<string, string> = {};
      let somaExistenteAmt = parseFloat(selfAmount || '0') || 0;
      let somaExistentePct = parseFloat(selfPercent || '0') || 0;

      next.forEach((fId) => {
        if (fId !== id && friendAmounts[fId] !== undefined) {
          nextAmt[fId] = friendAmounts[fId];
          somaExistenteAmt += parseFloat(friendAmounts[fId] || '0') || 0;
        }
        if (fId !== id && friendPercents[fId] !== undefined) {
          nextPct[fId] = friendPercents[fId];
          somaExistentePct += parseFloat(friendPercents[fId] || '0') || 0;
        }
      });

      if (!isRemoving) {
        const restAmt = Math.max(0, Number((valorNumerico - somaExistenteAmt).toFixed(2)));
        const restPct = Math.max(0, Number((100 - somaExistentePct).toFixed(1)));
        nextAmt[id] = restAmt.toFixed(2);
        nextPct[id] = restPct.toFixed(1);
      }

      setFriendAmounts(nextAmt);
      setFriendPercents(nextPct);
    }
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
    if (mode === splitMode) return;
    const prevMode = splitMode;
    setSplitMode(mode);
    if (mode === 'equal') {
      setHasCustomEdits(false);
      inicializarDivisaoIgual(selecionados, valorNumerico);
    } else if (mode === 'percent') {
      if (valorNumerico > 0) {
        const nextPct: Record<string, string> = {};
        selecionados.forEach((id) => {
          const v =
            prevMode === 'amount' && friendAmounts[id] !== undefined
              ? parseFloat(friendAmounts[id] || '0') || 0
              : valorNumerico / (selecionados.length + 1);
          const pct = (v / valorNumerico) * 100;
          nextPct[id] = pct.toFixed(1);
        });
        setFriendPercents(nextPct);
        const selfV =
          prevMode === 'amount' && selfAmount !== undefined
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
          if (prevMode === 'percent' && friendPercents[id] !== undefined) {
            const pct = parseFloat(friendPercents[id] || '0') || 0;
            nextAmt[id] = ((valorNumerico * pct) / 100).toFixed(2);
          } else if (friendAmounts[id] !== undefined && hasCustomEdits) {
            nextAmt[id] = friendAmounts[id];
          } else {
            nextAmt[id] = (valorNumerico / (selecionados.length + 1)).toFixed(2);
          }
        });
        setFriendAmounts(nextAmt);
        if (prevMode === 'percent' && selfPercent !== undefined) {
          const sPct = parseFloat(selfPercent || '0') || 0;
          setSelfAmount(((valorNumerico * sPct) / 100).toFixed(2));
        } else if (!selfAmount || !hasCustomEdits) {
          setSelfAmount((valorNumerico / (selecionados.length + 1)).toFixed(2));
        }
      }
    }
  };

  const handleFriendPercentChange = (friendId: string, rawVal: string) => {
    const cleaned = rawVal.replace(',', '.');
    setHasCustomEdits(true);
    setFriendPercents((prev) => ({ ...prev, [friendId]: cleaned }));
  };

  const handleFriendAmountChange = (friendId: string, rawVal: string) => {
    const cleaned = rawVal.replace(',', '.');
    setHasCustomEdits(true);
    setFriendAmounts((prev) => ({ ...prev, [friendId]: cleaned }));
  };

  const handleAjustarRestanteEmVoce = () => {
    setHasCustomEdits(true);
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
      const finalTag = (tag || 'Uber').trim();
      if (finalTag) {
        const updatedTags = upsertCustomTag(finalTag, selectedTagIconKey);
        setCustomTags(updatedTags);
      }

      const payload = {
        titulo: titulo.trim(),
        tag: finalTag,
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

  const CurrentTagIcon = getIconByKey(selectedTagIconKey);
  const TagEditorPreviewIcon = getIconByKey(tagEditorIconKey);
  const canSaveCurrentTitleAsPreset =
    titulo.trim().length > 0 &&
    !presetTitles.some((t) => t.toLowerCase() === titulo.trim().toLowerCase());

  const currentTagSavedObj = customTags.find(
    (t) => t.name.toLowerCase() === tag.trim().toLowerCase()
  );
  const canSaveCurrentTagQuick =
    tag.trim().length > 0 &&
    (!currentTagSavedObj || currentTagSavedObj.iconKey !== selectedTagIconKey);

  const filteredIconPresets =
    iconCategoryFilter === 'todos'
      ? TAG_ICON_PRESETS
      : TAG_ICON_PRESETS.filter((p) => p.category === iconCategoryFilter);

  const amigosOrdenados = [...amigosReais].sort((a, b) => {
    const favA = Boolean(a.favorito || a.is_favorite);
    const favB = Boolean(b.favorito || b.is_favorite);
    if (favA !== favB) return favA ? -1 : 1;
    const nomeA = a.nome || a.name || '';
    const nomeB = b.nome || b.name || '';
    return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
  });

  const totalFavoritosCount = amigosOrdenados.filter((a) => a.favorito || a.is_favorite).length;
  const amigosSelecionadosObjetos = amigosOrdenados.filter((a) => selecionados.includes(a.id));

  const amigosParticipantesFiltrados = amigosOrdenados.filter((amigo) => {
    if (buscaParticipante.trim()) {
      const termo = buscaParticipante.trim().toLowerCase();
      const nome = (amigo.nome || amigo.name || '').toLowerCase();
      const fone = (amigo.telefone || amigo.phone || '').toLowerCase();
      if (!nome.includes(termo) && !fone.includes(termo)) {
        return false;
      }
    }
    if (filtroParticipante === 'favoritos' && !(amigo.favorito || amigo.is_favorite)) {
      return false;
    }
    if (filtroParticipante === 'selecionados' && !selecionados.includes(amigo.id)) {
      return false;
    }
    return true;
  });

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className="bg-[var(--bg-surface)] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up relative overflow-y-auto max-h-[92dvh] sm:max-h-[90vh] border border-[var(--border-color)] shadow-xl pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle de arrastar para baixo (sempre acessível no topo) */}
        <div
          data-sheet-handle="true"
          className="sticky -top-6 z-20 bg-[var(--bg-surface)]/95 backdrop-blur-sm w-full pt-2.5 pb-3 -mt-6 mb-2 flex justify-center items-center cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
        >
          <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full" />
        </div>

        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-2 rounded-full hover:bg-[var(--bg-subtle)] transition-colors active:scale-95"
        >
          <X size={22} strokeWidth={2} />
        </button>

        <h2
          data-sheet-handle="true"
          className="text-h1 text-[var(--text-primary)] mb-5 pr-8 select-none"
        >
          {isEditing ? 'Editar Racha' : 'Adicionar Novo Racha'}
        </h2>

        {/* Campo: Título / Descrição + Títulos Pré-configurados */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="block text-[var(--text-secondary)] text-caption uppercase font-semibold">
              Título / Descrição
            </label>
            <div className="flex items-center gap-2">
              {canSaveCurrentTitleAsPreset && (
                <button
                  type="button"
                  onClick={() => handleAddPresetTitle(titulo)}
                  className="text-caption font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1 active:scale-95"
                  title="Salvar este título nos seus pré-configurados"
                >
                  <Plus size={13} strokeWidth={2.5} />
                  <span>Salvar nos rápidos</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsManagingTitles((prev) => !prev)}
                className={`text-caption font-semibold px-2 py-0.5 rounded-lg border transition-colors inline-flex items-center gap-1 active:scale-95 ${
                  isManagingTitles
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
                }`}
              >
                <Pencil size={11} strokeWidth={2} />
                <span>{isManagingTitles ? 'Concluir' : 'Personalizar'}</span>
              </button>
            </div>
          </div>

          <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-xl h-12 px-4 flex items-center text-[var(--text-primary)] mb-2 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/20 transition-all">
            <input
              type="text"
              placeholder="Ex: Jantar, Churrasco, Mercado, Uber..."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="bg-transparent w-full text-[var(--text-primary)] text-body1 outline-none placeholder:text-[var(--text-secondary)]"
            />
            {titulo && (
              <button
                type="button"
                onClick={() => setTitulo('')}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 -mr-1 shrink-0"
                title="Limpar título"
              >
                <X size={16} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Lista de Títulos Pré-configurados */}
          <div
            data-horizontal-scroll="true"
            className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide items-center"
          >
            {presetTitles.map((sugestao) => {
              const isSelected = titulo.trim().toLowerCase() === sugestao.toLowerCase();
              return (
                <div
                  key={sugestao}
                  className={`inline-flex items-center rounded-full text-caption font-semibold border transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setTitulo(sugestao)}
                    className="whitespace-nowrap px-3 py-1 active:scale-95"
                  >
                    {sugestao}
                  </button>
                  {isManagingTitles && (
                    <button
                      type="button"
                      onClick={() => handleRemovePresetTitle(sugestao)}
                      className={`pr-2 pl-0.5 py-1 hover:opacity-80 ${
                        isSelected ? 'text-white' : 'text-[#F43F5E]'
                      }`}
                      title={`Remover "${sugestao}"`}
                    >
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              );
            })}

            {!isManagingTitles && (
              <button
                type="button"
                onClick={() => setIsManagingTitles(true)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full text-caption font-semibold border border-dashed border-[var(--primary)]/50 text-[var(--primary)] bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 transition-colors shrink-0 inline-flex items-center gap-1 active:scale-95"
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>Novo título</span>
              </button>
            )}
          </div>

          {/* Painel de criação/edição de títulos pré-configurados */}
          {isManagingTitles && (
            <div
              data-no-sheet-drag="true"
              className="mt-2 p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] space-y-2 animate-fade-in"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Novo título rápido (ex: Futebol, Academia...)"
                  value={newPresetTitleInput}
                  onChange={(e) => setNewPresetTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPresetTitle();
                    }
                  }}
                  className="flex-1 h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-[var(--primary)] text-caption text-[var(--text-primary)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddPresetTitle()}
                  disabled={!newPresetTitleInput.trim()}
                  className="h-9 px-3 rounded-lg bg-[var(--primary)] text-white text-caption font-semibold disabled:opacity-40 inline-flex items-center gap-1 shrink-0 active:scale-95"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  <span>Adicionar</span>
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>Toque no "×" em um título acima para removê-lo.</span>
                <button
                  type="button"
                  onClick={handleResetPresetTitles}
                  className="text-[var(--primary)] hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  <RotateCcw size={11} strokeWidth={2} />
                  <span>Restaurar padrões</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Campo: Valor Total */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-[var(--text-secondary)] text-caption uppercase font-semibold">
              Valor Total
            </label>
            {splitMode === 'equal' && valorPorPessoaIgual > 0 && (
              <span className="text-caption text-[var(--primary)] font-semibold tabular-nums">
                R$ {moneyConverter(valorPorPessoaIgual)} / pessoa ({qtdTotalPessoas}x)
              </span>
            )}
          </div>
          <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-xl h-12 px-4 flex items-center focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/20 transition-all">
            <span className="text-[var(--text-secondary)] text-h2 mr-2 font-semibold">R$</span>
            <input
              type="tel"
              placeholder="0,00"
              value={valor}
              onChange={handleValorChange}
              className="bg-transparent w-full text-[var(--text-primary)] text-h1 font-display font-bold outline-none tabular-nums placeholder:text-[var(--text-secondary)]"
            />
          </div>
        </div>

        {/* Campo: Data */}
        <div className="mb-4">
          <label className="block text-[var(--text-secondary)] text-caption uppercase font-semibold mb-1.5">
            Data
          </label>
          <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-xl h-12 px-4 flex items-center text-[var(--text-primary)] focus-within:border-[var(--primary)]">
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="bg-transparent w-full outline-none text-[var(--text-primary)] text-body2"
            />
          </div>
        </div>

        {/* Campo: Categoria / Tag com escolha de Ícone */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="block text-[var(--text-secondary)] text-caption uppercase font-semibold">
              Categoria / Tag
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenNewTagEditor('')}
                className="text-caption font-semibold px-2.5 py-0.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors inline-flex items-center gap-1 active:scale-95"
              >
                <Plus size={12} strokeWidth={2.5} />
                <span>Nova Tag</span>
              </button>
              <button
                type="button"
                onClick={() => setIsManagingTags((prev) => !prev)}
                className={`text-caption font-semibold px-2 py-0.5 rounded-lg border transition-colors inline-flex items-center gap-1 active:scale-95 ${
                  isManagingTags
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-color)]'
                }`}
              >
                <Pencil size={11} strokeWidth={2} />
                <span>{isManagingTags ? 'Concluir' : 'Editar'}</span>
              </button>
            </div>
          </div>

          {/* Barra da Tag selecionada + Botão de trocar ícone */}
          <div className="bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-xl h-12 px-2.5 flex items-center gap-2 text-[var(--text-primary)] mb-2 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/20 transition-all">
            <button
              type="button"
              onClick={() => {
                if (currentTagSavedObj) {
                  handleOpenEditTagEditor(currentTagSavedObj);
                } else {
                  handleOpenNewTagEditor(tag);
                }
              }}
              className="w-8 h-8 rounded-lg bg-[var(--primary)]/15 hover:bg-[var(--primary)]/25 text-[var(--primary)] flex items-center justify-center shrink-0 transition-colors active:scale-95"
              title="Escolher ícone para esta tag"
            >
              <CurrentTagIcon size={17} strokeWidth={2} />
            </button>

            <input
              type="text"
              placeholder="Ex: Uber, Churrasco, Futebol..."
              value={tag}
              onChange={(e) => {
                const val = e.target.value;
                setTag(val);
                const matched = customTags.find(
                  (t) => t.name.toLowerCase() === val.trim().toLowerCase()
                );
                if (matched) {
                  setSelectedTagIconKey(matched.iconKey);
                } else if (val.trim()) {
                  setSelectedTagIconKey(inferIconKeyFromText(val));
                }
              }}
              className="bg-transparent w-full text-[var(--text-primary)] text-body2 outline-none placeholder:text-[var(--text-secondary)]"
            />

            {canSaveCurrentTagQuick && (
              <button
                type="button"
                onClick={() => {
                  const updated = upsertCustomTag(tag.trim(), selectedTagIconKey);
                  setCustomTags(updated);
                }}
                className="h-7 px-2.5 rounded-lg bg-[var(--primary)] text-white text-[11px] font-semibold shrink-0 inline-flex items-center gap-1 active:scale-95"
                title="Salvar nas suas tags"
              >
                <Check size={12} strokeWidth={2.5} />
                <span>Salvar</span>
              </button>
            )}
          </div>

          {/* Lista de Tags do Usuário com seus Ícones */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {customTags.map((tagItem) => {
              const TagItemIcon = getIconByKey(tagItem.iconKey);
              const isSelected = tag.trim().toLowerCase() === tagItem.name.toLowerCase();
              return (
                <div
                  key={tagItem.id}
                  className={`inline-flex items-center rounded-xl text-caption font-semibold border transition-all ${
                    isSelected
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-sm'
                      : 'bg-[var(--bg-subtle)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setTag(tagItem.name);
                      setSelectedTagIconKey(tagItem.iconKey);
                    }}
                    className="px-2.5 py-1.5 inline-flex items-center gap-1.5 active:scale-95"
                  >
                    <TagItemIcon
                      size={14}
                      strokeWidth={2}
                      className={isSelected ? 'text-white' : 'text-[var(--primary)]'}
                    />
                    <span>{tagItem.name}</span>
                  </button>

                  {isManagingTags && (
                    <div className="flex items-center pr-1.5 gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditTagEditor(tagItem)}
                        className={`p-1 rounded hover:bg-black/10 ${
                          isSelected ? 'text-white' : 'text-[var(--text-secondary)]'
                        }`}
                        title={`Editar tag e ícone de "${tagItem.name}"`}
                      >
                        <Pencil size={11} strokeWidth={2.2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomTag(tagItem)}
                        className={`p-1 rounded hover:bg-black/10 ${
                          isSelected ? 'text-white' : 'text-[#F43F5E]'
                        }`}
                        title={`Excluir "${tagItem.name}"`}
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {!isManagingTags && (
              <button
                type="button"
                onClick={() => handleOpenNewTagEditor('')}
                className="px-2.5 py-1.5 rounded-xl text-caption font-semibold border border-dashed border-[var(--primary)]/50 text-[var(--primary)] bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 transition-colors inline-flex items-center gap-1 active:scale-95"
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>Criar Tag</span>
              </button>
            )}
          </div>

          {isManagingTags && (
            <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-secondary)] px-1">
              <span>Toque no lápis para mudar o ícone/nome ou no "×" para apagar.</span>
              <button
                type="button"
                onClick={handleResetCustomTags}
                className="text-[var(--primary)] hover:underline inline-flex items-center gap-1 font-semibold shrink-0"
              >
                <RotateCcw size={11} strokeWidth={2} />
                <span>Restaurar padrões</span>
              </button>
            </div>
          )}

          {/* Criador / Editor de Tag com Grande Variedade de Presets de Ícones */}
          {isTagEditorOpen && (
            <div
              data-no-sheet-drag="true"
              className="mt-3 p-4 rounded-2xl bg-[var(--bg-subtle)] border-2 border-[var(--primary)]/40 shadow-md space-y-3.5 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} strokeWidth={2} className="text-[var(--primary)]" />
                  <span className="text-caption font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    {editingTagId ? 'Editar Tag e Ícone' : 'Criar Nova Tag Personalizada'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTagEditorOpen(false)}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-lg"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              {/* Nome da Tag + Preview em tempo real */}
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shrink-0 shadow-sm">
                  <TagEditorPreviewIcon size={22} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1">
                    Nome da Tag
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Futebol, Churrasco, Gasolina, Pet..."
                    value={tagEditorName}
                    onChange={(e) => setTagEditorName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] focus:border-[var(--primary)] text-body2 text-[var(--text-primary)] outline-none"
                  />
                </div>
              </div>

              {/* Filtro de Categorias de Ícones */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase mb-1.5">
                  Escolha o Ícone ({TAG_ICON_PRESETS.length} opções disponíveis)
                </label>
                <div
                  data-horizontal-scroll="true"
                  className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide"
                >
                  {TAG_ICON_CATEGORIES.map((cat) => {
                    const active = iconCategoryFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setIconCategoryFilter(cat.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap border transition-colors shrink-0 ${
                          active
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                            : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Grade de Presets de Ícones */}
                <div
                  data-no-sheet-drag="true"
                  className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-52 overflow-y-auto p-1.5 mt-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]"
                >
                  {filteredIconPresets.map((preset) => {
                    const PresetIcon = preset.icon;
                    const isSelectedIcon = tagEditorIconKey === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => setTagEditorIconKey(preset.key)}
                        className={`flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl border text-center transition-all active:scale-95 ${
                          isSelectedIcon
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-sm'
                            : 'bg-[var(--bg-subtle)]/60 hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-transparent'
                        }`}
                        title={preset.label}
                      >
                        <PresetIcon
                          size={18}
                          strokeWidth={2}
                          className={isSelectedIcon ? 'text-white' : 'text-[var(--primary)]'}
                        />
                        <span className="text-[10px] font-medium leading-tight truncate w-full text-center">
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botões do Editor de Tag */}
              <div className="flex items-center gap-2 pt-1">
                {editingTagId && (
                  <button
                    type="button"
                    onClick={() => {
                      const found = customTags.find((t) => t.id === editingTagId);
                      if (found) handleDeleteCustomTag(found);
                      setIsTagEditorOpen(false);
                      setEditingTagId(null);
                    }}
                    className="h-10 px-3 rounded-xl bg-[var(--rose-bg)] border border-[var(--rose-border)] text-[#F43F5E] text-caption font-semibold inline-flex items-center gap-1 active:scale-95"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                    <span>Excluir</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsTagEditorOpen(false);
                    setEditingTagId(null);
                  }}
                  className="flex-1 h-10 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-caption font-semibold active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTagFromEditor}
                  className="flex-[1.5] h-10 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-caption font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Check size={15} strokeWidth={2.5} />
                  <span>{editingTagId ? 'Atualizar Tag' : 'Salvar Tag'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Seleção de Grupo (Opcional) */}
        {grupos.length > 0 && (
          <div className="mb-4">
            <label className="text-[var(--text-secondary)] text-caption uppercase font-semibold mb-1.5 flex items-center gap-1.5">
              <UsersRound size={14} strokeWidth={2} className="text-[var(--primary)]" /> Grupo (Opcional)
            </label>
            <select
              value={groupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              className="w-full h-12 bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-xl px-4 text-body2 outline-none border border-[var(--border-color)] focus:border-[var(--primary)]"
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

        {/* Campo: Quem estava com você (Seletor compacto com busca, filtros e lista rolável) */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <label className="text-[var(--text-secondary)] text-caption uppercase font-semibold">
              Participantes ({selecionados.length}{' '}
              {selecionados.length === 1 ? 'amigo' : 'amigos'} + Você)
            </label>
            {amigosReais.length > 0 && (
              <div className="flex items-center gap-2">
                {selecionados.length > 0 && selecionados.length < amigosReais.length && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelecionados([]);
                      setPaidByFriendId('');
                    }}
                    className="text-caption text-[#F43F5E] font-semibold hover:underline"
                  >
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (selecionados.length === amigosReais.length) {
                      setSelecionados([]);
                      setPaidByFriendId('');
                    } else {
                      const todosIds = amigosReais.map((a) => a.id);
                      setSelecionados(todosIds);
                      inicializarDivisaoIgual(todosIds, valorNumerico);
                    }
                  }}
                  className="text-caption text-[var(--primary)] font-semibold hover:underline"
                >
                  {selecionados.length === amigosReais.length ? 'Limpar todos' : 'Selecionar todos'}
                </button>
              </div>
            )}
          </div>

          {isLoadingAmigos ? (
            <div className="flex justify-center p-4">
              <LoaderCircle className="animate-spin text-[var(--primary)]" />
            </div>
          ) : amigosReais.length === 0 ? (
            <p className="text-caption text-[var(--text-secondary)] italic">
              Cadastre amigos na aba "Amigos" primeiro!
            </p>
          ) : (
            <div className="space-y-2">
              {/* Faixa rápida de amigos já selecionados no racha */}
              {amigosSelecionadosObjetos.length > 0 && (
                <div
                  data-horizontal-scroll="true"
                  className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
                >
                  {amigosSelecionadosObjetos.map((amigo) => {
                    const nomeAmigo = amigo.nome || amigo.name || 'Amigo';
                    const corAmigo = amigo.cor || amigo.color || 'bg-sky-500';
                    return (
                      <button
                        key={`sel-${amigo.id}`}
                        type="button"
                        onClick={() => toggleAmigo(amigo.id)}
                        className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-[var(--primary)]/12 border border-[var(--primary)]/40 text-[var(--text-primary)] text-caption font-semibold shrink-0 active:scale-95 transition-all"
                        title={`Remover ${nomeAmigo} do racha`}
                      >
                        <div
                          style={
                            amigo.avatar_url
                              ? undefined
                              : { backgroundColor: getAvatarColor(corAmigo) }
                          }
                          className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center text-[10px] text-white font-bold shrink-0"
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
                        <span className="truncate max-w-[96px]">{nomeAmigo.split(' ')[0]}</span>
                        <X size={12} strokeWidth={2.5} className="text-[var(--primary)] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Busca + Filtros rápidos de amigos */}
              <div className="flex flex-col gap-1.5">
                <div className="h-9 bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-xl px-3 flex items-center gap-2 focus-within:border-[var(--primary)] transition-colors">
                  <Search size={14} strokeWidth={2} className="text-[var(--text-secondary)] shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar amigo pelo nome..."
                    value={buscaParticipante}
                    onChange={(e) => setBuscaParticipante(e.target.value)}
                    className="bg-transparent w-full text-caption text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
                  />
                  {buscaParticipante && (
                    <button
                      type="button"
                      onClick={() => setBuscaParticipante('')}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-0.5 shrink-0"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>

                {(totalFavoritosCount > 0 || selecionados.length > 0) && (
                  <div
                    data-horizontal-scroll="true"
                    className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
                  >
                    <button
                      type="button"
                      onClick={() => setFiltroParticipante('todos')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors shrink-0 ${
                        filtroParticipante === 'todos'
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)]'
                      }`}
                    >
                      Todos ({amigosReais.length})
                    </button>
                    {totalFavoritosCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFiltroParticipante(
                            filtroParticipante === 'favoritos' ? 'todos' : 'favoritos'
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors inline-flex items-center gap-1 shrink-0 ${
                          filtroParticipante === 'favoritos'
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)]'
                        }`}
                      >
                        <Star
                          size={11}
                          strokeWidth={2}
                          className={
                            filtroParticipante === 'favoritos'
                              ? 'fill-white text-white'
                              : 'fill-[#F59E0B] text-[#F59E0B]'
                          }
                        />
                        <span>Favoritos ({totalFavoritosCount})</span>
                      </button>
                    )}
                    {selecionados.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFiltroParticipante(
                            filtroParticipante === 'selecionados' ? 'todos' : 'selecionados'
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors shrink-0 ${
                          filtroParticipante === 'selecionados'
                            ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)]'
                        }`}
                      >
                        No racha ({selecionados.length})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Grade compacta rolável de amigos (2 colunas, altura controlada) */}
              <div
                data-no-sheet-drag="true"
                className="max-h-48 overflow-y-auto p-1.5 rounded-2xl bg-[var(--bg-subtle)]/70 border border-[var(--border-color)]"
              >
                {amigosParticipantesFiltrados.length === 0 ? (
                  <p className="text-caption text-[var(--text-secondary)] text-center py-4">
                    Nenhum amigo encontrado para este filtro.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {amigosParticipantesFiltrados.map((amigo) => {
                      const isSelected = selecionados.includes(amigo.id);
                      const nomeAmigo = amigo.nome || amigo.name || 'Amigo';
                      const corAmigo = amigo.cor || amigo.color || 'bg-sky-500';
                      const isFav = Boolean(amigo.favorito || amigo.is_favorite);
                      const isVerified = Boolean(amigo.has_account || amigo.is_registered);

                      return (
                        <button
                          key={amigo.id}
                          type="button"
                          onClick={() => toggleAmigo(amigo.id)}
                          className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl border text-left transition-all active:scale-[0.98] ${
                            isSelected
                              ? 'border-[var(--primary)] bg-[var(--primary)]/12 text-[var(--text-primary)] shadow-sm'
                              : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="relative shrink-0">
                              <div
                                style={
                                  amigo.avatar_url
                                    ? undefined
                                    : { backgroundColor: getAvatarColor(corAmigo) }
                                }
                                className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-caption text-white font-bold"
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
                              {isFav && (
                                <Star
                                  size={10}
                                  strokeWidth={2.2}
                                  className="absolute -bottom-0.5 -right-0.5 text-[#F59E0B] fill-[#F59E0B] bg-[var(--bg-surface)] rounded-full p-[1px]"
                                />
                              )}
                            </div>

                            <div className="min-w-0 flex-1 flex items-center gap-1">
                              <span
                                className={`text-caption truncate ${
                                  isSelected ? 'font-bold text-[var(--text-primary)]' : 'font-medium'
                                }`}
                              >
                                {nomeAmigo}
                              </span>
                              {isVerified && (
                                <BadgeCheck
                                  size={13}
                                  strokeWidth={2}
                                  className="text-[var(--primary)] shrink-0"
                                />
                              )}
                            </div>
                          </div>

                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                              isSelected
                                ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                                : 'border-[var(--border-color)] bg-[var(--bg-subtle)]'
                            }`}
                          >
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modo de Divisão: Igual, Por % ou Por Valor (R$) */}
        {selecionados.length > 0 && (
          <div className="mb-5 bg-[var(--bg-subtle)] p-4 rounded-2xl border border-[var(--border-color)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <label className="text-[var(--text-primary)] text-caption uppercase font-semibold">
                Como dividir a conta?
              </label>
              <div className="flex bg-[var(--bg-surface)] p-1 rounded-xl border border-[var(--border-color)] shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleModeSwitch('equal')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-caption font-semibold transition-colors active:scale-95 ${
                    splitMode === 'equal'
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Equal size={12} strokeWidth={2} /> Igual
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('percent')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-caption font-semibold transition-colors active:scale-95 ${
                    splitMode === 'percent'
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Percent size={12} strokeWidth={2} /> Por %
                </button>
                <button
                  type="button"
                  onClick={() => handleModeSwitch('amount')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-caption font-semibold transition-colors active:scale-95 ${
                    splitMode === 'amount'
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <DollarSign size={12} strokeWidth={2} /> Valor R$
                </button>
              </div>
            </div>

            {splitMode === 'equal' ? (
              <p className="text-caption text-[var(--text-secondary)]">
                Divisão igualitária entre{' '}
                <strong className="text-[var(--text-primary)]">{qtdTotalPessoas} pessoas</strong>:{' '}
                <strong className="text-[var(--primary)] tabular-nums">
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
                        className="flex items-center justify-between bg-[var(--bg-surface)] px-3 py-2.5 rounded-xl border border-[var(--border-color)] gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            style={{ backgroundColor: getAvatarColor(corAmigo) }}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-caption text-white font-bold shrink-0"
                          >
                            {nomeAmigo[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0 truncate">
                            <p className="text-caption font-semibold text-[var(--text-primary)] truncate">
                              {nomeAmigo}
                            </p>
                            <p className="text-caption text-[var(--text-secondary)] tabular-nums">
                              {splitMode === 'percent'
                                ? `R$ ${moneyConverter(valorCalculado)}`
                                : `${pctCalculada}%`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 bg-[var(--bg-subtle)] px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] focus-within:border-[var(--primary)] shrink-0">
                          {splitMode === 'amount' && (
                            <span className="text-caption text-[var(--text-secondary)] font-semibold">
                              R$
                            </span>
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
                            className="w-16 sm:w-20 bg-transparent text-right text-[var(--text-primary)] text-caption font-bold outline-none tabular-nums"
                          />
                          {splitMode === 'percent' && (
                            <span className="text-caption text-[var(--primary)] font-bold">%</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                {/* Linha Você */}
                <div className="flex items-center justify-between bg-[var(--bg-surface)] px-3 py-2.5 rounded-xl border border-[var(--primary)]/30 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-caption text-white font-bold shrink-0">
                      V
                    </div>
                    <div className="min-w-0 truncate">
                      <p className="text-caption font-semibold text-[var(--text-primary)] truncate">
                        Você (Sua parte)
                      </p>
                      <p className="text-caption text-[var(--text-secondary)] tabular-nums">
                        {splitMode === 'percent'
                          ? `R$ ${moneyConverter(selfAmountOwed)}`
                          : `${valorNumerico > 0 ? ((selfAmountOwed / valorNumerico) * 100).toFixed(1) : '0'}%`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[var(--bg-subtle)] px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] focus-within:border-[var(--primary)] shrink-0">
                    {splitMode === 'amount' && (
                      <span className="text-caption text-[var(--text-secondary)] font-semibold">
                        R$
                      </span>
                    )}
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={splitMode === 'percent' ? selfPercent : selfAmount}
                      onChange={(e) => {
                        setHasCustomEdits(true);
                        if (splitMode === 'percent') {
                          setSelfPercent(e.target.value.replace(',', '.'));
                        } else {
                          setSelfAmount(e.target.value.replace(',', '.'));
                        }
                      }}
                      className="w-16 sm:w-20 bg-transparent text-right text-[var(--text-primary)] text-caption font-bold outline-none tabular-nums"
                    />
                    {splitMode === 'percent' && (
                      <span className="text-caption text-[var(--primary)] font-bold">%</span>
                    )}
                  </div>
                </div>

                {/* Resumo da Soma e Botão Auxiliar */}
                <div className="flex flex-col gap-1.5 pt-2 px-1 border-t border-[var(--border-color)]">
                  <div className="flex justify-between items-center text-caption">
                    <span className="text-[var(--text-secondary)]">Soma da divisão:</span>
                    <span
                      className={`font-bold tabular-nums ${
                        (splitMode === 'percent' && Math.abs(somaPercentual - 100) <= 0.5) ||
                        (splitMode === 'amount' && Math.abs(somaTotal - valorNumerico) <= 0.1)
                          ? 'text-[#10B981]'
                          : 'text-[#F59E0B]'
                      }`}
                    >
                      R$ {moneyConverter(somaTotal)} ({somaPercentual}%)
                    </span>
                  </div>

                  {splitMode === 'percent' && Math.abs(somaPercentual - 100) > 0.5 && (
                    <div className="flex items-center justify-between text-caption bg-[var(--amber-bg)] px-3 py-2 rounded-xl border border-[var(--amber-border)]">
                      <span className="text-[#F59E0B] font-medium">
                        {somaPercentual < 100
                          ? `Falta fechar ${(100 - somaPercentual).toFixed(1)}%`
                          : `Passou ${(somaPercentual - 100).toFixed(1)}%`}
                      </span>
                      <button
                        type="button"
                        onClick={handleAjustarRestanteEmVoce}
                        className="text-caption text-[var(--primary)] hover:underline font-semibold active:scale-95"
                      >
                        Ajustar em Você
                      </button>
                    </div>
                  )}

                  {splitMode === 'amount' &&
                    Math.abs(somaTotal - valorNumerico) > 0.1 &&
                    valorNumerico > 0 && (
                      <div className="flex items-center justify-between text-caption bg-[var(--amber-bg)] px-3 py-2 rounded-xl border border-[var(--amber-border)]">
                        <span className="text-[#F59E0B] font-medium">
                          {somaTotal < valorNumerico
                            ? `Falta R$ ${moneyConverter(valorNumerico - somaTotal)}`
                            : `Passou R$ ${moneyConverter(somaTotal - valorNumerico)}`}
                        </span>
                        <button
                          type="button"
                          onClick={handleAjustarRestanteEmVoce}
                          className="text-caption text-[var(--primary)] hover:underline font-semibold active:scale-95"
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
            <label className="text-[var(--text-secondary)] text-caption uppercase font-semibold mb-1.5 flex items-center gap-1.5">
              <Wallet size={14} strokeWidth={2} className="text-[var(--primary)]" /> Quem pagou esta conta?
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => setPaidByFriendId('')}
                className={`px-3.5 py-2 rounded-xl text-caption font-semibold border transition-colors shrink-0 active:scale-95 ${
                  paidByFriendId === ''
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)]'
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
                      className={`px-3.5 py-2 rounded-xl text-caption font-semibold border transition-colors shrink-0 active:scale-95 ${
                        isPayer
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)]'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <span className="truncate max-w-[120px]">{nomeAmigo}</span>
                        {(amigo.has_account || amigo.is_registered) && (
                          <BadgeCheck
                            size={12}
                            strokeWidth={2}
                            className={isPayer ? 'text-white shrink-0' : 'text-[var(--primary)] shrink-0'}
                          />
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
          className="w-full ds-btn-primary"
        >
          {isSaving ? (
            <LoaderCircle className="animate-spin" size={20} strokeWidth={2} />
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

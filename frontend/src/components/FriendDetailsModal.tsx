import { createPortal } from 'react-dom';
// src/components/FriendDetailsModal.tsx
import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  Trash2,
  LoaderCircle,
  DollarSign,
  X,
  Pencil,
  QrCode,
  Phone,
  Upload,
  BadgeCheck,
} from 'lucide-react';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';
import { AddFriendModal } from './AddFriendModal';
import { PixModal } from './PixModal';
import { PayWithReceiptModal, ReceiptViewerModal } from './ReceiptModals';
import { RideCard } from './RideCard';
import { RideDetailsModal } from './RideDetailsModal';
import { generatePixCopiaECola } from '../utils/pixGenerator';
import { formatPhoneBR, openWhatsApp, phonesMatchBR, stripCountryCode } from '../utils/phoneFormatter';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { getAvatarColor } from '../utils/avatarColor';
import { applyBilateralNetting } from '../utils/netting';
import { getRideStatusForUser } from '../utils/rideStatus';
import type { CorridaNettingInfo } from '../utils/netting';
import type { Corrida, Amigo } from '../types';

function parseCurrency(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^\d,-]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

interface FriendDetailsProps {
  amigo: any;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  update?: () => void;
}

export function FriendDetailsModal({
  amigo,
  isOpen,
  onClose,
  onDelete,
  update,
}: FriendDetailsProps) {
  const [amigoAtual, setAmigoAtual] = useState<any>(amigo);
  const [corridasDoAmigo, setCorridasDoAmigo] = useState<any[]>([]);
  const [todasCorridas, setTodasCorridas] = useState<Corrida[]>([]);
  const [todosAmigos, setTodosAmigos] = useState<Amigo[]>([]);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [corridaSelecionada, setCorridaSelecionada] = useState<Corrida | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const nettingCache = useMemo(
    () => new Map<string, Map<string, CorridaNettingInfo>>(),
    [todasCorridas, todosAmigos]
  );

  // Modal de Registrar Recebimento (usado quando o amigo deve para Você — você é o lesado/credor)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Modal de Pagar com Comprovante (usado quando Você deve para o amigo — você é o devedor)
  const [payWithReceiptTarget, setPayWithReceiptTarget] = useState<{
    isOpen: boolean;
    mode: 'all' | 'single';
    corridaId?: string;
    participantFriendId?: string;
    amount: number;
    description: string;
  }>({
    isOpen: false,
    mode: 'all',
    amount: 0,
    description: '',
  });

  // Modal de Visualizar Comprovante
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

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [myConfig, setMyConfig] = useState<{ nome: string; pix: string }>({
    nome: 'Você',
    pix: '',
  });

  useModalBackHandler(isOpen, onClose);
  useModalBackHandler(isPaymentModalOpen, () => setIsPaymentModalOpen(false));

  useEffect(() => {
    if (amigo) {
      setAmigoAtual(amigo);
    }
  }, [amigo]);

  const carregarCorridas = async () => {
    const targetAmigo = amigo || amigoAtual;
    if (!targetAmigo?.id) return;
    setIsLoading(true);
    try {
      const [todasCorridasData, config, todosAmigosData, todosGrupos, sessionUser] = await Promise.all([
        dbService.corridas.getAll(),
        dbService.settings.get(),
        dbService.amigos.getAll(),
        dbService.grupos.getAll(),
        dbService.auth.getSessionUser(),
      ]);

      setTodasCorridas(todasCorridasData);
      setTodosAmigos(todosAmigosData);
      setMyAvatarUrl(sessionUser?.avatar_url || null);

      setMyConfig({
        nome: config.nome || config.name || 'Você',
        pix: (config.pix_key || config.pix || '').trim(),
      });

      const targetPhone = stripCountryCode(targetAmigo.telefone || targetAmigo.phone || '');
      const targetName = (targetAmigo.nome || targetAmigo.name || '').trim().toLowerCase();

      const atualizado =
        todosAmigosData.find((a) => a.id === targetAmigo.id) ||
        todosAmigosData.find((a) => {
          const aPhone = stripCountryCode(a.telefone || a.phone || '');
          if (targetPhone && aPhone && phonesMatchBR(targetPhone, aPhone)) return true;
          const aName = (a.nome || a.name || '').trim().toLowerCase();
          return targetName && aName && targetName === aName;
        }) ||
        targetAmigo;

      setAmigoAtual(atualizado);

      const effectivePhone = stripCountryCode(atualizado.telefone || atualizado.phone || targetPhone);
      const effectiveName = (atualizado.nome || atualizado.name || targetName).trim().toLowerCase();

      // Mapeia todos os IDs de amigos equivalentes (por ID direto, telefone ou nome)
      const matchingFriendIds = new Set<string>();
      if (atualizado.id) matchingFriendIds.add(atualizado.id);
      if (targetAmigo.id) matchingFriendIds.add(targetAmigo.id);

      todosAmigosData.forEach((a) => {
        const aPhone = stripCountryCode(a.telefone || a.phone || '');
        const aName = (a.nome || a.name || '').trim().toLowerCase();
        if (
          (effectivePhone && phonesMatchBR(aPhone, effectivePhone)) ||
          (effectiveName && aName && aName === effectiveName)
        ) {
          matchingFriendIds.add(a.id);
        }
      });

      const groupMap = new Map<string, string>();
      todosGrupos.forEach((g) => {
        groupMap.set(g.id, g.name);
      });

      // Determina se este amigo foi o pagador da corrida
      const checkIfFriendIsPayer = (c: any) => {
        if (!c.paidByFriendId) return false;
        if (matchingFriendIds.has(c.paidByFriendId)) return true;
        if (effectivePhone && c.payerPhone && phonesMatchBR(c.payerPhone, effectivePhone)) return true;
        if (effectiveName && c.paidByName && c.paidByName.trim().toLowerCase() === effectiveName) return true;
        return false;
      };

      // Determina se este amigo é participante da corrida
      const checkIfFriendIsParticipant = (c: any) => {
        return (c.participantesIds || []).some((pid: string) => {
          if (matchingFriendIds.has(pid)) return true;
          const f = todosAmigosData.find((a) => a.id === pid);
          if (f) {
            const fPhone = stripCountryCode(f.telefone || f.phone || '');
            const fName = (f.nome || f.name || '').trim().toLowerCase();
            if (effectivePhone && phonesMatchBR(fPhone, effectivePhone)) return true;
            if (effectiveName && fName && fName === effectiveName) return true;
          }
          return false;
        });
      };

      // Prioriza a chave Pix que o amigo cadastrou para si (caso exista em racha pago por ele)
      const rachaComPix = todasCorridasData.find(
        (c) => checkIfFriendIsPayer(c) && c.payerPixKey?.trim()
      );
      if (rachaComPix?.payerPixKey?.trim()) {
        atualizado.pix_key = rachaComPix.payerPixKey.trim();
        atualizado.registered_pix_key = rachaComPix.payerPixKey.trim();
        setAmigoAtual({ ...atualizado });
      }

      const nettingMap = applyBilateralNetting(todasCorridasData, atualizado, todosAmigosData);

      const corridasFormatadas = todasCorridasData
        .map((corrida) => {
          const amigoFoiPagador = checkIfFriendIsPayer(corrida);
          const amigoEhParticipante = checkIfFriendIsParticipant(corrida);

          // Se o amigo não foi pagador e nem participante, desconsidera
          if (!amigoFoiPagador && !amigoEhParticipante) return null;

          // Se outro amigo (terceiro) pagou a corrida, o acerto é entre eles
          if (corrida.paidByFriendId && !amigoFoiPagador) {
            return null;
          }

          const pid =
            corrida.participantesIds.find((id) => matchingFriendIds.has(id)) || atualizado.id;
          const qtdPessoas = (corrida.participantesIds?.length || 0) + 1;

          // Quando Você pagou e o amigo deve a parte dele:
          const parte =
            corrida.valoresDevidos?.[pid] !== undefined
              ? Number(corrida.valoresDevidos[pid])
              : corrida.valorTotal / qtdPessoas;
          const jaPago = Number(corrida.pagamentos?.[pid] || 0);

          // Quando o amigo pagou e Você deve sua parte para ele:
          const parteAmigosSoma = Object.values(corrida.valoresDevidos || {}).reduce(
            (acc, v) => acc + Number(v || 0),
            0
          );
          const suaParte =
            corrida.selfAmountOwed !== undefined &&
            corrida.selfAmountOwed !== null &&
            Number(corrida.selfAmountOwed) > 0
              ? Number(corrida.selfAmountOwed)
              : Math.abs(parteAmigosSoma - corrida.valorTotal) <= 0.1 || parteAmigosSoma >= corrida.valorTotal - 0.1
              ? 0
              : corrida.valorTotal / qtdPessoas;
          const seuJaPago = Number(corrida.selfAmountPaid || 0);

          const netting = nettingMap.get(corrida.id);

          const pendente = amigoFoiPagador
            ? 0
            : (netting ? netting.pendenteRestante : Math.max(0, Number((parte - jaPago).toFixed(2))));
          const voceDeve = amigoFoiPagador
            ? (netting ? netting.voceDeveRestante : Math.max(0, Number((suaParte - seuJaPago).toFixed(2))))
            : 0;

          const compensado = netting?.compensado || 0;
          const quitadaPorCompensacao = !!netting?.quitadaPorCompensacao;

          const valorExibicaoParte = amigoFoiPagador ? suaParte : parte;
          const pct =
            corrida.valorTotal > 0
              ? ((valorExibicaoParte / corrida.valorTotal) * 100).toFixed(1)
              : '0';

          const nomeGrupo =
            corrida.groupName || (corrida.groupId ? groupMap.get(corrida.groupId) : undefined);

          const receiptFromFriend =
            corrida.comprovantes?.[pid] ||
            Object.entries(corrida.comprovantes || {}).find(([k]) => matchingFriendIds.has(k))?.[1] ||
            null;
          const receiptUrl = amigoFoiPagador
            ? corrida.selfReceiptUrl || null
            : receiptFromFriend || null;

          return {
            id: corrida.id,
            rawCorrida: corrida,
            participantFriendId: amigoFoiPagador ? 'self' : pid,
            data: corrida.data,
            app: corrida.tag || 'Uber',
            titulo: corrida.titulo,
            groupId: corrida.groupId,
            groupName: nomeGrupo,
            precoTotal: moneyConverter(corrida.valorTotal),
            parteNumero: valorExibicaoParte,
            partePct: pct,
            parteAmigo: moneyConverter(valorExibicaoParte),
            pendente,
            pendenteFormatado: moneyConverter(pendente),
            voceDeve,
            voceDeveFormatado: moneyConverter(voceDeve),
            compensado,
            compensadoFormatado: moneyConverter(compensado),
            quitadaPorCompensacao,
            jaPago: amigoFoiPagador ? seuJaPago : jaPago,
            amigoFoiPagador,
            receiptUrl,
            payerPixKey: corrida.payerPixKey || null,
          };
        })
        .filter(Boolean) as any[];

      corridasFormatadas.sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
      );
      setCorridasDoAmigo(corridasFormatadas);
    } catch (error) {
      console.error('Erro ao carregar corridas do amigo:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && amigo?.id) {
      carregarCorridas();
    }
  }, [isOpen, amigo?.id]);

  const baseAmigo = amigoAtual || amigo;
  if (!isOpen || !baseAmigo) return null;

  const nome = baseAmigo.nome || baseAmigo.name || 'Amigo';
  const cor = baseAmigo.cor || baseAmigo.color || 'bg-sky-500';
  const telefone = baseAmigo.telefone || baseAmigo.phone || '';

  // Prioriza a chave Pix que o próprio amigo cadastrou para si (vinda da conta dele ou do pagador do racha)
  let friendPix = (baseAmigo.registered_pix_key || '').trim();
  if (!friendPix) {
    for (const c of corridasDoAmigo) {
      if (c.amigoFoiPagador && c.payerPixKey?.trim()) {
        friendPix = c.payerPixKey.trim();
        break;
      }
    }
  }
  if (!friendPix) {
    friendPix = (baseAmigo.pix_key || baseAmigo.pix || '').trim();
  }

  // Saldos consolidados das corridas e do perfil do amigo
  const rawVoceDeveFromAmigo = parseCurrency(
    baseAmigo?.voceDeveNumerico ??
    baseAmigo?.voceDeve ??
    amigo?.voceDeveNumerico ??
    amigo?.voceDeve
  );
  const rawDividaFromAmigo = parseCurrency(
    baseAmigo?.dividaNumerica ??
    baseAmigo?.divida ??
    amigo?.dividaNumerica ??
    amigo?.divida
  );

  const totalEleDeveFromCorridas = corridasDoAmigo.reduce((acc, curr) => acc + (curr.pendente || 0), 0);
  const totalVoceDeveFromCorridas = corridasDoAmigo.reduce((acc, curr) => acc + (curr.voceDeve || 0), 0);

  const totalEleDeve = corridasDoAmigo.length > 0 ? totalEleDeveFromCorridas : rawDividaFromAmigo;
  const totalVoceDeve = corridasDoAmigo.length > 0 ? totalVoceDeveFromCorridas : rawVoceDeveFromAmigo;

  const voceDeveNoSaldo = totalVoceDeve > totalEleDeve + 0.005;
  const eleDeveNoSaldo = totalEleDeve > totalVoceDeve + 0.005;
  const valorDestaque = voceDeveNoSaldo
    ? Number((totalVoceDeve - totalEleDeve).toFixed(2))
    : eleDeveNoSaldo
    ? Number((totalEleDeve - totalVoceDeve).toFixed(2))
    : 0;

  const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const apenasNumeros = e.target.value.replace(/\D/g, '');
    if (apenasNumeros === '') {
      setPaymentAmount('');
      return;
    }
    const valorEmCentavos = Number(apenasNumeros) / 100;
    const valorFormatado = valorEmCentavos.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setPaymentAmount(valorFormatado);
  };

  const handleConfirmCreditorPayment = async () => {
    const valor = parseFloat(paymentAmount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      alert('Digite um valor válido.');
      return;
    }

    setIsProcessingPayment(true);
    try {
      await dbService.financeiro.registrarPagamento(baseAmigo.id, valor, undefined, null, 'from_friend');
      setPaymentAmount('');
      setIsPaymentModalOpen(false);
      await carregarCorridas();
      if (update) update();
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleConfirmPayWithReceipt = async (amount: number, receiptBase64: string) => {
    if (payWithReceiptTarget.mode === 'single' && payWithReceiptTarget.corridaId) {
      const targetRide = corridasDoAmigo.find((c) => c.id === payWithReceiptTarget.corridaId);
      const jaPago = Number(targetRide?.jaPago || 0);
      const parteTotal = Number(targetRide?.parteNumero || amount);
      const novoTotalPago = Math.min(parteTotal, Number((jaPago + amount).toFixed(2)));
      await dbService.financeiro.definirPagamentoParticipante(
        payWithReceiptTarget.corridaId,
        payWithReceiptTarget.participantFriendId || 'self',
        novoTotalPago > 0 ? novoTotalPago : amount,
        receiptBase64
      );
    } else {
      await dbService.financeiro.registrarPagamento(
        baseAmigo.id,
        amount,
        undefined,
        receiptBase64,
        'to_friend'
      );
    }
    await carregarCorridas();
    if (update) update();
  };

  const formatarDataCurta = (dataIso: string) => {
    if (!dataIso) return '';
    const partes = dataIso.split('-');
    if (partes.length !== 3) return dataIso;
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
  };

  const montarMensagemCobranca = (configOverride?: { nome: string; pix: string }) => {
    const cfg = configOverride || myConfig;
    const pix = (cfg.pix || '').trim();
    const pendentesTexto = corridasDoAmigo
      .filter((c) => c.pendente > 0.005 || c.voceDeve > 0.005)
      .map((c) => {
        const tagGrupo = c.groupName ? ` [Grupo: ${c.groupName}]` : '';
        if (c.amigoFoiPagador) {
          return `• ${formatarDataCurta(c.data)} - ${c.app} (${c.titulo})${tagGrupo}: R$ ${c.voceDeveFormatado} (você pagou)`;
        }
        return `• ${formatarDataCurta(c.data)} - ${c.app} (${c.titulo})${tagGrupo}: R$ ${c.pendenteFormatado}`;
      })
      .join('\n');

    const totalFmt = moneyConverter(valorDestaque);
    const copiaECola = pix
      ? generatePixCopiaECola({
          pixKey: pix,
          merchantName: cfg.nome || 'Voce',
          amount: valorDestaque > 0 ? valorDestaque : undefined,
          description: `RachApp ${nome}`,
        })
      : '';

    return (
      `Fala ${nome.split(' ')[0]}! Segue o resumo dos nossos rachas pelo RachApp:\n\n` +
      `${pendentesTexto || 'Sem pendências detalhadas'}\n\n` +
      `*Total Pendente: R$ ${totalFmt}*\n` +
      `*Minha Chave Pix:* ${pix || 'Não informada no perfil'}` +
      (copiaECola ? `\n\n*Pix Copia e Cola:*\n${copiaECola}` : '') +
      `\n\nValeu!`
    );
  };

  const handleCobrarWhatsApp = async () => {
    const fresh = await dbService.settings.get();
    const cfg = {
      nome: fresh.nome || fresh.name || myConfig.nome || 'Você',
      pix: (fresh.pix_key || fresh.pix || myConfig.pix || '').trim(),
    };
    setMyConfig(cfg);

    const mensagem = montarMensagemCobranca(cfg);
    openWhatsApp(telefone, mensagem);
  };

  const handleOpenPixModal = async () => {
    const fresh = await dbService.settings.get();
    const cfg = {
      nome: fresh.nome || fresh.name || myConfig.nome || 'Você',
      pix: (fresh.pix_key || fresh.pix || myConfig.pix || '').trim(),
    };
    setMyConfig(cfg);
    setIsPixModalOpen(true);
  };

  if (!isOpen || !baseAmigo) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0f19] w-full max-w-md rounded-t-[28px] sm:rounded-3xl border-t sm:border border-white/10 shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] pb-safe overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho com Editar e Excluir */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-white/10 bg-[#0b0f19]/95 backdrop-blur-md shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-white hover:bg-gray-800 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-sm sm:text-base font-semibold text-white truncate px-2">Detalhes do Amigo</h2>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="p-1.5 sm:p-2 text-gray-300 hover:bg-white/10 hover:text-white rounded-full transition-colors"
              title="Editar Amigo"
            >
              <Pencil size={17} />
            </button>
            <button
              onClick={() => onDelete(baseAmigo.id)}
              className="p-1.5 sm:p-2 text-red-500 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors"
              title="Excluir Amigo"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-5 sm:py-5 overflow-y-auto flex-1">
          {/* Resumo do Perfil */}
          <div className="flex flex-col items-center mb-6">
            <div
              style={
                baseAmigo.avatar_url ? undefined : { backgroundColor: getAvatarColor(cor) }
              }
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-3xl font-black text-white shadow-lg mb-3"
            >
              {baseAmigo.avatar_url ? (
                <img
                  src={baseAmigo.avatar_url}
                  alt={nome}
                  className="w-full h-full object-cover"
                />
              ) : (
                nome[0]?.toUpperCase()
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xl font-bold text-white">{nome}</h3>
              {(amigoAtual?.has_account || amigoAtual?.is_registered) && (
                <BadgeCheck size={20} className="text-[#2DD4BF] fill-[#2DD4BF]/20 shrink-0" />
              )}
            </div>
            {(amigoAtual?.has_account || amigoAtual?.is_registered) && (
              <span className="text-[11px] font-semibold text-[#2DD4BF] bg-[#2DD4BF]/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 mt-1 mb-0.5">
                <BadgeCheck size={12} /> Conta RachApp Ativa
              </span>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 mt-1.5">
              {telefone && (
                <span className="text-xs text-gray-400 bg-white/5 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Phone size={11} /> {formatPhoneBR(telefone)}
                </span>
              )}
              {friendPix && (
                <span className="text-xs text-[#2DD4BF] bg-[#2DD4BF]/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <QrCode size={11} /> Pix: {friendPix}
                </span>
              )}
            </div>

            <div
              className={`text-4xl font-black mt-4 mb-1 ${
                voceDeveNoSaldo ? 'text-red-400' : eleDeveNoSaldo ? 'text-amber-400' : 'text-[#2DD4BF]'
              }`}
            >
              R$ {moneyConverter(valorDestaque)}
            </div>
            <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-4">
              {voceDeveNoSaldo
                ? `Você deve para ${nome.split(' ')[0]}`
                : eleDeveNoSaldo
                ? `${nome.split(' ')[0]} te deve`
                : 'Tudo em dia'}
            </p>

            {/* Quando VOCÊ DEVE ao amigo: aparece SOMENTE a opção de pagar ele (mediante comprovante) */}
            {voceDeveNoSaldo ? (
              <button
                onClick={() =>
                  setPayWithReceiptTarget({
                    isOpen: true,
                    mode: 'all',
                    amount: valorDestaque,
                    description: `Acerto RachApp ${nome}`,
                  })
                }
                className="w-full bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] py-3.5 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-teal-500/20 text-sm"
              >
                <Upload size={18} />
                Pagar {nome.split(' ')[0]} (R$ {moneyConverter(valorDestaque)})
              </button>
            ) : (
              <>
                {/* Quando o amigo te deve (você é o lesado): pode registrar que ele pagou e cobrar via WhatsApp / QR Pix */}
                {valorDestaque > 0.005 && (
                  <button
                    onClick={() => {
                      setPaymentAmount(moneyConverter(valorDestaque));
                      setIsPaymentModalOpen(true);
                    }}
                    className="bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] px-6 py-2.5 rounded-full font-bold flex items-center gap-2 transition-colors shadow-lg shadow-teal-500/20 mb-4"
                  >
                    <DollarSign size={18} /> Informar que {nome.split(' ')[0]} Pagou
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full">
                  <button
                    onClick={handleCobrarWhatsApp}
                    className="bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-2.5 sm:py-3 px-2 sm:px-4 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95 truncate"
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
                    <span className="truncate">WhatsApp</span>
                  </button>

                  <button
                    onClick={handleOpenPixModal}
                    className="bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-[#2DD4BF]/40 text-[#2DD4BF] font-bold py-2.5 sm:py-3 px-2 sm:px-4 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95 truncate"
                  >
                    <QrCode size={16} className="shrink-0" />
                    <span className="truncate">QR Code Pix</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-between items-center mb-3">
            <h4 className="text-white font-bold text-base">Rachas Compartilhados</h4>
            <span className="text-xs text-gray-500 font-medium">{corridasDoAmigo.length} itens</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoaderCircle className="animate-spin text-[#2DD4BF]" />
            </div>
          ) : corridasDoAmigo.length === 0 ? (
            <div className="bg-[#1c1c1e] p-6 rounded-2xl border border-white/5 text-center mb-4">
              {voceDeveNoSaldo ? (
                <>
                  <p className="text-red-400 font-bold text-sm mb-1">
                    Você possui uma pendência de R$ {moneyConverter(valorDestaque)} com {nome.split(' ')[0]}.
                  </p>
                  <p className="text-gray-400 text-xs">
                    Toque no botão "Pagar {nome.split(' ')[0]}" acima para anexar o comprovante Pix e liquidar este saldo.
                  </p>
                </>
              ) : (
                <p className="text-gray-400 text-sm">
                  Você ainda não dividiu nenhum racha com {nome.split(' ')[0]}.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {corridasDoAmigo.map((corridaItem) => {
                const corridaCompleta: Corrida =
                  corridaItem.rawCorrida ||
                  todasCorridas.find((c) => c.id === corridaItem.id) || {
                    id: corridaItem.id,
                    titulo: corridaItem.titulo,
                    valorTotal: parseCurrency(corridaItem.precoTotal),
                    data: corridaItem.data,
                    tag: corridaItem.app,
                    participantesIds: [],
                  };

                const userStatus = getRideStatusForUser(
                  corridaCompleta,
                  todasCorridas,
                  todosAmigos,
                  nettingCache
                );

                const corridaParticipantes = [
                  { id: 0, nome: 'Você', cor: '#2DD4BF', avatar_url: myAvatarUrl },
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

                return (
                  <RideCard
                    key={corridaItem.id}
                    data={corridaCompleta.data}
                    tag={corridaCompleta.tag}
                    titulo={corridaCompleta.titulo}
                    valorTotal={moneyConverter(corridaCompleta.valorTotal)}
                    userStatus={userStatus}
                    participantes={corridaParticipantes}
                    onClick={() => setCorridaSelecionada(corridaCompleta)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sub-modal de Recebimento pelo Credor (quando o amigo deve para Você) */}
      {isPaymentModalOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[65] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsPaymentModalOpen(false)}
        >
          <div
            className="bg-[#1c1c1e] w-full max-w-sm rounded-3xl p-6 border border-white/10 animate-slide-up shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-lg">Confirmar Recebimento</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              Informe o valor que {nome.split(' ')[0]} te pagou para abater nos rachas pendentes.
            </p>

            <div className="relative mb-6">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                R$
              </span>
              <input
                type="tel"
                placeholder="0,00"
                value={paymentAmount}
                onChange={handlePaymentAmountChange}
                className="w-full bg-[#05080f] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white text-xl font-bold focus:outline-none focus:border-[#2DD4BF] transition-colors"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 bg-transparent border border-white/10 text-white font-bold py-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmCreditorPayment}
                disabled={isProcessingPayment || !paymentAmount}
                className="flex-1 bg-[#2DD4BF] text-[#05080f] font-bold py-3 rounded-xl hover:bg-[#25b5a3] transition-colors disabled:opacity-50 flex justify-center items-center"
              >
                {isProcessingPayment ? (
                  <LoaderCircle className="animate-spin" size={20} />
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pagamento com Comprovante Obrigatório (quando Você deve ao amigo) */}
      <PayWithReceiptModal
        isOpen={payWithReceiptTarget.isOpen}
        onClose={() => setPayWithReceiptTarget((prev) => ({ ...prev, isOpen: false }))}
        recipientName={nome}
        pixKey={friendPix}
        defaultAmount={payWithReceiptTarget.amount}
        allowCustomAmount={true}
        description={payWithReceiptTarget.description}
        onConfirm={handleConfirmPayWithReceipt}
      />

      {/* Modal de Visualização de Comprovante */}
      <ReceiptViewerModal
        isOpen={receiptToView.isOpen}
        onClose={() => setReceiptToView({ isOpen: false, url: null, title: '', initialIndex: 0 })}
        receiptUrl={receiptToView.url}
        title={receiptToView.title}
        initialIndex={receiptToView.initialIndex}
      />

      {/* Modal de Editar Amigo */}
      <AddFriendModal
        isOpen={isEditModalOpen}
        friendToEdit={baseAmigo}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(updatedFriend) => {
          if (updatedFriend) setAmigoAtual({ ...baseAmigo, ...updatedFriend });
          carregarCorridas();
          if (update) update();
        }}
      />

      {/* Modal de Pix QR Code e Copia e Cola (quando o amigo te deve) */}
      <PixModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        pixKey={myConfig.pix}
        recipientName={myConfig.nome}
        amount={valorDestaque}
        description={`RachApp ${nome}`}
        whatsappPhone={telefone}
        whatsappCustomMessage={montarMensagemCobranca()}
      />

      {/* Modal Detalhes do Racha */}
      <RideDetailsModal
        isOpen={!!corridaSelecionada}
        ride={corridaSelecionada || undefined}
        participantes={todosAmigos.filter((a) =>
          corridaSelecionada?.participantesIds?.includes(a.id)
        )}
        onClose={() => setCorridaSelecionada(null)}
        onDelete={async (id) => {
          await dbService.corridas.delete(id);
          setCorridaSelecionada(null);
          await carregarCorridas();
          if (update) update();
        }}
        onUpdated={async () => {
          await carregarCorridas();
          if (update) update();
        }}
      />
    </div>,
    document.body
  );
}

// src/utils/netting.ts
import { stripCountryCode, phonesMatchBR } from './phoneFormatter';

export interface CorridaNettingInfo {
  id: string;
  compensado: number;
  pendenteRestante: number;
  voceDeveRestante: number;
  isQuitada: boolean;
  quitadaPorCompensacao: boolean;
}

/**
 * Aplica compensação bilateral cronológica (FIFO) entre "Você" e um amigo específico.
 *
 * Exemplo:
 * - Racha 1: Você pagou, Amigo deve R$ 10.
 * - Racha 2: Amigo pagou, Você deve R$ 20.
 *
 * Resultado do Netting:
 * - Racha 1: R$ 10 compensados com Racha 2 -> Saldo pendente: R$ 0,00 (Quitado por compensação).
 * - Racha 2: R$ 10 compensados com Racha 1 -> Restante que Você deve: R$ 10,00.
 * - Saldo total: Você deve R$ 10,00 ao amigo.
 *
 * Se Racha 2 for excluído, a dívida de R$ 10 do Racha 1 volta automaticamente!
 */
export function applyBilateralNetting(
  corridas: any[],
  targetFriend: {
    id?: string;
    phone?: string;
    telefone?: string;
    name?: string;
    nome?: string;
  },
  allFriends: any[] = []
): Map<string, CorridaNettingInfo> {
  const result = new Map<string, CorridaNettingInfo>();
  if (!corridas || corridas.length === 0) return result;

  const targetPhone = stripCountryCode(targetFriend.telefone || targetFriend.phone || '');
  const targetName = (targetFriend.nome || targetFriend.name || '').trim().toLowerCase();

  // Mapeia todos os IDs conhecidos deste amigo
  const matchingFriendIds = new Set<string>();
  if (targetFriend.id) matchingFriendIds.add(targetFriend.id);

  allFriends.forEach((f) => {
    const fPhone = stripCountryCode(f.telefone || f.phone || '');
    const fName = (f.nome || f.name || '').trim().toLowerCase();
    if (
      (targetPhone && fPhone && phonesMatchBR(fPhone, targetPhone)) ||
      (targetName && fName && fName === targetName)
    ) {
      matchingFriendIds.add(f.id);
    }
  });

  const isFriendPayer = (c: any) => {
    if (!c.paidByFriendId) return false;
    if (matchingFriendIds.has(c.paidByFriendId)) return true;
    if (targetPhone && c.payerPhone && phonesMatchBR(c.payerPhone, targetPhone)) return true;
    if (targetName && c.paidByName && c.paidByName.trim().toLowerCase() === targetName) return true;
    return false;
  };

  const isFriendParticipant = (c: any) => {
    return (c.participantesIds || []).some((pid: string) => {
      if (matchingFriendIds.has(pid)) return true;
      const f = allFriends.find((a) => a.id === pid);
      if (f) {
        const fPhone = stripCountryCode(f.telefone || f.phone || '');
        const fName = (f.nome || f.name || '').trim().toLowerCase();
        if (targetPhone && phonesMatchBR(fPhone, targetPhone)) return true;
        if (targetName && fName && fName === targetName) return true;
      }
      return false;
    });
  };

  // Filtra as corridas que envolvem este amigo e ordena cronologicamente (ASC)
  const cronologicas = [...corridas]
    .filter((c) => {
      const amigoPagou = isFriendPayer(c);
      const amigoParticipou = isFriendParticipant(c);
      if (!amigoPagou && !amigoParticipou) return false;
      // Se um terceiro pagou, o acerto direto é com esse terceiro
      if (c.paidByFriendId && !amigoPagou) return false;
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.data || a.expense_date || 0).getTime();
      const timeB = new Date(b.data || b.expense_date || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

  // Fila de pendências
  interface QueueItem {
    corridaId: string;
    valorRestante: number;
    compensado: number;
    jaPagoDireto: number;
    valorTotalOriginal: number;
  }

  const filaAmigoDevendo: QueueItem[] = [];
  const filaVoceDevendo: QueueItem[] = [];

  for (const c of cronologicas) {
    const amigoPagou = isFriendPayer(c);
    const qtdPessoas = (c.participantesIds?.length || 0) + 1;

    if (!amigoPagou) {
      // Você pagou, o amigo é participante
      const pid =
        (c.participantesIds || []).find((id: string) => matchingFriendIds.has(id)) || targetFriend.id;
      const parteAmigo =
        c.valoresDevidos?.[pid] !== undefined
          ? Number(c.valoresDevidos[pid])
          : Number(c.valorTotal || 0) / qtdPessoas;
      const jaPagoAmigo = Number(c.pagamentos?.[pid] || 0);
      const debitoAmigo = Math.max(0, Number((parteAmigo - jaPagoAmigo).toFixed(2)));

      filaAmigoDevendo.push({
        corridaId: c.id,
        valorRestante: debitoAmigo,
        compensado: 0,
        jaPagoDireto: jaPagoAmigo,
        valorTotalOriginal: parteAmigo,
      });
    } else {
      // O amigo pagou, Você deve sua parte a ele
      const parteAmigosSoma = Object.values(c.valoresDevidos || {}).reduce(
        (acc: number, v: any) => acc + Number(v || 0),
        0
      );
      const suaParte =
        c.selfAmountOwed !== undefined && c.selfAmountOwed !== null && Number(c.selfAmountOwed) > 0
          ? Number(c.selfAmountOwed)
          : Math.abs(parteAmigosSoma - Number(c.valorTotal || 0)) <= 0.1 ||
            parteAmigosSoma >= Number(c.valorTotal || 0) - 0.1
          ? 0
          : Number(c.valorTotal || 0) / qtdPessoas;
      const seuJaPago = Number(c.selfAmountPaid || 0);
      const debitoVoce = Math.max(0, Number((suaParte - seuJaPago).toFixed(2)));

      filaVoceDevendo.push({
        corridaId: c.id,
        valorRestante: debitoVoce,
        compensado: 0,
        jaPagoDireto: seuJaPago,
        valorTotalOriginal: suaParte,
      });
    }
  }

  // Cruzamento FIFO (Netting Bilateral)
  let idxA = 0;
  let idxV = 0;

  while (idxA < filaAmigoDevendo.length && idxV < filaVoceDevendo.length) {
    const itemA = filaAmigoDevendo[idxA];
    const itemV = filaVoceDevendo[idxV];

    if (itemA.valorRestante <= 0.005) {
      idxA++;
      continue;
    }
    if (itemV.valorRestante <= 0.005) {
      idxV++;
      continue;
    }

    const compensar = Math.min(itemA.valorRestante, itemV.valorRestante);
    if (compensar > 0.005) {
      itemA.valorRestante = Number((itemA.valorRestante - compensar).toFixed(2));
      itemA.compensado = Number((itemA.compensado + compensar).toFixed(2));

      itemV.valorRestante = Number((itemV.valorRestante - compensar).toFixed(2));
      itemV.compensado = Number((itemV.compensado + compensar).toFixed(2));
    }

    if (itemA.valorRestante <= 0.005) idxA++;
    if (itemV.valorRestante <= 0.005) idxV++;
  }

  // Mapeia os resultados para cada corrida
  for (const itemA of filaAmigoDevendo) {
    const pendenteRestante = Math.max(0, itemA.valorRestante);
    const isQuitada = pendenteRestante <= 0.005;
    const quitadaPorCompensacao = isQuitada && itemA.compensado > 0.005 && itemA.jaPagoDireto < itemA.valorTotalOriginal - 0.005;

    result.set(itemA.corridaId, {
      id: itemA.corridaId,
      compensado: itemA.compensado,
      pendenteRestante,
      voceDeveRestante: 0,
      isQuitada,
      quitadaPorCompensacao,
    });
  }

  for (const itemV of filaVoceDevendo) {
    const voceDeveRestante = Math.max(0, itemV.valorRestante);
    const isQuitada = voceDeveRestante <= 0.005;
    const quitadaPorCompensacao = isQuitada && itemV.compensado > 0.005 && itemV.jaPagoDireto < itemV.valorTotalOriginal - 0.005;

    result.set(itemV.corridaId, {
      id: itemV.corridaId,
      compensado: itemV.compensado,
      pendenteRestante: 0,
      voceDeveRestante,
      isQuitada,
      quitadaPorCompensacao,
    });
  }

  return result;
}

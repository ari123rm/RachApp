// src/utils/rideStatus.ts
import type { Amigo, Corrida } from '../types';
import { applyBilateralNetting, type CorridaNettingInfo } from './netting';

export interface RideUserStatus {
  status: 'pagante' | 'quitado' | 'pendente';
  /** Quanto o usuário ainda deve neste racha (quando status === 'pendente') */
  amountYouOwe: number;
  /** Quanto ainda devem ao usuário no total neste racha (quando status === 'pagante') */
  amountOwedToYou: number;
  /** Valor da parte do usuário neste racha */
  myShare: number;
}

function getNettingForFriend(
  friendId: string,
  allCorridas: Corrida[],
  allAmigos: Amigo[],
  fallbackMeta?: { phone?: string | null; name?: string | null },
  cache?: Map<string, Map<string, CorridaNettingInfo>>
): Map<string, CorridaNettingInfo> {
  if (cache && cache.has(friendId)) {
    return cache.get(friendId)!;
  }
  const friendObj = allAmigos.find((f) => f.id === friendId) || {
    id: friendId,
    phone: fallbackMeta?.phone || '',
    name: fallbackMeta?.name || '',
  };
  const map = applyBilateralNetting(allCorridas, friendObj, allAmigos);
  if (cache) {
    cache.set(friendId, map);
  }
  return map;
}

/**
 * Calcula o status do racha para o usuário logado ("Você"):
 * - 'pagante': Você pagou o racha (calcula também quanto ainda te devem no total neste racha)
 * - 'quitado': Outro participante pagou, mas sua parte já foi quitada/compensada
 * - 'pendente': Outro participante pagou e você ainda deve sua parte (ou o restante dela)
 */
export function getRideStatusForUser(
  corrida: Corrida,
  allCorridas: Corrida[],
  allAmigos: Amigo[],
  cache?: Map<string, Map<string, CorridaNettingInfo>>
): RideUserStatus {
  const valorTotal = Number(corrida.valorTotal ?? corrida.total_amount ?? 0);
  const participantesIds = corrida.participantesIds || [];
  const totalPessoas = participantesIds.length + 1;
  const valorDivididoPadrao = totalPessoas > 0 ? valorTotal / totalPessoas : valorTotal;

  const somaPartesAmigos = Object.values(corrida.valoresDevidos || {}).reduce(
    (acc, v) => acc + Number(v || 0),
    0
  );

  const minhaParte =
    corrida.selfAmountOwed !== undefined &&
    corrida.selfAmountOwed !== null &&
    Number(corrida.selfAmountOwed) > 0
      ? Number(corrida.selfAmountOwed)
      : Math.abs(somaPartesAmigos - valorTotal) <= 0.1 || somaPartesAmigos >= valorTotal - 0.1
      ? 0
      : valorDivididoPadrao;

  const meuValorPago = Number(corrida.selfAmountPaid || 0);
  const voceEhPagante = !corrida.paidByFriendId;

  if (voceEhPagante) {
    let totalTeDevem = 0;

    for (const pid of participantesIds) {
      const parteAmigo =
        corrida.valoresDevidos && corrida.valoresDevidos[pid] !== undefined
          ? Number(corrida.valoresDevidos[pid])
          : valorDivididoPadrao;
      const pagoDiretoAmigo = Number(corrida.pagamentos?.[pid] || 0);

      const netMap = getNettingForFriend(pid, allCorridas, allAmigos, undefined, cache);
      const netInfo = netMap.get(corrida.id);
      const pendenteAmigo = netInfo
        ? Number(netInfo.pendenteRestante || 0)
        : Math.max(0, Number((parteAmigo - pagoDiretoAmigo).toFixed(2)));

      if (pendenteAmigo > 0.005) {
        totalTeDevem += pendenteAmigo;
      }
    }

    return {
      status: 'pagante',
      amountYouOwe: 0,
      amountOwedToYou: Number(totalTeDevem.toFixed(2)),
      myShare: Number(minhaParte.toFixed(2)),
    };
  }

  const netMap = getNettingForFriend(
    corrida.paidByFriendId!,
    allCorridas,
    allAmigos,
    { phone: corrida.payerPhone, name: corrida.paidByName },
    cache
  );
  const selfNetting = netMap.get(corrida.id);
  const faltaPagar = selfNetting
    ? Number(selfNetting.voceDeveRestante || 0)
    : Math.max(0, Number((minhaParte - meuValorPago).toFixed(2)));

  const isQuitado =
    faltaPagar <= 0.01 ||
    meuValorPago >= minhaParte - 0.01 ||
    Boolean(selfNetting?.isQuitada);

  if (isQuitado) {
    return {
      status: 'quitado',
      amountYouOwe: 0,
      amountOwedToYou: 0,
      myShare: Number(minhaParte.toFixed(2)),
    };
  }

  return {
    status: 'pendente',
    amountYouOwe: Number(faltaPagar.toFixed(2)),
    amountOwedToYou: 0,
    myShare: Number(minhaParte.toFixed(2)),
  };
}

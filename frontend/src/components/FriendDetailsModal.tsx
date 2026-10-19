// src/components/FriendDetailsModal.tsx
import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Banknote,
  Trash2,
  LoaderCircle,
  DollarSign,
  X,
  Undo2,
  Pencil,
  QrCode,
  Check,
  Phone,
  UsersRound,
} from 'lucide-react';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';
import { AddFriendModal } from './AddFriendModal';
import { PixModal } from './PixModal';
import { generatePixCopiaECola } from '../utils/pixGenerator';
import { formatPhoneBR, stripCountryCode, toWhatsAppNumber } from '../utils/phoneFormatter';

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
  const [isLoading, setIsLoading] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [myConfig, setMyConfig] = useState<{ nome: string; pix: string }>({
    nome: 'Você',
    pix: '',
  });

  useEffect(() => {
    setAmigoAtual(amigo);
  }, [amigo]);

  const carregarCorridas = async () => {
    if (!amigoAtual?.id) return;
    setIsLoading(true);
    try {
      const [todasCorridas, config, todosAmigos, todosGrupos] = await Promise.all([
        dbService.corridas.getAll(),
        dbService.settings.get(),
        dbService.amigos.getAll(),
        dbService.grupos.getAll(),
      ]);

      setMyConfig({
        nome: config.nome || config.name || 'Você',
        pix: (config.pix_key || config.pix || '').trim(),
      });

      const atualizado = todosAmigos.find((a) => a.id === amigoAtual.id) || amigoAtual;
      setAmigoAtual(atualizado);

      const targetPhone = stripCountryCode(atualizado.telefone || atualizado.phone || '');
      const targetName = (atualizado.nome || atualizado.name || '').trim().toLowerCase();

      // Descobre todos os IDs equivalentes a este amigo (por ID direto, telefone ou nome)
      const matchingFriendIds = new Set<string>([atualizado.id]);
      todosAmigos.forEach((a) => {
        const aPhone = stripCountryCode(a.telefone || a.phone || '');
        const aName = (a.nome || a.name || '').trim().toLowerCase();
        if ((targetPhone && aPhone === targetPhone) || (targetName && aName === targetName)) {
          matchingFriendIds.add(a.id);
        }
      });

      // Também verifica grupos onde esse amigo participa
      const groupMap = new Map<string, string>();
      todosGrupos.forEach((g) => {
        groupMap.set(g.id, g.name);
      });

      const compartilhadas = todasCorridas.filter((c) =>
        c.participantesIds.some((pid) => matchingFriendIds.has(pid))
      );

      const corridasFormatadas = compartilhadas
        .map((corrida) => {
          const pid =
            corrida.participantesIds.find((id) => matchingFriendIds.has(id)) || atualizado.id;
          const qtdPessoas = corrida.participantesIds.length + 1;
          const parte =
            corrida.valoresDevidos?.[pid] !== undefined
              ? Number(corrida.valoresDevidos[pid])
              : corrida.valorTotal / qtdPessoas;
          const jaPago = Number(corrida.pagamentos?.[pid] || 0);

          // Se outro amigo pagou a corrida (não foi Você), o amigo atual deve para aquele pagador, não para Você
          if (corrida.paidByFriendId && !matchingFriendIds.has(corrida.paidByFriendId)) {
            return null;
          }

          // Se o próprio amigo pagou a corrida no grupo, ele não deve nessa corrida
          const amigoFoiPagador =
            !!corrida.paidByFriendId && matchingFriendIds.has(corrida.paidByFriendId);
          const pendente = amigoFoiPagador
            ? 0
            : Math.max(0, Number((parte - jaPago).toFixed(2)));
          const pct =
            corrida.valorTotal > 0 ? ((parte / corrida.valorTotal) * 100).toFixed(1) : '0';

          const nomeGrupo =
            corrida.groupName || (corrida.groupId ? groupMap.get(corrida.groupId) : undefined);

          return {
            id: corrida.id,
            participantFriendId: pid,
            data: corrida.data,
            app: corrida.tag || 'Uber',
            titulo: corrida.titulo,
            groupId: corrida.groupId,
            groupName: nomeGrupo,
            precoTotal: moneyConverter(corrida.valorTotal),
            parteNumero: parte,
            partePct: pct,
            parteAmigo: moneyConverter(parte),
            pendente,
            pendenteFormatado: moneyConverter(pendente),
            jaPago,
            amigoFoiPagador,
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

  if (!isOpen || !amigoAtual) return null;

  const nome = amigoAtual.nome || amigoAtual.name || 'Amigo';
  const cor = amigoAtual.cor || amigoAtual.color || 'bg-sky-500';
  const telefone = amigoAtual.telefone || amigoAtual.phone || '';
  const friendPix = amigoAtual.pix_key || amigoAtual.pix || '';

  const dividaAtual = corridasDoAmigo.reduce((acc, curr) => acc + curr.pendente, 0);

  const handleUndoPayment = async (corridaId: string, participantId?: string) => {
    if (
      window.confirm(
        'Deseja desfazer o pagamento deste racha? O valor voltará para a dívida pendente.'
      )
    ) {
      setIsLoading(true);
      try {
        await dbService.financeiro.desfazerPagamentoDaCorrida(
          corridaId,
          participantId || amigoAtual.id
        );
        await carregarCorridas();
        if (update) update();
      } catch (error) {
        console.error('Erro ao desfazer pagamento:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleQuitarCorridaUnica = async (
    corridaId: string,
    valorTotalParte: number,
    participantId?: string
  ) => {
    setIsLoading(true);
    try {
      await dbService.financeiro.definirPagamentoParticipante(
        corridaId,
        participantId || amigoAtual.id,
        valorTotalParte
      );
      await carregarCorridas();
      if (update) update();
    } catch (error) {
      console.error('Erro ao quitar corrida:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleConfirmPayment = async () => {
    const valor = parseFloat(paymentAmount.replace(/\./g, '').replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      alert('Digite um valor válido.');
      return;
    }

    setIsProcessingPayment(true);
    try {
      await dbService.financeiro.registrarPagamento(amigoAtual.id, valor);
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
      .filter((c) => c.pendente > 0.005)
      .map((c) => {
        const tagGrupo = c.groupName ? ` [Grupo: ${c.groupName}]` : '';
        return `• ${formatarDataCurta(c.data)} - ${c.app} (${c.titulo})${tagGrupo}: R$ ${c.pendenteFormatado}`;
      })
      .join('\n');

    const totalFmt = moneyConverter(dividaAtual);
    const copiaECola = pix
      ? generatePixCopiaECola({
          pixKey: pix,
          merchantName: cfg.nome || 'Voce',
          amount: dividaAtual > 0 ? dividaAtual : undefined,
          description: `RachApp ${nome}`,
        })
      : '';

    return (
      `Fala ${nome.split(' ')[0]}! Segue o resumo dos nossos rachas pelo RachApp:\n\n` +
      `${pendentesTexto || 'Sem pendências detalhadas'}\n\n` +
      `💰 *Total Pendente: R$ ${totalFmt}*\n` +
      `🔑 *Minha Chave Pix:* ${pix || 'Não informada no perfil'}` +
      (copiaECola ? `\n\n📋 *Pix Copia e Cola:*\n${copiaECola}` : '') +
      `\n\nValeu!`
    );
  };

  const handleCobrarWhatsApp = async () => {
    // Busca sempre a configuração mais recente do usuário logado para garantir que a chave Pix vá na mensagem
    const fresh = await dbService.settings.get();
    const cfg = {
      nome: fresh.nome || fresh.name || myConfig.nome || 'Você',
      pix: (fresh.pix_key || fresh.pix || myConfig.pix || '').trim(),
    };
    setMyConfig(cfg);

    const mensagem = montarMensagemCobranca(cfg);
    const encodedMessage = encodeURIComponent(mensagem);
    const fullPhone = toWhatsAppNumber(telefone);

    if (!fullPhone) {
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    } else {
      window.open(`https://wa.me/${fullPhone}?text=${encodedMessage}`, '_blank');
    }
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
        <h2 className="text-lg font-semibold text-white">Detalhes do Amigo</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="p-2 text-gray-300 hover:bg-white/10 hover:text-white rounded-full transition-colors"
            title="Editar Amigo"
          >
            <Pencil size={20} />
          </button>
          <button
            onClick={() => onDelete(amigoAtual.id)}
            className="p-2 text-red-500 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors"
            title="Excluir Amigo"
          >
            <Trash2 size={22} />
          </button>
        </div>
      </div>

      <div className="px-6 flex-1">
        {/* Resumo do Perfil */}
        <div className="flex flex-col items-center mt-6 mb-6">
          <div
            className={`w-20 h-20 rounded-full ${cor} flex items-center justify-center text-3xl font-black text-white shadow-lg mb-3`}
          >
            {nome[0]?.toUpperCase()}
          </div>
          <h3 className="text-xl font-bold text-white">{nome}</h3>

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

          <div className="text-4xl font-black text-[#2DD4BF] mt-4 mb-1">
            R$ {moneyConverter(dividaAtual)}
          </div>
          <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-4">
            Total Pendente
          </p>

          {dividaAtual > 0.005 && (
            <button
              onClick={() => {
                setPaymentAmount(moneyConverter(dividaAtual));
                setIsPaymentModalOpen(true);
              }}
              className="bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] px-6 py-2.5 rounded-full font-bold flex items-center gap-2 transition-colors shadow-lg shadow-teal-500/20"
            >
              <DollarSign size={18} /> Registrar Pagamento
            </button>
          )}
        </div>

        {/* Botões de Cobrança: WhatsApp e Pix QR Code */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button
            onClick={handleCobrarWhatsApp}
            className="bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-3.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            Cobrar WhatsApp
          </button>

          <button
            onClick={handleOpenPixModal}
            className="bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-[#2DD4BF]/40 text-[#2DD4BF] font-bold py-3.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <QrCode size={18} />
            QR Code Pix
          </button>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h4 className="text-white font-bold text-lg">Rachas Compartilhados</h4>
          <span className="text-xs text-gray-500 font-medium">{corridasDoAmigo.length} itens</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoaderCircle className="animate-spin text-[#2DD4BF]" />
          </div>
        ) : corridasDoAmigo.length === 0 ? (
          <div className="bg-[#1c1c1e] p-6 rounded-2xl border border-white/5 text-center mb-8">
            <p className="text-gray-400 text-sm">
              Você ainda não dividiu nenhum racha com {nome.split(' ')[0]}.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {corridasDoAmigo.map((corrida) => {
              const isQuitada = corrida.pendente <= 0.005;
              const temPagamento = corrida.jaPago > 0.005;
              return (
                <div
                  key={corrida.id}
                  className={`p-4 rounded-2xl border border-white/5 transition-opacity ${
                    isQuitada ? 'bg-[#14171f] opacity-75' : 'bg-[#1c1c1e]'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-gray-400 text-xs">{formatarDataCurta(corrida.data)}</p>
                      {corrida.groupName && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <UsersRound size={10} /> Grupo: {corrida.groupName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isQuitada ? (
                        <span className="bg-[#34C759]/20 text-[#34C759] text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Check size={12} /> Pago
                        </span>
                      ) : (
                        <>
                          <span className="bg-red-500/20 text-red-400 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            • Pendente
                          </span>
                          <button
                            onClick={() =>
                              handleQuitarCorridaUnica(
                                corrida.id,
                                corrida.parteNumero,
                                corrida.participantFriendId
                              )
                            }
                            className="text-xs bg-[#2DD4BF]/20 text-[#2DD4BF] hover:bg-[#2DD4BF]/30 px-2 py-0.5 rounded-md font-semibold transition-colors"
                            title="Marcar esta conta como paga"
                          >
                            Quitar
                          </button>
                        </>
                      )}
                      {temPagamento && (
                        <button
                          onClick={() =>
                            handleUndoPayment(corrida.id, corrida.participantFriendId)
                          }
                          className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-md transition-colors"
                          title="Desfazer pagamento desta corrida"
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center text-white font-semibold mb-3">
                    <Banknote size={16} className="text-[#2DD4BF] mr-2 shrink-0" />
                    <span className="truncate">
                      {corrida.app} — {corrida.titulo}
                    </span>
                  </div>

                  <div className="flex justify-between items-end text-sm pt-2 border-t border-white/5">
                    <span className="text-gray-500 text-xs">
                      Custo Total: R$ {corrida.precoTotal}
                    </span>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">
                        Parte dele ({corrida.partePct}%): R$ {corrida.parteAmigo}
                      </div>
                      {!isQuitada && (
                        <div className="text-red-400 font-bold text-xs mt-0.5">
                          Pendente: R$ {corrida.pendenteFormatado}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sub-modal de Pagamento */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1c1c1e] w-full max-w-sm rounded-3xl p-6 border border-white/10 animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-bold text-xl">Registrar Pagamento</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              O valor digitado irá quitar os rachas pendentes de {nome.split(' ')[0]}, começando pelos mais antigos.
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
                onClick={handleConfirmPayment}
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

      {/* Modal de Editar Amigo */}
      <AddFriendModal
        isOpen={isEditModalOpen}
        friendToEdit={amigoAtual}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(updatedFriend) => {
          if (updatedFriend) setAmigoAtual({ ...amigoAtual, ...updatedFriend });
          carregarCorridas();
          if (update) update();
        }}
      />

      {/* Modal de Pix QR Code e Copia e Cola */}
      <PixModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        pixKey={myConfig.pix}
        recipientName={myConfig.nome}
        amount={dividaAtual}
        description={`RachApp ${nome}`}
        whatsappPhone={telefone}
        whatsappCustomMessage={montarMensagemCobranca()}
      />
    </div>
  );
}
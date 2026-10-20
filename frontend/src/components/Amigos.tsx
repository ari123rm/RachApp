// src/components/Amigos.tsx
import { useState, useEffect } from 'react';
import {
  Search,
  Star,
  LoaderCircle,
  UserPlus,
  UserCheck,
  UserX,
  CheckCircle2,
  Phone,
  QrCode,
  Inbox,
} from 'lucide-react';
import { FriendCard } from './FriendCard';
import { FriendDetailsModal } from './FriendDetailsModal';
import { AddFriendModal } from './AddFriendModal';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';
import { formatPhoneBR } from '../utils/phoneFormatter';

export function Amigos({ onDataChange }: { onDataChange?: () => void }) {
  const [subTab, setSubTab] = useState<'amigos' | 'solicitacoes'>('amigos');
  const [busca, setBusca] = useState('');
  const [amigoSelecionado, setAmigoSelecionado] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [amigos, setAmigos] = useState<any[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);

  const carregarDados = async () => {
    setIsLoading(true);
    try {
      const [dadosAmigos, pedidos] = await Promise.all([
        dbService.amigos.getAll(),
        dbService.amigos.getRequests().catch(() => []),
      ]);

      const amigosComValores = await Promise.all(
        dadosAmigos.map(async (amigo) => {
          const valorDevido =
            amigo.dividaNumerica !== undefined
              ? amigo.dividaNumerica
              : await dbService.financeiro.calcularDividaDoAmigo(amigo.id);
          const dividaFormatada = moneyConverter(valorDevido);

          return {
            ...amigo,
            nome: amigo.nome || amigo.name || 'Amigo',
            cor: amigo.cor || amigo.color || 'bg-sky-500',
            favorito: amigo.favorito ?? amigo.is_favorite ?? false,
            is_verified: !!(amigo.is_verified || amigo.has_account),
            has_account: !!(amigo.is_verified || amigo.has_account),
            divida: dividaFormatada,
            dividaNumerica: valorDevido,
            voceDeveNumerico: Number(amigo.voceDeveNumerico || 0),
          };
        })
      );

      setAmigos(amigosComValores);
      setSolicitacoes(pedidos || []);
    } catch (error) {
      console.error('Erro ao buscar amigos e solicitações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleToggleFavorito = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setAmigos(
      amigos.map((amigo) =>
        amigo.id === id ? { ...amigo, favorito: !amigo.favorito } : amigo
      )
    );

    await dbService.amigos.toggleFavorito(id);
  };

  const handleExcluirAmigo = async (id: string) => {
    const nomeAlvo = amigoSelecionado?.nome || amigoSelecionado?.name || 'este amigo';
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir ${nomeAlvo}? Esta ação não pode ser desfeita.`
    );

    if (!confirmar) return;

    try {
      await dbService.amigos.delete(id);
      setAmigos(amigos.filter((a) => a.id !== id));
      setAmigoSelecionado(null);
      if (onDataChange) onDataChange();
    } catch (error) {
      alert('Erro ao excluir o amigo.');
    }
  };

  const handleAceitarSolicitacao = async (pedido: any) => {
    setProcessandoId(pedido.requesterId || pedido.id);
    try {
      await dbService.amigos.acceptRequest(pedido.requesterId || pedido.id);
      alert(`Você e ${pedido.name} agora são amigos!`);
      await carregarDados();
      if (onDataChange) onDataChange();
    } catch (err: any) {
      alert(err.message || 'Erro ao aceitar solicitação.');
    } finally {
      setProcessandoId(null);
    }
  };

  const handleRecusarSolicitacao = async (pedido: any) => {
    setProcessandoId(pedido.requesterId || pedido.id);
    try {
      await dbService.amigos.rejectRequest(pedido.requesterId || pedido.id);
      setSolicitacoes((prev) => prev.filter((p) => (p.requesterId || p.id) !== (pedido.requesterId || pedido.id)));
    } catch (err: any) {
      alert(err.message || 'Erro ao recusar solicitação.');
    } finally {
      setProcessandoId(null);
    }
  };

  const amigosFiltrados = amigos.filter((a) =>
    (a.nome || a.name || '').toLowerCase().includes(busca.toLowerCase())
  );
  const favoritos = amigos.filter((a) => a.favorito);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[#2DD4BF]">
        <LoaderCircle size={40} className="animate-spin mb-4" />
        <p className="text-gray-400 font-medium">Carregando amigos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      <header className="mt-2 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Amigos</h1>
        </div>

        {/* Abas: Meus Amigos / Aceitar Amizades (Convites) + Botão Novo */}
        <div className="flex items-center justify-between gap-2">
          <div className="bg-[#1c1c1e] p-1 rounded-full flex items-center border border-white/5 flex-1">
            <button
              onClick={() => setSubTab('amigos')}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${
                subTab === 'amigos'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Meus Amigos
            </button>
            <button
              onClick={() => setSubTab('solicitacoes')}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                subTab === 'solicitacoes'
                  ? 'bg-[#2DD4BF] text-[#05080f]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>Aceitar Amizades</span>
              {solicitacoes.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-black">
                  {solicitacoes.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => setIsAddFriendOpen(true)}
            className="bg-[#1c1c1e] hover:bg-[#2c2c2e] text-[#2DD4BF] border border-[#2DD4BF]/30 px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            <UserPlus size={15} /> Novo
          </button>
        </div>

        {subTab === 'amigos' && (
          <div className="bg-[#1c1c1e] rounded-2xl flex items-center p-3 text-gray-400 border border-white/5 focus-within:ring-1 focus-within:ring-[#2DD4BF] focus-within:text-[#2DD4BF] transition-all">
            <Search size={20} className="mr-3" />
            <input
              type="text"
              placeholder="Buscar amigos..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="bg-transparent w-full outline-none text-white placeholder:text-gray-500"
            />
          </div>
        )}
      </header>

      {subTab === 'amigos' ? (
        <>
          {/* FAVORITOS COM SELO DE VERIFICAÇÃO */}
          {busca === '' && favoritos.length > 0 && (
            <section>
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-lg font-bold text-white">Favoritos</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {favoritos.map((amigo) => (
                  <div
                    key={amigo.id}
                    onClick={() => setAmigoSelecionado(amigo)}
                    className="flex flex-col items-center min-w-[72px] cursor-pointer active:opacity-70"
                  >
                    <div className="relative mb-2">
                      <div
                        className={`w-16 h-16 rounded-3xl ${amigo.cor} flex items-center justify-center shadow-lg border border-white/10`}
                      >
                        <span className="text-2xl font-black text-white">
                          {amigo.nome[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-[#05080f] rounded-full p-1">
                        <Star size={16} className="text-yellow-500 fill-yellow-500" />
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1 w-full">
                      <span className="text-sm font-medium text-gray-300 truncate text-center">
                        {amigo.nome.split(' ')[0]}
                      </span>
                      {amigo.is_verified && (
                        <CheckCircle2 size={13} className="fill-[#2DD4BF] text-[#05080f] shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TODOS OS AMIGOS */}
          <section className="pb-10">
            <h2 className="text-lg font-bold text-white mb-4">
              {busca ? 'Resultados da busca' : 'Todos os Amigos'}
            </h2>

            <div className="space-y-3">
              {amigosFiltrados.length === 0 ? (
                <div className="bg-[#1c1c1e] p-8 rounded-3xl text-center border border-white/5">
                  <p className="text-gray-400 mb-3">Nenhum amigo encontrado.</p>
                  <button
                    onClick={() => setIsAddFriendOpen(true)}
                    className="text-[#2DD4BF] font-bold text-sm hover:underline"
                  >
                    + Adicionar um novo amigo
                  </button>
                </div>
              ) : (
                amigosFiltrados.map((amigo) => (
                  <FriendCard
                    key={amigo.id}
                    amigo={amigo}
                    onClick={() => setAmigoSelecionado(amigo)}
                    onToggleFavorito={(e) => handleToggleFavorito(amigo.id, e)}
                  />
                ))
              )}
            </div>
          </section>
        </>
      ) : (
        /* ABA DEDICADA: ACEITAR AMIZADES (SISTEMA DE CONVITES) */
        <section className="pb-10 space-y-3">
          <div className="bg-[#1c1c1e] p-4 rounded-2xl border border-white/5 mb-4">
            <p className="text-xs text-gray-300">
              Aqui você gerencia convites e solicitações de pessoas que adicionaram seu telefone no Rachapp. Ao aceitar, o contato passa a fazer parte da sua lista de amigos.
            </p>
          </div>

          {solicitacoes.length === 0 ? (
            <div className="bg-[#1c1c1e] p-8 rounded-3xl text-center border border-white/5 flex flex-col items-center justify-center gap-2">
              <Inbox size={32} className="text-gray-500 mb-1" />
              <p className="text-white font-bold text-sm">Nenhuma solicitação pendente</p>
              <p className="text-gray-500 text-xs max-w-xs">
                Quando outros usuários te convidarem pelo seu número de telefone, o convite aparecerá aqui para você aceitar.
              </p>
            </div>
          ) : (
            solicitacoes.map((pedido) => {
              const reqId = pedido.requesterId || pedido.id;
              const isBusy = processandoId === reqId;

              return (
                <div
                  key={reqId}
                  className="bg-[#1c1c1e] rounded-2xl p-4 flex items-center justify-between border border-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-teal-500 flex items-center justify-center font-black text-white text-lg shrink-0">
                      {(pedido.name || 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white text-base truncate">{pedido.name}</span>
                        <CheckCircle2 size={15} className="fill-[#2DD4BF] text-[#05080f] shrink-0" />
                      </div>
                      {pedido.phone && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone size={11} className="text-gray-500" /> {formatPhoneBR(pedido.phone)}
                        </p>
                      )}
                      {pedido.pix_key && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 truncate max-w-[150px]">
                          <QrCode size={11} className="text-[#2DD4BF]" /> Pix: {pedido.pix_key}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      disabled={isBusy}
                      onClick={() => handleAceitarSolicitacao(pedido)}
                      className="bg-[#2DD4BF] hover:bg-[#25b5a3] text-[#05080f] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-transform active:scale-95 disabled:opacity-50"
                    >
                      <UserCheck size={14} /> Aceitar
                    </button>
                    <button
                      disabled={isBusy}
                      onClick={() => handleRecusarSolicitacao(pedido)}
                      className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-2.5 py-2 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                      title="Recusar"
                    >
                      <UserX size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      <FriendDetailsModal
        amigo={amigoSelecionado}
        isOpen={!!amigoSelecionado}
        onClose={() => {
          setAmigoSelecionado(null);
          carregarDados();
        }}
        onDelete={handleExcluirAmigo}
        update={() => {
          carregarDados();
          if (onDataChange) onDataChange();
        }}
      />

      <AddFriendModal
        isOpen={isAddFriendOpen}
        onClose={() => setIsAddFriendOpen(false)}
        onSuccess={() => {
          carregarDados();
          if (onDataChange) onDataChange();
        }}
      />
    </div>
  );
}

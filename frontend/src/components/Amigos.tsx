// src/components/Amigos.tsx
import { useState, useEffect } from 'react';
import { Search, Star, LoaderCircle } from 'lucide-react';
import { FriendCard } from './FriendCard'; // 🟢 IMPORT CARD
import { FriendDetailsModal } from './FriendDetailsModal'; // 🟢 IMPORT MODAL
import { dbService } from '../services/database'; // 🟢 IMPORTANDO O SERVIÇO
import moneyConverter from '../utils/moneyConverter';

export function Amigos({ onDataChange }: { onDataChange?: () => void }) {
  const [busca, setBusca] = useState('');
  const [amigoSelecionado, setAmigoSelecionado] = useState<any>(null); // 🟢 Controle do Modal
  const [isLoading, setIsLoading] = useState(true); // 🟢 Controle de loading da tela

  // 🟢 Transformamos em um estado para poder alterar o "favorito"
  const [amigos, setAmigos] = useState<any[]>([]);

  // Função que inverte a estrela
  const carregarAmigos = async () => {
    setIsLoading(true);
    try {
      const dadosAmigos = await dbService.amigos.getAll();
      
      // Para cada amigo, busca o cálculo financeiro de quanto ele deve
      const amigosComValores = await Promise.all(
        dadosAmigos.map(async (amigo) => {
          const valorDevido = await dbService.financeiro.calcularDividaDoAmigo(amigo.id);
          const dividaFormatada = moneyConverter(valorDevido); // Formata para exibir como dinheiro
          
          return { ...amigo, divida: dividaFormatada };
        })
      );
      
      setAmigos(amigosComValores);
    } catch (error) {
      console.error("Erro ao buscar amigos", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Dispara a busca assim que a tela abre
  useEffect(() => {
    carregarAmigos();
  }, []);

  // 🟢 FUNÇÃO PARA FAVORITAR NO BANCO 🟢
  const handleToggleFavorito = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Atualiza na tela instantaneamente (Optimistic UI) para não dar delay visual
    setAmigos(amigos.map(amigo => 
      amigo.id === id ? { ...amigo, favorito: !amigo.favorito } : amigo
    ));

    // Salva no banco em segundo plano
    await dbService.amigos.toggleFavorito(id);
  };

  const handleExcluirAmigo = async (id: string) => {
    // Confirmação nativa do navegador para evitar clique acidental
    const confirmar = window.confirm(`Tem certeza que deseja excluir ${amigoSelecionado.nome}? Esta ação não pode ser desfeita.`);
    
    if (!confirmar) return;

    try {
      // 1. Apaga no banco de dados
      await dbService.amigos.delete(id);
      
      // 2. Tira da tela atualizando o estado
      setAmigos(amigos.filter(a => a.id !== id));
      if (onDataChange) onDataChange();
      
      // 3. Fecha o modal de detalhes
      setAmigoSelecionado(null);
      
    } catch (error) {
      alert("Erro ao excluir o amigo.");
    }
  };

  const amigosFiltrados = amigos.filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()));
  const favoritos = amigos.filter(a => a.favorito);

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
      <header className="mt-2">
        <h1 className="text-3xl font-bold text-white mb-4">Lista de Amigos</h1>
        <div className="bg-[#1c1c1e] rounded-2xl flex items-center p-3 text-gray-400 border border-white/5 focus-within:ring-1 focus-within:ring-[#2DD4BF] focus-within:text-[#2DD4BF] transition-all">
          <Search size={20} className="mr-3" />
          <input 
            type="text" placeholder="Buscar amigos..." value={busca} onChange={(e) => setBusca(e.target.value)}
            className="bg-transparent w-full outline-none text-white placeholder:text-gray-500"
          />
        </div>
      </header>

      {/* FAVORITOS */}
      {busca === '' && favoritos.length > 0 && (
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-lg font-bold text-white">Favoritos</h2>
            <button className="text-sm text-blue-500 font-medium hover:text-blue-400">Ver todos</button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {favoritos.map(amigo => (
              <div 
                key={amigo.id} 
                onClick={() => setAmigoSelecionado(amigo)} // 🟢 Clicar aqui também abre!
                className="flex flex-col items-center min-w-[72px] cursor-pointer active:opacity-70"
              >
                <div className="relative mb-2">
                  <div className={`w-16 h-16 rounded-3xl ${amigo.cor} flex items-center justify-center shadow-lg border border-white/10`}>
                    <span className="text-2xl font-black text-white">{amigo.nome[0]}</span>
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-[#05080f] rounded-full p-1">
                    <Star size={16} className="text-yellow-500 fill-yellow-500" />
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-300 truncate w-full text-center">
                  {amigo.nome.split(' ')[0]}
                </span>
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
            <p className="text-gray-500 text-center py-6">Nenhum amigo encontrado.</p>
          ) : (
            amigosFiltrados.map(amigo => (
              <FriendCard 
                key={amigo.id}
                amigo={amigo}
                onClick={() => setAmigoSelecionado(amigo)} // 🟢 Abre modal
                onToggleFavorito={(e) => handleToggleFavorito(amigo.id, e)} // 🟢 Favorita
              />
            ))
          )}
        </div>
      </section>

      {/* 🟢 TELA DE DETALHES 🟢 */}
      <FriendDetailsModal 
        amigo={amigoSelecionado} 
        isOpen={!!amigoSelecionado} 
        onClose={() => {setAmigoSelecionado(null); carregarAmigos();}}
        onDelete={handleExcluirAmigo} // 🟢 PASSANDO A FUNÇÃO AQUI
        update={carregarAmigos}
      />

      
    </div>
  );
}
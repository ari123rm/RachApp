// src/components/AddRideModal.tsx
import { useState, useEffect } from 'react';
import { X, LoaderCircle } from 'lucide-react';
import { dbService } from '../services/database'; // 🟢 Import do serviço
import type { Amigo } from '../types/index.ts';

interface AddRideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // 🟢 Para avisar o App.tsx que salvou
}
// Função para obter a data de hoje no formato YYYY-MM-DD
const getTodayDate = () => {
    const date = new Date();
    const year = date.getFullYear();
    // O mês começa em 0 (Janeiro), por isso somamos +1 e garantimos 2 dígitos com padStart
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

export function AddRideModal({ isOpen, onClose , onSuccess}: AddRideModalProps) {
  // Estados do formulário
 const [valor, setValor] = useState('');
  const [data, setData] = useState(getTodayDate());
  const [selecionados, setSelecionados] = useState<string[]>([]); // 🟢 Agora guarda IDs (strings)
  const [titulo, setTitulo] = useState('');
  const [tag, setTag] = useState('');


    const [amigosReais, setAmigosReais] = useState<Amigo[]>([]);
  const [isLoadingAmigos, setIsLoadingAmigos] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Amigos falsos apenas para testarmos o visual por enquanto
useEffect(() => {
    if (isOpen) {
    const carregarAmigos = async () => {
        setIsLoadingAmigos(true);
        const dados = await dbService.amigos.getAll();
        setAmigosReais(dados);
        setIsLoadingAmigos(false);
    };
    carregarAmigos();
    }
}, [isOpen]);
  const sugestoesTitulos = ["Eletra", "IFCE", "Casa", "Cinema", "Pizza"];
  const sugestoesTags = ["Uber", "Pizza", "Trabalho", "Jogos"];

  const toggleAmigo = (id: string) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter(item => item !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  };
  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 1. Pega o valor digitado e remove tudo que NÃO for número
    const apenasNumeros = e.target.value.replace(/\D/g, "");

    // Se o usuário apagar tudo, deixa vazio
    if (apenasNumeros === "") {
      setValor("");
      return;
    }

    // 2. Transforma em número e divide por 100 para criar a casa dos centavos
    // Ex: Digitou "123" -> vira 1.23
    const valorEmCentavos = Number(apenasNumeros) / 100;

    // 3. Formata para o padrão brasileiro (0,00)
    const valorFormatado = valorEmCentavos.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    setValor(valorFormatado);
  };
  const handleDividirCorrida = async () => {
    if (!titulo || !valor || selecionados.length === 0) {
      alert("Por favor, preencha o título, valor e selecione ao menos um amigo.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Converte "24,50" -> 24.50 (número puro para o banco)
      const valorLimpo = parseFloat(valor.replace(/\./g, '').replace(',', '.'));

      // 2. Envia para o serviço
      await dbService.corridas.create({
        titulo,
        tag: tag || "Uber",
        data,
        valorTotal: valorLimpo,
        participantesIds: selecionados
      });

      // 3. Reseta e fecha
      setValor('');
      setTitulo('');
      setTag('');
      setSelecionados([]);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      alert("Erro ao salvar corrida.");
    } finally {
      setIsSaving(false);
    }
  };

  // Se o modal não estiver aberto, não renderiza nada
  if (!isOpen) return null;

  return (
    // Fundo escuro transparente (Backdrop)
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center transition-opacity">
      
      {/* Caixa do Modal */}
      <div className="bg-[#1c1c1e] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up relative overflow-y-auto max-h-[90vh]">
        
        {/* Botão Fechar */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white"
        >
          <X size={24} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">Adicionar Novo Racha</h2>

        {/* Campo: Título / Descrição com Sugestões */}
        <div className="mb-5">
          <label className="block text-gray-400 text-sm mb-2">Título / Para que serve?</label>
          <div className="bg-[#2c2c2e] rounded-xl p-4 flex items-center text-white mb-2">
            <input 
              type="text" 
              placeholder="Ex: Cinema, Jantar, Trabalho..."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="bg-transparent w-full text-white text-lg outline-none placeholder:text-gray-600"
            />
          </div>
          {/* 🟢 CHIPS DE SUGESTÃO PARA O TÍTULO 🟢 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sugestoesTitulos.map((sugestao) => (
              <button
                key={sugestao}
                type="button" // Evita que o botão recarregue a página sem querer
                onClick={() => setTitulo(sugestao)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  titulo === sugestao 
                    ? 'bg-[#2DD4BF]/20 border-[#2DD4BF] text-[#2DD4BF]' // Fica verde se estiver selecionado
                    : 'bg-[#3a3a3c] border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {sugestao}
              </button>
            ))}
          </div>
        </div>

        {/* Campo: Valor Total (Seu código da máscara de dinheiro continua igual) */}
        <div className="mb-5">
          <label className="block text-gray-400 text-sm mb-2">Valor Total</label>
          <div className="bg-[#2c2c2e] rounded-xl p-4 flex items-center">
            <span className="text-gray-400 text-2xl mr-2 font-medium">R$</span>
            <input 
              type="tel"
              placeholder="0,00"
              value={valor}
              onChange={handleValorChange}
              className="bg-transparent w-full text-white text-3xl font-semibold outline-none"
            />
          </div>
        </div>

        {/* Grid para Data e Tag */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Data</label>
            <div className="bg-[#2c2c2e] rounded-xl p-4 flex items-center text-white">
              <input 
                type="date" 
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="bg-transparent w-full outline-none text-white text-sm" 
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Tag / App</label>
            <div className="bg-[#2c2c2e] rounded-xl p-4 flex items-center text-white mb-2">
              <input 
                type="text" 
                placeholder="UberX"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="bg-transparent w-full text-white text-sm outline-none placeholder:text-gray-600"
              />
            </div>
            {/* 🟢 CHIPS DE SUGESTÃO PARA A TAG 🟢 */}
            <div className="flex flex-wrap gap-1.5">
              {sugestoesTags.map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => setTag(sugestao)}
                  className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                    tag === sugestao
                      ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                      : 'bg-[#3a3a3c] border-gray-600 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {sugestao}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Campo: Quem estava com você */}
        <div className="mb-8">
          <label className="text-gray-400 text-sm mb-3 block">Quem estava com você?</label>
          {isLoadingAmigos ? (
            <div className="flex justify-center p-4"><LoaderCircle className="animate-spin text-gray-500" /></div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {amigosReais.length === 0 ? (
                <p className="text-xs text-gray-500 italic">Cadastre amigos na aba "Amigos" primeiro!</p>
              ) : (
                amigosReais.map((amigo) => {
                  const isSelected = selecionados.includes(amigo.id);
                  return (
                    <button
                      key={amigo.id}
                      onClick={() => toggleAmigo(amigo.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${
                        isSelected ? 'border-[#2DD4BF] bg-[#2DD4BF]/10 text-white' : 'border-gray-700 bg-[#2c2c2e] text-gray-400'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full ${amigo.cor} flex items-center justify-center text-[10px] text-white font-bold`}>
                        {amigo.nome[0]}
                      </div>
                      <span className="text-sm">{amigo.nome}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Botão Salvar */}
        <button 
          onClick={handleDividirCorrida}
          disabled={isSaving}
          className="w-full bg-[#007AFF] hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2"
        >
          {isSaving ? <LoaderCircle className="animate-spin" /> : 'Rachar'}
        </button>

      </div>
    </div>
  );
}
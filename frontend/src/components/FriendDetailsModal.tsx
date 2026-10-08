// src/components/FriendDetailsModal.tsx
import { useState, useEffect } from 'react';
import { ChevronLeft, Banknote, Trash2, LoaderCircle, DollarSign, X, Undo2 } from 'lucide-react';
import { dbService } from '../services/database';
import moneyConverter from '../utils/moneyConverter';

interface FriendDetailsProps {
  amigo: any;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  update?: () => void; // Função para atualizar os dados na tela principal após um pagamento
}

export function FriendDetailsModal({ amigo, isOpen, onClose, onDelete , update }: FriendDetailsProps) {
  const [corridasDoAmigo, setCorridasDoAmigo] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 🟢 ESTADOS DO NOVO MODAL DE PAGAMENTO
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Função isolada para recarregar as corridas, assim podemos chamar após o pagamento
  const carregarCorridas = async () => {
    setIsLoading(true);
    try {
      const todasCorridas = await dbService.corridas.getAll();
      const compartilhadas = todasCorridas.filter(c => c.participantesIds.includes(amigo.id));

      const corridasFormatadas = compartilhadas.map(corrida => {
        const qtdPessoas = corrida.participantesIds.length + 1;
        const parte = corrida.valorTotal / qtdPessoas;
        const jaPago = corrida.pagamentos?.[amigo.id] || 0;
        const pendente = parte - jaPago;
        
        return {
          id: corrida.id,
          data: corrida.data,
          app: corrida.tag ,
          titulo: corrida.titulo,
          precoTotal: moneyConverter(corrida.valorTotal),
          parteAmigo: moneyConverter(parte),
          pendente: pendente, 
          pendenteFormatado: moneyConverter(pendente),
          jaPago: jaPago // 🟢 ADICIONE ESTA LINHA AQUI
        };
      });

      // Ordena: Mais recentes primeiro
      corridasFormatadas.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setCorridasDoAmigo(corridasFormatadas);
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setIsLoading(false);
    }
  };
  const handleUndoPayment = async (corridaId: string) => {
    if (window.confirm("Deseja desfazer o pagamento desta corrida? O valor voltará para a dívida pendente.")) {
      setIsLoading(true);
      try {
        await dbService.financeiro.desfazerPagamentoDaCorrida(corridaId, amigo.id);
        await carregarCorridas(); // Recarrega a lista
      } catch (error) {
        console.error("Erro ao desfazer pagamento:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };
    const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 1. Pega o valor digitado e remove tudo que NÃO for número
    const apenasNumeros = e.target.value.replace(/\D/g, "");

    // Se o usuário apagar tudo, deixa vazio
    if (apenasNumeros === "") {
      setPaymentAmount("");
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

    setPaymentAmount(valorFormatado);
  };

  useEffect(() => {
    if (isOpen && amigo) {
      carregarCorridas();
    }
  }, [isOpen, amigo]);

  if (!isOpen || !amigo) return null;

  // 🟢 FUNÇÃO DE REGISTRAR PAGAMENTO
  const handleConfirmPayment = async () => {
    const valor = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      alert("Digite um valor válido.");
      return;
    }

    setIsProcessingPayment(true);
    try {
      // Chama nosso novo serviço
      await dbService.financeiro.registrarPagamento(amigo.id, valor);
      
      // Limpa e fecha modal
      setPaymentAmount('');
      setIsPaymentModalOpen(false);
      
      // Recarrega os dados na tela
      await carregarCorridas();
      
      // Alerta simples (Pode trocar por um Toast se preferir)
      alert("Pagamento registrado! As corridas mais antigas foram quitadas.");
      if(update)update();
      // IMPORTANTE: Como o "amigo.divida" vem de fora por props, 
      // fechar o modal principal forçaria a tela anterior a recarregar e atualizar o total.
      // onClose(); 
    } catch (error) {
      console.error("Erro ao processar:", error);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCobrarWhatsApp = async () => {
    const config = await dbService.settings.get();
    const pix = config.pix;
    const telefoneLimpo = amigo.telefone ? amigo.telefone.replace(/\D/g, '') : ""; 
    const formatarData = (dataIso: string) => {
      if (!dataIso) return "";
      const [ano, mes, dia] = dataIso.split('-');
      return `${dia}/${mes}/${ano.slice(2)}`;
    };

    // Só envia na mensagem as corridas que ainda estão devendo
    const pendentesTexto = corridasDoAmigo
      .filter(c => c.pendente > 0)
      .map(c => `${formatarData(c.data)} - ${c.titulo} - Falta R$ ${c.pendenteFormatado}`)
      .join('\n');

    const mensagem = `Fala ${amigo.nome.split(' ')[0]}! O total fechou em R$ ${amigo.divida}.\n\n${pendentesTexto}\n\nTotal: R$ ${amigo.divida}\nMeu Pix: ${pix}\nValeu!`;
    const encodedMessage = encodeURIComponent(mensagem); 
    
    if (!telefoneLimpo) {
      alert("Este amigo não tem um WhatsApp cadastrado.");
    } else {
      window.open(`https://wa.me/55${telefoneLimpo}?text=${encodedMessage}`, '_blank');
    }
  };

  // Recalcular dívida total baseada no state atual para ficar dinâmico sem precisar fechar o modal
  const dividaAtual = corridasDoAmigo.reduce((acc, curr) => acc + curr.pendente, 0);

  return (
    <div className="fixed inset-0 bg-[#05080f] z-50 flex flex-col animate-slide-up overflow-y-auto pb-6">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <button onClick={onClose} className="p-2 text-white hover:bg-gray-800 rounded-full transition-colors">
          <ChevronLeft size={28} />
        </button>
        <h2 className="text-lg font-semibold text-white">Detalhes do Amigo</h2>
        <button onClick={() => {onDelete(amigo.id); onClose();}} className="p-2 text-red-500 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors">
          <Trash2 size={24} />
        </button>
      </div>

      <div className="px-6 flex-1">
        {/* Resumo do Perfil */}
        <div className="flex flex-col items-center mt-6 mb-8">
          <div className={`w-20 h-20 rounded-full ${amigo.cor} flex items-center justify-center text-3xl font-black text-white shadow-lg mb-4`}>
            {amigo.nome[0]}
          </div>
          <h3 className="text-xl font-bold text-white mb-1">{amigo.nome}</h3>
          
          <div className="text-4xl font-black text-[#34C759] mt-2 mb-1">
            R$ {moneyConverter(dividaAtual)}
          </div>
          <p className="text-gray-500 text-sm mb-4">Total Pendente</p>

          {/* 🟢 BOTÃO DE RECEBER PAGAMENTO */}
          {dividaAtual > 0 && (
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="bg-[#34C759]/20 text-[#34C759] hover:bg-[#34C759]/30 px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-colors"
            >
              <DollarSign size={18} /> Registrar Pagamento
            </button>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <button onClick={handleCobrarWhatsApp} className="w-full bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-transform active:scale-95">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            Enviar Cobrança
          </button>
        </div>
        
        <h4 className="text-white font-bold text-lg mb-4">Rachas Compartilhados</h4>
        
        {isLoading ? (
          <div className="flex justify-center py-8"><LoaderCircle className="animate-spin text-[#2DD4BF]" /></div>
        ) : corridasDoAmigo.length === 0 ? (
          <div className="bg-[#1c1c1e] p-6 rounded-xl border border-white/5 text-center mb-8">
            <p className="text-gray-400 text-sm">Você ainda não dividiu nenhum racha com {amigo.nome.split(' ')[0]}.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {corridasDoAmigo.map((corrida) => {
              const isQuitada = corrida.pendente <= 0;
              const temPagamento = corrida.jaPago > 0;
              return (
                <div key={corrida.id} className={`p-4 rounded-xl border border-white/5 transition-opacity ${isQuitada ? 'bg-gray-900/50 opacity-60' : 'bg-[#1c1c1e]'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-gray-400 text-sm">{corrida.data}</p>
                    <div className="flex items-center gap-2">
                      {isQuitada && (
                        <span className="bg-[#34C759]/20 text-[#34C759] text-xs px-2 py-1 rounded-md font-bold">Pago</span>
                      )}
                      {temPagamento && (
                        <button 
                          onClick={() => handleUndoPayment(corrida.id)}
                          className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-md transition-colors"
                          title="Desfazer pagamento desta corrida"
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center text-white font-medium mb-3">
                    <Banknote size={16} className="text-gray-400 mr-2" /> {corrida.app}
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Custo Total: R$ {corrida.precoTotal}</span>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Parte dele: R$ {corrida.parteAmigo}</div>
                      {!isQuitada && <div className="text-[#34C759] font-bold">Pendente: R$ {corrida.pendenteFormatado}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        
      </div>

      {/* 🟢 SUB-MODAL DE PAGAMENTO 🟢 */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1c1c1e] w-full max-w-sm rounded-2xl p-6 border border-white/10 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-bold text-xl">Registrar Pagamento</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-gray-400 text-sm mb-4">
              O valor digitado irá quitar as corridas de {amigo.nome.split(' ')[0]}, começando das mais antigas.
            </p>

            <div className="relative mb-6">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">R$</span>
              <input
                type="tel"
                placeholder="0.00"
                value={paymentAmount}
                onChange={handlePaymentAmountChange}
                className="w-full bg-[#05080f] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white text-xl font-bold focus:outline-none focus:border-[#34C759] transition-colors"
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
                className="flex-1 bg-[#34C759] text-white font-bold py-3 rounded-xl hover:bg-[#2ebd4f] transition-colors disabled:opacity-50 flex justify-center items-center"
              >
                {isProcessingPayment ? <LoaderCircle className="animate-spin" size={20} /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
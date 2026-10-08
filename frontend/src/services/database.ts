// src/services/database.ts
import {type Amigo,type Corrida } from '../types/index.ts';

// Função auxiliar para simular o tempo de resposta de um servidor real (300ms)
const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

// Chaves que usaremos no nosso banco temporário (LocalStorage)
const STORAGE_KEYS = {
  AMIGOS: '@RachaUber:amigos',
  CORRIDAS: '@RachaUber:corridas',
  SETTINGS: '@RachaUber:settings', // 🟢 NOVA CHAVE
};

// Funções utilitárias internas para ler e gravar no armazenamento temporário
const getLocalData = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setLocalData = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// 🟢 NOSSO SERVIÇO UNIFICADO 🟢
export const dbService = {
  
  // ==========================================
  // SERVIÇOS DE AMIGOS
  // ==========================================
  amigos: {
    // Buscar todos os amigos
    getAll: async (): Promise<Amigo[]> => {
      await delay();
      return getLocalData<Amigo>(STORAGE_KEYS.AMIGOS);
    },

    // Criar um novo amigo
    create: async (novoAmigo: Omit<Amigo, 'id'>): Promise<Amigo> => {
      await delay();
      const amigos = getLocalData<Amigo>(STORAGE_KEYS.AMIGOS);
      
      const amigoCriado = {
        ...novoAmigo,
        id: crypto.randomUUID(), // Gera um ID único estilo banco de dados
      };
      
      setLocalData(STORAGE_KEYS.AMIGOS, [...amigos, amigoCriado]);
      return amigoCriado;
    },

    // Alternar favorito
    toggleFavorito: async (id: string): Promise<void> => {
      await delay();
      const amigos = getLocalData<Amigo>(STORAGE_KEYS.AMIGOS);
      const index = amigos.findIndex(a => a.id === id);
      
      if (index !== -1) {
        amigos[index].favorito = !amigos[index].favorito;
        setLocalData(STORAGE_KEYS.AMIGOS, amigos);
      }
    },
    delete: async (id: string): Promise<void> => {
      await delay();
      const amigos = getLocalData<Amigo>(STORAGE_KEYS.AMIGOS);
      // Filtra a lista, removendo o amigo com o ID correspondente
      const novaLista = amigos.filter(a => a.id !== id);
      setLocalData(STORAGE_KEYS.AMIGOS, novaLista);
    }
  },

  // ==========================================
  // SERVIÇOS DE CORRIDAS
  // ==========================================
  corridas: {
    // Buscar todas as corridas
    getAll: async (): Promise<Corrida[]> => {
      await delay();
      return getLocalData<Corrida>(STORAGE_KEYS.CORRIDAS).toReversed();
    },

    // Criar uma nova corrida
    create: async (novaCorrida: Omit<Corrida, 'id'>): Promise<Corrida> => {
      await delay();
      const corridas = getLocalData<Corrida>(STORAGE_KEYS.CORRIDAS);
      
      const corridaCriada = {
        ...novaCorrida,
        id: crypto.randomUUID(),
        isPaied: false 
      };
      
      setLocalData(STORAGE_KEYS.CORRIDAS, [...corridas, corridaCriada]);
      return corridaCriada;
    },

    setPaied: async (id: string, isPaied: boolean = true): Promise<void> => {
      await delay();
      const corridas = getLocalData<Corrida>(STORAGE_KEYS.CORRIDAS);
      const index = corridas.findIndex(c => c.id === id);
      
      if (index !== -1) {
        corridas[index].isPaied = isPaied;
        setLocalData(STORAGE_KEYS.CORRIDAS, corridas);
      }
    },

    delete: async (id: string): Promise<void> => {
      await delay();
      const corridas = getLocalData<Corrida>(STORAGE_KEYS.CORRIDAS);
      // Filtra a lista, removendo a corrida com o ID correspondente
      const novaLista = corridas.filter(c => c.id !== id);
      setLocalData(STORAGE_KEYS.CORRIDAS, novaLista);
    }
  },

  // ==========================================
  // SERVIÇOS FINANCEIROS (Cálculos de dívida)
  // ==========================================
  financeiro: {
    calcularDividaDoAmigo: async (amigoId: string): Promise<number> => {
      await delay(100);
      const corridas = getLocalData<any>(STORAGE_KEYS.CORRIDAS); // usando any ou atualize sua type Corrida
      
      let totalDevido = 0;
      
      corridas.forEach(corrida => {
        if (corrida.participantesIds.includes(amigoId)) {
          const valorDaParte = corrida.valorTotal / (corrida.participantesIds.length + 1);
          
          // 🟢 Verifica se já existe algum pagamento parcial guardado para esse amigo nesta corrida
          const valorJaPago = corrida.pagamentos?.[amigoId] || 0;
          
          // Só soma à dívida o que falta pagar
          const pendente = valorDaParte - valorJaPago;
          if (pendente > 0) {
            totalDevido += pendente;
          }
        }
      });
      
      return totalDevido;
    },
    desfazerPagamentoDaCorrida: async (corridaId: string, amigoId: string): Promise<void> => {
      await delay(100);
      const corridas = getLocalData<any>(STORAGE_KEYS.CORRIDAS);
      const index = corridas.findIndex(c => c.id === corridaId);
      
      if (index !== -1 && corridas[index].pagamentos) {
        // Zera o valor que este amigo pagou nesta corrida
        corridas[index].pagamentos[amigoId] = 0;
        setLocalData(STORAGE_KEYS.CORRIDAS, corridas);
      }
    },

    // 🟢 NOVA FUNÇÃO: Abate a dívida priorizando as mais antigas
    registrarPagamento: async (amigoId: string, valorPago: number): Promise<void> => {
      await delay(200);
      const corridas = getLocalData<any>(STORAGE_KEYS.CORRIDAS);
      
      // 1. Filtra as corridas desse amigo e ordena da mais ANTIGA para a mais NOVA
      const corridasDoAmigo = corridas
        .filter(c => c.participantesIds.includes(amigoId))
        .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

      let saldoRestante = valorPago;

      // 2. Percorre as corridas quitando o que der
      for (let corrida of corridasDoAmigo) {
        if (saldoRestante <= 0) break; // Se o dinheiro acabou, para.

        const valorDaParte = corrida.valorTotal / (corrida.participantesIds.length + 1);
        if (!corrida.pagamentos) corrida.pagamentos = {};
        
        const valorJaPago = corrida.pagamentos[amigoId] || 0;
        const faltaPagarNessaCorrida = valorDaParte - valorJaPago;

        if (faltaPagarNessaCorrida > 0) {
          if (saldoRestante >= faltaPagarNessaCorrida) {
            // Quita a corrida inteira
            corrida.pagamentos[amigoId] = valorJaPago + faltaPagarNessaCorrida;
            saldoRestante -= faltaPagarNessaCorrida;
          } else {
            // Quita só uma parte (o saldo não deu pra tudo)
            corrida.pagamentos[amigoId] = valorJaPago + saldoRestante;
            saldoRestante = 0; 
          }
        }
      }

      // 3. Salva de volta no banco
      setLocalData(STORAGE_KEYS.CORRIDAS, corridas);
    }
  },

  // ==========================================
  // SERVIÇO DE CONFIGURAÇÕES
  // ==========================================

  settings: {
    get: async () => {
      await delay(100);
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) return JSON.parse(data);
      
      // Valores padrão na primeira vez que o usuário abre o app
      return { 
        nome: 'Ariel', 
        pix: 'arielmoraes05@gmail.com',
        notificacoes: true
      };
    },
    
    save: async (config: any) => {
      await delay(100);
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(config));
      return config;
    },

    // Função bônus para desenvolvimento: Apaga tudo
    clearAllData: async () => {
      await delay(300);
      localStorage.clear();
    }
  }
};
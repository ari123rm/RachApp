// src/types/index.ts

export interface Amigo {
  id: string;
  nome: string;
  telefone: string;
  cor: string;
  favorito: boolean;
}

export interface Corrida {
  id: string;
  titulo: string;
  valorTotal: number; // Vamos salvar como número puro no banco (ex: 24.50)
  data: string;       // Formato ISO ou YYYY-MM-DD
  tag: string;
  participantesIds: string[]; // Salvamos apenas os IDs de quem participou
  isPaied?: boolean;
  pagamentos?: Record<string, number>; // { amigoId: valorPago }
}
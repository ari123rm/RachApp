import axios from 'axios';
import type { Amigo, Corrida } from '../types';

export const api = axios.create({
  baseURL: 'http://localhost:5000/api', // URL do seu backend
});

// Injeta o Token JWT em todas as requisições automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@Rachapp:token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const dbService = {
  auth: {
    login: async (email: string, password_plain: string) => {
      const { data } = await api.post('/auth/login', { email, password: password_plain });
      
      localStorage.setItem('@Rachapp:token', data.token);
      localStorage.setItem('@Rachapp:user', JSON.stringify(data.user));
      return data;
    },
    register: async (userData: any) => {
      const { data } = await api.post('/auth/register', userData);
      return data;
    },
    logout: () => {
      localStorage.removeItem('@Rachapp:token');
      localStorage.removeItem('@Rachapp:user');
    },
    verify: async (email: string, code: string) => {
      const { data } = await api.post('/auth/verify', { email, code });
      return data;
    },
    
  },
  amigos: {
    getAll: async (): Promise<Amigo[]> => (await api.get('/friends')).data,
    create: async (amigo: Omit<Amigo, 'id'>) => (await api.post('/friends', amigo)).data,
    delete: async (id: string) => api.delete(`/friends/${id}`),
    toggleFavorito: async (id: string) => api.patch(`/friends/${id}/favorite`)
  },
  grupos: {
    getAll: async () => (await api.get('/groups')).data,
    create: async (name: string) => (await api.post('/groups', { name })).data,
    getById: async (id: string) => (await api.get(`/groups/${id}`)).data,
    addMember: async (id: string, identifier: string) => (await api.post(`/groups/${id}/members`, { identifier })).data,
  },
  dashboard: {
    get: async () => (await api.get('/finances/dashboard')).data
  },
  // As chamadas de finanças precisarão de endpoints dedicados no backend para listar o histórico global,
  // mas a estrutura de chamadas permanece a mesma do seu app original.
  settings: {
    get: async () => {
      const userStr = localStorage.getItem('@Rachapp:user');
      return userStr ? JSON.parse(userStr) : { nome: 'Usuário', pix: '', notificacoes: true };
    },
    clearAllData: async () => dbService.auth.logout(),
    updateProfile: async (data: { name?: string; pix_key?: string }) => {
      const res = await api.put('/auth/profile', data);
      localStorage.setItem('@Rachapp:user', JSON.stringify(res.data)); // Atualiza o cache local
      return res.data;
    },
    updatePassword: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await api.put('/auth/password', data);
      return res.data;
    },
  }
};
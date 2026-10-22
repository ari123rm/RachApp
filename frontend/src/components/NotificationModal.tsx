// src/components/NotificationModal.tsx
import { useState, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  DollarSign,
  Users,
  Car,
  Clock,
  Sparkles,
} from 'lucide-react';
import { dbService } from '../services/database';
import type { AppNotification } from '../types';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChange?: () => void;
}

function formatNotificationDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `Hoje às ${hora}`;
    }

    const ontem = new Date(now);
    ontem.setDate(now.getDate() - 1);
    const isOntem =
      d.getDate() === ontem.getDate() &&
      d.getMonth() === ontem.getMonth() &&
      d.getFullYear() === ontem.getFullYear();

    if (isOntem) {
      return `Ontem às ${hora}`;
    }

    const diaMes = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${diaMes} às ${hora}`;
  } catch {
    return dateStr;
  }
}

export function NotificationModal({ isOpen, onClose, onDataChange }: NotificationModalProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const carregarNotificacoes = async () => {
    try {
      const list = await dbService.notifications.list();
      setNotifications(list);
    } catch (err) {
      console.warn('Erro ao carregar notificações:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarNotificacoes();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMarkAsRead = async (id: string) => {
    await dbService.notifications.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    if (onDataChange) onDataChange();
  };

  const handleMarkAllAsRead = async () => {
    await dbService.notifications.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (onDataChange) onDataChange();
  };

  const handleDelete = async (id: string) => {
    await dbService.notifications.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (onDataChange) onDataChange();
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIconForType = (type: string) => {
    switch (type) {
      case 'PAYMENT_RECEIVED':
        return <DollarSign size={18} className="text-emerald-400" />;
      case 'GROUP_INVITE':
        return <Users size={18} className="text-sky-400" />;
      case 'EXPENSE_ADDED':
      default:
        return <Car size={18} className="text-[#2DD4BF]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-[#141a23] border border-gray-800 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-4 border-b border-gray-800/80 flex items-center justify-between bg-[#0e131a]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2DD4BF]/15 text-[#2DD4BF] flex items-center justify-center border border-[#2DD4BF]/20">
              <Bell size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Notificações
                {unreadCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#2DD4BF] text-[#05080f]">
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400">Atividades e atualizações da sua conta</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                title="Marcar todas como lidas"
                className="p-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors flex items-center gap-1"
              >
                <CheckCheck size={16} />
                <span className="hidden sm:inline text-xs">Lidas</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Lista de Notificações */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              Carregando notificações...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-800/40 text-gray-600 flex items-center justify-center border border-gray-800">
                <Sparkles size={24} />
              </div>
              <p className="text-sm font-semibold text-gray-300">Tudo em dia!</p>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Você será notificado aqui e em tempo real quando amigos adicionarem você a rachas, pagarem dívidas ou adicionarem você a grupos.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.read) handleMarkAsRead(notif.id);
                }}
                className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                  notif.read
                    ? 'bg-[#18202c]/40 border-gray-800/50 opacity-75'
                    : 'bg-[#1a2332] border-[#2DD4BF]/30 shadow-md'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-gray-800/80 flex items-center justify-center shrink-0 border border-gray-700/50 mt-0.5">
                    {getIconForType(notif.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white truncate">{notif.title}</p>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-[#2DD4BF] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed break-words">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-500">
                      <Clock size={11} />
                      <span>{formatNotificationDate(notif.created_at)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(notif.id);
                  }}
                  title="Excluir notificação"
                  className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800/40 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

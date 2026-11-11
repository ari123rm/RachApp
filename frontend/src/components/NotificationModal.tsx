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
  FileCheck,
  ChevronRight,
} from 'lucide-react';
import { dbService } from '../services/database';
import type { AppNotification } from '../types';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChange?: () => void;
  onOpenRide?: (expenseId: string) => void;
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

export function NotificationModal({ isOpen, onClose, onDataChange, onOpenRide }: NotificationModalProps) {
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

  const handleItemClick = async (notif: AppNotification) => {
    if (!notif.read) {
      await handleMarkAsRead(notif.id);
    }
    const expenseId = notif.data?.expenseId || notif.data?.expense_id;
    if (expenseId && onOpenRide) {
      onClose();
      onOpenRide(expenseId);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIconForType = (type: string) => {
    switch (type) {
      case 'RECEIPT_UPLOADED':
        return <FileCheck size={18} strokeWidth={2} className="text-[#10B981]" />;
      case 'PAYMENT_RECEIVED':
        return <DollarSign size={18} strokeWidth={2} className="text-[#10B981]" />;
      case 'GROUP_INVITE':
        return <Users size={18} strokeWidth={2} className="text-[#0F766E]" />;
      case 'EXPENSE_ADDED':
      default:
        return <Car size={18} strokeWidth={2} className="text-[#0F766E]" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-t-2xl sm:rounded-2xl max-h-[92dvh] sm:max-h-[85vh] flex flex-col shadow-lg overflow-hidden pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle visual mobile */}
        <div className="w-12 h-1 bg-[var(--border-color)] rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Cabeçalho */}
        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#CCFBF1] text-[#0F766E] flex items-center justify-center shrink-0">
              <Bell size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-h2 text-[var(--text-primary)] flex items-center gap-2">
                Notificações
                {unreadCount > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0F766E] text-white">
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Atividades e atualizações da sua conta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                title="Marcar todas como lidas"
                className="p-2 rounded-xl text-xs font-semibold text-[#0F766E] hover:bg-[#CCFBF1]/50 transition-colors flex items-center gap-1"
              >
                <CheckCheck size={16} strokeWidth={2} />
                <span className="hidden sm:inline text-xs">Lidas</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <X size={20} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Lista de Notificações */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-[var(--text-secondary)] text-sm">
              Carregando notificações...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] flex items-center justify-center border border-[var(--border-color)]">
                <Sparkles size={24} strokeWidth={2} />
              </div>
              <p className="text-base font-display font-semibold text-[var(--text-primary)]">
                Tudo em dia!
              </p>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto leading-relaxed">
                Você será notificado aqui e em tempo real quando amigos adicionarem você a rachas, pagarem dívidas ou adicionarem você a grupos.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const hasRide = Boolean(notif.data?.expenseId || notif.data?.expense_id);
              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                    hasRide ? 'cursor-pointer hover:border-[#0F766E]/50 active:scale-[0.99]' : ''
                  } ${
                    notif.read
                      ? 'bg-[var(--bg-subtle)]/60 border-[var(--border-color)] opacity-80'
                      : 'bg-[var(--bg-surface)] border-[#0F766E]/30 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center shrink-0 border border-[var(--border-color)] mt-0.5">
                      {getIconForType(notif.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-display font-semibold text-[var(--text-primary)] truncate">
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-[#0F766E] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed break-words">
                        {notif.message}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                          <Clock size={12} strokeWidth={2} />
                          <span>{formatNotificationDate(notif.created_at)}</span>
                        </div>
                        {hasRide && (
                          <div className="flex items-center gap-0.5 text-xs font-semibold text-[#0F766E]">
                            <span>Ver racha</span>
                            <ChevronRight size={14} strokeWidth={2} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(notif.id);
                    }}
                    title="Excluir notificação"
                    className="text-[var(--text-secondary)] hover:text-[#F43F5E] p-1.5 rounded-lg hover:bg-[var(--rose-bg)] transition-colors shrink-0"
                  >
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

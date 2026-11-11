// src/components/ThemeSelectorModal.tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Check,
  Palette,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { useModalBackHandler } from '../utils/modalBackHandler';
import { SCALAR_THEMES, useTheme, type ThemeMode, type ThemePreset } from '../utils/theme';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ThemeFilter = 'all' | 'light' | 'dark';

export function ThemeSelectorModal({ isOpen, onClose }: ThemeSelectorModalProps) {
  const { theme, setTheme, preset: currentPreset } = useTheme();
  const [filter, setFilter] = useState<ThemeFilter>('all');

  useModalBackHandler(isOpen, onClose);

  if (!isOpen) return null;

  const lightThemes = SCALAR_THEMES.filter((t) => !t.isDark);
  const darkThemes = SCALAR_THEMES.filter((t) => t.isDark);

  const renderThemeCard = (preset: ThemePreset) => {
    const isSelected = theme === preset.id;
    return (
      <button
        key={preset.id}
        type="button"
        onClick={() => setTheme(preset.id as ThemeMode)}
        className={`group text-left rounded-2xl p-3 border transition-all relative overflow-hidden flex flex-col justify-between active:scale-[0.98] ${
          isSelected
            ? 'border-[var(--primary)] ring-2 ring-[var(--primary-focus-ring)] bg-[var(--bg-subtle)] shadow-sm'
            : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--primary)]/50'
        }`}
      >
        {/* Mini Preview Visual das Cores do Tema */}
        <div
          className="w-full h-14 rounded-xl p-2.5 flex flex-col justify-between border border-black/10 dark:border-white/10 mb-2.5 relative overflow-hidden"
          style={{ backgroundColor: preset.preview.bg }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full shadow-xs"
                style={{ backgroundColor: preset.preview.accent }}
              />
              <span
                className="w-10 h-1.5 rounded-full opacity-85"
                style={{ backgroundColor: preset.preview.text }}
              />
            </div>
            {isSelected && (
              <span
                className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-white shadow-sm"
                style={{ backgroundColor: preset.preview.accent }}
              >
                <Check size={11} strokeWidth={3} />
              </span>
            )}
          </div>

          <div
            className="w-full h-4.5 rounded-md flex items-center justify-between px-2 border border-black/5 dark:border-white/5"
            style={{ backgroundColor: preset.preview.surface }}
          >
            <div className="flex items-center gap-1">
              <span
                className="w-2.5 h-1.5 rounded-full"
                style={{ backgroundColor: preset.preview.accent }}
              />
              <span
                className="w-8 h-1.5 rounded-full opacity-55"
                style={{ backgroundColor: preset.preview.text }}
              />
            </div>
            <span
              className="w-3 h-1.5 rounded-full opacity-75"
              style={{ backgroundColor: preset.preview.accent }}
            />
          </div>
        </div>

        {/* Nome e Descrição do Tema */}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <p className="text-xs font-display font-bold text-[var(--text-primary)] truncate">
              {preset.name}
            </p>
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10 dark:border-white/15"
              style={{ backgroundColor: preset.preview.accent }}
              title={`Destaque: ${preset.preview.accent}`}
            />
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
            {preset.subtitle}
          </p>
        </div>
      </button>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col overflow-hidden animate-fade-in">
      {/* Cabeçalho Fixo da Tela de Temas */}
      <header className="bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-color)] px-4 sm:px-6 pt-[max(2.25rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-3.5 shrink-0">
        <div className="max-w-lg md:max-w-xl lg:max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--primary)] flex items-center justify-center transition-all active:scale-95 shrink-0"
              title="Voltar para Configurações"
            >
              <ChevronLeft size={20} strokeWidth={2.2} />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-display font-bold text-[var(--text-primary)] truncate">
                Temas & Aparência
              </h1>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {SCALAR_THEMES.length} temas inspirados em Scalar, GitHub, Notion e Catppuccin
              </p>
            </div>
          </div>

          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-[var(--primary-light)] text-[var(--primary)] shrink-0 hidden sm:inline-flex items-center gap-1.5">
            <Sparkles size={12} strokeWidth={2.2} />
            <span>{currentPreset.name}</span>
          </span>
        </div>
      </header>

      {/* Conteúdo Rolável */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] max-w-lg md:max-w-xl lg:max-w-2xl w-full mx-auto space-y-5 scrollbar-hide">
        {/* Card do Tema Ativo + Filtros Rápidos */}
        <section className="ds-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
                <Palette size={19} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-display font-bold text-[var(--text-primary)] truncate">
                    {currentPreset.name}
                  </h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-secondary)] shrink-0">
                    {currentPreset.isDark ? 'Escuro' : 'Claro'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                  {currentPreset.subtitle}
                </p>
              </div>
            </div>

            {/* Amostra das cores atuais */}
            <div className="flex items-center -space-x-1.5 shrink-0">
              <span
                className="w-6 h-6 rounded-full border-2 border-[var(--bg-surface)] shadow-xs"
                style={{ backgroundColor: currentPreset.preview.bg }}
              />
              <span
                className="w-6 h-6 rounded-full border-2 border-[var(--bg-surface)] shadow-xs"
                style={{ backgroundColor: currentPreset.preview.surface }}
              />
              <span
                className="w-6 h-6 rounded-full border-2 border-[var(--bg-surface)] shadow-xs"
                style={{ backgroundColor: currentPreset.preview.accent }}
              />
            </div>
          </div>

          {/* Abas de Filtro: Todos / Claros / Escuros */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`h-10 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                filter === 'all'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>Todos ({SCALAR_THEMES.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter('light')}
              className={`h-10 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                filter === 'light'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sun size={14} strokeWidth={2.2} />
              <span>Claros ({lightThemes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter('dark')}
              className={`h-10 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${
                filter === 'dark'
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-color)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Moon size={14} strokeWidth={2.2} />
              <span>Escuros ({darkThemes.length})</span>
            </button>
          </div>
        </section>

        {/* Seção: Temas Claros */}
        {(filter === 'all' || filter === 'light') && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--amber-bg)] text-[#F59E0B] flex items-center justify-center">
                  <Sun size={15} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-[var(--text-primary)]">
                    Temas Claros
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Tons suaves, solares e de alta legibilidade diurna
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {lightThemes.length} opções
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {lightThemes.map(renderThemeCard)}
            </div>
          </section>
        )}

        {/* Seção: Temas Escuros */}
        {(filter === 'all' || filter === 'dark') && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center">
                  <Moon size={15} strokeWidth={2.2} />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-[var(--text-primary)]">
                    Temas Escuros
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Conforto visual noturno e alto contraste
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {darkThemes.length} opções
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {darkThemes.map(renderThemeCard)}
            </div>
          </section>
        )}
      </div>
    </div>,
    document.body
  );
}

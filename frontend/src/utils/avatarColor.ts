// src/utils/avatarColor.ts

export const TAILWIND_COLOR_MAP: Record<string, string> = {
  'bg-sky-500': '#0ea5e9',
  'bg-pink-500': '#ec4899',
  'bg-amber-500': '#f59e0b',
  'bg-green-500': '#22c55e',
  'bg-purple-500': '#a855f7',
  'bg-indigo-500': '#6366f1',
  'bg-teal-500': '#14b8a6',
  'bg-emerald-500': '#10b981',
  'bg-blue-500': '#3b82f6',
  'bg-red-500': '#ef4444',
  'bg-rose-500': '#f43f5e',
  'bg-orange-500': '#f97316',
  'bg-cyan-500': '#06b6d4',
  'bg-violet-500': '#8b5cf6',
  'bg-fuchsia-500': '#d946ef',
  'bg-yellow-500': '#eab308',
  'bg-lime-500': '#84cc16',
};

export const PRESET_AVATAR_COLORS = [
  '#0ea5e9', // Sky
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#22c55e', // Green
  '#a855f7', // Purple
  '#6366f1', // Indigo
];

/**
 * Retorna uma cor hexadecimal válida para o fundo do avatar,
 * garantindo que qualquer formato (classe Tailwind, hex, rgb ou nulo) tenha sempre uma cor visível.
 */
export function getAvatarColor(cor?: string | null): string {
  if (!cor || typeof cor !== 'string') return '#0ea5e9';
  const trimmed = cor.trim();
  if (!trimmed) return '#0ea5e9';

  if (trimmed.startsWith('#') || trimmed.startsWith('rgb') || trimmed.startsWith('hsl')) {
    return trimmed;
  }

  return TAILWIND_COLOR_MAP[trimmed] || '#0ea5e9';
}

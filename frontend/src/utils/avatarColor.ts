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
  'bg-[#2DD4BF]': '#2dd4bf',
  'bg-[#2dd4bf]': '#2dd4bf',
};

// 14 cores modernas, vibrantes e com excelente contraste no modo escuro
export const PRESET_AVATAR_COLORS = [
  '#2DD4BF', // Teal (marca do RachApp)
  '#06B6D4', // Cyan
  '#0EA5E9', // Sky
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#64748B', // Slate
];

/**
 * Converte HSL (Hue, Saturation %, Lightness %) para Hexadecimal (#RRGGBB)
 */
export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/**
 * Converte Hexadecimal (#RRGGBB) para HSL ({ h, s, l })
 */
export function hexToHsl(hexStr: string): { h: number; s: number; l: number } {
  let hex = (hexStr || '').trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const num = parseInt(hex, 16);
  if (isNaN(num)) return { h: 172, s: 66, l: 50 };

  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = Math.round(h * 60);
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Verifica se uma string é um hexadecimal válido (#RGB ou #RRGGBB)
 */
export function isValidHex(hexStr: string): boolean {
  if (!hexStr) return false;
  return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hexStr.trim());
}

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

  // Suporte a classes customizadas no formato bg-[#2DD4BF]
  if (trimmed.startsWith('bg-[') && trimmed.endsWith(']')) {
    return trimmed.slice(4, -1);
  }

  return TAILWIND_COLOR_MAP[trimmed] || '#0ea5e9';
}

/**
 * Retorna uma cor hexadecimal consistente para o avatar de um grupo
 */
export function getGroupAvatarColor(seed?: string | null): string {
  if (!seed || typeof seed !== 'string') return '#6366F1';
  const trimmed = seed.trim();
  if (!trimmed) return '#6366F1';

  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('rgb') ||
    trimmed.startsWith('hsl') ||
    trimmed.startsWith('bg-')
  ) {
    return getAvatarColor(trimmed);
  }

  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return PRESET_AVATAR_COLORS[hash % PRESET_AVATAR_COLORS.length];
}

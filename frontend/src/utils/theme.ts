// src/utils/theme.ts
import { useState, useEffect } from 'react';

export type ThemeMode =
  | 'light'
  | 'scalar-light'
  | 'github-light'
  | 'notion-light'
  | 'catppuccin-latte'
  | 'rose-pine-dawn'
  | 'solarized-light'
  | 'mint-breeze'
  | 'dark'
  | 'deep-space'
  | 'purple'
  | 'moon'
  | 'blue-planet'
  | 'kepler'
  | 'mars'
  | 'saturn'
  | 'solarized'
  | 'laserwave';

export interface ThemePreset {
  id: ThemeMode;
  name: string;
  subtitle: string;
  isDark: boolean;
  preview: {
    bg: string;
    surface: string;
    accent: string;
    text: string;
  };
  tokens: {
    bgApp: string;
    bgSurface: string;
    bgSubtle: string;
    bgMuted: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    borderColor: string;
    primary: string;
    primaryLight: string;
    primaryDark: string;
    primaryFocusRing: string;
  };
}

export const SCALAR_THEMES: ThemePreset[] = [
  // ==========================================
  // TEMAS CLAROS (LIGHT THEMES)
  // ==========================================
  {
    id: 'light',
    name: 'Default Light',
    subtitle: 'RachApp Slate & Teal',
    isDark: false,
    preview: {
      bg: '#F8FAFC',
      surface: '#FFFFFF',
      accent: '#0F766E',
      text: '#0F172A',
    },
    tokens: {
      bgApp: '#F8FAFC',
      bgSurface: '#FFFFFF',
      bgSubtle: '#F1F5F9',
      bgMuted: '#E2E8F0',
      textPrimary: '#0F172A',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
      borderColor: '#E2E8F0',
      primary: '#0F766E',
      primaryLight: '#CCFBF1',
      primaryDark: '#115E59',
      primaryFocusRing: 'rgba(15, 118, 110, 0.2)',
    },
  },
  {
    id: 'scalar-light',
    name: 'Scalar Light',
    subtitle: 'Scalar Daylight & Indigo',
    isDark: false,
    preview: {
      bg: '#F6F6F9',
      surface: '#FFFFFF',
      accent: '#4F46E5',
      text: '#18181B',
    },
    tokens: {
      bgApp: '#F6F6F9',
      bgSurface: '#FFFFFF',
      bgSubtle: '#EFEFF5',
      bgMuted: '#E4E4ED',
      textPrimary: '#18181B',
      textSecondary: '#52525B',
      textMuted: '#A1A1AA',
      borderColor: '#E4E4E7',
      primary: '#4F46E5',
      primaryLight: '#EEF2FF',
      primaryDark: '#3730A3',
      primaryFocusRing: 'rgba(79, 70, 229, 0.2)',
    },
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    subtitle: 'Primer Alabaster & Blue',
    isDark: false,
    preview: {
      bg: '#F6F8FA',
      surface: '#FFFFFF',
      accent: '#0969DA',
      text: '#1F2328',
    },
    tokens: {
      bgApp: '#F6F8FA',
      bgSurface: '#FFFFFF',
      bgSubtle: '#EAEEF2',
      bgMuted: '#D0D7DE',
      textPrimary: '#1F2328',
      textSecondary: '#59636E',
      textMuted: '#8C959F',
      borderColor: '#D8DEE4',
      primary: '#0969DA',
      primaryLight: '#DDF4FF',
      primaryDark: '#0550AE',
      primaryFocusRing: 'rgba(9, 105, 218, 0.2)',
    },
  },
  {
    id: 'notion-light',
    name: 'Notion Warm',
    subtitle: 'Warm Paper & Terracotta',
    isDark: false,
    preview: {
      bg: '#F7F6F3',
      surface: '#FFFFFF',
      accent: '#D9730D',
      text: '#37352F',
    },
    tokens: {
      bgApp: '#F7F6F3',
      bgSurface: '#FFFFFF',
      bgSubtle: '#EFECE6',
      bgMuted: '#E3E0D8',
      textPrimary: '#2F2D28',
      textSecondary: '#6B675E',
      textMuted: '#9B978E',
      borderColor: '#E6E4DD',
      primary: '#D9730D',
      primaryLight: '#FEF3C7',
      primaryDark: '#B45309',
      primaryFocusRing: 'rgba(217, 115, 13, 0.2)',
    },
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    subtitle: 'Creamy Latte & Mauve',
    isDark: false,
    preview: {
      bg: '#EFF1F5',
      surface: '#FFFFFF',
      accent: '#8839EF',
      text: '#4C4F69',
    },
    tokens: {
      bgApp: '#EFF1F5',
      bgSurface: '#FFFFFF',
      bgSubtle: '#E6E9EF',
      bgMuted: '#CCD0DA',
      textPrimary: '#4C4F69',
      textSecondary: '#6C6F85',
      textMuted: '#8C8FA1',
      borderColor: '#DCE0E8',
      primary: '#7C3AED',
      primaryLight: '#F3E8FF',
      primaryDark: '#5B21B6',
      primaryFocusRing: 'rgba(124, 58, 237, 0.2)',
    },
  },
  {
    id: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn',
    subtitle: 'Soft Floral & Rose',
    isDark: false,
    preview: {
      bg: '#FAF4ED',
      surface: '#FFFAF3',
      accent: '#B4637A',
      text: '#575279',
    },
    tokens: {
      bgApp: '#FAF4ED',
      bgSurface: '#FFFAF3',
      bgSubtle: '#F2E9E1',
      bgMuted: '#DFDAD9',
      textPrimary: '#575279',
      textSecondary: '#797593',
      textMuted: '#9893A5',
      borderColor: '#E8DFD5',
      primary: '#BE185D',
      primaryLight: '#FCE7F3',
      primaryDark: '#9D174D',
      primaryFocusRing: 'rgba(190, 24, 93, 0.18)',
    },
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    subtitle: 'Warm Parchment & Cyan',
    isDark: false,
    preview: {
      bg: '#FDF6E3',
      surface: '#FFFBF0',
      accent: '#2AA198',
      text: '#073642',
    },
    tokens: {
      bgApp: '#FDF6E3',
      bgSurface: '#FFFBF0',
      bgSubtle: '#EEE8D5',
      bgMuted: '#E1DBCB',
      textPrimary: '#073642',
      textSecondary: '#586E75',
      textMuted: '#839496',
      borderColor: '#E5DFCC',
      primary: '#0D9488',
      primaryLight: '#CCFBF1',
      primaryDark: '#115E59',
      primaryFocusRing: 'rgba(13, 148, 136, 0.22)',
    },
  },
  {
    id: 'mint-breeze',
    name: 'Mint Breeze',
    subtitle: 'Fresh Sage & Emerald',
    isDark: false,
    preview: {
      bg: '#F2FAF6',
      surface: '#FFFFFF',
      accent: '#059669',
      text: '#064E3B',
    },
    tokens: {
      bgApp: '#F2FAF6',
      bgSurface: '#FFFFFF',
      bgSubtle: '#E6F5EE',
      bgMuted: '#D1FAE5',
      textPrimary: '#064E3B',
      textSecondary: '#3F6A58',
      textMuted: '#6B9080',
      borderColor: '#D8EDE3',
      primary: '#059669',
      primaryLight: '#D1FAE5',
      primaryDark: '#047857',
      primaryFocusRing: 'rgba(5, 150, 105, 0.2)',
    },
  },

  // ==========================================
  // TEMAS ESCUROS (DARK THEMES)
  // ==========================================
  {
    id: 'dark',
    name: 'Default Dark',
    subtitle: 'Slate Dark & Teal',
    isDark: true,
    preview: {
      bg: '#0F172A',
      surface: '#1E293B',
      accent: '#14B8A6',
      text: '#F8FAFC',
    },
    tokens: {
      bgApp: '#0F172A',
      bgSurface: '#1E293B',
      bgSubtle: '#131C31',
      bgMuted: '#334155',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      borderColor: '#334155',
      primary: '#0D9488',
      primaryLight: 'rgba(20, 184, 166, 0.16)',
      primaryDark: '#5EEAD4',
      primaryFocusRing: 'rgba(20, 184, 166, 0.28)',
    },
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    subtitle: 'Scalar Cosmic Indigo',
    isDark: true,
    preview: {
      bg: '#090A10',
      surface: '#121521',
      accent: '#6366F1',
      text: '#F8FAFC',
    },
    tokens: {
      bgApp: '#090A10',
      bgSurface: '#121521',
      bgSubtle: '#181C2C',
      bgMuted: '#252B42',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      borderColor: '#22273B',
      primary: '#6366F1',
      primaryLight: 'rgba(99, 102, 241, 0.16)',
      primaryDark: '#818CF8',
      primaryFocusRing: 'rgba(99, 102, 241, 0.28)',
    },
  },
  {
    id: 'purple',
    name: 'Purple',
    subtitle: 'Scalar Royal Violet',
    isDark: true,
    preview: {
      bg: '#100C1C',
      surface: '#1A142D',
      accent: '#8B5CF6',
      text: '#FAF5FF',
    },
    tokens: {
      bgApp: '#100C1C',
      bgSurface: '#1A142D',
      bgSubtle: '#231B3B',
      bgMuted: '#322754',
      textPrimary: '#FAF5FF',
      textSecondary: '#A78BFA',
      textMuted: '#7C3AED',
      borderColor: '#2D234A',
      primary: '#8B5CF6',
      primaryLight: 'rgba(139, 92, 246, 0.18)',
      primaryDark: '#C4B5FD',
      primaryFocusRing: 'rgba(139, 92, 246, 0.3)',
    },
  },
  {
    id: 'moon',
    name: 'Moon',
    subtitle: 'Scalar Lunar Zinc',
    isDark: true,
    preview: {
      bg: '#121316',
      surface: '#1C1D22',
      accent: '#38BDF8',
      text: '#F4F4F5',
    },
    tokens: {
      bgApp: '#121316',
      bgSurface: '#1C1D22',
      bgSubtle: '#25272E',
      bgMuted: '#343741',
      textPrimary: '#F4F4F5',
      textSecondary: '#A1A1AA',
      textMuted: '#71717A',
      borderColor: '#2C2E37',
      primary: '#0284C7',
      primaryLight: 'rgba(56, 189, 248, 0.16)',
      primaryDark: '#7DD3FC',
      primaryFocusRing: 'rgba(56, 189, 248, 0.28)',
    },
  },
  {
    id: 'blue-planet',
    name: 'Blue Planet',
    subtitle: 'Scalar Ocean & Sky',
    isDark: true,
    preview: {
      bg: '#071324',
      surface: '#0E213D',
      accent: '#0EA5E9',
      text: '#F0F9FF',
    },
    tokens: {
      bgApp: '#071324',
      bgSurface: '#0E213D',
      bgSubtle: '#142C50',
      bgMuted: '#1E3F70',
      textPrimary: '#F0F9FF',
      textSecondary: '#93C5FD',
      textMuted: '#60A5FA',
      borderColor: '#1B3864',
      primary: '#0284C7',
      primaryLight: 'rgba(14, 165, 233, 0.18)',
      primaryDark: '#7DD3FC',
      primaryFocusRing: 'rgba(14, 165, 233, 0.3)',
    },
  },
  {
    id: 'kepler',
    name: 'Kepler',
    subtitle: 'Scalar Midnight Blue',
    isDark: true,
    preview: {
      bg: '#0B0F19',
      surface: '#131B2E',
      accent: '#3B82F6',
      text: '#F8FAFC',
    },
    tokens: {
      bgApp: '#0B0F19',
      bgSurface: '#131B2E',
      bgSubtle: '#1A2540',
      bgMuted: '#263559',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      borderColor: '#22304F',
      primary: '#2563EB',
      primaryLight: 'rgba(59, 130, 246, 0.18)',
      primaryDark: '#93C5FD',
      primaryFocusRing: 'rgba(59, 130, 246, 0.3)',
    },
  },
  {
    id: 'mars',
    name: 'Mars',
    subtitle: 'Scalar Martian Crimson',
    isDark: true,
    preview: {
      bg: '#160B0E',
      surface: '#241217',
      accent: '#E11D48',
      text: '#FFF1F2',
    },
    tokens: {
      bgApp: '#160B0E',
      bgSurface: '#241217',
      bgSubtle: '#31181F',
      bgMuted: '#47222C',
      textPrimary: '#FFF1F2',
      textSecondary: '#FDA4AF',
      textMuted: '#FB7185',
      borderColor: '#3D1D26',
      primary: '#E11D48',
      primaryLight: 'rgba(225, 29, 72, 0.18)',
      primaryDark: '#FDA4AF',
      primaryFocusRing: 'rgba(225, 29, 72, 0.3)',
    },
  },
  {
    id: 'saturn',
    name: 'Saturn',
    subtitle: 'Scalar Warm Amber',
    isDark: true,
    preview: {
      bg: '#141210',
      surface: '#211D1A',
      accent: '#D97706',
      text: '#FAFAF9',
    },
    tokens: {
      bgApp: '#141210',
      bgSurface: '#211D1A',
      bgSubtle: '#2C2622',
      bgMuted: '#3F3630',
      textPrimary: '#FAFAF9',
      textSecondary: '#A8A29E',
      textMuted: '#78716C',
      borderColor: '#362F2A',
      primary: '#D97706',
      primaryLight: 'rgba(217, 119, 6, 0.18)',
      primaryDark: '#FCD34D',
      primaryFocusRing: 'rgba(217, 119, 6, 0.3)',
    },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    subtitle: 'Scalar Solarized Teal',
    isDark: true,
    preview: {
      bg: '#002B36',
      surface: '#073642',
      accent: '#2AA198',
      text: '#FDF6E3',
    },
    tokens: {
      bgApp: '#002B36',
      bgSurface: '#073642',
      bgSubtle: '#0B4351',
      bgMuted: '#125464',
      textPrimary: '#FDF6E3',
      textSecondary: '#93A1A1',
      textMuted: '#657B83',
      borderColor: '#114B59',
      primary: '#2AA198',
      primaryLight: 'rgba(42, 161, 152, 0.2)',
      primaryDark: '#5EEAD4',
      primaryFocusRing: 'rgba(42, 161, 152, 0.3)',
    },
  },
  {
    id: 'laserwave',
    name: 'Laserwave',
    subtitle: 'Scalar Synthwave Pink',
    isDark: true,
    preview: {
      bg: '#171024',
      surface: '#241938',
      accent: '#DB2777',
      text: '#FDF2F8',
    },
    tokens: {
      bgApp: '#171024',
      bgSurface: '#241938',
      bgSubtle: '#30214B',
      bgMuted: '#432E68',
      textPrimary: '#FDF2F8',
      textSecondary: '#F472B6',
      textMuted: '#EC4899',
      borderColor: '#3A2859',
      primary: '#DB2777',
      primaryLight: 'rgba(219, 39, 119, 0.18)',
      primaryDark: '#F9A8D4',
      primaryFocusRing: 'rgba(219, 39, 119, 0.3)',
    },
  },
];

const THEME_STORAGE_KEY = 'rachapp_theme';
const THEME_EVENT_NAME = 'rachapp-theme-change';

export function getThemePreset(theme: string | null | undefined): ThemePreset {
  return SCALAR_THEMES.find((t) => t.id === theme) || SCALAR_THEMES[0];
}

export function getSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && SCALAR_THEMES.some((t) => t.id === saved)) {
      return saved as ThemeMode;
    }
  } catch {
    // ignore storage errors
  }
  return 'light';
}

export function applyTheme(theme: ThemeMode): void {
  const preset = getThemePreset(theme);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, preset.id);
  } catch {
    // ignore storage errors
  }

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('data-theme', preset.id);

    if (preset.isDark) {
      root.classList.add('dark');
      document.body?.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      document.body?.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    root.style.setProperty('--bg-app', preset.tokens.bgApp);
    root.style.setProperty('--bg-surface', preset.tokens.bgSurface);
    root.style.setProperty('--bg-subtle', preset.tokens.bgSubtle);
    root.style.setProperty('--bg-muted', preset.tokens.bgMuted);
    root.style.setProperty('--text-primary', preset.tokens.textPrimary);
    root.style.setProperty('--text-secondary', preset.tokens.textSecondary);
    root.style.setProperty('--text-muted', preset.tokens.textMuted);
    root.style.setProperty('--border-color', preset.tokens.borderColor);
    root.style.setProperty('--primary', preset.tokens.primary);
    root.style.setProperty('--primary-light', preset.tokens.primaryLight);
    root.style.setProperty('--primary-dark', preset.tokens.primaryDark);
    root.style.setProperty('--primary-focus-ring', preset.tokens.primaryFocusRing);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', preset.tokens.bgApp);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_EVENT_NAME, { detail: preset.id }));
  }
}

export function initTheme(): ThemeMode {
  const theme = getSavedTheme();
  applyTheme(theme);
  return theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => getSavedTheme());

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeMode>;
      if (customEvent.detail) {
        setThemeState(customEvent.detail);
      } else {
        setThemeState(getSavedTheme());
      }
    };

    window.addEventListener(THEME_EVENT_NAME, handleThemeChange);
    return () => window.removeEventListener(THEME_EVENT_NAME, handleThemeChange);
  }, []);

  const setTheme = (nextTheme: ThemeMode) => {
    applyTheme(nextTheme);
    setThemeState(nextTheme);
  };

  const preset = getThemePreset(theme);

  const toggleTheme = () => {
    setTheme(preset.isDark ? 'light' : 'dark');
  };

  return {
    theme,
    preset,
    themes: SCALAR_THEMES,
    isDark: preset.isDark,
    setTheme,
    toggleTheme,
  };
}

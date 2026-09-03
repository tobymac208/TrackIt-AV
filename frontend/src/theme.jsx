import { createContext, useContext, useEffect, useState } from 'react';

export const THEME_KEY = 'avtracker-theme';

export const THEMES = [
  {
    id: 'light',
    label: 'Light',
    description: 'Bright surfaces with navy sidebar and blue accents.',
    swatches: ['#f4f6f9', '#ffffff', '#2563eb', '#1a2332'],
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Low-glare charcoal UI with brighter blue accents.',
    swatches: ['#0b1220', '#152033', '#3b82f6', '#e8eef4'],
  },
  {
    id: 'cod',
    label: 'Call of Duty',
    description: 'Black Ops Cold War — near-black, safety orange, and khaki.',
    swatches: ['#0a0a0a', '#161412', '#ff5a00', '#e8e4dc'],
  },
];

export const THEME_IDS = THEMES.map((theme) => theme.id);

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return THEME_IDS.includes(stored) ? stored : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore quota / private-mode failures */
    }
  }, [theme]);

  const setTheme = (next) => {
    if (THEME_IDS.includes(next)) setThemeState(next);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

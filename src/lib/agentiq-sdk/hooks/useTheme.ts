import { atom, useAtom } from 'jotai';

export interface ThemeConfig {
  mode: 'light' | 'dark';
  translucency: 'off' | 'low' | 'high';
  iconPack?: string;
}

const themeAtom = atom<ThemeConfig>({
  mode: 'light',
  translucency: 'low'
});

export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);

  const setMode = (mode: 'light' | 'dark') => {
    setTheme(prev => ({ ...prev, mode }));
  };

  const setTranslucency = (translucency: 'off' | 'low' | 'high') => {
    setTheme(prev => ({ ...prev, translucency }));
  };

  return {
    theme,
    setMode,
    setTranslucency,
    setTheme
  };
}

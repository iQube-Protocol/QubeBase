export const theme = {
  colors: {
    light: {
      background: 'hsl(0 0% 100%)',
      foreground: 'hsl(222.2 84% 4.9%)',
      card: 'hsl(0 0% 100%)',
      'card-foreground': 'hsl(222.2 84% 4.9%)',
      primary: 'hsl(221.2 83.2% 53.3%)',
      'primary-foreground': 'hsl(210 40% 98%)',
      muted: 'hsl(210 40% 96.1%)',
      'muted-foreground': 'hsl(215.4 16.3% 46.9%)',
      accent: 'hsl(210 40% 96.1%)',
      'accent-foreground': 'hsl(222.2 47.4% 11.2%)',
      border: 'hsl(214.3 31.8% 91.4%)'
    },
    dark: {
      background: 'hsl(222.2 84% 4.9%)',
      foreground: 'hsl(210 40% 98%)',
      card: 'hsl(222.2 84% 4.9%)',
      'card-foreground': 'hsl(210 40% 98%)',
      primary: 'hsl(217.2 91.2% 59.8%)',
      'primary-foreground': 'hsl(222.2 47.4% 11.2%)',
      muted: 'hsl(217.2 32.6% 17.5%)',
      'muted-foreground': 'hsl(215 20.2% 65.1%)',
      accent: 'hsl(217.2 32.6% 17.5%)',
      'accent-foreground': 'hsl(210 40% 98%)',
      border: 'hsl(217.2 32.6% 17.5%)'
    }
  },
  translucency: {
    off: 'opacity-100',
    low: 'backdrop-blur-sm bg-opacity-90',
    high: 'backdrop-blur-md bg-opacity-70'
  }
};

export type Theme = typeof theme;

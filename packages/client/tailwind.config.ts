import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'nexus-bg': '#0d1117',
        'nexus-sidebar': '#161b22',
        'nexus-surface': '#21262d',
        'nexus-border': '#30363d',
        'nexus-text': '#e6edf3',
        'nexus-muted': '#8b949e',
        'nexus-accent': '#238636',
        'nexus-blue': '#1f6feb',
      },
    },
  },
  plugins: [],
};

export default config;

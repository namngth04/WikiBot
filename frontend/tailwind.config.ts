import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'be-vietnam': ['var(--font-be-vietnam)', 'sans-serif'],
        'sans': ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'mono': ['Roboto Mono', 'JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        // Màu gốc của WikiBot (giữ lại để đảm bảo tính kế thừa)
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // Hệ màu Đa Theme (Dynamic Theme Colors) sử dụng CSS Variables
        canvas: {
          DEFAULT: 'var(--color-canvas)',
          soft: 'var(--color-canvas-soft)',
        },
        surface: {
          1: 'var(--color-surface-1)',
          2: 'var(--color-surface-2)',
          3: 'var(--color-surface-3)',
          4: 'var(--color-surface-4)',
        },
        hairline: {
          DEFAULT: 'var(--color-hairline)',
          strong: 'var(--color-hairline-strong)',
          tertiary: 'var(--color-hairline-tertiary)',
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          muted: 'var(--color-ink-muted)',
          subtle: 'var(--color-ink-subtle)',
          tertiary: 'var(--color-ink-tertiary)',
        },
        brand: {
          lavender: {
            DEFAULT: 'var(--color-brand-lavender)',
            hover: 'var(--color-brand-lavender-hover)',
            focus: 'var(--color-brand-lavender-focus)',
            active: 'var(--color-brand-lavender-active)',
          },
          secure: 'var(--color-brand-secure)',
        },
        semantic: {
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          overlay: '#000000',
        }
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        'xxl': '24px',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'soft-xl': '0 10px 30px -5px rgba(0, 0, 0, 0.08)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.1) 100%)',
      },
    },
  },
  plugins: [],
};

export default config;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './core.js',
    './render.js',
    './builder.js',
    './widgets.js',
    './pentester.html',
    './pentester.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fadeUp .28s ease-out forwards',
        'pop': 'pop .18s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(.9)' },
          '60%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  // Faqat JS da string birlashtirish orqali dinamik hosil bo'ladigan classlar
  safelist: [
    // Rang classlari — JS da runtime quriladi (rankCls, myCountCls, etc.)
    'text-amber-500','text-slate-400','text-orange-500','text-violet-400',
    'text-violet-500','text-violet-600','text-rose-500','text-rose-600',
    'text-emerald-400','text-emerald-500','text-blue-500','text-sky-500',
    'bg-violet-100','bg-violet-200','bg-rose-100','bg-rose-50',
    'bg-slate-200','bg-slate-700','bg-amber-50','bg-blue-50','bg-red-50',
    'dark:bg-violet-500/20','dark:bg-violet-500/30','dark:bg-rose-500/20',
    'dark:bg-rose-500/15','dark:bg-blue-500/10','dark:bg-amber-500/10',
    'dark:bg-red-500/10','dark:text-violet-300','dark:text-violet-400',
    'dark:text-rose-400',
    // do-pop animation
    'do-pop',
    // opacity-0 group-hover:opacity-100 (card footer)
    'opacity-0','opacity-30','scale-95','scale-105',
    // ring utilities
    'ring-2','ring-violet-400/50',
    // translate
    'translate-y-0','translate-y-4',
    // line-clamp
    'line-clamp-1','line-clamp-2','line-clamp-3',
    // font-awesome spin
    'fa-spin',
    // Checkbox accent rangi
    'accent-violet-500',
  ],
  plugins: [],
}
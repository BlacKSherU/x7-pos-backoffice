// Escala de tamaños de las vistas Platform SaaS de companies / merchants / users (historias 1-7):
// tipografía, paddings, separaciones, radios, alturas de tarjetas, botones, filas de tabla e
// inputs y tamaños de iconos. SaasViewKit y todas las vistas la usan; ninguna usa tamaños sueltos.
// Archivo aparte de SaasViewKit para que este solo exporte componentes (Fast Refresh).

/** Escala de tamaños compartida por todas las vistas Platform SaaS de las historias 1-7. */
export const SAAS = {
  /** Contenedor de cada vista: una sola separación vertical entre bloques. */
  page: 'flex flex-col gap-6 animate-fade-in text-left font-poppins pb-6 w-full min-w-0',
  radius: 'rounded-lg',
  /** Superficie blanca (cabecera, paneles, formularios, estados). */
  surface: 'bg-white border border-[#e8e2d8] rounded-lg shadow-sm min-w-0',
  cardPadding: 'p-5',
  /** Iconos Material Symbols: tamaños fijos. */
  iconSm: 'text-[16px] leading-none',
  iconMd: 'text-[20px] leading-none',
  iconLg: 'text-[24px] leading-none',
  iconXl: 'text-[40px] leading-none',
  /** Tipografía. */
  title: 'text-2xl font-black text-[#1d1c17] tracking-tight leading-tight break-words',
  body: 'text-sm text-[#5f5e5e]',
  caption: 'text-[11px] font-bold uppercase tracking-widest',
  label: 'block text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] mb-1.5',
  /** Barra oscura de título de un panel. */
  panelBar: 'bg-[#222222] px-5 h-12 flex items-center justify-between gap-3 min-w-0',
  panelBarTitle: 'text-[11px] font-bold uppercase tracking-widest text-white truncate',
  panelBarMeta: 'text-xs text-white/60 shrink-0',
  /** Barra de filtros sobre una tabla. */
  filterBar: 'px-5 py-3 border-b border-[#e8e2d8] bg-[#f8f3eb] grid grid-cols-1 gap-3 min-w-0',
  /** Tabla de los directorios: misma cabecera y misma altura de fila en todos. */
  table: 'w-full border-collapse',
  thead: 'bg-[#ece8e0] border-b border-[#e8e2d8]',
  th: 'px-5 h-11 text-left align-middle text-[11px] font-bold uppercase tracking-widest text-[#5f5e5e] whitespace-nowrap',
  row: 'group h-16 hover:bg-[#f8f3eb] transition-colors duration-200',
  rowLink: 'group h-16 cursor-pointer hover:bg-[#f8f3eb] transition-colors duration-200',
  td: 'px-5 py-3 align-middle text-sm text-[#1d1c17]',
  rowTitle: 'text-sm font-bold text-[#1d1c17] group-hover:text-primary transition-colors duration-200 break-words',
  rowSubtitle: 'text-xs text-[#5f5e5e] break-words',
  rowAction:
    'inline-flex items-center gap-1 h-8 text-xs font-bold text-[#5f5e5e] hover:text-primary transition-colors duration-200 cursor-pointer',
  /** Controles de formulario y filtros: una sola altura. */
  input:
    'w-full h-10 px-3 text-sm border bg-white text-[#1d1c17] rounded-lg placeholder:text-[#8a8880] focus:outline-none focus:border-[#ae001a] disabled:bg-[#f3f0ea] disabled:text-[#8a8880]',
  /** Botones: una sola altura. */
  buttonPrimary:
    'inline-flex items-center justify-center gap-2 h-10 px-5 bg-[#ae001a] hover:bg-[#930015] text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0',
  buttonSecondary:
    'inline-flex items-center justify-center gap-2 h-10 px-5 bg-white text-[#1d1c17] font-bold text-xs uppercase tracking-wider rounded-lg border border-[#e8e2d8] hover:text-primary transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0',
  buttonDark:
    'inline-flex items-center justify-center gap-2 h-10 px-5 bg-[#222222] text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-[#ae001a] transition-colors duration-200 cursor-pointer shrink-0',
  /** Separación de las cuadrículas de tarjetas. */
  gridGap: 'gap-4',
  statHeight: 'h-32',
  featureMinHeight: 'min-h-[13rem]',
} as const;

/** Compatibilidad: clase de inputs y selects (alias de SAAS.input). */
export const SAAS_INPUT_CLASS = SAAS.input;


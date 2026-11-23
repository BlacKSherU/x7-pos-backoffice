/**
 * Por debajo del breakpoint `md` de Tailwind (768 px) el menú lateral fijo (w-64) deja la
 * pantalla en una franja estrecha: en el teléfono arranca oculto y se cierra al elegir una
 * pantalla, y el usuario lo abre con el botón ☰ de la cabecera.
 */
export const PHONE_MAX_WIDTH = 767;

export function isPhoneViewport(width: number = typeof window === 'undefined' ? Infinity : window.innerWidth): boolean {
  return width <= PHONE_MAX_WIDTH;
}

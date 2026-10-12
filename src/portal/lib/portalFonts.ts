/**
 * Tipografía e iconos propios del portal comercial (Playfair Display variable, Plus Jakarta Sans y Material Symbols). Antes
 * eran hojas de estilos del `index.html`: todas las personas que abrían el selector público las pedían —tres conexiones a Google
 * Fonts que detenían el primer pintado— aunque solo el equipo de ventas usa el portal. Ahora se piden al entrar al portal.
 */
const PORTAL_FONT_STYLESHEETS = [
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..700;1,400..700&family=Plus+Jakarta+Sans:ital,wght@0,400..700;1,400..700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap',
];

/** Agrega las hojas de estilos del portal al documento (una sola vez, aunque se llame desde varias pantallas). */
export function loadPortalFonts(): void {
  if (typeof document === 'undefined') return;
  for (const href of PORTAL_FONT_STYLESHEETS) {
    if (document.head.querySelector(`link[rel="stylesheet"][href="${href}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}

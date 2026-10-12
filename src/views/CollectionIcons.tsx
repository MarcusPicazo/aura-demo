import type { SVGProps } from 'react';

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

/** Corazón; `filled` para una unidad ya guardada. */
export function HeartIcon({ filled, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  return (
    <Icon {...props} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
    </Icon>
  );
}

/** Dos columnas con una barra: comparar. */
export function CompareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="7" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="7" height="14" rx="1.2" />
      <path d="M6 9.5h2M16 9.5h2M6 13h2M16 13h2" />
    </Icon>
  );
}

/** Hoja de papel con una esquina doblada: documento / PDF. */
export function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6.5 3.5h7.2l4.3 4.3v12.7h-11.5Z" />
      <path d="M13.5 3.5v4.5h4.5M9.5 13h5M9.5 16h5" />
    </Icon>
  );
}

export function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="18" cy="5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="19" r="2.6" />
      <path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4" />
    </Icon>
  );
}

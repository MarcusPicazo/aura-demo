import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

function PoolIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 17c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" />
      <path d="M6 13V6a2 2 0 0 1 2-2h3l7 7" />
      <path d="M6 9h8" />
    </Icon>
  );
}

function GymIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8v8M20 8v8" />
      <path d="M2 12h2M20 12h2" />
      <path d="M7 6v12M17 6v12" />
      <path d="M7 12h10" />
    </Icon>
  );
}

function CoworkingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </Icon>
  );
}

function RooftopIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 21h18" />
      <path d="M5 21V10l7-6 7 6v11" />
      <path d="M9 21v-5h6v5" />
    </Icon>
  );
}

function KidsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="5" r="2" />
      <path d="M5 21v-6a3 3 0 0 1 3-3h1l3 3 3-3h1a3 3 0 0 1 3 3v6" />
      <path d="M9 21v-4M15 21v-4" />
    </Icon>
  );
}

function SecurityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" />
      <path d="M9.5 12l1.8 1.8L14.5 10" />
    </Icon>
  );
}

function ParkingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 16V8h3.5a2.5 2.5 0 0 1 0 5H9" />
    </Icon>
  );
}

function PetsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6.5" cy="9" r="1.6" />
      <circle cx="17.5" cy="9" r="1.6" />
      <circle cx="9.5" cy="5.5" r="1.6" />
      <circle cx="14.5" cy="5.5" r="1.6" />
      <path d="M12 12c-3 0-5.5 2-5.5 4.2 0 1.6 1.4 2.8 3 2.3.9-.3 1.7-.3 2.5 0 1.6.5 3-.7 3-2.3C15 14 14.5 12 12 12z" />
    </Icon>
  );
}

function DefaultIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 12.5l1.8 1.8 3.2-3.6" />
    </Icon>
  );
}

/** Registro de íconos de amenidades, cada uno referenciado por clave desde la config del
 *  cliente (`project.amenities[].icon`). Genérico y sin dependencias nuevas: SVG a mano en
 *  vez de una librería de íconos — una clave que no está en el registro cae al ícono
 *  genérico en vez de no mostrar nada. */
const AMENITY_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  pool: PoolIcon,
  gym: GymIcon,
  coworking: CoworkingIcon,
  rooftop: RooftopIcon,
  kids: KidsIcon,
  security: SecurityIcon,
  parking: ParkingIcon,
  pets: PetsIcon,
};

export function AmenityIcon({ name, className }: { name: string; className?: string }) {
  const Component = AMENITY_ICONS[name] ?? DefaultIcon;
  return <Component className={className} />;
}

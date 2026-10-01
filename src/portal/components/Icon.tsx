interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
}

/** Envoltura de un glifo de Material Symbols Outlined (cargado en index.html). El nombre
 *  es el mismo que usa el export de Stitch (p. ej. "space_dashboard", "bookmark"). */
export function Icon({ name, className = '', filled = false }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

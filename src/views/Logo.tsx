interface LogoProps {
  src: string;
  name: string;
  className?: string;
}

/** Logo del desarrollo — siempre `config.brand.logo`, nunca una ruta fija aquí. */
export function Logo({ src, name, className }: LogoProps) {
  return <img src={src} alt={name} className={className} />;
}

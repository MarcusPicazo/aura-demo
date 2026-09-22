// La validación vive en una función (no en un `if`/`throw` suelto a nivel de módulo) a
// propósito: con las env vars ausentes en el build, Vite reemplaza `import.meta.env.X`
// por `undefined` literal, y el `throw` directo a nivel de módulo confunde el análisis
// de Rolldown (el bundler de Vite 8) — el build "termina bien" pero descarta en
// silencio el árbol de módulos de la app, sin avisar. Moverlo a una función evita el bug.
function requireEnvVar(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Falta ${name}. Copia .env.example a .env.local y llena tus credenciales del proyecto de Supabase ` +
        '(Project Settings → API).',
    );
  }
  return value;
}

export const supabaseUrl = requireEnvVar(import.meta.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL');
export const supabaseAnonKey = requireEnvVar(import.meta.env.VITE_SUPABASE_ANON_KEY, 'VITE_SUPABASE_ANON_KEY');

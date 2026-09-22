import { useState, type FormEvent } from 'react';
import { supabaseAdmin } from '../lib/supabaseAdmin';

/** SPEC §4.1: login del panel de administración con Supabase Auth (correo y contraseña). */
export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (signInError) setError('Correo o contraseña incorrectos.');
    setSubmitting(false);
  }

  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-neutral-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="font-serif text-2xl text-neutral-900">Panel de administración</h1>

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { Login } from './Login';
import auraConfigJson from '../config/aura.json';
import type { DevelopmentConfig } from '../types';

const auraConfig = auraConfigJson as unknown as DevelopmentConfig;

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `text-sm font-medium ${isActive ? 'text-neutral-900 underline' : 'text-neutral-500 hover:text-neutral-900'}`;
}

/** Ruta /admin: si no hay sesión muestra Login; si hay sesión, la tabla de unidades o el editor de fachada. */
export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabaseAdmin.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabaseAdmin.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checkingSession) return null;
  if (!session) return <Login />;

  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex items-center gap-6">
          <h1 className="font-serif text-xl text-neutral-900">Admin — {auraConfig.name}</h1>
          <nav className="flex gap-4">
            <NavLink to="/admin" end className={navLinkClass}>
              Unidades
            </NavLink>
            <NavLink to="/admin/facade" className={navLinkClass}>
              Fachada
            </NavLink>
          </nav>
        </div>
        <button type="button" onClick={() => supabaseAdmin.auth.signOut()} className="text-sm text-neutral-500 underline">
          Cerrar sesión
        </button>
      </header>
      <Outlet />
    </div>
  );
}

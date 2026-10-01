import { useMemo, useState } from 'react';
import { usePortalStore } from '../../store/portalStore';
import { Icon } from '../../components/Icon';

export function HistorialAdmin() {
  const auditLog = usePortalStore((state) => state.auditLog);
  const team = usePortalStore((state) => state.team);
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  const actors = useMemo(() => Array.from(new Set(auditLog.map((entry) => entry.actorName))), [auditLog]);

  const filtered = auditLog.filter((entry) => {
    if (actorFilter && entry.actorName !== actorFilter) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return entry.actionLabel.toLowerCase().includes(term) || entry.detail.toLowerCase().includes(term);
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-1.5 text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">
          <span>Gestión Comercial</span>
          <Icon name="chevron_right" className="text-[14px]" />
          <span className="font-semibold text-secondary">Historial</span>
        </div>
        <h1 className="font-serif text-headline-lg tracking-tight text-primary">Historial y Bitácora de Auditoría</h1>
        <p className="mt-1 font-ui text-body-md text-on-surface-variant">
          Registro inmutable de cambios de precio, bloqueos, apartados, aprobaciones y movimientos de equipo.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2">
          <Icon name="search" className="text-[18px] text-on-surface-variant" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por acción o detalle..."
            className="w-full bg-transparent font-ui text-body-sm text-on-surface outline-none placeholder:text-on-surface-variant"
          />
        </div>
        <select
          value={actorFilter}
          onChange={(event) => setActorFilter(event.target.value)}
          className="cursor-pointer rounded-lg bg-surface-container-low px-3 py-2 font-ui text-body-sm text-on-surface outline-none"
        >
          <option value="">Todos los responsables</option>
          {actors.map((actor) => (
            <option key={actor} value={actor}>
              {actor}
            </option>
          ))}
        </select>
        <span className="whitespace-nowrap px-2 font-ui text-label-sm text-on-surface-variant">
          {filtered.length} de {auditLog.length} eventos · {team.length} miembros de equipo
        </span>
      </div>

      <div className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
        <div className="relative flex flex-col gap-5 before:absolute before:bottom-2 before:left-3 before:top-2 before:w-px before:bg-surface-container-high">
          {filtered.map((entry) => (
            <div key={entry.id} className="relative flex items-start gap-4">
              <div className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
                <Icon name={entry.icon} className="text-[13px]" />
              </div>
              <div className="flex min-w-0 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-ui text-body-md font-semibold text-on-surface">{entry.actionLabel}</span>
                  <span className="text-label-sm font-ui text-on-surface-variant">{entry.at}</span>
                </div>
                <p className="mt-0.5 font-ui text-body-sm text-on-surface-variant">
                  <strong className="font-medium text-on-surface">{entry.actorName}</strong> {entry.detail}
                </p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="font-ui text-body-sm text-on-surface-variant">Sin eventos para este filtro.</p>}
        </div>
      </div>
    </div>
  );
}

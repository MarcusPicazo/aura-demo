import { useState, type FormEvent } from 'react';
import { usePortalStore } from '../../store/portalStore';
import { Icon } from '../../components/Icon';
import { TEAM_PERMISSION_LABELS } from '../../types';
import type { TeamMember, TeamPermissionKey } from '../../types';

const ALL_PERMISSIONS = Object.keys(TEAM_PERMISSION_LABELS) as TeamPermissionKey[];

export function EquipoAdmin() {
  const team = usePortalStore((state) => state.team);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const asesores = team.filter((member) => member.role === 'asesor');
  const activos = asesores.filter((member) => member.status === 'activo').length;
  const invitados = asesores.filter((member) => member.status === 'invitado').length;
  const avgConversion = Math.round(asesores.reduce((sum, member) => sum + member.conversionRate, 0) / Math.max(1, asesores.length));

  const editingMember = team.find((member) => member.id === editingId) ?? null;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">
            <span>Gestión Comercial</span>
            <Icon name="chevron_right" className="text-[14px]" />
            <span className="font-semibold text-secondary">Equipo y Permisos</span>
          </div>
          <h1 className="font-serif text-headline-lg tracking-tight text-primary">Equipo y Permisos</h1>
          <p className="mt-1 font-ui text-body-md text-on-surface-variant">
            Fuerza de ventas de Torre Aura Del Valle: quién es cada quien y qué puede hacer dentro del portal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 self-start rounded-lg bg-primary px-4 py-2 font-ui text-label-md text-on-primary shadow-md transition-all hover:bg-primary-container active:scale-[0.97] md:self-auto"
        >
          <Icon name="person_add" className="text-[18px]" />
          <span>Invitar asesor</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Asesores" value={asesores.length} icon="groups" />
        <MetricCard label="Activos" value={activos} icon="check_circle" accent="text-secondary" />
        <MetricCard label="Invitados pendientes" value={invitados} icon="mail" accent="text-secondary" />
        <MetricCard label="Conversión promedio" value={`${avgConversion}%`} icon="pie_chart" />
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low font-ui text-label-sm uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Asesor</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Vendidas</th>
                <th className="px-4 py-3 text-center">Apartados activos</th>
                <th className="px-4 py-3 text-center">Conversión</th>
                <th className="px-4 py-3">Permisos</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low font-ui text-body-sm">
              {asesores.map((member) => (
                <tr key={member.id} className="hover:bg-surface-container-low/60">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-ui text-label-sm font-bold text-on-primary">
                        {member.initials}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-semibold text-on-surface">{member.name}</span>
                        <span className="truncate text-label-sm font-ui text-on-surface-variant">{member.roleLabel}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-sm font-ui font-semibold ${
                        member.status === 'activo' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {member.status === 'activo' ? 'Activo' : 'Invitado'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center font-semibold text-on-surface">{member.unitsSold}</td>
                  <td className="px-4 py-3.5 text-center text-on-surface-variant">{member.activeHolds}</td>
                  <td className="px-4 py-3.5 text-center font-semibold text-primary">{member.conversionRate}%</td>
                  <td className="px-4 py-3.5">
                    {member.permissions.length === 0 ? (
                      <span className="text-label-sm font-ui text-on-surface-variant">Solo su propia cartera</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {member.permissions.map((permission) => (
                          <span key={permission} className="rounded bg-surface-container-high px-1.5 py-0.5 text-[11px] font-ui text-on-surface-variant">
                            {TEAM_PERMISSION_LABELS[permission]}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(member.id)}
                        title="Editar permisos"
                        className="rounded-lg bg-surface-container-low p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <Icon name="tune" className="text-[18px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingMember && <PermissionsModal member={editingMember} onClose={() => setEditingId(null)} />}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

function MetricCard({ label, value, icon, accent }: { label: string; value: number | string; icon: string; accent?: string }) {
  return (
    <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-label-sm font-ui uppercase tracking-wider text-on-surface-variant">{label}</span>
        <Icon name={icon} className={`text-[18px] ${accent ?? 'text-on-surface-variant'}`} />
      </div>
      <span className="mt-2 font-serif text-headline-lg leading-none text-primary">{value}</span>
    </div>
  );
}

function PermissionsModal({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const updateTeamPermissions = usePortalStore((state) => state.updateTeamPermissions);
  const toggleTeamMemberStatus = usePortalStore((state) => state.toggleTeamMemberStatus);
  const [selected, setSelected] = useState<TeamPermissionKey[]>(member.permissions);

  function toggle(permission: TeamPermissionKey) {
    setSelected((prev) => (prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-8 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-label-sm font-ui uppercase tracking-wider text-secondary">Permisos de asesor</span>
            <h3 className="font-serif text-headline-sm text-primary">{member.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {ALL_PERMISSIONS.map((permission) => (
            <label key={permission} className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-container-low p-3">
              <input type="checkbox" checked={selected.includes(permission)} onChange={() => toggle(permission)} className="h-4 w-4 rounded accent-primary" />
              <span className="font-ui text-body-sm text-on-surface">{TEAM_PERMISSION_LABELS[permission]}</span>
            </label>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-surface-container-high pt-4">
          <button
            type="button"
            onClick={() => toggleTeamMemberStatus(member.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-ui text-label-sm transition-colors ${
              member.status === 'activo' ? 'text-error hover:bg-error-container/40' : 'text-secondary hover:bg-secondary-container/40'
            }`}
          >
            <Icon name={member.status === 'activo' ? 'person_off' : 'how_to_reg'} className="text-[16px]" />
            <span>{member.status === 'activo' ? 'Suspender acceso' : 'Reactivar acceso'}</span>
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-surface-container px-4 py-2 font-ui text-label-md text-on-surface hover:bg-surface-container-high">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                updateTeamPermissions(member.id, selected);
                onClose();
              }}
              className="rounded-lg bg-primary px-4 py-2 font-ui text-label-md font-semibold text-on-primary shadow-md transition-all hover:bg-primary-container"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const inviteTeamMember = usePortalStore((state) => state.inviteTeamMember);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleLabel, setRoleLabel] = useState('Asesor');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    inviteTeamMember({ name, email, phone, roleLabel });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-8 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-label-sm font-ui uppercase tracking-wider text-secondary">Nuevo miembro</span>
            <h3 className="font-serif text-headline-sm text-primary">Invitar asesor</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface">
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre completo"
            className="rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface outline-none focus:bg-surface-container-lowest"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="correo@aura.com.mx"
            className="rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface outline-none focus:bg-surface-container-lowest"
          />
          <input
            type="tel"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+52 55 0000 0000"
            className="rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface outline-none focus:bg-surface-container-lowest"
          />
          <select
            value={roleLabel}
            onChange={(event) => setRoleLabel(event.target.value)}
            className="rounded-lg bg-surface-container-low p-2.5 font-ui text-body-sm text-on-surface outline-none focus:bg-surface-container-lowest"
          >
            <option>Asesor</option>
            <option>Asesor Senior</option>
            <option>Asesor Junior</option>
          </select>
          <div className="mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-surface-container px-4 py-2 font-ui text-label-md text-on-surface hover:bg-surface-container-high">
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-ui text-label-md font-semibold text-on-primary shadow-md transition-all hover:bg-primary-container">
              Enviar invitación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

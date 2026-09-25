/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.5 (named roles with plain descriptions, no shared logins),
 * D8.1 (plain language throughout).
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, UserPlus } from 'lucide-react';
import { HOST_ROLES, getHostRole } from '@/components/host/hostRoles';

export default function TeamPanel({ proposalId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'editor' });

  const load = async () => {
    setLoading(true);
    const list = await base44.entities.HostTeamMember.filter({ proposal_id: proposalId }, '-created_date', 50);
    setMembers(list || []);
    setLoading(false);
  };

  useEffect(() => { if (proposalId) load(); }, [proposalId]);

  const invite = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) return;
    setSaving(true);
    await base44.entities.HostTeamMember.create({ ...form, proposal_id: proposalId });
    setForm({ name: '', email: '', role: 'editor' });
    setSaving(false);
    load();
  };

  const remove = async (id) => {
    await base44.entities.HostTeamMember.delete(id);
    load();
  };

  const changeRole = async (id, role) => {
    await base44.entities.HostTeamMember.update(id, { role });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-extrabold">Your team</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite the people who'll help — your marketing agency, finance contact or anyone else.
          Everyone gets their own login and only sees what their role allows.
        </p>
      </div>

      <form onSubmit={invite} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
        <input
          className="c53-input sm:col-span-1"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          aria-label="Team member name"
        />
        <input
          className="c53-input sm:col-span-1"
          type="email"
          required
          placeholder="Email address"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          aria-label="Team member email address"
        />
        <select
          className="c53-input sm:col-span-1"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          aria-label="Role"
        >
          {HOST_ROLES.filter((r) => r.key !== 'owner').map((r) => (
            <option key={r.key} value={r.key}>{r.name}</option>
          ))}
        </select>
        <Button type="submit" disabled={saving} className="grad-bg border-0 sm:col-span-1">
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />}
          Send invite
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-4">
          {getHostRole(form.role).description}
        </p>
      </form>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : members.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No one else on your team yet. Invite someone above whenever you're ready.
        </p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-bold">{m.name || m.email}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">{getHostRole(m.role).description}</p>
              </div>
              <select
                className="c53-input w-auto"
                value={m.role}
                onChange={(e) => changeRole(m.id, e.target.value)}
                aria-label={`Role for ${m.email}`}
              >
                {HOST_ROLES.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
              </select>
              <Button variant="outline" size="icon" onClick={() => remove(m.id)} aria-label={`Remove ${m.email}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
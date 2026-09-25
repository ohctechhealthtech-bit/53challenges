import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Edit3, Save, X, Trophy, User, Heart, Flame } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function Profile() {
  const { user, setChallengeApiSession } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.full_name || '');
  const [saving, setSaving] = useState(false);

  const initial = (user?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const role = user?.role || 'user';

  const handleSave = () => {
    setSaving(true);
    const updated = { ...user, full_name: name };
    setChallengeApiSession(updated);
    setEditing(false);
    setSaving(false);
  };

  return (
    <div className="container-tight py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-heading text-3xl font-extrabold">My Profile</h1>
        <p className="mt-2 text-muted-foreground">View and manage your account details.</p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="relative h-28 grad-bg">
            <div className="absolute -bottom-10 left-6">
              <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-card bg-card text-2xl font-extrabold text-primary">
                {initial}
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-12">
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="c53-input mt-1"
                    placeholder="Your name"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl grad-bg px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60">
                    <Save className="h-4 w-4" /> Save
                  </button>
                  <button onClick={() => { setEditing(false); setName(user?.full_name || ''); }} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold transition hover:border-primary hover:text-primary">
                    <X className="h-4 w-4" /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-xl font-bold">{user?.full_name || 'Unnamed'}</h2>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                  <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold transition hover:border-primary hover:text-primary">
                    <Edit3 className="h-4 w-4" /> Edit
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 border-t border-border pt-4">
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize text-muted-foreground">{role}</span>
                  </div>
                </div>
                <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
                  <Link to="/my-progress" className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium transition hover:border-primary hover:text-primary">
                    <Flame className="h-4 w-4" /> My Progress
                  </Link>
                  <Link to="/my-entries" className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium transition hover:border-primary hover:text-primary">
                    <User className="h-4 w-4" /> My Entries
                  </Link>
                  <Link to="/my-votes" className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium transition hover:border-primary hover:text-primary">
                    <Heart className="h-4 w-4" /> My Votes
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
/** Every request this person has sent us — challenge requests, ideas, host
 *  applications and judge applications — with the current status of each. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ClipboardList } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { loadMyApplications } from '@/lib/myApplications';
import ApplicationRow from '@/components/applications/ApplicationRow';

export default function MyApplications() {
  const { isAuthenticated, navigateToLogin } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { navigateToLogin(); return; }
    loadMyApplications()
      .then(setItems)
      .catch((e) => { setError(e?.message || 'Could not load your requests.'); setItems([]); });
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="container-tight py-12">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <ClipboardList className="h-7 w-7 text-primary" aria-hidden="true" /> My Requests
      </h1>
      <p className="mt-2 text-muted-foreground">
        Everything you've sent us — challenge requests, ideas, host applications and judge applications — with where each one is up to.
      </p>

      {error && <p className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">{error}</p>}

      {items === null ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border py-20 text-center">
          <p className="font-heading text-lg font-bold">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Once you send us a request or an application, you'll be able to follow it here.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/host-a-challenge" className="rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white">Host a challenge</Link>
            <Link to="/become-a-judge" className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold">Become a judge</Link>
          </div>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((i) => <ApplicationRow key={`${i.kind}-${i.id}`} item={i} />)}
        </ul>
      )}
    </div>
  );
}
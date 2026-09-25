import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Share2, Link2, Loader2 } from 'lucide-react';
import PromoGenerator from '@/components/promo/PromoGenerator';
import PromoAccounts from '@/components/promo/PromoAccounts';
import PromoPostCard from '@/components/promo/PromoPostCard';
import { listPosts } from '@/lib/participantPromo';

const TABS = [
  { k: 'generate', l: 'Create post', icon: Sparkles },
  { k: 'posts', l: 'My posts', icon: Share2 },
  { k: 'accounts', l: 'Social accounts', icon: Link2 },
];

export default function MyPromo() {
  const params = new URLSearchParams(window.location.search);
  const initialEntryId = params.get('entry') || '';
  const challengeName = params.get('challenge') || '';
  const entryTitle = params.get('title') || '';
  const initialTopic = challengeName || entryTitle
    ? `I've just entered "${entryTitle || 'my work'}"${challengeName ? ` in the ${challengeName} challenge` : ''} — ask people to check it out and vote.`
    : '';
  const [tab, setTab] = useState('generate');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await listPosts();
    setPosts(d?.posts || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="container-tight py-12">
      <p className="text-xs font-extrabold uppercase tracking-[.22em] text-primary">Promote your entries</p>
      <h1 className="mt-2 font-heading text-3xl font-extrabold sm:text-4xl">Your promo studio</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Link your social profiles, let AI write a post about your entry, then share it to your followers and pull in the votes.</p>

      <div className="mt-6 inline-flex flex-wrap rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === t.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
            <t.icon className="h-4 w-4" /> {t.l}{t.k === 'posts' && posts.length ? ` (${posts.length})` : ''}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {tab === 'generate' && <PromoGenerator initialEntryId={initialEntryId} initialTopic={initialTopic} onSaved={() => { load(); setTab('posts'); }} />}
        {tab === 'accounts' && <PromoAccounts />}
        {tab === 'posts' && (
          loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <div className="grid gap-4 md:grid-cols-2">
              {posts.map((p) => <PromoPostCard key={p.id} post={p} onChange={load} />)}
              {!posts.length && <p className="text-sm text-muted-foreground">No posts yet — head to Create post to make your first one.</p>}
            </div>
          )
        )}
      </div>
    </div>
  );
}
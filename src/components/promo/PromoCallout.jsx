import { Link } from 'react-router-dom';
import { Sparkles, Share2 } from 'lucide-react';

export default function PromoCallout({ to = '/my-promo', compact = false }) {
  if (compact) {
    return (
      <Link to={to} className="inline-flex items-center gap-1.5 rounded-lg grad-bg px-3 py-2 text-xs font-bold text-white">
        <Sparkles className="h-3.5 w-3.5" /> Generate & share post
      </Link>
    );
  }
  return (
    <section className="mx-auto mt-8 max-w-lg rounded-2xl border border-primary/30 grad-soft-bg p-6 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary"><Share2 className="h-5 w-5" /></div>
      <h2 className="mt-3 font-heading text-lg font-bold">Now get the votes in</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Let AI write a post about your entry, add an image, and share it straight to your socials.</p>
      <Link to={to} className="mt-4 inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-3 text-sm font-bold text-white">
        <Sparkles className="h-4 w-4" /> Generate & share my post
      </Link>
    </section>
  );
}
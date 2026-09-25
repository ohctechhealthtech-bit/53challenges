import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1499209974431-9ece4f496a52?auto=format&fit=crop&w=600&q=80';

/**
 * "Explore by activity" grid — categories come from the live Challenge API
 * (publicChallengeApi?action=categories), not a hardcoded list.
 */
export default function ActivityGrid() {
  const { categories, loading } = useCategories();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!categories.length) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-6">
      {categories.map((cat) => (
        <Link
          key={cat.slug}
          to={`/challenges/category/${cat.slug}`}
          className="group relative h-16 overflow-hidden rounded-lg border border-slate-200 sm:h-20"
        >
          <img
            src={cat.image || FALLBACK_IMG}
            alt={cat.name}
            loading="lazy"
            className="c53-ken-burns h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-black/20" />
          <span className="absolute bottom-2 left-2 right-2 text-xs font-bold leading-tight text-white sm:text-sm">
            {cat.name}
          </span>
        </Link>
      ))}
    </div>
  );
}
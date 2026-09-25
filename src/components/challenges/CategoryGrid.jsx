import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import RevealOnScroll from '@/components/home/RevealOnScroll';

export default function CategoryGrid({ counts = {} }) {
  const { categories, loading } = useCategories();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!categories.length) return null;

  return (
    <RevealOnScroll stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((cat) => (
        <Link
          key={cat.slug}
          to={`/challenges?category=${cat.slug}`}
          className="card-lift group relative overflow-hidden rounded-3xl border border-border bg-card p-6 hover:border-primary/40"
        >
          <div
            className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-150"
            style={{ backgroundColor: cat.color }}
          />
          <div
            className="grid h-14 w-14 place-items-center rounded-2xl text-3xl shadow-sm"
            style={{ backgroundColor: cat.color + '22' }}
          >
            {cat.icon}
          </div>
          <h3 className="mt-5 font-heading text-xl font-bold">{cat.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{cat.blurb}</p>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: cat.color }}>
              {counts[cat.slug] || 0} Challenge{(counts[cat.slug] || 0) === 1 ? '' : 's'}
            </span>
            <span className="text-sm font-medium text-muted-foreground transition-transform group-hover:translate-x-1">Explore ›</span>
          </div>
        </Link>
      ))}
    </RevealOnScroll>
  );
}
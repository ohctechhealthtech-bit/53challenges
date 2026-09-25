import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import CategoryIcon from '@/components/home/CategoryIcon';
import { StaggerGrid, StaggerItem } from '@/components/motion/StaggerGrid';

/**
 * "Explore by Activity" — the six canonical categories sorted with active
 * challenges first. Categories with 0 challenges move to a secondary
 * "Coming Soon" section. Uses SVG icons (not emoji).
 */
export default function ExploreCategories({ counts = {} }) {
  const { categories } = useCategories();
  const active = categories.filter((c) => (counts[c.slug] || 0) > 0).sort(
    (a, b) => (counts[b.slug] || 0) - (counts[a.slug] || 0)
  );
  const inactive = categories.filter((c) => (counts[c.slug] || 0) === 0);

  return (
    <section className="container-tight py-12 lg:py-16">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Explore by Activity</p>
        <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Find a challenge that moves you</h2>
      </div>

      {active.length > 0 && (
        <StaggerGrid className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((cat) => {
            const n = counts[cat.slug] || 0;
            return (
              <StaggerItem key={cat.slug}>
                <Link
                  to={`/challenges/category/${cat.slug}`}
                  className="card-lift group relative block h-full overflow-hidden rounded-2xl border border-border bg-card p-6 transition-[transform,border-color] duration-280 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div
                    className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-150"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div
                    className="grid h-14 w-14 place-items-center rounded-2xl"
                    style={{ backgroundColor: cat.color + '22', color: cat.color }}
                  >
                    <CategoryIcon slug={cat.slug} className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 font-heading text-xl font-bold">{cat.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{cat.blurb}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: cat.color }}>
                      {n} Challenge{n === 1 ? '' : 's'}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground transition-transform group-hover:translate-x-1">
                      Explore ›
                    </span>
                  </div>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}

      {inactive.length > 0 && (
        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Coming Soon</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inactive.map((cat) => (
              <div
                key={cat.slug}
                className="flex items-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 p-5"
              >
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl opacity-50"
                  style={{ backgroundColor: cat.color + '22', color: cat.color }}
                >
                  <CategoryIcon slug={cat.slug} className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-muted-foreground">{cat.name}</h3>
                  <p className="text-xs font-medium text-muted-foreground/70">Coming Soon</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && inactive.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
          <p>Challenges are being prepared. Check back soon.</p>
          <Link to="/coming-soon" className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary">
            Notify Me <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
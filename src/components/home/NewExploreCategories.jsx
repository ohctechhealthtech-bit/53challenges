import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useCategories } from '@/hooks/useCategories';
import CategoryIcon from '@/components/home/CategoryIcon';
import { DURATION, EASE, STAGGER, VARIANTS } from '@/lib/motion';

const FALLBACK_BG = 'https://images.unsplash.com/photo-1499209974431-9ece4f496a52?auto=format&fit=crop&w=600&q=80';

/**
 * "Explore by activity" — 6 image-overlay cards in a responsive grid,
 * always showing all six canonical categories.
 */
export default function NewExploreCategories({ counts = {} }) {
  const reduced = useReducedMotion();
  const { categories } = useCategories();

  return (
    <section className="container-tight py-12 lg:py-16">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Explore by Activity</p>
        <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">Find a challenge that moves you</h2>
      </div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={reduced ? { hidden: {}, visible: {} } : VARIANTS.staggerContainer(STAGGER.base)}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
      >
        {categories.map((cat) => {
          const n = counts[cat.slug] || 0;
          return (
            <motion.div
              key={cat.slug}
              variants={reduced ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : VARIANTS.fadeUp}
            >
              <Link
                to={`/challenges/category/${cat.slug}`}
                className="card-lift group relative block aspect-[3/4] overflow-hidden rounded-2xl border border-border bg-card"
              >
                {/* Background image */}
                <img
                  src={cat.image || FALLBACK_BG}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                {/* Color tint */}
                <div className="absolute inset-0" style={{ backgroundColor: cat.color, opacity: 0.15 }} />
                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                {/* Icon */}
                <div
                  className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-lg"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}
                >
                  <CategoryIcon slug={cat.slug} className="h-5 w-5" />
                </div>

                {/* Label */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="font-heading text-sm font-bold leading-tight text-white">{cat.name}</h3>
                  <p className="mt-0.5 text-xs font-medium" style={{ color: cat.color }}>
                    {n > 0 ? `${n} Challenge${n === 1 ? '' : 's'}` : 'Explore'}
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
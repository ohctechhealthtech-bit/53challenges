import { motion } from 'framer-motion';
import { iconFor } from './introIcons';


export default function IntroHighlights({ highlights, accent }) {
  if (!highlights?.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {highlights.map((h, i) => {
        const Icon = iconFor(h.icon);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${accent.soft}`}>
              <Icon className={`h-5 w-5 ${accent.text}`} />
            </span>
            <h3 className="mt-4 font-heading text-base font-bold">{h.title}</h3>
            {h.text && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{h.text}</p>}
          </motion.div>
        );
      })}
    </div>
  );
}
import { motion } from 'framer-motion';
import { Image } from '@/components/ui/image';

export default function IntroGallery({ gallery }) {
  if (!gallery?.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {gallery.map((url, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.94 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45, delay: (i % 4) * 0.07, ease: [0.16, 1, 0.3, 1] }}
          className="aspect-square overflow-hidden rounded-xl border border-border bg-muted"
        >
          <Image src={url} alt={`Inspiration ${i + 1}`} className="h-full w-full" />
        </motion.div>
      ))}
    </div>
  );
}
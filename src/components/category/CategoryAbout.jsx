import { Image } from '@/components/ui/image';
import RevealOnScroll from '@/components/home/RevealOnScroll';

export default function CategoryAbout({ cat, accent }) {
  const imgs = (cat.gallery_images && cat.gallery_images.length ? cat.gallery_images : []).slice(0, 3);
  return (
    <section id="about" className="scroll-mt-24 border-t border-border">
      <div className="container-tight py-14">
        <RevealOnScroll>
          <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>About this category</p>
          <h2 className="mt-1 font-heading text-2xl font-bold sm:text-3xl">What is {cat.name}?</h2>
        </RevealOnScroll>
        <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-center">
          <RevealOnScroll variant="right">
            <p className="text-base leading-relaxed text-muted-foreground">{cat.full_description}</p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{cat.short_description}.</p>
          </RevealOnScroll>
          <RevealOnScroll variant="left">
            {imgs.length ? (
              <div className="grid grid-cols-3 gap-3">
                {imgs.map((src, i) => (
                  <div key={i} className="aspect-[3/4] overflow-hidden rounded-2xl border border-border">
                    <Image src={src} alt={`${cat.name} example ${i + 1}`} className="h-full w-full" fittingType="fill" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1].map((i) => (
                  <div key={i} className="aspect-[3/4] rounded-2xl border border-border" style={{ background: `linear-gradient(140deg, ${accent}${i ? '22' : '33'}, transparent)` }} />
                ))}
              </div>
            )}
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}
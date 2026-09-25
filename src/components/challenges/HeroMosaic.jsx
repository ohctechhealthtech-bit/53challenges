const TILES = [
  { color: '#E86A33', emoji: '🎨' }, { color: '#2D7DD2', emoji: '🎸' },
  { color: '#D4537E', emoji: '🪰' }, { color: '#8A6A00', emoji: '📷' },
  { color: '#3BA55D', emoji: '🍳' }, { color: '#B4884E', emoji: '🎭' },
  { color: '#5B7CFA', emoji: '💻' }, { color: '#C13AD6', emoji: '🎤' },
  { color: '#E86A33', emoji: '🪵' }, { color: '#2D7DD2', emoji: '🤸' },
  { color: '#3BA55D', emoji: '✍️' }, { color: '#12B5A5', emoji: '🔧' },
];

import RevealOnScroll from '@/components/home/RevealOnScroll';

export default function HeroMosaic() {
  return (
    <RevealOnScroll stagger className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {TILES.map((t, i) => (
        <div
          key={i}
          className="group relative aspect-square overflow-hidden rounded-2xl shadow-sm transition-transform duration-500 hover:scale-[1.03]"
          style={{ backgroundColor: t.color }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-90 transition-transform duration-500 group-hover:scale-125 sm:text-4xl">
            {t.emoji}
          </div>
          <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent" />
        </div>
      ))}
    </RevealOnScroll>
  );
}
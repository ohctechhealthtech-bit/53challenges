// Accent colour themes for the challenge intro page (intro.accent).
// All class names are literal strings so Tailwind keeps them in the build.
export const ACCENTS = {
  orange:  { text: 'text-orange-400',  bg: 'bg-orange-500',  soft: 'bg-orange-500/15',  border: 'border-orange-500/30',  grad: 'from-orange-500 to-amber-500' },
  purple:  { text: 'text-purple-400',  bg: 'bg-purple-500',  soft: 'bg-purple-500/15',  border: 'border-purple-500/30',  grad: 'from-purple-500 to-fuchsia-500' },
  blue:    { text: 'text-blue-400',    bg: 'bg-blue-500',    soft: 'bg-blue-500/15',    border: 'border-blue-500/30',    grad: 'from-blue-500 to-cyan-500' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500', soft: 'bg-emerald-500/15', border: 'border-emerald-500/30', grad: 'from-emerald-500 to-teal-500' },
  rose:    { text: 'text-rose-400',    bg: 'bg-rose-500',    soft: 'bg-rose-500/15',    border: 'border-rose-500/30',    grad: 'from-rose-500 to-pink-500' },
  amber:   { text: 'text-amber-400',   bg: 'bg-amber-500',   soft: 'bg-amber-500/15',   border: 'border-amber-500/30',   grad: 'from-amber-500 to-yellow-500' },
};

export const accentFor = (name) => ACCENTS[name] || ACCENTS.blue;
import { Image } from '@/components/ui/image';

const initials = (name) =>
  String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

export default function JudgeAvatar({ judge, size = 'h-10 w-10 text-sm' }) {
  if (judge?.avatar_url) {
    return <Image src={judge.avatar_url} alt={judge.name || 'Judge'} className={`${size} shrink-0 rounded-full`} fittingType="fill" />;
  }
  return (
    <span className={`${size} inline-flex shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-800`} aria-hidden="true">
      {initials(judge?.name)}
    </span>
  );
}
export default function VoteCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="mb-4 h-6 w-40 rounded-full bg-amber-100" />
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-stone-100" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-2/3 rounded bg-stone-200" />
          <div className="h-4 w-1/3 rounded bg-stone-100" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-24 rounded-full bg-teal-50" />
        <div className="h-6 w-20 rounded-full bg-orange-50" />
      </div>
      <div className="mt-4 h-48 w-full rounded-xl bg-stone-100" />
      <div className="mt-4 h-4 w-full rounded bg-stone-100" />
      <div className="mt-2 h-4 w-4/5 rounded bg-stone-100" />
      <div className="mt-6 flex items-center gap-3 border-t border-stone-100 pt-4">
        <div className="mr-auto h-8 w-16 rounded bg-stone-100" />
        <div className="h-11 w-24 rounded-full bg-orange-100" />
        <div className="h-11 w-24 rounded-full bg-stone-100" />
      </div>
    </div>
  );
}

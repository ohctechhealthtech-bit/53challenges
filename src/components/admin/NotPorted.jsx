import { Construction } from 'lucide-react';

export default function NotPorted({ label }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 py-16 text-center">
      <Construction className="h-6 w-6 text-muted-foreground" />
      <p className="font-heading text-lg font-bold">Not ported yet</p>
      <p className="text-sm text-muted-foreground">The “{label}” section has not been brought across from 53 Classes yet.</p>
    </div>
  );
}
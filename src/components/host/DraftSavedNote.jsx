/**
 * D8 — Host Experience Principles: calm reassurance that nothing is lost.
 */
import { Check } from 'lucide-react';

export default function DraftSavedNote({ savedAt }) {
  if (!savedAt) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="h-3.5 w-3.5 text-[#2E9B66]" aria-hidden="true" />
      Draft saved
    </span>
  );
}
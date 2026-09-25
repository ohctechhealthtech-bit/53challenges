import { num } from './statsMeta';

export default function PanelSnapshot({ panel }) {
  if (!panel) return null;
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/60 p-5">
      <p className="font-heading text-sm font-bold">Judging panel</p>
      <div className="mt-3 flex flex-wrap gap-6 text-sm">
        <p><span className="text-muted-foreground">Invited:</span> <span className="font-semibold">{num(panel.assigned)}</span></p>
        <p><span className="text-muted-foreground">Accepted:</span> <span className="font-semibold">{num(panel.accepted)}</span></p>
        <p><span className="text-muted-foreground">Still to reply:</span> <span className="font-semibold">{num(panel.pending)}</span></p>
      </div>
    </div>
  );
}
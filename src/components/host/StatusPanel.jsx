/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.3 (calm status panels, never hard errors),
 * D8.4 (host-facing status vocabulary only), D8.6 (no internal routing detail).
 */
import { Clock, CircleAlert, CheckCircle2, XCircle } from 'lucide-react';
import { HOST_TONE_STYLES } from '@/lib/hostStatusLabels';

const TONE_ICONS = {
  progress: Clock,
  action: CircleAlert,
  complete: CheckCircle2,
  declined: XCircle,
};

export default function StatusPanel({ tone = 'progress', title, message, timeframe, action }) {
  const styles = HOST_TONE_STYLES[tone] || HOST_TONE_STYLES.progress;
  const Icon = TONE_ICONS[tone] || Clock;
  return (
    <div className={`rounded-2xl border p-5 ${styles.panel}`} role="status">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.text}`} aria-hidden="true" />
        <div className="min-w-0">
          <h3 className={`font-heading text-sm font-bold ${styles.text}`}>{title}</h3>
          {message && <p className="mt-1 text-sm leading-relaxed text-foreground/80">{message}</p>}
          {timeframe && <p className="mt-2 text-xs text-muted-foreground">{timeframe}</p>}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}
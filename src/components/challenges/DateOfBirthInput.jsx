import { useEffect, useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Accepts DD/MM/YYYY, D-M-YYYY, DDMMYYYY, YYYY-MM-DD (typed, pasted or autofilled)
// and returns a strict ISO yyyy-mm-dd value, or '' when not yet a real date.
export function parseDobInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  let y, m, d;

  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const dmy = s.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{4})$/);
  const digits = s.replace(/\D/g, '');

  if (iso) { [, y, m, d] = iso; }
  else if (dmy) { [, d, m, y] = dmy; }
  else if (digits.length === 8) { d = digits.slice(0, 2); m = digits.slice(2, 4); y = digits.slice(4); }
  else return '';

  y = Number(y); m = Number(m); d = Number(d);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Reject impossible dates (31 Feb), the future, and absurd years.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
  if (dt.getTime() > Date.now()) return '';
  if (y < 1900) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isoToDisplay(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/**
 * Date of birth field. A plain text input so typed, pasted and autofilled
 * values are all accepted — the native date input silently discards anything
 * that isn't entered as sequential keystrokes in its own segments.
 */
export default function DateOfBirthInput({ value, onChange, className = '' }) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const [open, setOpen] = useState(false);

  // Keep the field in sync when the form value is set or reset externally.
  useEffect(() => {
    if (parseDobInput(text) !== (value || '')) setText(isoToDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handle = (raw) => {
    setText(raw);
    onChange(parseDobInput(raw));
  };

  const parsed = parseDobInput(text);

  const selected = parsed ? new Date(`${parsed}T00:00:00`) : undefined;

  const pick = (date) => {
    if (!date) return;
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setText(isoToDisplay(iso));
    onChange(iso);
    setOpen(false);
  };

  return (
    <div>
      <div className="relative">
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder="DD/MM/YYYY"
          value={text}
          onChange={(e) => handle(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            handle((e.clipboardData?.getData('text') || '').trim());
          }}
          onBlur={() => { if (parsed) setText(isoToDisplay(parsed)); }}
          className={`pr-11 ${className}`}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Open calendar to pick your date of birth"
              className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto border border-border bg-popover p-0 shadow-2xl">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={pick}
              defaultMonth={selected}
              captionLayout="dropdown-buttons"
              fromYear={1900}
              toYear={new Date().getFullYear()}
              disabled={{ after: new Date() }}
              classNames={{
                caption_dropdowns: 'flex items-center justify-center gap-2',
                caption_label: 'sr-only',
                dropdown: 'rounded-lg border border-border bg-secondary px-2 py-1 text-sm font-semibold text-foreground',
                vhidden: 'sr-only',
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {parsed
          ? `Reading this as ${new Date(`${parsed}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`
          : 'Type DD/MM/YYYY, or pick a date from the calendar.'}
      </p>
    </div>
  );
}
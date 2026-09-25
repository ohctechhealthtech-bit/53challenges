import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { pickFields, toPayload } from './mastersMeta';

// Generic field-driven create/edit dialog shared by the four master lists.
export default function MasterFormDialog({ open, onClose, title, fields, record, onSave }) {
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setValues(pickFields(record || {}, fields)); setError(''); }
  }, [open, record, fields]);

  const set = (name, v) => setValues((prev) => ({ ...prev, [name]: v }));
  const missing = fields.filter((f) => f.required && !String(values[f.name] || '').trim());

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave(toPayload(values, fields));
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          {fields.map((f) => (
            <div key={f.name}>
              {f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />
                  {f.label}
                </label>
              ) : (
                <>
                  <label htmlFor={`mf-${f.name}`} className="mb-1 block text-sm font-medium">
                    {f.label}{f.required && <span className="text-destructive"> *</span>}
                  </label>
                  {f.type === 'textarea' || f.type === 'lines' ? (
                    <textarea id={`mf-${f.name}`} rows={f.type === 'lines' ? 5 : 3} className="c53-input" value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />
                  ) : f.type === 'select' ? (
                    <select id={`mf-${f.name}`} className="c53-input" value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
                      <option value="">—</option>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input id={`mf-${f.name}`} type={f.type === 'number' ? 'number' : 'text'} className="c53-input" value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />
                  )}
                </>
              )}
              {f.hint && <p className="mt-1 text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || missing.length > 0} title={missing.length ? `Required: ${missing.map((f) => f.label).join(', ')}` : undefined}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
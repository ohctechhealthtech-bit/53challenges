/**
 * Services tab — optional professional services a host can add.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatAud } from '@/lib/hostDeposit';
import { HOST_ADDONS } from '@/lib/hostAddons';

export default function ServicesTab({ addons }) {
  const [cart, setCart] = useState([]);
  const list = (addons && addons.length ? addons : HOST_ADDONS.map((a) => ({ key: a.key, name: a.name, amount: 0 })));
  const toggle = (key) => setCart((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));
  const total = list.filter((a) => cart.includes(a.key)).reduce((s, a) => s + (a.amount || 0), 0);

  return (
    <div>
      <h2 className="font-heading text-2xl font-extrabold">Optional services</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Add professional support to your challenge — pick what you need.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => {
          const meta = HOST_ADDONS.find((h) => h.key === a.key);
          const selected = cart.includes(a.key);
          return (
            <div key={a.key} className={`flex flex-col rounded-2xl border bg-card p-4 ${selected ? 'border-primary' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-heading text-base font-bold">{a.name}</h3>
                <span className="shrink-0 text-sm font-bold">{formatAud((a.amount || 0) / 100)}</span>
              </div>
              {meta?.description && <p className="mt-2 flex-1 text-sm text-muted-foreground">{meta.description}</p>}
              <Button type="button" variant={selected ? 'default' : 'outline'} className="mt-4" onClick={() => toggle(a.key)}>
                {selected ? 'Added ✓' : 'Add to my list'}
              </Button>
            </div>
          );
        })}
      </div>

      {cart.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm">
            <span className="font-semibold">{cart.length} service{cart.length > 1 ? 's' : ''} selected</span>
            <span className="text-muted-foreground"> — estimated {formatAud(total / 100)}</span>
          </p>
          <Button asChild className="grad-bg border-0">
            <Link to="/contact-us">Request these services</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
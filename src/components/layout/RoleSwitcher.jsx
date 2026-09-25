// Role badge / switcher beside the account avatar: jumps straight to the
// dashboard for each role the signed-in account holds.
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Check } from 'lucide-react';

const ROLE_DASHBOARDS = {
  admin: '/dashboard',
  judge: '/judge',
  host: '/host-dashboard',
  user: '/my-dashboard',
};

const ROLE_LABELS = {
  admin: 'Admin',
  judge: 'Judge',
  host: 'Host',
  user: 'User',
};

export default function RoleSwitcher({ roles = [] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const list = roles.length > 1 ? roles.filter((r) => r !== 'user') : roles;
  if (list.length === 0) return null;

  const path = location.pathname.toLowerCase();
  const activeRole = list.find((r) => {
    const dash = ROLE_DASHBOARDS[r];
    return path === dash || path.startsWith(`${dash}/`);
  }) || list[0];
  const label = ROLE_LABELS[activeRole] || activeRole;

  if (list.length === 1) {
    return (
      <button
        type="button"
        onClick={() => navigate(ROLE_DASHBOARDS[activeRole])}
        className="hidden items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-white/20 sm:inline-flex"
      >
        {label}
      </button>
    );
  }

  const switchRole = (role) => {
    setOpen(false);
    navigate(ROLE_DASHBOARDS[role] || '/my-dashboard');
  };

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-foreground transition-all hover:bg-white/20"
      >
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-border bg-popover py-1.5 shadow-2xl">
          <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Switch Role</p>
          {list.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => switchRole(r)}
              className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors ${
                r === activeRole ? 'font-semibold text-gold' : 'text-foreground hover:bg-muted hover:text-primary'
              }`}
            >
              {ROLE_LABELS[r] || r}
              {r === activeRole && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
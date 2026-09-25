import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function AccessDenied({ message }) {
  return (
    <div className="container-tight py-24">
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card/60 p-10 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-5 font-heading text-2xl font-extrabold">Access denied</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {message || 'You do not have permission to view this area.'}
        </p>
        <Link to="/" className="mt-8 inline-flex rounded-xl grad-bg px-6 py-3 text-sm font-bold text-white">
          Back to home
        </Link>
      </div>
    </div>
  );
}
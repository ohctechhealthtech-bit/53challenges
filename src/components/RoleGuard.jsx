import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import AccessDenied from '@/components/AccessDenied';

// Gates a group of routes behind the admin role. Applies on direct URL entry too,
// because it wraps the routes themselves rather than the navigation links.
export default function RoleGuard({ message }) {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin === true;
  if (!isAuthenticated || !isAdmin) return <AccessDenied message={message} />;
  return <Outlet />;
}
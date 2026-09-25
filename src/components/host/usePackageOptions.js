/**
 * D8 — Host Experience Principles.
 * Turns the configured hosting packages into wizard answer tiles so the
 * apply wizard shows the same package names as /host-a-challenge.
 */
import { User, Users, Award } from 'lucide-react';
import useHostPackages from '@/hooks/useHostPackages';

const ICONS = [User, Users, Award];

export default function usePackageOptions() {
  const { packages } = useHostPackages();

  return packages.map((pkg, i) => ({
    value: pkg.key,
    label: pkg.name,
    description: pkg.tagline || pkg.audience || '',
    icon: ICONS[i] || Users,
  }));
}
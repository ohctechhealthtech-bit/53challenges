/** Hosting packages from the hostPackages API, with the local copy as fallback. */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { HOST_PACKAGES } from '@/lib/hostPackages';

export default function useHostPackages() {
  const { data, isLoading } = useQuery({
    queryKey: ['hostPackages'],
    queryFn: async () => {
      const res = await base44.functions.invoke('hostPackages', {});
      return res.data?.packages?.length ? res.data.packages : HOST_PACKAGES;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return { packages: data || HOST_PACKAGES, isLoading };
}
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import SectionToolbar from '@/components/admin/SectionToolbar';
import CategoriesPanel from '@/components/admin/masters/CategoriesPanel';
import PackagesPanel from '@/components/admin/masters/PackagesPanel';
import ServicesPanel from '@/components/admin/masters/ServicesPanel';
import TemplatesPanel from '@/components/admin/masters/TemplatesPanel';

// Masters & packages tab — reference data the whole platform reads,
// managed remotely on the parent via masters.* actions.
export default function MastersTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminChallengeApi.mastersGet());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <SectionToolbar
        section="masters"
        title="Masters & packages"
        description="Reference data the whole platform reads: creative categories, host packages, service add-ons and ready-to-run templates."
      />
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading && !data ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data ? (
        <>
          <CategoriesPanel categories={data.categories || []} onReload={load} />
          <PackagesPanel packages={data.packages || []} onReload={load} />
          <ServicesPanel services={data.services || []} onReload={load} />
          <TemplatesPanel templates={data.templates || []} onReload={load} />
        </>
      ) : null}
    </div>
  );
}
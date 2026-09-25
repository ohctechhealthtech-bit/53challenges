import { useEffect, useState } from 'react';
import { Loader2, Gavel } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { loadWorkspace } from '@/lib/judgeScoring';
import CalibrationList from '@/components/judging/CalibrationList';
import ScoringConsole from '@/components/judging/ScoringConsole';

export default function JudgePortal() {
  const { isAuthenticated, navigateToLogin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) { navigateToLogin(); return; }
    (async () => {
      setLoading(true);
      try {
        setData(await loadWorkspace());
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, reloadKey]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!data?.judge) {
    return (
      <div className="container-tight py-20 text-center">
        <Gavel className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-heading text-2xl font-extrabold">Judge Portal</h1>
        <p className="mt-2 text-muted-foreground">No active judge profile is linked to your account. Apply to become a judge and an admin will review it.</p>
        <Link to="/become-a-judge" className="mt-5 inline-flex rounded-xl grad-bg px-5 py-2.5 text-sm font-bold text-white">Become a Judge</Link>
      </div>
    );
  }

  return (
    <div className="container-tight py-12">
      <h1 className="font-heading text-3xl font-extrabold">Judge Portal</h1>
      <p className="text-sm text-muted-foreground">Scoring is blind — you see only the entry, an anonymous ID, and the rubric.</p>

      <div className="mt-8 space-y-6">
        <CalibrationList
          panels={data.panels}
          calibration={data.calibration}
          onDone={() => setReloadKey((k) => k + 1)}
        />
        <ScoringConsole />
      </div>
    </div>
  );
}
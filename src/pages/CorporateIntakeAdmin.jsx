import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, FileText, History } from 'lucide-react';
import CorporateIntakeQueue from '@/components/dashboard/CorporateIntakeQueue';
import HostProposalQueue from '@/components/dashboard/HostProposalQueue';
import ServiceDeliveryPanel from '@/components/corporate/ServiceDeliveryPanel';
import { corporateIntake } from '@/lib/corporateIntake';

export default function CorporateIntakeAdmin() {
  const [tab, setTab] = useState('queue');
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [newVersionNote, setNewVersionNote] = useState('');
  const [creating, setCreating] = useState(false);

  const loadQs = async () => {
    setLoadingQ(true);
    try {
      const res = await corporateIntake.listQuestionnaires();
      setQuestionnaires(res.questionnaires || []);
    } catch { setQuestionnaires([]); }
    finally { setLoadingQ(false); }
  };
  useEffect(() => { loadQs(); }, []);

  const createVersion = async (sourceId) => {
    if (!sourceId) return;
    setCreating(true);
    try {
      await corporateIntake.createQuestionnaireVersion(sourceId, newVersionNote || 'New version');
      setNewVersionNote('');
      await loadQs();
    } catch (e) {
      alert(e.message || 'Failed to create version');
    } finally {
      setCreating(false);
    }
  };

  const active = questionnaires.find((q) => q.is_active);

  return (
    <div className="container-tight py-8">
      <h1 className="font-heading text-3xl font-extrabold">Corporate Services</h1>
      <p className="mt-1 text-sm text-muted-foreground">Host intake queue and questionnaire version control.</p>
      <Link to="/rate-card-admin" className="mt-2 inline-block text-sm text-primary hover:underline">Rate Card Admin →</Link>

      <div className="mt-6 flex gap-2 border-b border-border">
        <TabBtn active={tab === 'queue'} onClick={() => setTab('queue')}>Intake Queue</TabBtn>
        <TabBtn active={tab === 'host'} onClick={() => setTab('host')}>Host Proposals</TabBtn>
        <TabBtn active={tab === 'service'} onClick={() => setTab('service')}>Service Delivery</TabBtn>
        <TabBtn active={tab === 'questionnaire'} onClick={() => setTab('questionnaire')}>Questionnaire Manager</TabBtn>
      </div>

      <div className="mt-6">
        {tab === 'queue' ? <CorporateIntakeQueue /> : tab === 'host' ? <HostProposalQueue /> : tab === 'service' ? <ServiceDeliveryPanel /> : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Active questionnaire</p>
              {loadingQ ? <Loader2 className="mt-2 h-4 w-4 animate-spin" /> : active ? (
                <div className="mt-2">
                  <p className="font-medium">{active.name}</p>
                  <p className="text-xs text-muted-foreground">Version {active.version} · {active.is_active ? 'Active' : 'Inactive'}</p>
                  {active.change_note && <p className="mt-1 text-xs text-muted-foreground">{active.change_note}</p>}
                </div>
              ) : <p className="mt-2 text-sm text-muted-foreground">No active questionnaire.</p>}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4 text-primary" /> Create new version</p>
              <p className="mt-1 text-xs text-muted-foreground">Editing an active version creates a new one. Historical responses keep their original question/option records.</p>
              <input className="c53-input mt-3" placeholder="Change note (e.g. added Q10)" value={newVersionNote} onChange={(e) => setNewVersionNote(e.target.value)} />
              <Button className="mt-3" disabled={!active || creating} onClick={() => createVersion(active?.id)}>
                {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                Clone active → new version
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-primary" /> All versions</p>
              <ul className="mt-2 space-y-1 text-sm">
                {questionnaires.map((q) => (
                  <li key={q.id} className="flex items-center justify-between">
                    <span>{q.name} <span className="text-muted-foreground">v{q.version}</span></span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${q.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{q.is_active ? 'Active' : 'Historical'}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`border-b-2 px-4 py-2 text-sm font-medium transition ${active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{children}</button>
  );
}
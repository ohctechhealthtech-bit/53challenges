import { useState } from 'react';
import { Gavel, Users, Link2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import JudgesMasterPanel from '@/components/judges/JudgesMasterPanel';
import JudgeAssignments from '@/components/dashboard/JudgeAssignments';

export default function JudgeManagement() {
  const { user } = useAuth();
  const [tab, setTab] = useState('judges');

  const isAdmin = user?.role === 'admin' || user?.role === 'creator' || user?.is_admin === true;
  if (!isAdmin) {
    return <p className="py-10 text-sm text-muted-foreground">Admin access required.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary"><Gavel className="h-5 w-5" /></span>
        <div>
          <h2 className="font-heading text-2xl font-extrabold">Judge Management</h2>
          <p className="text-sm text-muted-foreground">Manage the judges master and assign judges to competitions.</p>
        </div>
      </div>

      <div className="mt-6 inline-flex rounded-xl border border-border bg-card p-1">
        <Tab active={tab === 'judges'} onClick={() => setTab('judges')}><Users className="h-4 w-4" /> Judges</Tab>
        <Tab active={tab === 'assignments'} onClick={() => setTab('assignments')}><Link2 className="h-4 w-4" /> Assignments</Tab>
      </div>

      <div className="mt-6">
        {tab === 'judges' && <JudgesMasterPanel />}
        {tab === 'assignments' && <JudgeAssignments />}
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
      {children}
    </button>
  );
}
import { useState, useEffect, useCallback } from 'react';
import { Globe, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/customSession';
import CreateDomainDialog from '@/components/admin/domains/CreateDomainDialog';
import DomainTable from '@/components/admin/domains/DomainTable';
import AdminSslPanel from '@/components/admin/domains/AdminSslPanel';

export default function DomainManagement() {
  const [domains, setDomains] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [sslPanelOpen, setSslPanelOpen] = useState(false);
  const [defaultSsl, setDefaultSsl] = useState(null);
  const baseDomain = '53challenges.com';

  const loadDomains = useCallback(async () => {
    setLoading(true);
    try {
      // Read through the function, not base44.entities. ChallengeDomain's RLS
      // read rule resolves against a Base44 platform user, so a direct browser
      // read returns an empty list — not an error — for admins signed in via
      // the Challenge-API login, and the table silently shows "no domains".
      const res = await base44.functions.invoke('challengeDomains', {
        action: 'list',
        session_token: getSessionToken(),
      });
      setDomains(res?.data?.domains || []);
    } catch {
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChallenges = useCallback(async () => {
    try {
      // Pull from the external Challenge API (source of truth) via the
      // challengeDomains function — same active challenges the public
      // Challenges page shows, not the local template-generated records.
      const res = await base44.functions.invoke('challengeDomains', { action: 'challenges', session_token: getSessionToken() });
      setChallenges(res?.data?.challenges || res?.challenges || []);
    } catch {
      setChallenges([]);
    }
  }, []);

  const loadDefaultSsl = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('manageAdminSsl', { action: 'get', session_token: getSessionToken() });
      setDefaultSsl(res?.data?.configuration || res?.configuration || null);
    } catch {
      setDefaultSsl(null);
    }
  }, []);

  // Challenges already assigned to a live (non-deleted) domain are excluded
  // from the dropdown so each challenge can only have one active domain.
  const assignedChallengeIds = new Set(
    (domains || [])
      .filter((d) => d.status !== 'deleted' && d.challenge_id)
      .map((d) => d.challenge_id)
  );
  const availableChallenges = (challenges || []).filter((c) => !assignedChallengeIds.has(c.id));

  useEffect(() => {
    loadDomains();
    loadChallenges();
    loadDefaultSsl();
  }, [loadDomains, loadChallenges, loadDefaultSsl]);

  return (
    <div className="container-tight py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" /> Domain Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage challenge subdomains and independent domains.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSslPanelOpen(true)} className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Default SSL
            {defaultSsl ? (
              <span className="ml-1 inline-flex items-center rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
                Configured
              </span>
            ) : (
              <span className="ml-1 inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                Missing
              </span>
            )}
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create Domain
          </Button>
        </div>
      </div>

      <DomainTable domains={domains} loading={loading} onChanged={loadDomains} />

      <CreateDomainDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        challenges={availableChallenges}
        baseDomain={baseDomain}
        defaultSsl={defaultSsl}
        onCreated={loadDomains}
      />

      <AdminSslPanel
        open={sslPanelOpen}
        onOpenChange={setSslPanelOpen}
        currentConfig={defaultSsl}
        onSaved={loadDefaultSsl}
      />
    </div>
  );
}
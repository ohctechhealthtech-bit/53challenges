import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import ChallengeFormDialog from '@/components/admin/ChallengeFormDialog';
import { hostPortal } from '@/lib/hostPortalClient';

// Child-app challenge categories (enum on this app's Challenge entity).
const CHILD_CATEGORIES = [
  { key: 'art-craft-making', label: 'Art, Craft & Making' },
  { key: 'food-farming-community', label: 'Food, Farming & Community' },
  { key: 'music-dance-performance', label: 'Music, Dance & Performance' },
  { key: 'outdoor-adventure', label: 'Outdoor & Adventure' },
  { key: 'photography-film-digital', label: 'Photography, Film & Digital' },
  { key: 'writing-ideas-innovation', label: 'Writing, Ideas & Innovation' },
];

// Reference data for the form dropdowns — matches the child app's Challenge
// entity fields (state, stage, status, entry types, age divisions).
const CHILD_REFERENCE = {
  categories: CHILD_CATEGORIES,
  states: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'],
  pipeline_stages: ['state', 'national', 'grand_final'],
  statuses: ['draft', 'active', 'archived'],
  entry_types: ['image', 'video', 'audio', 'document', 'written_text'],
  age_divisions: ['children', 'teens', 'adults', 'ndi'],
};

// Map a child-app challenge (from admin_preview_challenges) to the shape
// ChallengeFormDialog's initial() expects.
function toFormChallenge(ch) {
  if (!ch) return undefined;
  return {
    id: ch.id,
    title: ch.title || '',
    theme: ch.theme || ch.title || '',
    description: ch.brief || '',
    category: ch.category || '',
    content_type: ch.content_type || 'admin_managed',
    state: ch.state || '',
    season: ch.season || '',
    stage: ch.stage || 'state',
    status: ch.status || 'draft',
    start_date: ch.start_date || '',
    end_date: ch.end_date || '',
    voting_end_date: ch.voting_ends_at || '',
    cover_image: ch.cover_image || '',
    age_divisions: ch.divisions || [],
  };
}

// Map the ChallengeFormDialog payload to the fields admin_update_challenge /
// admin_create_challenge expect on the hostPortal backend.
function toHostPortalFields(payload) {
  return {
    title: payload.title,
    brief: payload.description,
    cover_image: payload.cover_image || '',
    category: payload.category,
    content_type: payload.content_type,
    divisions: payload.age_divisions || [],
    status: payload.status,
    start_date: payload.start_date ? new Date(payload.start_date).toISOString() : undefined,
    end_date: payload.end_date ? new Date(payload.end_date).toISOString() : undefined,
    voting_end_date: payload.voting_end_date ? new Date(payload.voting_end_date).toISOString() : null,
  };
}

// Unified challenge form — reuses the same ChallengeFormDialog the admin
// dashboard uses for editing challenges. Handles both creating (no challenge)
// and editing (with a child-app challenge from admin_preview_challenges).
export default function ChallengeEditDialog({ challenge, open, onOpenChange, onSaved, proposalId, proposalTitle }) {
  const isCreate = !challenge;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isCreate ? internalOpen : open;
  const setOpen = isCreate ? setInternalOpen : onOpenChange;

  const handleSubmit = async (payload) => {
    if (isCreate) {
      const res = await hostPortal('admin_create_challenge', {
        proposal_id: proposalId || '',
        fields: toHostPortalFields(payload),
      });
      toast.success('Challenge created!');
      onSaved?.(res);
    } else {
      await hostPortal('admin_update_challenge', {
        challenge_id: challenge.id,
        fields: toHostPortalFields(payload),
      });
      toast.success('Challenge updated');
      onSaved?.();
    }
  };

  return (
    <>
      {isCreate && (
        <Button size="sm" variant="outline" onClick={() => setInternalOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Create Challenge
        </Button>
      )}
      <ChallengeFormDialog
        open={isOpen}
        onOpenChange={setOpen}
        challenge={toFormChallenge(challenge)}
        categories={CHILD_CATEGORIES}
        reference={CHILD_REFERENCE}
        skipFetch
        titleText={isCreate ? 'Create New Challenge' : `Edit ${challenge?.title || 'challenge'}`}
        submitLabel={isCreate ? 'Create Challenge' : 'Save Changes'}
        intro={isCreate && proposalTitle ? `From proposal: ${proposalTitle}` : undefined}
        onSubmit={handleSubmit}
        onSaved={() => {}}
      />
    </>
  );
}
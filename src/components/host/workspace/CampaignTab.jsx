/**
 * Campaign tab — unlocks once a challenge is approved.
 */
import { Megaphone } from 'lucide-react';

export default function CampaignTab({ unlocked }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center">
      <Megaphone className="mx-auto mb-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
      {unlocked ? (
        <>
          <p className="font-heading text-lg font-bold">Your campaign workspace is open</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Our team will share your launch plan, posts and promotion schedule here.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          The campaign workspace unlocks once one of your challenges has been approved.
        </p>
      )}
    </div>
  );
}
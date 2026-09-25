import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { useSubdomainChallenge } from '@/hooks/useSubdomainChallenge';
import { Button } from '@/components/ui/button';
import ChallengeIntro from '@/pages/ChallengeIntro';

export default function SubdomainChallenge({ slug }) {
  const { loading, domain, challenge, error } = useSubdomainChallenge(slug);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error === 'not_found' || !domain) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <Globe className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Challenge site not found</h1>
          <p className="text-muted-foreground mb-6">
            We couldn't find a challenge for <span className="font-semibold text-foreground">{slug}</span>.
            It may have been removed or not yet configured.
          </p>
          <Button asChild>
            <Link to="/">Visit 53 Challenges</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (error === 'challenge_missing' || !challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <Globe className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Challenge coming soon</h1>
          <p className="text-muted-foreground mb-6">
            This subdomain is registered but the challenge content isn't available yet.
          </p>
          <Button asChild>
            <Link to="/">Visit 53 Challenges</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Render the full challenge intro page with the mapped challenge ID. Layout
  // (header + footer) comes from the "/" route this is mounted on.
  const cid = challenge.id || domain.challenge_id;
  return <ChallengeIntro challengeId={cid} />;
}
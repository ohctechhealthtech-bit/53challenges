import SJHero from '@/components/sponsorjudge/SJHero';
import SJJudgeShowcase from '@/components/sponsorjudge/SJJudgeShowcase';
import SJSponsorShowcase from '@/components/sponsorjudge/SJSponsorShowcase';
import SJJoinCTA from '@/components/sponsorjudge/SJJoinCTA';
import SJPanelLists from '@/components/sponsorjudge/SJPanelLists';

export default function SponsorsAndJudges() {
  return (
    <main>
      <SJHero />
      <SJPanelLists />
      <SJJudgeShowcase />
      <SJSponsorShowcase />
      <SJJoinCTA />
    </main>
  );
}
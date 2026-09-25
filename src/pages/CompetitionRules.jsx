import TrustPageLayout from '@/components/TrustPageLayout';

export default function CompetitionRules() {
  return (
    <TrustPageLayout
      title="Competition Rules"
      subtitle="The rules that govern challenges on 53 Challenges."
      lastUpdated="August 2026"
    >
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">1. Entry Requirements</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Entries must be submitted before the challenge's stated closing date and time.</li>
            <li>Each participant may submit one entry per challenge unless otherwise stated.</li>
            <li>Entries must meet the format requirements specified on the challenge page (e.g., video, image, written).</li>
            <li>Late, incomplete, or ineligible entries will not be accepted.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">2. Divisions & Eligibility</h2>
          <p className="mt-2">
            Challenges may be divided by age: Children (7–12), Teens (13–19), Adults (20+), and NDI
            (National Disability Insurance). Participants must enter the correct division for their age
            and circumstances. Misrepresenting your division results in disqualification.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">3. Originality & Content Standards</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>All work must be original and created by the entrant.</li>
            <li>No AI-generated content unless the challenge explicitly permits it.</li>
            <li>Content must not contain offensive, discriminatory, or unlawful material.</li>
            <li>Music, images, or other copyrighted material must be properly licensed.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">4. Judging & Scoring</h2>
          <p className="mt-2">
            Each challenge uses a configured scoring model that may include judge scores, public votes,
            or a weighted combination of both. The scoring model is displayed on each challenge page.
            Judging is conducted by independent panels, and all results are audited before publication.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">5. Voting Rules</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Each verified user may vote once per entry.</li>
            <li>Vote manipulation — including bots, multiple accounts, or coordinated voting — is prohibited.</li>
            <li>Suspicious votes are flagged and may be excluded from the final count.</li>
            <li>Public voting is one component of the final result; it does not solely determine rankings.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">6. State & National Pathway</h2>
          <p className="mt-2">
            Many challenges follow a state-to-national pathway. State winners may qualify for the national
            stage. The number of qualifying places per state is determined by the challenge configuration.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">7. Disqualification</h2>
          <p className="mt-2">
            Entries may be disqualified for: plagiarism, vote manipulation, inappropriate content,
            incorrect division entry, or breach of these rules. Disqualification decisions are final
            and made by the challenge organisers or audit panel.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">8. Appeals</h2>
          <p className="mt-2">
            Participants may appeal a disqualification or result within 48 hours of publication by
            contacting hello@53challenges.com. Appeals are reviewed by the audit panel and decisions
            are final.
          </p>
        </section>
      </div>
    </TrustPageLayout>
  );
}
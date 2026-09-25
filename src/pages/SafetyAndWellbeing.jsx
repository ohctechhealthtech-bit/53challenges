import TrustPageLayout from '@/components/TrustPageLayout';

export default function SafetyAndWellbeing() {
  return (
    <TrustPageLayout
      title="Safety & Wellbeing"
      subtitle="Our commitment to a safe, supportive environment for all participants."
      lastUpdated="August 2026"
    >
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">Our Commitment</h2>
          <p className="mt-2">
            53 Challenges is a platform for creative expression, community, and healthy competition.
            We are committed to ensuring every participant — regardless of age, background, or ability —
            feels safe, respected, and supported.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">Content Guidelines</h2>
          <p className="mt-2">All entries and interactions must be:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Respectful — no harassment, bullying, or hate speech.</li>
            <li>Appropriate — no explicit, violent, or unlawful content.</li>
            <li>Original — no plagiarism or stolen content.</li>
            <li>Honest — no misleading or deceptive material.</li>
          </ul>
          <p className="mt-2">
            Content that violates these guidelines is removed, and the responsible account may be
            suspended or permanently banned.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">Child Safety</h2>
          <p className="mt-2">
            Challenges open to children (ages 7–12) and teens (ages 13–19) have additional safeguards:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Parental or guardian consent is required for participants under 16.</li>
            <li>Entries from minors are moderated before public display.</li>
            <li>Personal information (such as full names and locations) of minors is protected.</li>
            <li>Inappropriate interactions with minors are reported to authorities.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">Mental Health & Wellbeing</h2>
          <p className="mt-2">
            Competition can be intense. We encourage all participants to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Celebrate effort and creativity, not just winning.</li>
            <li>Be kind to fellow participants — your words affect real people.</li>
            <li>Take breaks from social media during high-pressure voting periods.</li>
            <li>Reach out for support if you feel overwhelmed.</li>
          </ul>
          <p className="mt-2">
            If you or someone you know is struggling, contact Lifeline on 13 11 14 (Australia) or
            Kids Helpline on 1800 55 1800 (for ages 5–25).
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">Reporting Concerns</h2>
          <p className="mt-2">
            If you encounter inappropriate content, behaviour, or feel unsafe on the platform, report it
            immediately:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Use the report button on any entry or comment.</li>
            <li>Email safety@53challenges.com for serious concerns.</li>
            <li>Contact authorities if you believe a crime has been committed.</li>
          </ul>
          <p className="mt-2">
            All reports are reviewed within 24 hours. We take every report seriously and act to protect
            our community.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">Privacy & Data Protection</h2>
          <p className="mt-2">
            Your personal information is protected under our Privacy Policy. We never share your contact
            details publicly without consent, and we use encryption to keep your data secure.
          </p>
        </section>
      </div>
    </TrustPageLayout>
  );
}
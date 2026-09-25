import TrustPageLayout from '@/components/TrustPageLayout';

export default function PrivacyPolicy() {
  return (
    <TrustPageLayout
      title="Privacy Policy"
      subtitle="How we collect, use and protect your personal information."
      lastUpdated="August 2026"
    >
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">1. Overview</h2>
          <p className="mt-2">
            53 Challenges is committed to protecting your privacy. This policy explains what personal
            information we collect, how we use it, and the choices you have about your data when you use
            our platform to enter challenges, vote, or host competitions.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">2. Information We Collect</h2>
          <p className="mt-2">We collect:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Account information: name, email address, and state/territory.</li>
            <li>Challenge entries: your submitted work, descriptions, and associated metadata.</li>
            <li>Voting data: which entries you vote for (to prevent fraud and ensure one-vote-per-person).</li>
            <li>Usage data: pages visited, device type, and approximate location (for analytics).</li>
          </ul>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">3. How We Use Your Information</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>To run challenges, process entries, and calculate audited results.</li>
            <li>To verify votes and prevent fraudulent activity.</li>
            <li>To communicate with you about challenges, deadlines, and results.</li>
            <li>To improve our platform and develop new features.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">4. Sharing Your Information</h2>
          <p className="mt-2">
            We do not sell your personal information. We share data only with: independent judging
            panels (for scoring), auditors (for result verification), and service providers who help us
            operate the platform — all under strict confidentiality agreements.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">5. Your Rights</h2>
          <p className="mt-2">
            You can request access to, correction of, or deletion of your personal information at any
            time. Contact us at hello@53challenges.com to exercise these rights.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">6. Data Security</h2>
          <p className="mt-2">
            We use industry-standard security measures including encryption, access controls, and regular
            security reviews to protect your data.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">7. Children's Privacy</h2>
          <p className="mt-2">
            Some challenges are open to children aged 7+. For participants under 16, we require parental
            or guardian consent at registration. We do not knowingly collect personal information from
            children without consent.
          </p>
        </section>
      </div>
    </TrustPageLayout>
  );
}
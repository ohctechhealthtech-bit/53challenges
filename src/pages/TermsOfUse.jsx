import TrustPageLayout from '@/components/TrustPageLayout';

export default function TermsOfUse() {
  return (
    <TrustPageLayout
      title="Terms of Use"
      subtitle="The terms and conditions for using 53 Challenges."
      lastUpdated="August 2026"
    >
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">1. Acceptance of Terms</h2>
          <p className="mt-2">
            By accessing or using the 53 Challenges platform, you agree to be bound by these Terms of
            Use. If you do not agree, please do not use the platform.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">2. Eligibility</h2>
          <p className="mt-2">
            Challenges are open to Australian residents. Some challenges have age-based divisions
            (Children 7–12, Teens 13–19, Adults 20+, NDI). Participants under 16 require parental or
            guardian consent.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">3. Original Work</h2>
          <p className="mt-2">
            All entries must be your original work. By submitting, you confirm that you own the rights
            to the content and that it does not infringe on any third-party rights. Plagiarism or
            copyright infringement results in immediate disqualification.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">4. Content Licence</h2>
          <p className="mt-2">
            By submitting an entry, you grant 53 Challenges a non-exclusive licence to display, reproduce,
            and promote your entry on the platform and in associated marketing materials. You retain all
            ownership rights to your work.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">5. Voting & Results</h2>
          <p className="mt-2">
            Public voting is part of the final result, combined with independent judging panels. Results
            are audited before publication. Attempting to manipulate votes — including through bots,
            multiple accounts, or coordinated voting — results in disqualification and may lead to
            permanent account suspension.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">6. Code of Conduct</h2>
          <p className="mt-2">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Submit content that is offensive, discriminatory, or harmful.</li>
            <li>Harass or intimidate other participants, judges, or organisers.</li>
            <li>Attempt to hack, disrupt, or reverse-engineer the platform.</li>
            <li>Impersonate another person or organisation.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">7. Prizes</h2>
          <p className="mt-2">
            Prize details are specified on each challenge page. Winners may be required to verify their
            identity before prizes are awarded. Prizes are non-transferable unless stated otherwise.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">8. Limitation of Liability</h2>
          <p className="mt-2">
            53 Challenges is provided "as is." We are not liable for any indirect, incidental, or
            consequential damages arising from your use of the platform.
          </p>
        </section>
        <section>
          <h2 className="font-heading text-lg font-bold text-foreground">9. Changes to Terms</h2>
          <p className="mt-2">
            We may update these terms from time to time. Continued use of the platform after changes
            constitutes acceptance of the updated terms.
          </p>
        </section>
      </div>
    </TrustPageLayout>
  );
}
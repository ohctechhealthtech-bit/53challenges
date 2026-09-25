import React from 'react';
import SponsorPageHero from '@/components/challenges/sponsors/SponsorPageHero';
import SponsorBenefits from '@/components/challenges/sponsors/SponsorBenefits';
import BecomeSponsorSection from '@/components/challenges/sponsors/BecomeSponsorSection';

export default function BecomeSponsor() {
  const scrollToForm = () => {
    document.getElementById('enquiry')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <SponsorPageHero onStart={scrollToForm} />
      <SponsorBenefits />
      <div id="enquiry">
        <BecomeSponsorSection defaultOpen />
      </div>
    </div>
  );
}
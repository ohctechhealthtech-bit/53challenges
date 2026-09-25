import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import IntakeIntroHeader from '@/components/corporate/IntakeIntroHeader';
import IntakeWizard from '@/components/corporate/IntakeWizard';
import IntakeConfirmation from '@/components/corporate/IntakeConfirmation';

function PricingLink() {
  return (
    <div className="container-tight pb-12">
      <Link to="/pricing-calculator" className="inline-flex items-center gap-2 rounded-xl border border-border bg-white/5 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary">
        <Calculator className="h-4 w-4" /> Estimate the cost of your Challenge Proposal
      </Link>
    </div>
  );
}

export default function CorporateIntake() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    document.title = 'Discuss your proposal — 53 Challenges';
  }, []);

  if (result) return <IntakeConfirmation />;
  return (
    <>
      <IntakeIntroHeader />
      <IntakeWizard onComplete={setResult} />
      <PricingLink />
    </>
  );
}
import React, { useState } from 'react';
import { Handshake, ChevronDown } from 'lucide-react';
import SponsorApplyForm from './SponsorApplyForm';

export default function BecomeSponsorSection({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="py-14 bg-stone-50">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 bg-orange-100 text-orange-800 text-xs font-bold px-3 py-1.5 rounded-full">
            <Handshake className="w-3.5 h-3.5" /> Partner with us
          </span>
          <h2 className="text-3xl font-bold text-stone-900 mt-4">Run a challenge with us</h2>
          <p className="text-stone-600 mt-3 max-w-2xl mx-auto">
            Brands, councils, schools and not-for-profits partner with 53 Challenges to launch creative challenges
            that reach communities right across Australia. Tell us your idea and our partnerships team will
            shape it with you.
          </p>
          {!open && (
            <button
              onClick={() => setOpen(true)}
              className="mt-6 inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-7 py-3 rounded-xl transition-colors"
            >
              Start an enquiry <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {open && <div className="mt-8"><SponsorApplyForm /></div>}
      </div>
    </section>
  );
}
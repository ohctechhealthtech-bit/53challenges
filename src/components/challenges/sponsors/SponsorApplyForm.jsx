import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { ORG_TYPES, GEO_SCOPES } from './sponsorApplyOptions';
import EmailVerifyGate from '@/components/verify/EmailVerifyGate';

const EMPTY = {
  organisation_type: 'Sponsor / Brand',
  organisation_name: '',
  contact_name: '',
  contact_email: '',
  phone: '',
  website: '',
  geographic_scope: 'National',
  challenge_title: '',
  challenge_description: '',
  audience: '',
  audience_size: '',
  estimated_budget: '',
  launch_timing: '',
};

export default function SponsorApplyForm() {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState('');

  const set = (k, v) => {
    if (k === 'contact_email') setToken('');
    setForm((prev) => ({ ...prev, [k]: v }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!token) return toast.error('Please verify your email address first.');
    setSubmitting(true);
    const res = await base44.functions.invoke('sponsorApplication', { action: 'submit', ...form, verification_token: token })
      .catch((err) => ({ data: { error: err?.response?.data?.error || 'Something went wrong. Please try again.' } }));
    setSubmitting(false);
    if (res?.data?.error) return toast.error(res.data.error);
    setDone(true);
  };

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-stone-900">Enquiry received</h3>
        <p className="text-stone-600 mt-2 max-w-md mx-auto">
          Thanks! We've emailed you a confirmation. Our partnerships team reviews every enquiry personally and will be in touch with next steps.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-stone-200 p-6 md:p-8 space-y-6">
      <div>
        <h3 className="font-bold text-stone-900 text-lg mb-4">Who you are</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-stone-700">Organisation type *</Label>
            <select
              required
              value={form.organisation_type}
              onChange={(e) => set('organisation_type', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white text-stone-900"
            >
              {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-stone-700">Organisation name *</Label>
            <Input required value={form.organisation_name} onChange={(e) => set('organisation_name', e.target.value)} className="mt-1 bg-white text-stone-900" />
          </div>
          <div>
            <Label className="text-stone-700">Contact name *</Label>
            <Input required value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} className="mt-1 bg-white text-stone-900" />
          </div>
          <div>
            <Label className="text-stone-700">Contact email *</Label>
            <Input required type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} className="mt-1 bg-white text-stone-900" />
          </div>
          <div>
            <Label className="text-stone-700">Phone</Label>
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="mt-1 bg-white text-stone-900" />
          </div>
          <div>
            <Label className="text-stone-700">Geographic scope</Label>
            <select
              value={form.geographic_scope}
              onChange={(e) => set('geographic_scope', e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white text-stone-900"
            >
              {GEO_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-stone-700">Website</Label>
            <Input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" className="mt-1 bg-white text-stone-900" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-bold text-stone-900 text-lg mb-4">Your challenge idea</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-stone-700">Challenge title *</Label>
            <Input required value={form.challenge_title} onChange={(e) => set('challenge_title', e.target.value)} placeholder="e.g. Future Cities Photo Challenge" className="mt-1 bg-white text-stone-900" />
          </div>
          <div>
            <Label className="text-stone-700">What's the challenge? *</Label>
            <Textarea required rows={4} value={form.challenge_description} onChange={(e) => set('challenge_description', e.target.value)} className="mt-1 bg-white text-stone-900" />
          </div>
          <div>
            <Label className="text-stone-700">Who's the audience? *</Label>
            <Textarea required rows={2} value={form.audience} onChange={(e) => set('audience', e.target.value)} placeholder="e.g. secondary students in NSW" className="mt-1 bg-white text-stone-900" />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label className="text-stone-700">Audience size</Label>
              <Input value={form.audience_size} onChange={(e) => set('audience_size', e.target.value)} placeholder="e.g. 500" className="mt-1 bg-white text-stone-900" />
            </div>
            <div>
              <Label className="text-stone-700">Estimated budget</Label>
              <Input value={form.estimated_budget} onChange={(e) => set('estimated_budget', e.target.value)} placeholder="e.g. $10,000" className="mt-1 bg-white text-stone-900" />
            </div>
            <div>
              <Label className="text-stone-700">Launch timing</Label>
              <Input value={form.launch_timing} onChange={(e) => set('launch_timing', e.target.value)} placeholder="e.g. Term 3 2026" className="mt-1 bg-white text-stone-900" />
            </div>
          </div>
        </div>
      </div>

      <EmailVerifyGate
        email={form.contact_email.trim()}
        purpose="sponsor_application"
        label="your enquiry"
        verified={!!token}
        onVerified={setToken}
        light
      />

      <Button type="submit" disabled={submitting || !token} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
        <Send className="w-4 h-4" /> {submitting ? 'Sending…' : 'Submit inquiry'}
      </Button>
    </form>
  );
}
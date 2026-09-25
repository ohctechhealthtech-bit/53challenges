import { useState } from 'react';
import { Mail, MessageSquare, ArrowRight, CheckCircle2 } from 'lucide-react';
import TrustPageLayout from '@/components/TrustPageLayout';
import { SITE_CONFIG } from '@/lib/siteConfig';

export default function ContactUs() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Form is display-only — in production this would send to a backend function.
    setSubmitted(true);
  };

  return (
    <TrustPageLayout title="Contact Us" subtitle="Get in touch with the 53 Challenges team.">
      <div className="space-y-8">
        {/* Contact methods */}
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href={`mailto:${SITE_CONFIG.contact.email}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 transition hover:border-primary"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading font-bold">Email</p>
              <p className="text-sm text-muted-foreground">{SITE_CONFIG.contact.email}</p>
            </div>
          </a>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading font-bold">Response Time</p>
              <p className="text-sm text-muted-foreground">We reply within 1–2 business days</p>
            </div>
          </div>
        </div>

        {/* Contact form */}
        {submitted ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h3 className="mt-4 font-heading text-xl font-bold">Message sent!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Thanks for reaching out. We'll get back to you within 1–2 business days.
            </p>
            <button
              onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-primary hover:text-primary"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Name *</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="c53-input"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">Email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="c53-input"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Subject *</label>
              <select
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="c53-input"
              >
                <option value="">Select a topic</option>
                <option value="general">General enquiry</option>
                <option value="sponsorship">Sponsorship / Hosting</option>
                <option value="technical">Technical support</option>
                <option value="safety">Safety concern</option>
                <option value="media">Media / Press</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground">Message *</label>
              <textarea
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="c53-input resize-none"
                placeholder="Tell us how we can help..."
              />
            </div>
            <button
              type="submit"
              className="btn-bounce btn-glow inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-110"
            >
              Send Message <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </TrustPageLayout>
  );
}
import { Link } from 'react-router-dom';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { ECOSYSTEM } from '@/lib/challenges-data';
import RevealOnScroll from '@/components/home/RevealOnScroll';

export default function CategoryClasses({ accent }) {
  const classes = ECOSYSTEM.find((e) => e.slug === 'classes');
  if (!classes) return null;
  return (
    <section className="border-t border-border">
      <div className="container-tight py-14">
        <RevealOnScroll>
          <div className="flex flex-col items-start gap-6 rounded-3xl border border-border bg-card p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: accent }}>Related classes</p>
              <h2 className="mt-1 font-heading text-2xl font-bold">Build your skills before entering</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">{classes.blurb} Browse expert-led courses matched to this category and prepare your best work.</p>
            </div>
            <a href={classes.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: classes.color }}>
              Explore 53 Classes <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
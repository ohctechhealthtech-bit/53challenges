import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { challengeApi } from '@/lib/challengeApi';
import { normalizeCategory, challengePhase, daysLeft, categoryMeta } from '@/lib/challenges-data';
import { getCategoryDefaults } from '@/lib/categoryContent';
import CategoryStickyNav from '@/components/category/CategoryStickyNav';
import CategoryHero from '@/components/category/CategoryHero';
import CategoryAbout from '@/components/category/CategoryAbout';
import CategoryWorkTypes from '@/components/category/CategoryWorkTypes';
import CategoryLearning from '@/components/category/CategoryLearning';
import CategoryBenefits from '@/components/category/CategoryBenefits';
import CategoryEligibility from '@/components/category/CategoryEligibility';
import CategoryProcess from '@/components/category/CategoryProcess';
import CategoryChallenges from '@/components/category/CategoryChallenges';
import CategoryPrevWinners from '@/components/category/CategoryPrevWinners';
import CategoryClasses from '@/components/category/CategoryClasses';
import CategoryFAQ from '@/components/category/CategoryFAQ';
import CategoryFinalCTA from '@/components/category/CategoryFinalCTA';

export default function ChallengeCategoryDetail() {
  const { slug } = useParams();
  const norm = normalizeCategory(slug);
  const meta = categoryMeta(norm);
  const accent = meta.color;

  const [cat, setCat] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Merge admin-managed entity content over the structured fallback.
      const defaults = getCategoryDefaults(norm);
      let merged = { ...defaults, slug: norm };
      try {
        const recs = await base44.entities.ChallengeCategory.filter({ slug: norm, status: 'active' }, 'display_order', 5);
        if (!cancelled && recs && recs.length) {
          const r = recs[0];
          merged = {
            ...defaults,
            ...r,
            work_types: (r.work_types && r.work_types.length) ? r.work_types : defaults.work_types,
            benefits: (r.benefits && r.benefits.length) ? r.benefits : defaults.benefits,
            challenge_formats: (r.challenge_formats && r.challenge_formats.length) ? r.challenge_formats : defaults.challenge_formats,
            faq_items: (r.faq_items && r.faq_items.length) ? r.faq_items : defaults.faq_items,
            learning_outcomes: (r.learning_outcomes && r.learning_outcomes.length) ? r.learning_outcomes : defaults.learning_outcomes,
            audience_types: (r.audience_types && r.audience_types.length) ? r.audience_types : defaults.audience_types,
            gallery_images: (r.gallery_images && r.gallery_images.length) ? r.gallery_images : defaults.gallery_images,
          };
        }
      } catch { /* fall back to defaults */ }
      // Use the live category image (from the API categories cache) as the hero
      // image when no admin-managed entity image is set.
      if (!merged.hero_image && meta.image) merged.hero_image = meta.image;
      if (cancelled) return;
      setCat(merged);

      // Challenges — from the live Challenge API, filtered by canonical category.
      let chs = [];
      try {
        const res = await challengeApi.listChallenges({ status: 'active', limit: 200 });
        chs = (res?.challenges || []).filter((c) => normalizeCategory(c.category) === norm);
      } catch { chs = []; }
      if (!cancelled) {
        setChallenges(chs);
        // Fall back to the first challenge's cover image if still no hero image.
        if (!merged.hero_image && chs.length && chs[0].cover_image) {
          merged.hero_image = chs[0].cover_image;
          setCat({ ...merged });
        }
      }

      // Previous winners — audited combined results for this category.
      try {
        const w = await base44.entities.CombinedResult.filter({ category: meta.name }, '-created_date', 12).catch(() => []);
        if (!cancelled) setWinners(w || []);
      } catch { if (!cancelled) setWinners([]); }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [norm, meta.name]);

  const stats = useMemo(() => {
    const count = challenges.length;
    const prizeTotal = challenges.reduce((sum, c) => sum + (Number(c.prize_value) > 0 ? Number(c.prize_value) : 0), 0);
    const nextClosing = (() => {
      const future = challenges
        .filter((c) => challengePhase(c) === 'submit' || challengePhase(c) === 'upcoming')
        .map((c) => c.submission_ends_at || c.voting_ends_at)
        .filter(Boolean)
        .sort((a, b) => new Date(a) - new Date(b));
      if (!future.length) return null;
      const d = new Date(future[0]);
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    })();
    return { count, prizeTotal, nextClosing };
  }, [challenges]);

  if (!cat) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <CategoryStickyNav accent={accent} />
      <CategoryHero cat={cat} accent={accent} challengeCount={stats.count} prizeTotal={stats.prizeTotal} nextClosing={stats.nextClosing} />
      <CategoryAbout cat={cat} accent={accent} />
      <CategoryWorkTypes cat={cat} accent={accent} />
      <CategoryLearning cat={cat} accent={accent} />
      <CategoryBenefits cat={cat} accent={accent} />
      <CategoryEligibility cat={cat} accent={accent} />
      <CategoryProcess cat={cat} accent={accent} />
      <CategoryChallenges challenges={challenges} accent={accent} />
      <CategoryPrevWinners winners={winners} accent={accent} />
      <CategoryClasses accent={accent} />
      <CategoryFAQ cat={cat} accent={accent} />
      <CategoryFinalCTA cat={cat} accent={accent} />
    </div>
  );
}
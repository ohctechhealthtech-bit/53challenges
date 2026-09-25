/**
 * Step 1 · "Your challenge" — template-first challenge choice.
 * Hosts pick a ready-made challenge from our library (rich photo cards, best
 * match first), or describe their own custom build with an optional banner
 * image and an AI description helper.
 */
import { useEffect, useState } from 'react';
import { Loader2, Check, Clock, Users, PenLine, Star, Tag, Trophy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { templateLibrary } from '@/lib/templateLibrary';
import { templateThumb } from '@/components/host/idea/templateThumb';
import { useCategories } from '@/hooks/useCategories';
import useCategoryOptions from '@/components/host/useCategoryOptions';
import ChallengeBannerUpload from '@/components/host/apply/ChallengeBannerUpload';
import DescriptionTipsNote from '@/components/host/apply/DescriptionTipsNote';
import AiDescriptionButton, { DESC_MAX, DESC_MIN_WORDS, DESC_TARGET_WORDS } from '@/components/host/apply/AiDescriptionButton';
import EntryTypeMultiSelect from '@/components/challenges/EntryTypeMultiSelect';

const pretty = (v) => String(v || '').replace(/[_-]/g, ' ');

export default function ChallengePickStep({ answers, set, setAnswers }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const custom = !!answers.custom_challenge_idea;
  const { categories } = useCategories();
  // Templates carry their own category, so picking one fills that answer in
  // for the host (and the wizard then skips the category question).
  const slugFor = (id) => (categories || []).find((c) => c.id === id)?.slug || '';
  const { options: categoryOptions, loading: categoriesLoading } = useCategoryOptions();

  useEffect(() => {
    (async () => {
      try {
        const res = await templateLibrary.recommend({
          host_type: answers.host_type,
          delivery_level: answers.delivery_level,
          org_kind: answers.org_kind,
        }, 8);
        setOptions(res.templates || []);
      } catch (e) {
        setError('We could not load our challenge library just now.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (t) =>
    setAnswers((a) => ({
      ...a,
      template_id: t.id,
      template_name: t.template_name,
      custom_challenge_idea: false,
      challenge_title: t.template_name || a.challenge_title,
      challenge_description: t.summary || a.challenge_description,
      category: t.category || slugFor(t.primary_category_id) || a.category,
    }));

  const goCustom = () =>
    setAnswers((a) => ({ ...a, custom_challenge_idea: true, template_id: '', template_name: '' }));

  const description = answers.challenge_description || '';
  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-muted-foreground">{error}</p>}

      {options.map((t, i) => {
        const selected = answers.template_id === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => choose(t)}
            className={`block w-full overflow-hidden rounded-2xl border text-left transition ${
              selected
                ? 'border-2 border-[#1677C8] bg-blue-50 shadow-md'
                : 'border-border bg-card hover:border-primary/50 hover:shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row">
              <div className="relative h-40 w-full shrink-0 sm:h-auto sm:w-48">
                <img src={templateThumb(t)} alt="" loading="lazy" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-[#1677C8] shadow-sm">
                    <Star className="h-3.5 w-3.5" /> Best match
                  </span>
                )}
              </div>
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-heading text-base font-bold text-[#102A43]">{t.template_name}</p>
                  {selected && <Check className="h-5 w-5 shrink-0 text-[#1677C8]" />}
                </div>
                {t.summary && <p className="mt-1 text-sm text-slate-600">{t.summary}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  {t.entry_type && (
                    <span className="inline-flex items-center gap-1 capitalize">
                      <Users className="h-3.5 w-3.5" /> {pretty(t.entry_type)} entries
                    </span>
                  )}
                  {t.recommended_duration_weeks && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> about {t.recommended_duration_weeks} weeks
                    </span>
                  )}
                  {t.category && (
                    <span className="inline-flex items-center gap-1 capitalize">
                      <Tag className="h-3.5 w-3.5" /> {pretty(t.category)}
                    </span>
                  )}
                  {t.winner_selection_method && (
                    <span className="inline-flex items-center gap-1 capitalize">
                      <Trophy className="h-3.5 w-3.5" /> {pretty(t.winner_selection_method)}
                    </span>
                  )}
                </div>
                <span className={`mt-4 inline-block text-sm font-semibold ${selected ? 'text-[#1677C8]' : 'text-primary'}`}>
                  {selected ? 'Selected' : 'Choose this challenge'}
                </span>
              </div>
            </div>
          </button>
        );
      })}

      {!custom ? (
        <button
          type="button"
          onClick={goCustom}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-5 text-left text-sm transition hover:border-primary/50"
        >
          <PenLine className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            <span className="block font-semibold text-[#102A43]">None of these — I'll describe my own challenge</span>
            <span className="block text-muted-foreground">Give us your title and a short description, and we'll build it for you.</span>
          </span>
        </button>
      ) : (
        <div className="space-y-4 rounded-2xl border border-border bg-secondary/50 p-5">
          <p className="text-xs text-muted-foreground">
            Custom builds take a little longer to set up — we'll confirm the details with you.
          </p>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#102A43]" htmlFor="challenge_title">Challenge name</label>
            <Input
              id="challenge_title"
              className="bg-card"
              maxLength={80}
              value={answers.challenge_title || ''}
              onChange={(e) => set('challenge_title', e.target.value)}
              placeholder="e.g. Reimagine Our Packaging"
            />
          </div>

          <ChallengeBannerUpload value={answers.cover_image || ''} onChange={(url) => set('cover_image', url)} />

          <DescriptionTipsNote />

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#102A43]" htmlFor="challenge_description">
              What should people create?
            </label>
            <Textarea
              id="challenge_description"
              rows={4}
              className="bg-card"
              maxLength={DESC_MAX}
              value={description}
              onChange={(e) => set('challenge_description', e.target.value)}
              placeholder="Describe the brief in a few sentences."
            />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>At least {DESC_MIN_WORDS} words — around {DESC_TARGET_WORDS} works best.</span>
              <span>{description.length} / {DESC_MAX} characters · {wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
            </div>
            <div className="mt-2">
              <AiDescriptionButton
                title={answers.challenge_title}
                description={description}
                category={answers.category}
                onGenerated={(text) => set('challenge_description', text)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-[#102A43]" htmlFor="accepted_entry_types">
              What can people submit?
            </label>
            <p className="mb-2 text-xs text-muted-foreground">
              Choose every kind of entry you'll accept — participants can only upload these. Leave all unticked to accept everything.
            </p>
            <div id="accepted_entry_types">
              <EntryTypeMultiSelect
                value={answers.accepted_entry_types || []}
                onChange={(v) => set('accepted_entry_types', v)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="custom-category" className="mb-1 block text-sm font-semibold text-[#102A43]">
              What kind of entries are you after?
            </label>
            <select
              id="custom-category"
              className="c53-input"
              value={answers.category || ''}
              onChange={(e) => set('category', e.target.value)}
            >
              <option value="">{categoriesLoading ? 'Loading categories…' : 'Choose a category'}</option>
              {categoryOptions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setAnswers((a) => ({ ...a, custom_challenge_idea: false }))}
            className="text-sm font-semibold text-primary underline"
          >
            Back to our challenge library
          </button>
        </div>
      )}
    </div>
  );
}
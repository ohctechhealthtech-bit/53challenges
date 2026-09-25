/**
 * Guided, category-first challenge discovery: category tile → activity format →
 * age group → setting → ranked shortlist. Exposed as wizard steps so the host
 * application keeps its progress bar and Back/Continue chrome.
 */
import { useEffect, useState } from 'react';
import PhotoQuestionTiles from '@/components/host/apply/PhotoQuestionTiles';
import { FORMAT_IMAGES, AGE_IMAGES, SETTING_IMAGES } from '@/components/host/apply/tileImages';
import CategoryTiles from '@/components/host/apply/CategoryTiles';
import TemplateShortlist from '@/components/host/apply/TemplateShortlist';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ChallengeBannerUpload from '@/components/host/apply/ChallengeBannerUpload';
import DescriptionTipsNote from '@/components/host/apply/DescriptionTipsNote';
import EntryTypeMultiSelect from '@/components/challenges/EntryTypeMultiSelect';
import AiDescriptionButton, { DESC_MAX, DESC_MIN_WORDS, DESC_TARGET_WORDS } from '@/components/host/apply/AiDescriptionButton';
import { AGE_OPTIONS, SETTING_OPTIONS, formatsFor } from '@/components/host/apply/discoveryOptions';
import { templateLibrary } from '@/lib/templateLibrary';
import { CATEGORY_OPTIONS } from '@/components/host/applySteps';

function ShortlistStep({ answers, set, setAnswers }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const custom = !!answers.custom_challenge_idea;
  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === answers.category)?.label || '';

  useEffect(() => {
    let alive = true;
    setLoading(true);
    templateLibrary
      .recommend(
        {
          host_type: answers.host_type,
          delivery_level: answers.delivery_level,
          org_kind: answers.org_kind,
          category: answers.category,
          format: answers.discovery_format,
          age_group: answers.discovery_age,
          setting: answers.discovery_setting,
        },
        4
      )
      .then((res) => alive && setTemplates(res.templates || []))
      .catch(() => alive && setError('We could not load our challenge library just now.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.category, answers.discovery_format, answers.discovery_age, answers.discovery_setting]);

  const choose = (t) =>
    setAnswers((a) => ({
      ...a,
      template_id: t.id,
      template_name: t.template_name,
      custom_challenge_idea: false,
      challenge_title: t.template_name || a.challenge_title,
      challenge_description: t.summary || a.challenge_description,
    }));

  if (custom) {
    const description = answers.challenge_description || '';
    const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-secondary/50 p-5">
        <p className="text-xs text-muted-foreground">
          Happy to build something new for you in {categoryLabel} — custom builds take a little longer to set up, and
          we'll confirm the details with you.
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

        <ChallengeBannerUpload value={answers.cover_image || ''} onChange={(v) => set('cover_image', v)} />

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
          <p className="mb-1 text-sm font-semibold text-[#102A43]">What can people submit?</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Tick every kind of entry you'll accept — participants can then only upload these. Leave all unticked to accept everything.
          </p>
          <EntryTypeMultiSelect
            value={answers.accepted_entry_types || []}
            onChange={(v) => set('accepted_entry_types', v)}
          />
        </div>

        <button
          type="button"
          onClick={() => setAnswers((a) => ({ ...a, custom_challenge_idea: false }))}
          className="text-sm font-semibold text-primary underline"
        >
          Back to our suggestions
        </button>
      </div>
    );
  }

  return (
    <TemplateShortlist
      templates={templates}
      loading={loading}
      error={error}
      selectedId={answers.template_id}
      onSelect={choose}
      onCustom={() =>
        setAnswers((a) => ({ ...a, custom_challenge_idea: true, template_id: '', template_name: '' }))
      }
    />
  );
}

export default function useCategoryPickSteps({ answers, set, setAnswers }) {
  // Changing category invalidates every later answer in this flow.
  const pickCategory = (v) =>
    setAnswers((a) => ({
      ...a,
      category: v,
      discovery_format: '',
      discovery_age: '',
      discovery_setting: '',
      template_id: '',
      template_name: '',
      custom_challenge_idea: false,
    }));

  return [
    {
      question: 'What kind of challenge would you like to run?',
      hint: 'Pick the area that fits best — we\'ll guide you to the right challenge from there.',
      body: <CategoryTiles value={answers.category} onChange={pickCategory} />,
      valid: () => !!answers.category,
    },
    {
      question: 'What kind of activity is this?',
      hint: 'How would you like people to take part?',
      body: (
        <PhotoQuestionTiles
          images={FORMAT_IMAGES}
          options={formatsFor(answers.category)}
          value={answers.discovery_format}
          onChange={(v) => set('discovery_format', v)}
        />
      ),
      valid: () => !!answers.discovery_format,
    },
    {
      question: 'Who is this for?',
      body: (
        <PhotoQuestionTiles
          images={AGE_IMAGES}
          options={AGE_OPTIONS}
          value={answers.discovery_age}
          onChange={(v) => set('discovery_age', v)}
        />
      ),
      valid: () => !!answers.discovery_age,
    },
    {
      question: 'Where will this take place?',
      body: (
        <PhotoQuestionTiles
          images={SETTING_IMAGES}
          options={SETTING_OPTIONS}
          value={answers.discovery_setting}
          onChange={(v) => set('discovery_setting', v)}
        />
      ),
      valid: () => !!answers.discovery_setting,
    },
    {
      question: 'Here are the challenges that fit best',
      hint: 'Pick the one you like — you can still adjust the name and wording later.',
      body: <ShortlistStep answers={answers} set={set} setAnswers={setAnswers} />,
      valid: () =>
        !!answers.template_id ||
        (!!answers.custom_challenge_idea &&
          !!answers.category &&
          answers.challenge_title.trim().length >= 3 &&
          answers.challenge_description.trim().length > 0),
    },
  ];
}
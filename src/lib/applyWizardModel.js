/**
 * The /host-apply wizard model.
 *
 * buildScreens() returns the screens for the answers so far — conditional
 * screens are added and removed, so the total is always calculated and never
 * hard-coded. validateQuestion() validates one screen at a time and names the
 * field each message belongs to.
 */

// The seven phases shown in the progress bar.
export const PHASES = [
  { key: 'package', label: 'Your package' },
  { key: 'about', label: 'About you' },
  { key: 'challenge', label: 'Your challenge' },
  { key: 'details', label: 'Challenge details' },
  { key: 'judging', label: 'Judging' },
  { key: 'format', label: 'Format' },
  { key: 'payment', label: 'Payment' },
];

/** Age divisions come from the single "Who is this for?" answer. */
export function divisionsForAudience(audience) {
  switch (audience) {
    case 'under_13': return ['children'];
    case 'ages_13_to_17': return ['teens'];
    case 'adults_18_plus': return ['adults'];
    case 'seniors_65_plus': return ['adults'];
    case 'all_ages': return ['children', 'teens', 'adults'];
    default: return [];
  }
}

/** A judge panel is only needed when judges score the entries. */
export const usesJudgePanel = (winnerMethod) => winnerMethod === 'judges' || winnerMethod === 'combination';

export const isSeriesScope = (scope) => scope === 'series' || scope === 'annual_program';

export function buildScreens(answers = {}, ctx = {}) {
  const { packagePreselected = false, isAuthenticated = false } = ctx;
  const series = isSeriesScope(answers.program_scope);
  const screens = [];

  if (!packagePreselected) {
    screens.push({
      key: 'delivery_level', phase: 'package',
      question: 'How much help would you like from us?',
      hint: 'All packages run on the same platform — the difference is who does the work.',
    });
  }

  screens.push({
    key: 'host_type', phase: 'about',
    question: 'Who are you running this challenge for?',
    hint: 'This helps us tailor everything that follows.',
  });

  screens.push(
    { key: 'challenge_kind', phase: 'challenge', question: 'What kind of challenge would you like to run?', hint: "Pick the area that fits best — we'll guide you from there." },
    { key: 'activity_format', phase: 'challenge', question: 'What kind of activity is this?', hint: 'How would you like people to take part?' },
    { key: 'audience', phase: 'challenge', question: 'Who is this for?', hint: "We'll set the age groups for your challenge from this." },
    { key: 'setting', phase: 'challenge', question: 'Where will this take place?' },
    { key: 'template', phase: 'challenge', question: 'Here are the challenges that fit best', hint: 'Pick the one you like — you can still adjust the name and wording later.' },
  );

  if (!answers.category) {
    screens.push({ key: 'category', phase: 'details', question: 'What kind of entries are you after?' });
  }

  screens.push({
    key: 'participant_range', phase: 'details',
    question: 'How many people do you expect to take part?',
    hint: 'A rough guess is fine — we can adjust later.',
  });

  screens.push({
    key: 'winner_method', phase: 'judging',
    question: 'How winners are decided',
    hint: 'Our selection process is fixed for every challenge — please confirm you accept it.',
  });

  {
    screens.push({
      key: 'judges', phase: 'judging',
      question: 'Who should judge the entries?',
      hint: 'Use our judges, or nominate your own — we invite them for you.',
    });
  }

  screens.push({ key: 'program_scope', phase: 'format', question: 'Is this a one-off, or something ongoing?' });
  if (series) {
    screens.push(
      { key: 'series_count', phase: 'format', question: 'How many challenges should the series run?', hint: "We'll create them all automatically once you're approved." },
      { key: 'series_cadence', phase: 'format', question: 'How often should they run?' },
    );
  }
  screens.push({
    key: 'dates', phase: 'format',
    question: 'When does your challenge run?',
    hint: 'Entries open on your start date and close on your end date.',
  });

  screens.push({
    key: 'addons', phase: 'format',
    question: 'Would you like us to take care of anything else?',
    hint: 'Add any of these services now, or skip and decide later.',
  });

  // Guests give us their contact details first, then verify, then pay.
  if (!isAuthenticated) {
    screens.push({
      key: 'guest_submit', phase: 'payment',
      question: 'Last step — who should we reply to?',
      hint: "We'll set up your host account against these details and email them to you.",
    });
  }

  // Email verification gate — sits between details and payment so the email
  // is confirmed before any money is taken.
  screens.push({
    key: 'email_verify', phase: 'payment',
    question: 'Verify your email before sending your application',
    hint: 'We email a one-time code to confirm it’s really you.',
    hideNext: true,
  });

  screens.push({
    key: 'payment', phase: 'payment',
    question: 'Confirm and pay',
    hint: 'Have a quick look over the costs, then send it — payment happens right here.',
    hideNext: true,
  });

  return screens;
}

const looksLikeEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
const filled = (v, min = 2) => String(v || '').trim().length >= min;

/** Validates a single screen. Returns [] when the screen is complete. */
export function validateQuestion(key, answers = {}, ctx = {}) {
  const a = answers;
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  switch (key) {
    case 'delivery_level':
      if (!a.delivery_level) add('delivery_level', 'Please choose how much help you would like.');
      break;

    case 'host_type': {
      if (!a.host_type) add('host_type', 'Please tell us who you are running this challenge for.');
      if (ctx.needsHostDetails) {
        if (!filled(a.org_name)) add('org_name', 'Organisation, school or group name is required.');
        if (!filled(a.contact_name)) add('contact_name', 'Your name is required.');
        if (!looksLikeEmail(a.org_contact_email)) add('org_contact_email', 'Please enter a valid contact email.');
      }
      if (!a.beneficiary_for) add('beneficiary_for', 'Please tell us who this challenge is being organised for.');
      if (a.beneficiary_for === 'other') {
        if (!filled(a.beneficiary_name)) add('beneficiary_name', 'Organisation or group name is required.');
        if (!filled(a.beneficiary_contact_name)) add('beneficiary_contact_name', 'Contact person is required.');
        if (!looksLikeEmail(a.beneficiary_contact_email)) add('beneficiary_contact_email', 'Please enter a valid contact email for them.');
      }
      break;
    }

    case 'challenge_kind':
      if (!a.category) add('challenge_kind', 'Please choose the kind of challenge you would like to run.');
      break;
    case 'activity_format':
      if (!a.discovery_format) add('activity_format', 'Please choose the kind of activity.');
      break;
    case 'audience':
      if (!a.discovery_age) add('audience', 'Please tell us who this challenge is for.');
      break;
    case 'setting':
      if (!a.discovery_setting) add('setting', 'Please tell us where this will take place.');
      break;

    case 'template':
      if (!a.template_id) {
        if (!a.custom_challenge_idea) {
          add('template_id', 'Choose a challenge, or tell us you would like your own.');
          break;
        }
        if (!filled(a.challenge_title, 3)) add('challenge_title', 'Challenge name needs at least 3 characters.');
        if (String(a.challenge_title || '').length > 80) add('challenge_title', 'Challenge name can be at most 80 characters.');
        if (!a.category) add('category', 'Please choose a category for your challenge.');
        if (!filled(a.challenge_description, 1)) add('challenge_description', 'Please describe what people should create.');
        if (String(a.challenge_description || '').length > 500) add('challenge_description', 'Description can be at most 500 characters.');
      }
      break;

    case 'category':
      if (!a.category) add('category', 'Please choose the kind of entries you are after.');
      break;
    case 'participant_range':
      if (!a.participant_range) add('participant_range', 'Please give us a rough number of participants.');
      break;

    case 'winner_method':
      if (!a.judging_policy_accepted) add('judging_policy_accepted', 'Please confirm you accept the judging and results policy.');
      break;

    case 'judges': {
      const source = a.judge_source || 'platform';
      if (!source) add('judge_source', 'Please tell us who should judge the entries.');
      if (source !== 'platform') {
        const ok = (a.host_judges || []).some((j) => filled(j.name) && looksLikeEmail(j.email));
        if (!ok) add('host_judges', 'Add at least one judge with a name and a valid email address.');
      }
      break;
    }

    case 'program_scope':
      if (!a.program_scope) add('program_scope', 'Please tell us if this is a one-off or ongoing.');
      break;
    case 'series_count':
      if (!a.series_count) add('series_count', 'Please choose how many challenges the series runs.');
      break;
    case 'series_cadence':
      if (!a.series_cadence) add('series_cadence', 'Please choose how often they run.');
      break;

    case 'dates':
      if (!a.start_date) add('start_date', 'Start date is required — the day entries open.');
      if (!a.end_date) add('end_date', 'End date is required — the day entries close.');
      if (a.start_date && a.end_date && a.end_date <= a.start_date) {
        add('end_date', 'End date has to be after the start date.');
      }
      if (a.voting_end_date && a.end_date && a.voting_end_date <= a.end_date) {
        add('voting_end_date', 'Voting has to close after the end date.');
      }
      break;

    case 'guest_submit':
      if (!filled(a.contact_name)) add('contact_name', 'Your name is required.');
      if (!looksLikeEmail(a.contact_email)) add('contact_email', 'Please enter a valid email address — we set your account up against it.');
      if (!filled(a.organisation_name || a.org_name)) add('organisation_name', 'Organisation, school or group name is required.');
      break;

    case 'email_verify':
      if (!a.email_verified) add('email_verified', 'Please verify your email to continue.');
      break;

    default:
      break;
  }
  return errors;
}
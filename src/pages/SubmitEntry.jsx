import { safeExternalUrl } from '@/lib/safeUrl';
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, X, Plus, Image as ImageIcon, Video, FileText,
  Music, Link as LinkIcon, Trophy, Loader2, AlertTriangle, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { challengeApi } from '@/lib/challengeApi';
import { getSessionToken } from '@/lib/customSession';
import { functionErrorMessage, isSessionExpired } from '@/lib/functionErrors';
import { useAuth } from '@/lib/AuthContext';
import { categoryMeta, STATES, challengePhase, isComplianceBlocked, isOpenForEntries } from '@/lib/challenges-data';
import { sendLifecycle } from '@/lib/marketing';
import {
  getDivisions, deriveAge, assignDivision, divisionLabel,
} from '@/components/challenges/divisions';
import { ENTRY_TYPE_OPTIONS } from '@/components/challenges/entryTypes';
import EntryFeePaymentStep from '@/components/challenges/EntryFeePaymentStep';
import DateOfBirthInput from '@/components/challenges/DateOfBirthInput';
import StepErrorSummary from '@/components/challenges/StepErrorSummary';
import EmailVerifyGate from '@/components/verify/EmailVerifyGate';
import PromoCallout from '@/components/promo/PromoCallout';
import ShareButtons from '@/components/promo/ShareButtons';

const STEP_LABELS = ['Participant Info', 'Submission Details', 'Content', 'Review & Submit'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?\d[\d\s]{7,}$/;

// Mobile fields accept numbers only (an optional leading + and spaces).
const digitsOnly = (v) => {
  const plus = String(v).trim().startsWith('+');
  const digits = String(v).replace(/[^\d\s]/g, '').replace(/\s{2,}/g, ' ');
  return (plus ? '+' : '') + digits;
};

const EMPTY_FORM = {
  fullName: '', email: '', phone: '', state: '', dateOfBirth: '', creativeBackground: '',
  ndiOptIn: false, ndiReference: '',
  guardianName: '', guardianEmail: '', guardianConsent: false,
  guardianRelationship: '', guardianMobile: '', guardianAddress: '',
  title: '', description: '',
  textContent: '', images: [], videos: [], audios: [], documents: [], externalLinks: [],
};

const FieldError = ({ msg }) => msg ? (
  <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
    <AlertTriangle className="h-3 w-3" /> {msg}
  </p>
) : null;

export default function SubmitEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth, navigateToLogin, clearChallengeApiSession } = useAuth();
  const [challenge, setChallenge] = useState(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(null); // { key, workUrl, mediaType }
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [errors, setErrors] = useState({});
  const [phase, setPhase] = useState('form');
  const [linkInput, setLinkInput] = useState('');
  const [submittedTitle, setSubmittedTitle] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [divisions] = useState(getDivisions());
  const [pendingPayload, setPendingPayload] = useState(null);
  const [guardianPending, setGuardianPending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [guardianToken, setGuardianToken] = useState('');
  // Proof the entrant's own address was confirmed with an emailed code.
  const [entryToken, setEntryToken] = useState('');
  const cardRef = useRef(null);

  // A blocked step must always be visible: mark the fields AND scroll the
  // summary into view, so nothing looks like a dead "Next" button.
  const blockStep = (e) => {
    setErrors(e);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) navigateToLogin();
  }, [isLoadingAuth, isAuthenticated, navigateToLogin]);

  // The entrant is always the signed-in account — the server rejects any
  // other address, so the field is locked to it rather than left editable.
  useEffect(() => {
    if (user?.email) setFormData((prev) => ({ ...prev, email: user.email }));
  }, [user?.email]);

  useEffect(() => {
    (async () => {
      try {
        const ch = await challengeApi.getChallenge(id);
        // Block the wizard for challenges that aren't open for entries —
        // prevents paying an entry fee the external API will then reject.
        // The external API's `status` field is the source of truth: a
        // "completed" challenge rejects entries even if its end date is
        // still in the future.
        const openForEntries = isOpenForEntries(ch);
        if (!openForEntries) {
          setLoadError('This challenge is not currently open for entries.');
          return;
        }
        // Interim compliance gate (Prompt 13) — block the wizard before any
        // field entry or fee payment for a launch-blocked challenge.
        if (isComplianceBlocked(ch)) {
          setLoadError('This challenge is temporarily blocked pending legal/compliance review.');
          return;
        }
        // Paid entry is deliberately disabled until the payment-safety stage.
        // Refuse the wizard outright rather than collecting a fee we can't
        // yet guarantee is refundable or eligibility-checked.
        const fee = Number(ch?.entry_fee ?? 0) || 0;
        if (fee > 0) {
          setLoadError('Paid entry is not available yet. This challenge is not currently accepting entries.');
          return;
        }
        setChallenge(ch);
      } catch (e) {
        setLoadError(e?.message || 'Could not load this challenge.');
      }
    })();
  }, [id]);

  const setField = (field, value) => {
    if (field === 'guardianEmail') setGuardianToken('');
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const e = { ...prev }; delete e[field]; delete e.duplicate; return e; });
  };

  const addFiles = (field, files) => {
    const items = Array.from(files || []).map((file) => ({ file, id: Date.now() + Math.random() }));
    if (items.length) setField(field, [...formData[field], ...items]);
  };
  const removeFile = (field, fid) => setField(field, formData[field].filter((f) => f.id !== fid));

  const addLink = (url) => {
    const clean = url?.trim();
    if (!clean) return false;
    setField('externalLinks', [...formData.externalLinks, { url: clean, id: Date.now() }]);
    setLinkInput('');
    return true;
  };

  // Accepted entry types — the challenge restricts which content kinds count.
  // Empty / missing means every kind is allowed.
  const acceptedTypes = challenge?.accepted_entry_types?.length ? challenge.accepted_entry_types : null;
  const typeAllowed = (t) => !acceptedTypes || acceptedTypes.includes(t);
  const acceptedLabels = (acceptedTypes || ENTRY_TYPE_OPTIONS.map((o) => o.value))
    .map((v) => ENTRY_TYPE_OPTIONS.find((o) => o.value === v)?.label || v);
  const contentError = acceptedTypes
    ? `Please add at least one accepted content item — this challenge accepts: ${acceptedLabels.join(', ')}`
    : 'Please add at least one content item — text, image, video, audio, PDF or link';

  // Only content of an ALLOWED kind counts towards the "at least one item" rule.
  const hasContent = (extraLink) =>
    (typeAllowed('image') && formData.images.length) ||
    (typeAllowed('video') && formData.videos.length) ||
    (typeAllowed('audio') && formData.audios.length) ||
    (typeAllowed('document') && formData.documents.length) ||
    (typeAllowed('link') && (formData.externalLinks.length || !!extraLink)) ||
    (typeAllowed('text') && !!formData.textContent.trim());

  const refDate = challenge?.submission_ends_at || challenge?.end_date || new Date().toISOString();
  const derivedAge = deriveAge(formData.dateOfBirth, refDate);
  const division = assignDivision(divisions, derivedAge, formData.ndiOptIn);
  // Divisions the challenge itself is open to (set when the challenge is
  // created). Empty means every division is open.
  // The API sends the NDIS division as "ndis"; this app's slug is "ndi".
  const rawAllowed = challenge?.age_divisions?.length
    ? challenge.age_divisions
    : (challenge?.divisions?.length ? challenge.divisions : null);
  const allowedDivisions = rawAllowed ? rawAllowed.map((s) => (s === 'ndis' ? 'ndi' : s)) : null;
  const divisionAllowed = !division || !allowedDivisions || allowedDivisions.includes(division.slug);
  const isUnderage = !!formData.dateOfBirth && derivedAge !== null && derivedAge < 7;
  const needsGuardian = !!formData.dateOfBirth && derivedAge !== null && derivedAge >= 7 && derivedAge < 18;

  const feeOverride = (challenge?.division_fee_overrides || []).find((o) => o.division_id === division?.id || o.division_id === division?.slug);
  const entryFee = Number(feeOverride?.amount ?? challenge?.entry_fee ?? 0) || 0;
  const totalSteps = entryFee > 0 ? 5 : 4;
  const stepLabels = entryFee > 0 ? [...STEP_LABELS.slice(0, 3), 'Review', 'Payment'] : STEP_LABELS;

  const checkDuplicate = async () => {
    if (!challenge) return false;
    try {
      const res = await base44.functions.invoke('submitChallengeEntry', {
        action: 'check',
        challenge_id: challenge.id,
        email: formData.email.trim().toLowerCase(),
        session_token: getSessionToken(),
      });
      return !!res.data?.duplicate;
    } catch {
      return false;
    }
  };

  const validateStep1 = () => {
    const e = {};
    if (formData.fullName.trim().length < 2) e.fullName = 'Please enter your full name';
    if (!EMAIL_RE.test(formData.email.trim())) e.email = 'Please enter a valid email address';
    if (!PHONE_RE.test(formData.phone.trim())) e.phone = 'Please enter a valid mobile number';
    if (!formData.state) e.state = 'Please select your state';
    if (!formData.dateOfBirth) e.dateOfBirth = 'Please enter your date of birth';
    else if (derivedAge === null) e.dateOfBirth = 'Please enter a valid date of birth';
    else if (derivedAge < 7) e.dateOfBirth = 'Entrants must be at least 7 years old at the challenge closing date';
    else if (!divisionAllowed) e.dateOfBirth = `This challenge is not open to the ${division?.name} division.`;
    if (formData.creativeBackground.trim().length < 10) e.creativeBackground = 'Please briefly describe your creative background (at least a sentence)';
    if (needsGuardian) {
      if (formData.guardianName.trim().length < 2) e.guardianName = "Please enter your guardian's full name";
      if (!formData.guardianRelationship.trim()) e.guardianRelationship = 'Please enter their relationship to you (e.g. mother, father, carer)';
      if (!EMAIL_RE.test(formData.guardianEmail.trim())) e.guardianEmail = 'Please enter a valid guardian email';
      else if (formData.guardianEmail.trim().toLowerCase() === formData.email.trim().toLowerCase()) e.guardianEmail = "Guardian email must be different from the entrant's email";
      if (!PHONE_RE.test(formData.guardianMobile.trim())) e.guardianMobile = "Please enter a valid guardian mobile number";
      else if (formData.guardianMobile.replace(/\D/g, '') === formData.phone.replace(/\D/g, '')) e.guardianMobile = "Guardian mobile must be different from the entrant's mobile number";
      if (formData.guardianAddress.trim().length < 8) e.guardianAddress = "Please enter your guardian's address";
      if (!formData.guardianConsent) e.guardianConsent = 'Guardian consent is required for entrants under 18';
      if (!guardianToken) e.guardianVerification = "Please verify your guardian's email with the code we send them";
    }
    return e;
  };

  const validateStep2 = () => {
    const e = {};
    if (!formData.title.trim()) e.title = 'Please enter a submission title';
    if (!formData.description.trim()) e.description = 'Please add a short description';
    return e;
  };

  const handleNext = async () => {
    if (step === 1) {
      const e = validateStep1();
      if (Object.keys(e).length) { blockStep(e); return; }
      setErrors({});
      setCheckingEmail(true);
      try {
        if (await checkDuplicate()) {
          blockStep({ email: 'This email has already entered this challenge', duplicate: true });
          return;
        }
      } catch {
        /* allow through */
      } finally {
        setCheckingEmail(false);
      }
    }
    if (step === 2) {
      const e = validateStep2();
      if (Object.keys(e).length) { blockStep(e); return; }
      setErrors({});
    }
    if (step === 3) {
      if (linkInput.trim()) { addLink(linkInput); setStep(4); return; }
      if (!hasContent()) {
        setErrors({ content: contentError });
        return;
      }
      // Upload now, so the email code is confirmed immediately before submit.
      if (!(await prepareUpload())) return;
    }
    if (step === 4) {
      if (!entryToken) {
        blockStep({ entryVerification: 'Please verify your email with the code we send you.' });
        return;
      }
      handleSubmit(); return;
    }
    setStep(step + 1);
  };

  // Identifies a file well enough to know whether the one already uploaded is
  // still the one selected.
  const mediaKey = (f) => (f ? `${f.name}:${f.size}:${f.lastModified}` : '');

  /**
   * Uploads the entrant's file on leaving the Content step, rather than during
   * submit.
   *
   * The upstream Challenge API validates the forwarded verification_token
   * against its own, shorter window. Uploading during submit spent that window
   * between confirming the emailed code and the upstream call, so a large video
   * made the token stale and the entry was rejected with "Email verification
   * required" even though the address had just been verified. Uploading first
   * means the code is confirmed immediately before the submit.
   */
  const prepareUpload = async () => {
    const firstMedia = formData.images[0] || formData.videos[0] || formData.audios[0] || formData.documents[0];
    if (!firstMedia) return true;                  // a link or text entry: nothing to upload
    const key = mediaKey(firstMedia.file);
    if (uploaded?.key === key) return true;        // this exact file is already up
    setUploading(true);
    try {
      const up = await base44.integrations.Core.UploadFile({ file: firstMedia.file });
      const mediaType = formData.images[0] ? 'image'
        : formData.videos[0] ? 'video'
          : formData.audios[0] ? 'audio' : 'document';
      setUploaded({ key, workUrl: up.file_url, mediaType });
      return true;
    } catch {
      setErrors({ content: 'Could not upload your file. Please check your connection and try again.' });
      return false;
    } finally {
      setUploading(false);
    }
  };

  const buildEntryPayload = async (pendingLink) => {
    const allLinks = pendingLink && !formData.externalLinks.some((l) => l.url === pendingLink)
      ? [...formData.externalLinks, { url: pendingLink }] : formData.externalLinks;
    const firstMedia = formData.images[0] || formData.videos[0] || formData.audios[0] || formData.documents[0];
    const firstLink = allLinks[0];

    let workUrl = firstLink?.url;
    let mediaType = 'link';
    if (firstMedia) {
      // Normally already uploaded by prepareUpload on leaving the Content step;
      // re-upload only if that was skipped or the file changed since.
      if (uploaded?.key === mediaKey(firstMedia.file)) {
        workUrl = uploaded.workUrl;
        mediaType = uploaded.mediaType;
      } else {
        const up = await base44.integrations.Core.UploadFile({ file: firstMedia.file });
        workUrl = up.file_url;
        mediaType = formData.images[0] ? 'image' : formData.videos[0] ? 'video' : formData.audios[0] ? 'audio' : 'document';
      }
    } else if (!firstLink && formData.textContent.trim()) {
      const textFile = new File([formData.textContent], 'content.txt', { type: 'text/plain' });
      const up = await base44.integrations.Core.UploadFile({ file: textFile });
      workUrl = up.file_url;
      mediaType = 'text';
    }
    if (!workUrl) throw new Error('Could not prepare your work for submission.');

    const email = formData.email.trim().toLowerCase();
    return {
      challenge_id: challenge.id,
      challenge_title: challenge.title || challenge.theme || '',
      user_id: email,
      creator_name: formData.fullName.trim(),
      creator_email: email,
      creator_phone: formData.phone.trim(),
      creative_background: formData.creativeBackground.trim(),
      title: formData.title.trim(),
      description: formData.description.trim() || formData.textContent.trim(),
      external_link: firstLink?.url,
      work_url: workUrl,
      media_type: mediaType,
      category: challenge.category || 'open-experimental',
      state: formData.state,
      date_of_birth: formData.dateOfBirth,
      derived_age: derivedAge,
      division_id: division?.slug,
      division_name: division?.name,
      ndi_opt_in: formData.ndiOptIn,
      ndi_eligibility_reference: formData.ndiOptIn ? formData.ndiReference.trim() : undefined,
      guardian_full_name: needsGuardian ? formData.guardianName.trim() : undefined,
      guardian_relationship: needsGuardian ? formData.guardianRelationship.trim() : undefined,
      guardian_email: needsGuardian ? formData.guardianEmail.trim().toLowerCase() : undefined,
      guardian_mobile: needsGuardian ? formData.guardianMobile.trim() : undefined,
      guardian_address: needsGuardian ? formData.guardianAddress.trim() : undefined,
      guardian_consent_checked: needsGuardian ? formData.guardianConsent : false,
      guardian_consent_timestamp: needsGuardian && formData.guardianConsent ? new Date().toISOString() : undefined,
    };
  };

  const handleSubmit = async () => {
    let pendingLink = null;
    if (linkInput.trim()) { pendingLink = linkInput.trim(); addLink(linkInput); }
    if (!hasContent(pendingLink)) {
      setErrors({ content: contentError });
      setStep(3);
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      if (!challenge) { setErrors({ form: 'No active challenge found' }); return; }
      if (derivedAge !== null && derivedAge < 7) {
        setErrors({ dateOfBirth: 'Entrants must be at least 7 years old at the challenge closing date' });
        setStep(1);
        return;
      }
      // Re-check the age-division restriction at final submit (spec rule) —
      // the challenge rules may have changed since step 1 was completed.
      if (!divisionAllowed) {
        setErrors({ dateOfBirth: `This challenge is not open to the ${division?.name} division.` });
        setStep(1);
        return;
      }
      if (await checkDuplicate()) {
        setErrors({ email: 'This email has already entered this challenge', duplicate: true });
        setStep(1);
        return;
      }
      const exRes = await base44.functions.invoke('exclusionGuard', { email: formData.email.trim().toLowerCase() }).catch(() => null);
      if (exRes?.data?.blocked) {
        setErrors({ email: 'This email cannot enter this season', excluded: exRes.data.reason });
        setStep(1);
        return;
      }

      const payload = await buildEntryPayload(pendingLink);

      // Paid challenge — hold the payload; entry is created only after payment.
      if (entryFee > 0) {
        setPendingPayload(payload);
        setStep(5);
        return;
      }

      const subRes = await base44.functions.invoke('submitChallengeEntry', {
        action: 'submit',
        entry: payload,
        verification_token: entryToken,
        session_token: getSessionToken(),
      });
      if (subRes.data?.error) {
        // needs_verification means the server no longer accepts this token, so
        // the "Email verified" state is stale. Clear it or the entrant is stuck
        // looking at a green confirmation and a red error, with no way to ask
        // for a new code.
        if (subRes.data?.needs_verification) setEntryToken('');
        setErrors({ form: subRes.data.error });
        return;
      }
      setGuardianPending(!!subRes.data?.guardian_approval_required);
      sendLifecycle('entry_confirmed', payload.creator_email, payload.creator_name, { title: payload.title, challenge: challenge.title || challenge.theme }).catch(() => {});
      setSubmittedTitle(payload.title);
      setPhase('success');
    } catch (e) {
      // An expired / missing sign-in is the common cause here: say so plainly
      // and send them back to log in, instead of a bare status code.
      if (isSessionExpired(e)) {
        clearChallengeApiSession();
        setErrors({ form: 'Your sign-in has expired. Please log in again — your entry details are still on screen.' });
        setTimeout(navigateToLogin, 2500);
        return;
      }
      setErrors({ form: functionErrorMessage(e, 'Failed to submit. Please try again.') });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaid = async (paymentIntentId) => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('challengeFunds', {
        action: 'record_entry_payment',
        payment_intent_id: paymentIntentId,
        entry: pendingPayload,
      });
      if (res.data?.error) throw new Error(res.data.error);
      sendLifecycle('entry_confirmed', pendingPayload.creator_email, pendingPayload.creator_name, { title: pendingPayload.title, challenge: challenge.title || challenge.theme }).catch(() => {});
      setSubmittedTitle(pendingPayload.title);
      setPhase('success');
    } catch {
      setErrors({ form: 'Your payment went through but the entry could not be recorded. Please contact support — do not pay again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => navigate(`/challenges/${challenge?.id || id}`);

  const fileList = (field, items) => items.length > 0 && (
    <div className="mt-2 space-y-1.5">
      {items.map((it) => (
        <div key={it.id} className="flex items-center justify-between rounded border border-border bg-secondary p-2">
          <span className="truncate text-xs font-medium">{it.file.name}</span>
          <button onClick={() => removeFile(field, it.id)} className="shrink-0 rounded p-1 text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );

  const uploadBox = (field, accept, Icon, label) => (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" /> {label}</label>
      <div className="rounded-lg border-2 border-dashed border-border p-3 text-center transition-colors hover:border-primary">
        <input type="file" accept={accept} multiple className="hidden" id={`sub-${field}`} onChange={(e) => { addFiles(field, e.target.files); e.target.value = ''; }} />
        <label htmlFor={`sub-${field}`} className="block cursor-pointer">
          <Upload className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground">Click to add</p>
        </label>
      </div>
      {fileList(field, formData[field])}
    </div>
  );

  if (!challenge && !loadError) return <div className="container-tight py-24 text-center text-muted-foreground">Loading…</div>;
  if (!challenge && loadError) return (
    <div className="container-tight py-24 text-center">
      <p className="text-destructive">{loadError}</p>
      <Link to="/challenges" className="mt-4 inline-block text-primary hover:underline">← Back to challenges</Link>
    </div>
  );

  if (phase === 'success') {
    return (
      <div className="container-tight py-16 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
          <Check className="h-10 w-10" />
        </div>
        <h1 className="mt-6 font-heading text-3xl font-extrabold">Your entry has been submitted</h1>
        <div className="mx-auto my-5 max-w-sm rounded-xl border border-border bg-card p-4 text-sm">
          <p className="flex items-center justify-center gap-2 font-semibold text-primary"><Trophy className="h-4 w-4" /> {challenge?.title || challenge?.theme}</p>
          <p className="mt-1.5 text-foreground"><span className="font-semibold">Submission:</span> {submittedTitle}</p>
        </div>
        {guardianPending && (
          <div className="mx-auto mb-4 max-w-sm rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-sm text-violet-300">
            Your entry is <strong>pending guardian approval</strong>. We've let your guardian know — it stays on hold until they approve it from the Guardian Dashboard.
          </div>
        )}
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">Your submission will be reviewed before appearing publicly. We'll email you when it's live.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to={`/challenges/${challenge.id}`} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">View challenge</Link>
          <Link to="/challenges" className="rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold">Browse more</Link>
        </div>
        <div className="mx-auto mt-8 flex max-w-sm justify-center">
          <ShareButtons
            url={`${window.location.origin}/challenges/${challenge.id}`}
            text={`I just entered ${challenge?.title || challenge?.theme} on 53 Challenges!`}
          />
        </div>
        <PromoCallout to={`/my-promo?challenge=${encodeURIComponent(challenge?.title || challenge?.theme || '')}&title=${encodeURIComponent(submittedTitle)}`} />
      </div>
    );
  }

  const cat = categoryMeta(challenge.category);

  return (
    <div className="container-tight py-10">
      <button onClick={resetAndClose} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to {challenge.theme || challenge.title}
      </button>

      <div className="mx-auto max-w-2xl">
        <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: cat.color }}>{cat.icon} {cat.name}</span>
        <h1 className="mt-4 font-heading text-3xl font-extrabold">Enter the Challenge</h1>
        {challenge && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2">
            <Trophy className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm font-semibold text-primary">{challenge.title || challenge.theme}</p>
          </div>
        )}

        {/* Stepper */}
        <div className="mt-8">
          <div className="mb-2 flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
              <div key={s} className={`h-2 flex-1 rounded-full transition-all ${s <= step ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
          <p className="text-xs font-medium text-muted-foreground">Step {step} of {totalSteps} — {stepLabels[step - 1]}</p>
        </div>

        <div ref={cardRef} className="mt-6 scroll-mt-24 rounded-3xl border border-border bg-card p-6 sm:p-7">
          <StepErrorSummary errors={errors} />
          {errors.duplicate && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>This email has already submitted an entry for <strong>{challenge?.title || challenge?.theme}</strong>. Only one entry per email is allowed.</span>
            </div>
          )}
          {errors.excluded && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errors.excluded}</span>
            </div>
          )}
          {errors.form && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errors.form}</span>
            </div>
          )}

          {/* Step 1: Participant Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Full Name *</label>
                <Input placeholder="Your full name" value={formData.fullName} onChange={(e) => setField('fullName', e.target.value)} className={errors.fullName ? 'border-destructive' : ''} />
                <FieldError msg={errors.fullName} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Email Address *</label>
                <Input type="email" value={formData.email} readOnly disabled className={`opacity-80 ${errors.email ? 'border-destructive' : ''}`} />
                <FieldError msg={errors.email} />
                <p className="mt-1 text-xs text-muted-foreground">Entries are tied to your signed-in account. One entry per account for this challenge.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Mobile Number *</label>
                <Input type="tel" inputMode="numeric" placeholder="+61 400 000 000" value={formData.phone} onChange={(e) => setField('phone', digitsOnly(e.target.value))} className={errors.phone ? 'border-destructive' : ''} />
                <FieldError msg={errors.phone} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Date of Birth *</label>
                <DateOfBirthInput value={formData.dateOfBirth} onChange={(v) => setField('dateOfBirth', v)} className={errors.dateOfBirth ? 'border-destructive' : ''} />
                <FieldError msg={errors.dateOfBirth} />
                {isUnderage && (
                  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                    We love your enthusiasm! Entrants need to be at least 7 years old at the challenge closing date to take part.
                  </div>
                )}
                {division && !isUnderage && divisionAllowed && (
                  <div className="mt-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                    You'll compete in: {divisionLabel(division)}
                  </div>
                )}
                {division && !isUnderage && !divisionAllowed && (
                  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                    This challenge is only open to: {allowedDivisions.map((s) => divisions.find((d) => d.slug === s)?.name || s).join(', ')}.
                  </div>
                )}
              </div>
              <div className={`space-y-2 rounded-lg border border-border p-3 ${allowedDivisions && !allowedDivisions.includes('ndi') ? 'hidden' : ''}`}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5" checked={formData.ndiOptIn} onChange={(e) => setField('ndiOptIn', e.target.checked)} />
                  <span><span className="font-semibold">Enter the NDIS division</span><br /><span className="text-xs text-muted-foreground">Optional — for participants with NDIS eligibility. You'll compete in the NDIS division instead of an age division.</span></span>
                </label>
                {formData.ndiOptIn && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold">NDIS Eligibility Reference</label>
                    <Input placeholder="Your NDIS eligibility reference" value={formData.ndiReference} onChange={(e) => setField('ndiReference', e.target.value)} />
                  </div>
                )}
              </div>
              {needsGuardian && (
                <div className="space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
                  <p className="text-sm font-semibold text-violet-300">Guardian consent (required for under-18 entrants)</p>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Guardian Full Name *</label>
                    <Input placeholder="Guardian's full name" value={formData.guardianName} onChange={(e) => setField('guardianName', e.target.value)} className={errors.guardianName ? 'border-destructive' : ''} />
                    <FieldError msg={errors.guardianName} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Relationship to You *</label>
                    <Input placeholder="e.g. Mother, Father, Carer" value={formData.guardianRelationship} onChange={(e) => setField('guardianRelationship', e.target.value)} className={errors.guardianRelationship ? 'border-destructive' : ''} />
                    <FieldError msg={errors.guardianRelationship} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Guardian Email *</label>
                    <Input type="email" placeholder="guardian@email.com" value={formData.guardianEmail} onChange={(e) => setField('guardianEmail', e.target.value)} className={errors.guardianEmail ? 'border-destructive' : ''} />
                    <FieldError msg={errors.guardianEmail} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Guardian Mobile *</label>
                    <Input type="tel" inputMode="numeric" placeholder="+61 400 000 000" value={formData.guardianMobile} onChange={(e) => setField('guardianMobile', digitsOnly(e.target.value))} className={errors.guardianMobile ? 'border-destructive' : ''} />
                    <FieldError msg={errors.guardianMobile} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Guardian Address *</label>
                    <Input placeholder="Street address, suburb, state" value={formData.guardianAddress} onChange={(e) => setField('guardianAddress', e.target.value)} className={errors.guardianAddress ? 'border-destructive' : ''} />
                    <FieldError msg={errors.guardianAddress} />
                  </div>
                  <EmailVerifyGate
                    email={formData.guardianEmail.trim()}
                    purpose="guardian_consent"
                    label="guardian consent"
                    verified={!!guardianToken}
                    onVerified={setGuardianToken}
                  />
                  <FieldError msg={errors.guardianVerification} />
                  <p className="text-xs text-muted-foreground">Your entry stays on hold until your guardian approves it. We'll ask them to confirm via the Guardian Dashboard.</p>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5" checked={formData.guardianConsent} onChange={(e) => setField('guardianConsent', e.target.checked)} />
                    <span className="text-xs text-muted-foreground">I confirm I am the parent/guardian of this entrant and consent to their participation in this challenge.</span>
                  </label>
                  <FieldError msg={errors.guardianConsent} />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Creative Background / Expertise *</label>
                <Textarea rows={3} placeholder="Briefly describe your creative experience — e.g. hobbyist, student, teaching or professional work in this field..." value={formData.creativeBackground} onChange={(e) => setField('creativeBackground', e.target.value)} className={errors.creativeBackground ? 'border-destructive' : ''} />
                <FieldError msg={errors.creativeBackground} />
                <p className="mt-1 text-xs text-muted-foreground">This keeps the competition fair — it helps us make sure experienced professionals aren't competing against beginners.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">State / Location *</label>
                <div className="grid grid-cols-4 gap-2">
                  {STATES.map((s) => (
                    <button key={s} type="button" onClick={() => setField('state', s)}
                      className={`rounded-lg border-2 p-2.5 text-sm font-semibold transition-all ${formData.state === s ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <FieldError msg={errors.state} />
              </div>
            </div>
          )}

          {/* Step 2: Submission Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Submission Title *</label>
                <Input placeholder="Name your entry" value={formData.title} onChange={(e) => setField('title', e.target.value)} className={errors.title ? 'border-destructive' : ''} />
                <FieldError msg={errors.title} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Short Description *</label>
                <Textarea rows={4} placeholder="Describe your entry in a few sentences..." value={formData.description} onChange={(e) => setField('description', e.target.value)} className={errors.description ? 'border-destructive' : ''} />
                <FieldError msg={errors.description} />
              </div>
            </div>
          )}

          {/* Step 3: Content */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Add at least one content item. This challenge accepts: {acceptedLabels.join(', ')}.</p>
              {errors.content && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errors.content}
                </div>
              )}
              {typeAllowed('text') && (
                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" /> Text Content</label>
                  <Textarea rows={4} placeholder="A poem, story, lyrics or any free text..." value={formData.textContent} onChange={(e) => setField('textContent', e.target.value)} />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {typeAllowed('image') && uploadBox('images', 'image/*', ImageIcon, 'Images')}
                {typeAllowed('video') && uploadBox('videos', 'video/*', Video, 'Videos')}
                {typeAllowed('audio') && uploadBox('audios', 'audio/*', Music, 'Audio')}
                {typeAllowed('document') && uploadBox('documents', '.pdf,.doc,.docx,.txt', FileText, 'PDF / Documents')}
              </div>
              {typeAllowed('link') && (
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><LinkIcon className="h-4 w-4" /> External Links</label>
                <div className="flex gap-2">
                  <Input placeholder="Paste portfolio, YouTube, Behance link..." value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(linkInput); } }} />
                  <Button type="button" size="sm" variant="outline" className="self-stretch" onClick={() => addLink(linkInput)}><Plus className="h-4 w-4" /></Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Typed a link but forgot to press +? No worries — we'll capture it automatically.</p>
                {formData.externalLinks.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {formData.externalLinks.map((link) => (
                      <div key={link.id} className="flex items-center justify-between rounded border border-border bg-secondary p-2">
                        <a href={safeExternalUrl(link.url)} target="_blank" rel="noopener noreferrer" className="truncate text-xs font-medium text-blue-400 underline">{link.url}</a>
                        <button onClick={() => setField('externalLinks', formData.externalLinks.filter((l) => l.id !== link.id))} className="shrink-0 rounded p-1 text-destructive hover:bg-destructive/10"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300">
                <Check className="h-5 w-5" />
                <p className="text-sm font-semibold">Review your entry, then submit.</p>
              </div>
              <div className="space-y-2 rounded-xl border border-border bg-secondary p-4 text-sm">
                <p><span className="font-semibold">Challenge:</span> {challenge?.title || challenge?.theme}</p>
                <p><span className="font-semibold">Name:</span> {formData.fullName}</p>
                <p><span className="font-semibold">Email:</span> {formData.email}</p>
                <p><span className="font-semibold">Mobile:</span> {formData.phone}</p>
                <p><span className="font-semibold">State:</span> {formData.state}</p>
                {division && <p><span className="font-semibold">Division:</span> {divisionLabel(division)}</p>}
                <p><span className="font-semibold">Creative Background:</span> {formData.creativeBackground}</p>
                <p><span className="font-semibold">Title:</span> {formData.title}</p>
                <p><span className="font-semibold">Category:</span> {cat.name}</p>
                <p><span className="font-semibold">Description:</span> {formData.description}</p>
                {entryFee > 0 && <p><span className="font-semibold">Entry Fee:</span> ${entryFee.toFixed(2)} AUD</p>}
                <div className="border-t border-border pt-2 text-muted-foreground">
                  {formData.textContent.trim() && <p>✍️ Text content ({formData.textContent.trim().split(/\s+/).length} words)</p>}
                  {formData.images.length > 0 && <p>🖼️ {formData.images.length} image(s)</p>}
                  {formData.videos.length > 0 && <p>🎬 {formData.videos.length} video(s)</p>}
                  {formData.audios.length > 0 && <p>🎵 {formData.audios.length} audio file(s)</p>}
                  {formData.documents.length > 0 && <p>📄 {formData.documents.length} document(s)</p>}
                  {formData.externalLinks.length > 0 && <p>🔗 {formData.externalLinks.length} link(s)</p>}
                  {linkInput.trim() && <p>🔗 1 link (auto-captured on submit)</p>}
                </div>
              </div>
              <EmailVerifyGate
                email={formData.email.trim()}
                purpose="challenge_entry"
                label="your challenge entry"
                verified={!!entryToken}
                onVerified={setEntryToken}
              />
              <FieldError msg={errors.entryVerification} />
              <p className="text-xs text-muted-foreground">Your submission will be reviewed by our team before appearing publicly.</p>
            </div>
          )}

          {/* Step 5: Entry fee payment */}
          {step === 5 && pendingPayload && (
            <EntryFeePaymentStep
              challengeId={challenge.id}
              divisionId={division?.slug}
              email={formData.email.trim().toLowerCase()}
              fee={entryFee}
              onPaid={handlePaid}
            />
          )}

          {/* Actions */}
          {step !== 5 && (
            <div className="mt-4 flex justify-between gap-3 border-t border-border pt-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
                {step > 1 && <Button variant="outline" onClick={() => { setStep(step - 1); setErrors({}); }}>← Back</Button>}
              </div>
              <Button className="bg-primary text-primary-foreground hover:brightness-110" onClick={handleNext} disabled={submitting || checkingEmail || uploading || !challenge}>
                {(submitting || checkingEmail || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {uploading ? 'Uploading…' : step === 4 ? (submitting ? (entryFee > 0 ? 'Preparing...' : 'Submitting...') : (entryFee > 0 ? 'Continue to Payment' : 'Submit Entry')) : checkingEmail ? 'Checking...' : 'Next'}
                {!submitting && !checkingEmail && !uploading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
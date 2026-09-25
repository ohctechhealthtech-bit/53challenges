/**
 * Server-side application draft: loads the host's active draft on mount and
 * autosaves answers (debounced, monotonic revision — an older save can never
 * overwrite a newer one).
 */
import { useEffect, useRef, useState } from 'react';
import { hostPortal } from '@/lib/hostPortalClient';

export default function useApplicationDraft(blankAnswers) {
  const [answers, setAnswers] = useState(blankAnswers);
  const [draftId, setDraftId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const revRef = useRef(0);
  const draftIdRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;
    hostPortal('get_application_draft')
      .then((data) => {
        if (!active) return;
        if (data.draft) {
          draftIdRef.current = data.draft.id;
          setDraftId(data.draft.id);
          revRef.current = data.draft.revision || 0;
          setAnswers((a) => ({ ...a, ...(data.draft.answers || {}) }));
        }
        setLoaded(true);
      })
      .catch(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const next = revRef.current + 1;
        const data = await hostPortal('save_application_draft', {
          draft_id: draftIdRef.current, answers, revision: next,
        });
        revRef.current = data.revision || next;
        if (data.draft_id) {
          draftIdRef.current = data.draft_id;
          setDraftId(data.draft_id);
        }
        setSavedAt(Date.now());
      } catch { /* retried on the next change */ }
    }, 800);
    return () => clearTimeout(timerRef.current);
  }, [answers, loaded]);

  return { answers, setAnswers, draftId, loaded, savedAt };
}
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const LIMITS = { instagram: 2200, facebook: 2000, tiktok: 2200, x: 280, linkedin: 2500, youtube: 1000, threads: 500, pinterest: 500 };

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sr = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    const action = p.action;
    const email = user.email;

    if (action === 'listAccounts') {
      const accounts = await sr.entities.ParticipantSocialAccount.filter({ owner_email: email }, '-created_date', 50);
      return Response.json({ accounts });
    }

    if (action === 'saveAccount') {
      if (!p.platform) return Response.json({ error: 'Platform required' }, { status: 400 });
      const existing = await sr.entities.ParticipantSocialAccount.filter({ owner_email: email, platform: p.platform }, '-created_date', 1);
      const data = {
        owner_email: email,
        platform: p.platform,
        handle: String(p.handle || '').slice(0, 120),
        profile_url: String(p.profile_url || '').slice(0, 400),
        connected: true,
      };
      const account = existing?.length
        ? await sr.entities.ParticipantSocialAccount.update(existing[0].id, data)
        : await sr.entities.ParticipantSocialAccount.create(data);
      return Response.json({ account });
    }

    if (action === 'deleteAccount') {
      const rec = await sr.entities.ParticipantSocialAccount.get(p.id);
      if (!rec || rec.owner_email !== email) return Response.json({ error: 'Not found' }, { status: 404 });
      await sr.entities.ParticipantSocialAccount.delete(p.id);
      return Response.json({ ok: true });
    }

    if (action === 'myEntries') {
      // Promo is only offered for approved entries — pending or rejected work
      // isn't publicly viewable, so promoting it would send people nowhere.
      const entries = await sr.entities.Entry.filter({ creator_email: email, status: 'approved' }, '-created_date', 50);
      return Response.json({
        entries: (entries || []).map((e) => ({ id: e.id, title: e.title, challenge_id: e.challenge_id, challenge_title: e.challenge_title, status: e.status })),
      });
    }

    if (action === 'generatePost') {
      const platforms = (p.platforms || []).filter((x) => LIMITS[x]);
      if (!platforms.length) return Response.json({ error: 'Pick at least one platform' }, { status: 400 });
      let entry = null;
      if (p.entry_id) {
        const e = await sr.entities.Entry.get(p.entry_id).catch(() => null);
        if (e && e.creator_email !== email) {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }
        if (e && e.status !== 'approved') {
          return Response.json({ error: 'You can promote an entry once it has been approved.' }, { status: 403 });
        }
        entry = e;
      }
      const limit = Math.min(...platforms.map((x) => LIMITS[x]));
      const res = await sr.integrations.Core.InvokeLLM({
        prompt: `Write a social media post for a creator promoting their own competition entry on 53 Challenges, an Australian creative competition platform. The goal is to get friends and followers to view and vote for the entry.

Creator name: ${user.full_name || 'the creator'}
${entry ? `Entry title: ${String(entry.title || '').slice(0, 160)}
Challenge: ${String(entry.challenge_title || '').slice(0, 160)}
What they made: ${String(entry.description || entry.work_text || '').slice(0, 500)}` : ''}
${p.topic ? `What they want to say: ${String(p.topic).slice(0, 400)}` : ''}
Tone: ${String(p.tone || 'friendly').slice(0, 30)}
Platforms: ${platforms.join(', ')}

Write in Australian English, first person, under ${limit} characters, with one clear call to action asking people to vote. Return the post copy and 5 to 8 relevant hashtags without the # symbol.`,
        response_json_schema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            hashtags: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      let image_url = '';
      if (p.generate_image) {
        const img = await sr.integrations.Core.GenerateImage({
          prompt: `Vibrant, modern social media promo graphic for a creative competition entry titled "${entry?.title || p.topic || 'my entry'}". Bold abstract shapes, energetic colours, no text, no words, no letters.`,
        });
        image_url = img?.url || '';
      }
      return Response.json({ content: res?.content || '', hashtags: (res?.hashtags || []).slice(0, 8), image_url });
    }

    if (action === 'listPosts') {
      const posts = await sr.entities.ParticipantPost.filter({ owner_email: email }, '-created_date', 100);
      return Response.json({ posts });
    }

    if (action === 'savePost') {
      if (!p.content) return Response.json({ error: 'Post content required' }, { status: 400 });
      const post = await sr.entities.ParticipantPost.create({
        owner_email: email,
        entry_id: p.entry_id || '',
        challenge_title: p.challenge_title || '',
        topic: String(p.topic || '').slice(0, 300),
        tone: p.tone || 'friendly',
        content: String(p.content).slice(0, 4000),
        hashtags: (p.hashtags || []).slice(0, 12),
        image_url: p.image_url || '',
        platforms: p.platforms || [],
        status: 'draft',
      });
      return Response.json({ post });
    }

    if (action === 'markShared') {
      const rec = await sr.entities.ParticipantPost.get(p.id);
      if (!rec || rec.owner_email !== email) return Response.json({ error: 'Not found' }, { status: 404 });
      const post = await sr.entities.ParticipantPost.update(p.id, { status: 'shared', shared_at: new Date().toISOString() });
      return Response.json({ post });
    }

    if (action === 'deletePost') {
      const rec = await sr.entities.ParticipantPost.get(p.id);
      if (!rec || rec.owner_email !== email) return Response.json({ error: 'Not found' }, { status: 404 });
      await sr.entities.ParticipantPost.delete(p.id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
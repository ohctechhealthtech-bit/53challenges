import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const PACKAGES_URL = 'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/hostPackagesApi';

export default async function (req) {
  try {
    createClientFromRequest(req);

    const res = await fetch(PACKAGES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': secrets.get('CHALLENGE_API_KEY') },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      return Response.json({ error: 'Hosting packages are unavailable right now.' }, { status: 502 });
    }

    const data = await res.json();
    const list = Array.isArray(data.packages) ? data.packages : [];

    const packages = list
      .filter((p) => p.is_active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((p) => ({
        key: p.key,
        name: p.name,
        tagline: p.tagline || '',
        price: p.price || '',
        priceNote: p.price_note || '',
        audience: p.audience || '',
        benefits: [
          ...(p.features_intro ? [p.features_intro] : []),
          ...(Array.isArray(p.features) ? p.features : []),
        ],
        cta: p.cta || '',
        badge: p.badge || '',
        highlight: !!p.highlighted,
      }));

    return Response.json({ count: packages.length, packages });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
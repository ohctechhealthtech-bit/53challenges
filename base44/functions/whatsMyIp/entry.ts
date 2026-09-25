export default async function () {
  try {
    const [icanhazip, ipinfo] = await Promise.allSettled([
      fetch('https://icanhazip.com/', { signal: AbortSignal.timeout(8000) })
        .then(r => r.text()).then(t => t.trim()),
      fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(8000) })
        .then(r => r.json()),
    ]);
    return Response.json({
      icanhazip: icanhazip.status === 'fulfilled' ? icanhazip.value : null,
      ipinfo: ipinfo.status === 'fulfilled' ? ipinfo.value : null,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
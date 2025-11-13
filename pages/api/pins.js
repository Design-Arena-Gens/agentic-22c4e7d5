export const config = { runtime: 'nodejs' };

function parseBoard(urlStr) {
  try {
    const u = new URL(urlStr);
    const parts = u.pathname.split('/').filter(Boolean);
    // Expect: /{username}/{board}/...
    if (parts.length < 2) return null;
    const username = parts[0];
    const board = parts[1];
    return { username, board };
  } catch {
    return null;
  }
}

async function fetchBoardPins(username, board, cursor) {
  const base = `https://widgets.pinterest.com/v3/pidgets/boards/${encodeURIComponent(username)}/${encodeURIComponent(board)}/pins/`;
  const url = cursor ? `${base}?cursor=${encodeURIComponent(cursor)}` : base;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PinterestFetcher/1.0)'
    },
  });
  if (!res.ok) {
    throw new Error(`Upstream error ${res.status}`);
  }
  return res.json();
}

function normalizePins(pidgetsJson) {
  const rawPins = (pidgetsJson?.data?.pins) || [];
  return rawPins.map((p) => {
    const id = p.id || p.pin_id || String(Math.random());
    const images = p.images || {};
    const best = images.orig?.url || images['736x']?.url || images['600x']?.url || images['564x']?.url || images['474x']?.url || images['236x']?.url || p.images?.url;
    const title = (p.description || p.grid_description || p.title || '').toString().slice(0, 120);
    const saves = typeof p.repin_count === 'number' ? p.repin_count : (typeof p.saves === 'number' ? p.saves : 0);
    return { id, title, imageUrl: best, saves };
  }).filter((x) => !!x.imageUrl);
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { boardUrl, limit = 20 } = body || {};
  const parsed = parseBoard(boardUrl || '');
  if (!parsed) {
    return new Response(JSON.stringify({ error: 'Invalid board URL. Expected https://www.pinterest.com/{username}/{board}/' }), { status: 400 });
  }

  const { username, board } = parsed;

  let pins = [];
  let cursor = undefined;

  try {
    // Fetch up to several pages until we meet the limit or run out
    for (let i = 0; i < 6 && pins.length < Number(limit); i++) {
      const json = await fetchBoardPins(username, board, cursor);
      const normalized = normalizePins(json);
      pins = pins.concat(normalized);
      cursor = json?.data?.page?.cursor || json?.data?.next || json?.resource?.options?.bookmarks?.[0];
      if (!cursor) break;
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: `Failed to fetch board: ${e.message}` }), { status: 502 });
  }

  // Sort by saves (desc) and slice to requested limit
  pins.sort((a, b) => (b.saves || 0) - (a.saves || 0));
  pins = pins.slice(0, Math.min(Number(limit) || 20, pins.length));

  return new Response(JSON.stringify({ pins }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

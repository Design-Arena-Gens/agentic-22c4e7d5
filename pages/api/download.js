import JSZip from 'jszip';
export const config = { runtime: 'nodejs' };

async function fetchImageAsArrayBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PinterestFetcher/1.0)' } });
  if (!res.ok) throw new Error(`Failed to fetch image ${res.status}`);
  const ab = await res.arrayBuffer();
  return ab;
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

  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return new Response(JSON.stringify({ error: 'No images provided' }), { status: 400 });
  }

  // Build zip in memory
  const zip = new JSZip();
  const folder = zip.folder('images');

  // Limit to avoid excessive memory/time in serverless
  const MAX_FILES = 200;
  const safeItems = items.slice(0, MAX_FILES);

  // Fetch images sequentially to avoid overloading upstream; could be batched if needed
  for (let i = 0; i < safeItems.length; i++) {
    const item = safeItems[i];
    try {
      const ab = await fetchImageAsArrayBuffer(item.url);
      const ext = (new URL(item.url).pathname.split('.').pop() || 'jpg').split(/[#?]/)[0].slice(0,5);
      const name = `${String(i+1).padStart(3,'0')}-${(item.id || 'pin').toString().slice(0,24)}.${ext}`;
      folder.file(name, ab);
    } catch (e) {
      // skip failures
    }
  }

  const zipContent = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });

  return new Response(zipContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="pinterest-images.zip"',
      'Cache-Control': 'no-store',
    },
  });
}

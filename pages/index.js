import { useState } from 'react';

export default function Home() {
  const [boardUrl, setBoardUrl] = useState('');
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [pins, setPins] = useState([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState({});

  const fetchPins = async () => {
    setLoading(true);
    setError('');
    setPins([]);
    setSelected({});
    try {
      const res = await fetch('/api/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardUrl, limit: Number(limit) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with ${res.status}`);
      }
      const data = await res.json();
      setPins(data.pins || []);
      const initSel = {};
      (data.pins || []).forEach((p) => { initSel[p.id] = true; });
      setSelected(initSel);
    } catch (e) {
      setError(e.message || 'Failed to fetch pins');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const downloadSelected = async () => {
    const chosen = pins.filter((p) => selected[p.id]);
    if (chosen.length === 0) return;
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: chosen.map((p) => ({ id: p.id, url: p.imageUrl })) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || `Download failed with ${res.status}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pinterest-images.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Pinterest Top Images Downloader</h1>
      <p style={{ color: '#555', marginBottom: 20 }}>
        Paste a Pinterest board URL (e.g., https://www.pinterest.com/&lt;username&gt;/&lt;board&gt;/), fetch pins, sort by saves, and download.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <input
          type="url"
          placeholder="https://www.pinterest.com/username/board/"
          value={boardUrl}
          onChange={(e) => setBoardUrl(e.target.value)}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd' }}
        />
        <input
          type="number"
          min={1}
          max={200}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          style={{ width: 100, padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd' }}
          title="Max images"
        />
        <button onClick={fetchPins} disabled={loading || !boardUrl} style={{ padding: '10px 16px', borderRadius: 8, background: '#111827', color: 'white', border: 'none' }}>
          {loading ? 'Fetching?' : 'Fetch'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {pins.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ color: '#374151' }}>{pins.length} pins (sorted by saves)</div>
            <button onClick={downloadSelected} style={{ padding: '8px 12px', borderRadius: 8, background: '#2563eb', color: 'white', border: 'none' }}>
              Download Selected as ZIP
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {pins.map((pin) => (
              <div key={pin.id} style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
                <div style={{ position: 'relative' }}>
                  <img src={pin.imageUrl} alt={pin.title || 'Pin'} style={{ width: '100%', display: 'block' }} />
                  <label style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 6px', borderRadius: 6, fontSize: 12 }}>
                    <input type="checkbox" checked={!!selected[pin.id]} onChange={() => toggleSelect(pin.id)} style={{ marginRight: 6 }} />
                    {pin.saves} saves
                  </label>
                </div>
                <div style={{ padding: 8, fontSize: 13, color: '#374151' }}>
                  {pin.title || 'Untitled'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

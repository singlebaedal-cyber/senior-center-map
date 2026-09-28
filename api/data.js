// Persistent / Fallback In-memory data store for Vercel Serverless
let memoryCache = {
  places: [],
  groups: [],
  salesReps: [],
  customStatuses: [],
  timestamp: Date.now(),
  savedBy: 'init',
  updateId: `init-${Date.now()}`
};

// Helper: Upstash Redis / Vercel KV REST API
async function getFromKv() {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) return null;

  try {
    const res = await fetch(`${kvUrl}/get/senior_center_data`, {
      headers: { Authorization: `Bearer ${kvToken}` }
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.result) {
      const parsed = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
      return parsed;
    }
  } catch (err) {
    console.error('Error fetching from KV store:', err);
  }
  return null;
}

async function saveToKv(data) {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) return false;

  try {
    const res = await fetch(`${kvUrl}/set/senior_center_data`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(typeof data === 'string' ? data : JSON.stringify(data))
    });
    return res.ok;
  } catch (err) {
    console.error('Error saving to KV store:', err);
  }
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'GET') {
    // 1. Try KV store first
    const kvData = await getFromKv();
    if (kvData && Array.isArray(kvData.places)) {
      memoryCache = { ...memoryCache, ...kvData };
      return res.status(200).json(memoryCache);
    }

    // 2. Return memory cache
    return res.status(200).json(memoryCache);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const now = Date.now();
    const updateId = `${now}-${Math.random().toString(36).substring(2, 6)}`;

    // Safety: Ensure valid arrays
    const newPlaces = Array.isArray(body.places) ? body.places : memoryCache.places;
    const newGroups = Array.isArray(body.groups) ? body.groups : memoryCache.groups;
    const newReps = Array.isArray(body.salesReps) ? body.salesReps : memoryCache.salesReps;
    const newStatuses = Array.isArray(body.customStatuses) ? body.customStatuses : memoryCache.customStatuses;

    memoryCache = {
      places: newPlaces,
      groups: newGroups,
      salesReps: newReps,
      customStatuses: newStatuses,
      timestamp: body.timestamp || now,
      savedBy: body.savedBy || 'web',
      updateId: updateId
    };

    // Save to KV if configured
    await saveToKv(memoryCache);

    return res.status(200).json({
      success: true,
      timestamp: memoryCache.timestamp,
      updateId: memoryCache.updateId
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

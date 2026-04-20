export interface GeocodeResult {
  countryCode: string;
  displayName?: string;
}

export interface OSMRoad {
  highway: string;
  lanes: number | null;
  lanesForward: number | null;
  lanesBackward: number | null;
  oneway: boolean;
  maxspeed: number | null;
  name: string | null;
  isRelevantForWarning: boolean;
  expectedLanesVisible: number;
}

export interface OSMClientOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
  nominatimBase?: string;
  overpassMirrors?: string[];
  nominatimMinIntervalMs?: number;
  timeoutMs?: number;
  userAgent?: string;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_NOMINATIM = 'https://nominatim.openstreetmap.org';
const DEFAULT_OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];
const DEFAULT_NOMINATIM_INTERVAL = 1100;
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_USER_AGENT = 'DriveSide/1.0 (contact: support@driveside.app)';

const IRRELEVANT_HIGHWAYS = new Set([
  'footway', 'cycleway', 'path', 'steps', 'track',
  'pedestrian', 'bridleway', 'corridor', 'elevator',
]);

export interface OSMClient {
  reverseGeocode: (lat: number, lng: number) => Promise<GeocodeResult | null>;
  fetchRoad: (lat: number, lng: number) => Promise<OSMRoad | null>;
}

export function parseRoadTags(tags: Record<string, string>): OSMRoad {
  const highway = tags.highway ?? 'unknown';
  const lanes = parseIntOrNull(tags.lanes);
  const lanesForward = parseIntOrNull(tags['lanes:forward']);
  const lanesBackward = parseIntOrNull(tags['lanes:backward']);
  const oneway = tags.oneway === 'yes' || tags.oneway === '-1';
  const maxspeed = parseMaxspeed(tags.maxspeed);
  const name = tags.name ?? null;
  const isRelevantForWarning = !IRRELEVANT_HIGHWAYS.has(highway);

  let expectedLanesVisible: number;
  if (oneway && lanes != null) {
    expectedLanesVisible = lanes + 1;
  } else if (lanesForward != null) {
    expectedLanesVisible = lanesForward + 1;
  } else if (lanes != null) {
    expectedLanesVisible = Math.floor(lanes / 2) + 1;
  } else {
    expectedLanesVisible = 2;
  }

  return {
    highway,
    lanes,
    lanesForward,
    lanesBackward,
    oneway,
    maxspeed,
    name,
    isRelevantForWarning,
    expectedLanesVisible,
  };
}

function parseIntOrNull(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseMaxspeed(v: string | undefined): number | null {
  if (!v) return null;
  const match = v.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function buildOverpassQuery(lat: number, lng: number, radius = 25): string {
  return `[out:json][timeout:5];way(around:${radius},${lat},${lng})[highway][highway!~"footway|cycleway|path|steps|track"];out tags;`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function createOSMClient(options: OSMClientOptions = {}): OSMClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const nominatimBase = options.nominatimBase ?? DEFAULT_NOMINATIM;
  const overpassMirrors = options.overpassMirrors ?? DEFAULT_OVERPASS_MIRRORS;
  const nominatimMinInterval = options.nominatimMinIntervalMs ?? DEFAULT_NOMINATIM_INTERVAL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  let lastNominatimCall = 0;

  async function rateLimitNominatim() {
    const elapsed = now() - lastNominatimCall;
    if (elapsed < nominatimMinInterval) {
      await sleep(nominatimMinInterval - elapsed);
    }
    lastNominatimCall = now();
  }

  async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
    await rateLimitNominatim();
    const url = `${nominatimBase}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=5&addressdetails=1`;
    try {
      const res = await fetchWithTimeout(
        url,
        { headers: { 'User-Agent': userAgent, Accept: 'application/json' } },
        timeoutMs,
        fetchImpl,
      );
      if (!res.ok) return null;
      const data = await res.json();
      const code = data?.address?.country_code;
      if (typeof code !== 'string') return null;
      return {
        countryCode: code.toUpperCase(),
        displayName: data?.display_name,
      };
    } catch {
      return null;
    }
  }

  async function fetchRoad(lat: number, lng: number): Promise<OSMRoad | null> {
    const query = buildOverpassQuery(lat, lng);
    const body = `data=${encodeURIComponent(query)}`;

    for (const mirror of overpassMirrors) {
      try {
        const res = await fetchWithTimeout(
          mirror,
          {
            method: 'POST',
            headers: {
              'User-Agent': userAgent,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
          },
          timeoutMs,
          fetchImpl,
        );
        if (!res.ok) continue;
        const data = await res.json();
        const ways = Array.isArray(data?.elements) ? data.elements : [];
        if (ways.length === 0) return null;

        const best = pickBestWay(ways);
        return best ? parseRoadTags(best.tags ?? {}) : null;
      } catch {
        continue;
      }
    }
    return null;
  }

  return { reverseGeocode, fetchRoad };
}

function pickBestWay(ways: Array<{ tags?: Record<string, string> }>): { tags: Record<string, string> } | null {
  const PRIORITY: Record<string, number> = {
    motorway: 10, trunk: 9, primary: 8, secondary: 7, tertiary: 6,
    unclassified: 5, residential: 4, living_street: 3, service: 2,
  };
  let best: { tags: Record<string, string>; score: number } | null = null;
  for (const way of ways) {
    const tags = way.tags ?? {};
    const highway = tags.highway ?? '';
    const score = PRIORITY[highway] ?? 1;
    if (!best || score > best.score) {
      best = { tags, score };
    }
  }
  return best ? { tags: best.tags } : null;
}

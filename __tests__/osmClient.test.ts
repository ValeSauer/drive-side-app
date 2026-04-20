import { createOSMClient, parseRoadTags } from '@/lib/osmClient';

describe('parseRoadTags', () => {
  it('parses a typical primary road', () => {
    const road = parseRoadTags({
      highway: 'primary',
      lanes: '4',
      'lanes:forward': '2',
      'lanes:backward': '2',
      maxspeed: '50',
      name: 'Leopoldstraße',
    });
    expect(road.highway).toBe('primary');
    expect(road.lanes).toBe(4);
    expect(road.lanesForward).toBe(2);
    expect(road.oneway).toBe(false);
    expect(road.maxspeed).toBe(50);
    expect(road.isRelevantForWarning).toBe(true);
    expect(road.expectedLanesVisible).toBe(3);
  });

  it('treats footways as irrelevant', () => {
    const road = parseRoadTags({ highway: 'footway' });
    expect(road.isRelevantForWarning).toBe(false);
  });

  it('handles oneway streets', () => {
    const road = parseRoadTags({ highway: 'residential', lanes: '2', oneway: 'yes' });
    expect(road.oneway).toBe(true);
    expect(road.expectedLanesVisible).toBe(3);
  });

  it('extracts numeric maxspeed from strings with units', () => {
    expect(parseRoadTags({ highway: 'primary', maxspeed: '30 mph' }).maxspeed).toBe(30);
    expect(parseRoadTags({ highway: 'primary', maxspeed: 'walk' }).maxspeed).toBeNull();
  });

  it('falls back to half of lanes when lanes:forward missing', () => {
    const road = parseRoadTags({ highway: 'secondary', lanes: '4' });
    expect(road.expectedLanesVisible).toBe(3);
  });

  it('defaults to 2 expected lanes when nothing known', () => {
    const road = parseRoadTags({ highway: 'residential' });
    expect(road.expectedLanesVisible).toBe(2);
  });
});

describe('createOSMClient.reverseGeocode', () => {
  function mockResponse(body: unknown, ok = true): Response {
    return {
      ok,
      json: async () => body,
    } as unknown as Response;
  }

  it('extracts and uppercases the country code', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      mockResponse({ address: { country_code: 'gb' }, display_name: 'London' }),
    );
    const client = createOSMClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      nominatimMinIntervalMs: 0,
      sleep: async () => {},
    });
    const result = await client.reverseGeocode(51.5, -0.1);
    expect(result).toEqual({ countryCode: 'GB', displayName: 'London' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when the response lacks a country code', async () => {
    const fetchMock = jest.fn().mockResolvedValue(mockResponse({ address: {} }));
    const client = createOSMClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      nominatimMinIntervalMs: 0,
      sleep: async () => {},
    });
    expect(await client.reverseGeocode(0, 0)).toBeNull();
  });

  it('returns null on HTTP error', async () => {
    const fetchMock = jest.fn().mockResolvedValue(mockResponse({}, false));
    const client = createOSMClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      nominatimMinIntervalMs: 0,
      sleep: async () => {},
    });
    expect(await client.reverseGeocode(0, 0)).toBeNull();
  });

  it('returns null on network error', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('offline'));
    const client = createOSMClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      nominatimMinIntervalMs: 0,
      sleep: async () => {},
    });
    expect(await client.reverseGeocode(0, 0)).toBeNull();
  });

  it('enforces a minimum interval between Nominatim requests', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      mockResponse({ address: { country_code: 'de' } }),
    );
    const sleepMock = jest.fn().mockResolvedValue(undefined);
    let t = 1000;
    const client = createOSMClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      nominatimMinIntervalMs: 1000,
      now: () => t,
      sleep: async (ms) => {
        sleepMock(ms);
        t += ms;
      },
    });

    await client.reverseGeocode(0, 0);
    t += 200;
    await client.reverseGeocode(0, 0);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleepMock).toHaveBeenCalled();
    const waited = sleepMock.mock.calls[sleepMock.mock.calls.length - 1][0];
    expect(waited).toBeGreaterThan(500);
  });
});

describe('createOSMClient.fetchRoad', () => {
  it('returns parsed road on success', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          { tags: { highway: 'primary', lanes: '4', name: 'A1' } },
          { tags: { highway: 'service' } },
        ],
      }),
    });
    const client = createOSMClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      overpassMirrors: ['http://example.com/overpass'],
    });
    const road = await client.fetchRoad(48.0, 11.0);
    expect(road).not.toBeNull();
    expect(road?.highway).toBe('primary');
    expect(road?.name).toBe('A1');
  });

  it('falls back to next mirror on failure', async () => {
    const fetchMock = jest.fn()
      .mockRejectedValueOnce(new Error('mirror 1 down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elements: [{ tags: { highway: 'secondary' } }] }),
      });
    const client = createOSMClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      overpassMirrors: ['http://m1', 'http://m2'],
    });
    const road = await client.fetchRoad(0, 0);
    expect(road?.highway).toBe('secondary');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when all mirrors fail', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('offline'));
    const client = createOSMClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      overpassMirrors: ['http://m1', 'http://m2'],
    });
    expect(await client.fetchRoad(0, 0)).toBeNull();
  });

  it('returns null for empty elements', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elements: [] }),
    });
    const client = createOSMClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      overpassMirrors: ['http://m1'],
    });
    expect(await client.fetchRoad(0, 0)).toBeNull();
  });
});

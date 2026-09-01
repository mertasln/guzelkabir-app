import {
  haversineDistanceMeters,
  resolveGeotagStatus,
} from './evidence-geo.util';

describe('haversineDistanceMeters', () => {
  it('returns ~0 for identical coordinates', () => {
    const p = { lat: 41.0012, lng: 29.0361 };
    expect(haversineDistanceMeters(p, p)).toBeLessThan(1);
  });

  it('returns a known approximate distance (Karacaahmet-ish 1km offset)', () => {
    // ~0.009 derece enlem farkı ≈ 1000m
    const a = { lat: 41.0012, lng: 29.0361 };
    const b = { lat: 41.0102, lng: 29.0361 };
    const distance = haversineDistanceMeters(a, b);
    expect(distance).toBeGreaterThan(950);
    expect(distance).toBeLessThan(1050);
  });
});

describe('resolveGeotagStatus', () => {
  const reference = { referenceLat: 41.0012, referenceLng: 29.0361 };
  const now = new Date('2026-01-15T12:00:00Z');

  it('falls to manual_review when the grave location has no reference coordinate', () => {
    const result = resolveGeotagStatus({
      exif: { lat: 41.0012, lng: 29.0361, timestamp: now },
      referenceLat: null,
      referenceLng: null,
      toleranceMeters: 150,
      serverReceivedAt: now,
    });
    expect(result.status).toBe('manual_review');
    expect(result.distanceFromGraveM).toBeNull();
  });

  it('returns missing_exif when the photo has no GPS data', () => {
    const result = resolveGeotagStatus({
      exif: {},
      ...reference,
      toleranceMeters: 150,
      serverReceivedAt: now,
    });
    expect(result.status).toBe('missing_exif');
  });

  it('returns gps_mismatch when the photo was taken beyond tolerance', () => {
    const result = resolveGeotagStatus({
      exif: { lat: 41.02, lng: 29.0361, timestamp: now }, // ~2km kuzeyde
      ...reference,
      toleranceMeters: 150,
      serverReceivedAt: now,
    });
    expect(result.status).toBe('gps_mismatch');
    expect(result.distanceFromGraveM).toBeGreaterThan(150);
  });

  it('returns timestamp_mismatch when EXIF and server time differ by more than 24h', () => {
    const oldTimestamp = new Date('2026-01-10T12:00:00Z'); // 5 gün önce
    const result = resolveGeotagStatus({
      exif: { lat: 41.0012, lng: 29.0361, timestamp: oldTimestamp },
      ...reference,
      toleranceMeters: 150,
      serverReceivedAt: now,
    });
    expect(result.status).toBe('timestamp_mismatch');
  });

  it('returns valid when GPS is within tolerance and timestamp is fresh', () => {
    const result = resolveGeotagStatus({
      exif: { lat: 41.0013, lng: 29.0362, timestamp: now },
      ...reference,
      toleranceMeters: 150,
      serverReceivedAt: now,
    });
    expect(result.status).toBe('valid');
    expect(result.distanceFromGraveM).not.toBeNull();
  });

  it('respects a per-cemetery tolerance override', () => {
    // Karacaahmet gibi büyük bir mezarlıkta 150m yetersiz olabilir
    const result = resolveGeotagStatus({
      exif: { lat: 41.003, lng: 29.0361, timestamp: now }, // ~200m kuzeyde
      ...reference,
      toleranceMeters: 300,
      serverReceivedAt: now,
    });
    expect(result.status).toBe('valid');
  });
});

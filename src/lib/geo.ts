// Tiny static gazetteer of KL/PJ areas. A production system would call a
// geocoding service; for the alpha this keeps distance math meaningful for the
// named areas users actually type. Shared by the parser and the matcher.
export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export const GAZETTEER: Record<string, GeoPoint> = {
  klcc: { lat: 3.1578, lng: 101.7117, label: "KLCC" },
  bangsar: { lat: 3.1285, lng: 101.6709, label: "Bangsar" },
  "mont kiara": { lat: 3.1726, lng: 101.6509, label: "Mont Kiara" },
  "petaling jaya": { lat: 3.1073, lng: 101.6068, label: "Petaling Jaya" },
  pj: { lat: 3.1073, lng: 101.6068, label: "Petaling Jaya" },
  damansara: { lat: 3.1516, lng: 101.6213, label: "Damansara" },
  "bukit bintang": { lat: 3.1466, lng: 101.7113, label: "Bukit Bintang" },
  ampang: { lat: 3.1488, lng: 101.7613, label: "Ampang" },
};

// City-center fallback (KLCC) when we have no better signal, e.g. "near me"
// without device coordinates in the alpha.
export const DEFAULT_CITY_CENTER: GeoPoint = GAZETTEER.klcc!;

/** Best-effort geocode of a free-text area to coordinates. */
export function geocodeArea(text: string | null | undefined): GeoPoint | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const key of Object.keys(GAZETTEER)) {
    if (lower.includes(key)) return GAZETTEER[key]!;
  }
  return null;
}

/**
 * Resolve the coordinates to use for an intent: explicit device coords win, then
 * a geocoded named area, then the city center as a last resort so a market can
 * still form (with lower distance confidence).
 */
export function resolveIntentPoint(intent: {
  latitude: number | null;
  longitude: number | null;
  locationText: string | null;
}): { point: GeoPoint; confidence: number } {
  if (intent.latitude !== null && intent.longitude !== null) {
    return {
      point: { lat: intent.latitude, lng: intent.longitude, label: "device" },
      confidence: 1,
    };
  }
  const geo = geocodeArea(intent.locationText);
  if (geo) return { point: geo, confidence: 0.8 };
  return { point: DEFAULT_CITY_CENTER, confidence: 0.4 };
}

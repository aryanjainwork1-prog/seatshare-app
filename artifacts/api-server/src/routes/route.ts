import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface LatLng {
  lat: number;
  lng: number;
}

interface CacheEntry {
  coordinates: LatLng[];
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const routeCache = new Map<string, CacheEntry>();

function cacheKey(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  return [fromLat, fromLng, toLat, toLng]
    .map((v) => v.toFixed(4))
    .join(",");
}

function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of routeCache) {
    if (entry.expiresAt <= now) routeCache.delete(key);
  }
}

async function fetchOsrmRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<LatLng[]> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=full&geometries=geojson`;

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });

  if (!resp.ok) {
    throw new Error(`OSRM responded ${resp.status}`);
  }

  const data = (await resp.json()) as {
    code: string;
    routes?: Array<{ geometry: { coordinates: [number, number][] } }>;
  };

  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(`OSRM code=${data.code}`);
  }

  return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

router.get("/route", async (req, res): Promise<void> => {
  const fromLat = Number(req.query.fromLat);
  const fromLng = Number(req.query.fromLng);
  const toLat = Number(req.query.toLat);
  const toLng = Number(req.query.toLng);

  if ([fromLat, fromLng, toLat, toLng].some((v) => !Number.isFinite(v))) {
    res.status(400).json({ error: "fromLat, fromLng, toLat, toLng are required numbers" });
    return;
  }

  evictExpired();

  const key = cacheKey(fromLat, fromLng, toLat, toLng);
  const cached = routeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    res.json({ coordinates: cached.coordinates });
    return;
  }

  try {
    const coordinates = await fetchOsrmRoute(fromLat, fromLng, toLat, toLng);
    routeCache.set(key, { coordinates, expiresAt: Date.now() + CACHE_TTL_MS });
    res.json({ coordinates });
  } catch (err) {
    logger.warn({ err }, "OSRM route fetch failed — returning empty coordinates for straight-line fallback");
    res.json({ coordinates: [] });
  }
});

export default router;

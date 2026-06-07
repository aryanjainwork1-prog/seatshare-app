import { logger } from "./logger";

export interface DriverMatch {
  tripId: number;
  driverProfileId: number;
  deviationKm: number;
  matchScore: number;
  etaMinutes: number;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function pointToSegmentDistanceKm(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversineKm(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nearestX = ax + t * dx;
  const nearestY = ay + t * dy;
  return haversineKm(px, py, nearestX, nearestY);
}

export function computeMatchScore(
  passengerLat: number, passengerLng: number,
  destLat: number, destLng: number,
  driverOriginLat: number, driverOriginLng: number,
  driverDestLat: number, driverDestLng: number,
  driverRating: number,
  availableSeats: number
): { deviationKm: number; score: number } {
  const passengerDeviation = pointToSegmentDistanceKm(
    passengerLat, passengerLng,
    driverOriginLat, driverOriginLng,
    driverDestLat, driverDestLng
  );

  const destDeviation = pointToSegmentDistanceKm(
    destLat, destLng,
    driverOriginLat, driverOriginLng,
    driverDestLat, driverDestLng
  );

  const totalDeviation = passengerDeviation + destDeviation;

  const pickupDist = haversineKm(passengerLat, passengerLng, driverOriginLat, driverOriginLng);

  const deviationScore = Math.max(0, 1 - totalDeviation / 20);
  const proximityScore = Math.max(0, 1 - pickupDist / 10);
  const ratingScore = driverRating / 5;
  const seatsScore = Math.min(availableSeats / 4, 1);

  const score = deviationScore * 0.5 + proximityScore * 0.3 + ratingScore * 0.15 + seatsScore * 0.05;

  logger.debug({ totalDeviation, score }, "Match score computed");

  return { deviationKm: totalDeviation, score };
}

export function estimateEta(
  passengerLat: number, passengerLng: number,
  driverLat: number, driverLng: number
): number {
  const distKm = haversineKm(passengerLat, passengerLng, driverLat, driverLng);
  const avgSpeedKmh = 30;
  return Math.ceil((distKm / avgSpeedKmh) * 60);
}

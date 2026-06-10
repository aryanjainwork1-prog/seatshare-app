import { useEffect, useState } from "react";
import { customFetch } from "@workspace/api-client-react";

interface LatLng {
  lat: number;
  lng: number;
}

interface UseRouteGeometryResult {
  coordinates: LatLng[] | null;
  isLoading: boolean;
}

export function useRouteGeometry(
  fromCoords: LatLng,
  toCoords: LatLng,
): UseRouteGeometryResult {
  const [coordinates, setCoordinates] = useState<LatLng[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setCoordinates(null);

    const params = new URLSearchParams({
      fromLat: fromCoords.lat.toString(),
      fromLng: fromCoords.lng.toString(),
      toLat: toCoords.lat.toString(),
      toLng: toCoords.lng.toString(),
    });

    customFetch<{ coordinates: LatLng[] }>(`/api/route?${params.toString()}`)
      .then((data: { coordinates: LatLng[] }) => {
        if (!cancelled) setCoordinates(data.coordinates);
      })
      .catch(() => {
        if (!cancelled) setCoordinates([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng]);

  return { coordinates, isLoading };
}

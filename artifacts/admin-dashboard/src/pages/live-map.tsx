import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  useListDriverProfiles,
  getListDriverProfilesQueryKey,
  useListTrips,
  getListTripsQueryKey,
  useListBookings,
  getListBookingsQueryKey,
} from "@workspace/api-client-react";
import type { Booking, DriverProfile, Trip } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Car, MapPin, Users, Wifi, WifiOff } from "lucide-react";

// ── Custom marker icons ───────────────────────────────────────────────────────

function makeIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.5);">${label}</div>`,
  });
}

const DRIVER_ICON     = makeIcon("#3b82f6", "D");
const TRIP_ICON       = makeIcon("#22c55e", "T");
const PASSENGER_ICON  = makeIcon("#f97316", "P");

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriverLocation {
  driverUserId: number;
  lat: number;
  lng: number;
}

type DriverWithLoc = DriverProfile & { currentLat: number; currentLng: number };

interface DrawerItem {
  type: "driver" | "trip" | "booking";
  driver?: DriverProfile;
  trip?: Trip;
  booking?: Booking;
}

// ── Map controller — captures the Leaflet map instance ───────────────────────

function MapController({
  mapRef,
}: {
  mapRef: React.MutableRefObject<L.Map | null>;
}) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

// ── Bounds tracker ────────────────────────────────────────────────────────────

function BoundsTracker({
  onChange,
}: {
  onChange: (bounds: L.LatLngBounds) => void;
}) {
  const map = useMapEvents({
    moveend: () => onChange(map.getBounds()),
    zoomend: () => onChange(map.getBounds()),
  });
  useEffect(() => {
    onChange(map.getBounds());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({
  item,
  onClose,
}: {
  item: DrawerItem;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-4">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground text-lg leading-none"
        aria-label="Close"
      >
        ×
      </button>

      {item.type === "driver" && item.driver && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Car className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {item.driver.user?.name ?? `Driver #${item.driver.userId}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.driver.user?.phone ?? ""}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-accent rounded p-2">
              <p className="font-bold text-primary">
                {item.driver.rating.toFixed(1)}
              </p>
              <p className="text-muted-foreground">Rating</p>
            </div>
            <div className="bg-accent rounded p-2">
              <p className="font-bold">{item.driver.totalTrips}</p>
              <p className="text-muted-foreground">Trips</p>
            </div>
            <div className="bg-accent rounded p-2 flex items-center justify-center">
              <Badge
                variant={item.driver.isVerified ? "default" : "outline"}
                className="text-[10px]"
              >
                {item.driver.isVerified ? "Verified" : "Pending"}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {item.type === "trip" && item.trip && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">Trip #{item.trip.id}</p>
              <Badge variant="outline" className="text-[10px] mt-0.5">
                {item.trip.status}
              </Badge>
            </div>
          </div>
          <div className="text-xs space-y-1">
            <p className="text-muted-foreground">
              From:{" "}
              <span className="text-foreground">{item.trip.originAddress}</span>
            </p>
            <p className="text-muted-foreground">
              To:{" "}
              <span className="text-foreground">{item.trip.destAddress}</span>
            </p>
            <p className="text-muted-foreground">
              Seats:{" "}
              <span className="text-foreground">{item.trip.availableSeats}</span>
              {" · "}Fare:{" "}
              <span className="text-primary font-semibold">
                ${item.trip.farePerSeat}/seat
              </span>
            </p>
          </div>
        </div>
      )}

      {item.type === "booking" && item.booking && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {item.booking.passenger?.name ?? `Passenger #${item.booking.passengerId}`}
              </p>
              <Badge variant="outline" className="text-[10px] mt-0.5">
                {item.booking.status}
              </Badge>
            </div>
          </div>
          <div className="text-xs space-y-1">
            <p className="text-muted-foreground">
              Pickup:{" "}
              <span className="text-foreground">
                {item.booking.pickupAddress}
              </span>
            </p>
            <p className="text-muted-foreground">
              Drop-off:{" "}
              <span className="text-foreground">
                {item.booking.dropoffAddress}
              </span>
            </p>
            <p className="text-muted-foreground">
              Fare:{" "}
              <span className="text-primary font-semibold">
                ${item.booking.fare.toFixed(2)}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LiveMap() {
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [selected, setSelected] = useState<DrawerItem | null>(null);
  const [wsStatus, setWsStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [liveLocations, setLiveLocations] = useState<
    Map<number, DriverLocation>
  >(new Map());

  const mapRef = useRef<L.Map | null>(null);
  const wsRef  = useRef<WebSocket | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────
  const driverParams = { isOnline: true, limit: 100 };
  const { data: driversData } = useListDriverProfiles(driverParams, {
    query: {
      queryKey: getListDriverProfilesQueryKey(driverParams),
      staleTime: 30_000,
    },
  });

  const tripParams = { status: "active", limit: 100 };
  const { data: tripsData } = useListTrips(tripParams, {
    query: {
      queryKey: getListTripsQueryKey(tripParams),
      staleTime: 30_000,
    },
  });

  const bookingParams = { status: "confirmed", limit: 200 };
  const { data: bookingsData } = useListBookings(bookingParams, {
    query: {
      queryKey: getListBookingsQueryKey(bookingParams),
      staleTime: 30_000,
    },
  });

  const drivers:  DriverProfile[] = driversData?.data  ?? [];
  const trips:    Trip[]           = tripsData?.data    ?? [];
  const bookings: Booking[]        = bookingsData?.data ?? [];

  // ── WebSocket live tracking ──────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("seatshare_token");
    if (!token) {
      setWsStatus("disconnected");
      return;
    }

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      ws.send(JSON.stringify({ type: "subscribe_map" }));
    };

    ws.onmessage = (evt: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(evt.data) as {
          type: string;
          driverUserId?: number;
          lat?: number;
          lng?: number;
        };
        if (
          msg.type === "driver_location" &&
          msg.driverUserId != null &&
          msg.lat != null &&
          msg.lng != null
        ) {
          setLiveLocations((prev) => {
            const next = new Map(prev);
            next.set(msg.driverUserId!, {
              driverUserId: msg.driverUserId!,
              lat: msg.lat!,
              lng: msg.lng!,
            });
            return next;
          });
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("disconnected");

    return () => ws.close();
  }, []);

  // ── Merge WS locations ───────────────────────────────────────────────────────
  const driversWithLoc: DriverWithLoc[] = drivers
    .map((d) => {
      const live = liveLocations.get(d.userId);
      const lat = live?.lat ?? d.currentLat;
      const lng = live?.lng ?? d.currentLng;
      return lat != null && lng != null
        ? { ...d, currentLat: lat, currentLng: lng }
        : null;
    })
    .filter((d): d is DriverWithLoc => d !== null);

  // ── Bounds filtering ─────────────────────────────────────────────────────────
  const driversInBounds: DriverWithLoc[] = bounds
    ? driversWithLoc.filter((d) =>
        bounds.contains([d.currentLat, d.currentLng]),
      )
    : driversWithLoc;

  const tripsInBounds: Trip[] = bounds
    ? trips.filter((t) => bounds.contains([t.originLat, t.originLng]))
    : trips;

  const bookingsInBounds: Booking[] = bounds
    ? bookings.filter((b) => bounds.contains([b.pickupLat, b.pickupLng]))
    : bookings;

  // ── flyTo helpers ─────────────────────────────────────────────────────────────
  const flyTo = (lat: number, lng: number) => {
    mapRef.current?.flyTo([lat, lng], 14, { animate: true, duration: 0.5 });
  };

  const center: [number, number] = [20.5937, 78.9629];

  return (
    <div className="relative h-full w-full flex">
      {/* Left panel — online drivers */}
      <div className="w-64 shrink-0 border-r border-border bg-card flex flex-col z-[500] overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Car className="h-4 w-4 text-blue-400" />
            Online Drivers
          </div>
          <Badge variant="outline" className="text-[10px]">
            {driversInBounds.length}
          </Badge>
        </div>
        <ScrollArea className="flex-1">
          {driversInBounds.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">
              No online drivers in view
            </p>
          ) : (
            driversInBounds.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setSelected({ type: "driver", driver: d });
                  flyTo(d.currentLat, d.currentLng);
                }}
                className="w-full text-left p-3 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
              >
                <p className="text-sm font-medium truncate">
                  {d.user?.name ?? `Driver #${d.userId}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  ⭐ {d.rating.toFixed(1)} · {d.totalTrips} trips
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {d.currentLat.toFixed(4)}, {d.currentLng.toFixed(4)}
                </p>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            maxZoom={19}
          />
          <MapController mapRef={mapRef} />
          <BoundsTracker onChange={setBounds} />

          {/* Blue driver markers */}
          {driversWithLoc.map((d) => (
            <Marker
              key={`driver-${d.id}`}
              position={[d.currentLat, d.currentLng]}
              icon={DRIVER_ICON}
              eventHandlers={{
                click: () => setSelected({ type: "driver", driver: d }),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>
                    {d.user?.name ?? `Driver #${d.userId}`}
                  </strong>
                  <br />⭐ {d.rating.toFixed(1)} · {d.totalTrips} trips
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Green trip origin markers */}
          {trips.map((t) => (
            <Marker
              key={`trip-${t.id}`}
              position={[t.originLat, t.originLng]}
              icon={TRIP_ICON}
              eventHandlers={{
                click: () => setSelected({ type: "trip", trip: t }),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>Trip #{t.id}</strong>
                  <br />
                  {t.originAddress} → {t.destAddress}
                  <br />
                  {t.availableSeats} seats · ${t.farePerSeat}/seat
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Orange passenger pickup markers */}
          {bookings.map((b) => (
            <Marker
              key={`booking-${b.id}`}
              position={[b.pickupLat, b.pickupLng]}
              icon={PASSENGER_ICON}
              eventHandlers={{
                click: () => setSelected({ type: "booking", booking: b }),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>
                    {b.passenger?.name ?? `Passenger #${b.passengerId}`}
                  </strong>
                  <br />
                  {b.pickupAddress} → {b.dropoffAddress}
                  <br />
                  Fare: ${b.fare.toFixed(2)} · {b.status}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* WS status pill */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-card/90 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-border text-xs">
          {wsStatus === "connected" ? (
            <>
              <Wifi className="h-3 w-3 text-green-400" />
              <span className="text-green-400">Live</span>
            </>
          ) : wsStatus === "connecting" ? (
            <>
              <Wifi className="h-3 w-3 text-yellow-400 animate-pulse" />
              <span className="text-yellow-400">Connecting</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-destructive" />
              <span className="text-destructive">Offline</span>
            </>
          )}
        </div>

        {/* Map legend */}
        <div className="absolute bottom-8 right-3 z-[1000] bg-card/90 backdrop-blur-sm px-3 py-2 rounded-lg border border-border text-xs space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-muted-foreground">Driver online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Active trip</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <span className="text-muted-foreground">Passenger pickup</span>
          </div>
        </div>
      </div>

      {/* Right panel — confirmed bookings / passengers */}
      <div className="w-64 shrink-0 border-l border-border bg-card flex flex-col z-[500] overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-orange-400" />
            Passengers
          </div>
          <Badge variant="outline" className="text-[10px]">
            {bookingsInBounds.length}
          </Badge>
        </div>
        <ScrollArea className="flex-1">
          {bookingsInBounds.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">
              No passengers in view
            </p>
          ) : (
            bookingsInBounds.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setSelected({ type: "booking", booking: b });
                  flyTo(b.pickupLat, b.pickupLng);
                }}
                className="w-full text-left p-3 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
              >
                <p className="text-sm font-medium truncate">
                  {b.passenger?.name ?? `Passenger #${b.passengerId}`}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {b.pickupAddress.split(",")[0]}
                </p>
                <p className="text-xs text-primary mt-0.5">
                  ${b.fare.toFixed(2)} · {b.status}
                </p>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {selected && (
        <DetailDrawer item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

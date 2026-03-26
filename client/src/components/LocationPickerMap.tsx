import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapPin, Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LocationPickerMapProps {
  value?: { lat: number; lng: number; radiusKm: number } | null;
  onChange: (val: { lat: number; lng: number; radiusKm: number } | null) => void;
}

export default function LocationPickerMap({ value, onChange }: LocationPickerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [radius, setRadius] = useState(value?.radiusKm ?? 10);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(
    value ? { lat: value.lat, lng: value.lng } : null
  );
  const [address, setAddress] = useState<string>("");

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [26.8206, 30.8025],
      zoom: 6,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setPicked({ lat, lng });
      reverseGeocode(lat, lng);
    });

    leafletMap.current = map;
  }, []);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
    if (circleRef.current) { circleRef.current.remove(); circleRef.current = null; }

    if (picked) {
      const marker = L.marker([picked.lat, picked.lng]).addTo(map);
      const circle = L.circle([picked.lat, picked.lng], {
        radius: radius * 1000,
        color: "#7c3aed",
        fillColor: "#7c3aed",
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(map);
      markerRef.current = marker;
      circleRef.current = circle;
      map.setView([picked.lat, picked.lng], Math.max(map.getZoom(), 10));
      onChange({ lat: picked.lat, lng: picked.lng, radiusKm: radius });
    } else {
      onChange(null);
    }
  }, [picked, radius]);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`
      );
      const data = await res.json();
      const parts = [
        data.address?.city || data.address?.town || data.address?.village || data.address?.county,
        data.address?.state,
      ].filter(Boolean);
      setAddress(parts.join("، ") || data.display_name?.split(",").slice(0, 2).join(", ") || "");
    } catch {
      setAddress("");
    }
  };

  const locateMe = () => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPicked({ lat: coords.latitude, lng: coords.longitude });
        reverseGeocode(coords.latitude, coords.longitude);
        leafletMap.current?.setView([coords.latitude, coords.longitude], 13);
      },
      () => {}
    );
  };

  const clear = () => {
    setPicked(null);
    setAddress("");
    setRadius(10);
    onChange(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 dark:text-purple-400">
        <MapPin className="w-4 h-4" />
        تحديد المنطقة المستهدفة على الخريطة
      </div>

      <div className="relative rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800 shadow-sm">
        <div ref={mapRef} style={{ height: 300 }} />

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="absolute bottom-3 left-3 z-[1000] bg-white dark:bg-zinc-900 gap-1.5 text-xs shadow"
          onClick={locateMe}
        >
          <Navigation className="w-3.5 h-3.5" />
          موقعي
        </Button>

        {!picked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[500]">
            <div className="bg-black/60 text-white text-sm px-4 py-2 rounded-full backdrop-blur-sm">
              اضغط على الخريطة لتحديد المنطقة
            </div>
          </div>
        )}
      </div>

      {picked && (
        <div className="space-y-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="text-sm font-medium text-purple-800 dark:text-purple-300 line-clamp-1">
                {address || `${picked.lat.toFixed(4)}, ${picked.lng.toFixed(4)}`}
              </span>
            </div>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={clear}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>نطاق الاستهداف</span>
              <span className="font-bold text-purple-700 dark:text-purple-400">{radius} كم</span>
            </div>
            <Slider
              min={1}
              max={200}
              step={1}
              value={[radius]}
              onValueChange={([v]) => setRadius(v)}
              className="[&_[role=slider]]:bg-purple-600"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1 كم</span>
              <span>200 كم</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";

export function useCurrentLocation() {
  const [isLocating, setIsLocating] = useState(false);

  const detect = async (
    onAddress: (address: string) => void,
    onCoords?: (lat: number, lng: number) => void
  ) => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        onCoords?.(latitude, longitude);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          onAddress(data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } catch {
          onAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) alert("Location access denied. Please allow location permission.");
        else alert("Unable to detect location. Please enter manually.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return { isLocating, detect };
}

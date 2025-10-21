import React, { useEffect, useRef, useState } from "react";
import L, { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../_main/main.css";

export default function PreviewLocation() {
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Initialize map and geolocation
  useEffect(() => {
    if (containerRef.current && !mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center: [0, 0],
        zoom: 2,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(mapRef.current);
    }

    const onPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const latlng: [number, number] = [latitude, longitude];
      mapRef.current?.setView(latlng, 14);

      if (!markerRef.current) {
        markerRef.current = L.marker(latlng).addTo(mapRef.current!);
      } else {
        markerRef.current.setLatLng(latlng);
      }
    };

    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        onPosition,
        (err) => console.warn("Geolocation error:", err),
        { enableHighAccuracy: true, maximumAge: 2000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Handle expand/collapse and map resizing
  useEffect(() => {
    if (!mapRef.current) return;
    const timeout = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 300); // match CSS transition
    return () => clearTimeout(timeout);
  }, [expanded]);

  // Collapse when clicking outside
  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  return (
    <>
      <div
        ref={containerRef}
        className={`preview-map ${expanded ? "expanded" : ""}`}
      >
        <button
          className="map-expand-btn"
          onClick={() => setExpanded((prev) => !prev)}
          type="button"
        >
          {expanded ? "×" : "⤢"}
        </button>
      </div>
      {expanded && <div className="map-overlay" />}
    </>
  );
}

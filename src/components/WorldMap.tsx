import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { GeoJSONSource, Map as MapLibre, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// Published as a file of its own: MapLibre looks for its worker beside itself, which a bundle does not keep.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { Avatar } from "./Avatar";

export interface MapDot {
  id: string;
  lat: number;
  lon: number;
  weight: number;
  label: string;
  live?: boolean;
  // Draws the visitor's avatar instead of a dot when it stands alone.
  avatar?: boolean;
}

// OpenFreeMap: free vector tiles from OpenStreetMap, no key, no account.
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const SOURCE = "visitors";

// MapLibre reads hex and rgb, not the oklch the tokens are written in, so each
// token is painted once on a 1px canvas and read back.
function tokenColor(name: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;
}

function geojson(dots: MapDot[]) {
  return {
    type: "FeatureCollection" as const,
    features: dots.map((d) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [d.lon, d.lat] },
      properties: { id: d.id, weight: d.weight, label: d.label, live: d.live ? 1 : 0, avatar: d.avatar ? 1 : 0 },
    })),
  };
}

// A map opens on its dots, or on the whole world when there are none yet.
const WORLD: [[number, number], [number, number]] = [
  [-170, -58],
  [190, 78],
];

function boundsOf(dots: MapDot[]): [[number, number], [number, number]] {
  if (!dots.length) return WORLD;
  const lons = dots.map((d) => d.lon);
  const lats = dots.map((d) => d.lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}

export function WorldMap({ dots, selected, onSelect, ratio = 0.5 }: { dots: MapDot[]; selected?: string | null; onSelect?: (id: string) => void; ratio?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const ready = useRef(false);
  const latest = useRef({ dots, onSelect });
  latest.current = { dots, onSelect };
  const markers = useRef(new Map<string, { marker: Marker; root: Root }>());

  // The map is created once; MapLibre is loaded only when a map is shown.
  useEffect(() => {
    let cancelled = false;
    let instance: MapLibre | null = null;
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !box.current) return;
      maplibregl.setWorkerUrl(workerUrl);
      const m = new maplibregl.Map({
        container: box.current,
        style: STYLE,
        bounds: boundsOf(latest.current.dots),
        // A single dot, or dots in one town, open at town level rather than street level.
        fitBoundsOptions: { padding: 32, maxZoom: 9 },
        minZoom: 0.6,
        attributionControl: { compact: true },
        // Scrolling the page passes over the map; ctrl or cmd + scroll, or two fingers, zoom it.
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
      });
      m.touchZoomRotate.disableRotation();
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      instance = m;
      map.current = m;

      m.on("load", () => {
        // The tiles' greys warmed to the paper the rest of the app is printed on.
        for (const layer of m.getStyle().layers) {
          if (layer.type === "background") m.setPaintProperty(layer.id, "background-color", tokenColor("--color-paper"));
          if (layer.type === "fill" && /water/.test(layer.id)) m.setPaintProperty(layer.id, "fill-color", tokenColor("--map-water"));
        }

        m.addSource(SOURCE, {
          type: "geojson",
          data: geojson(latest.current.dots),
          cluster: true,
          clusterRadius: 44,
          clusterMaxZoom: 13,
          clusterProperties: { weight: ["+", ["get", "weight"]], live: ["max", ["get", "live"]] },
        });
        const accent = tokenColor("--color-accent-2");
        const cotton = tokenColor("--color-cotton");
        const ink = tokenColor("--color-ink");
        m.addLayer({
          id: "clusters",
          type: "circle",
          source: SOURCE,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": accent,
            "circle-radius": ["interpolate", ["linear"], ["sqrt", ["get", "weight"]], 1, 14, 10, 22, 50, 34],
            "circle-stroke-width": 3,
            "circle-stroke-color": cotton,
          },
        });
        m.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: SOURCE,
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["number-format", ["get", "weight"], { locale: "en" }],
            "text-font": ["Noto Sans Bold"],
            "text-size": 12,
            "text-allow-overlap": true,
          },
          paint: { "text-color": cotton },
        });
        m.addLayer({
          id: "point",
          type: "circle",
          source: SOURCE,
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "avatar"], 0]],
          paint: {
            "circle-color": accent,
            "circle-opacity": 0.85,
            "circle-radius": ["interpolate", ["linear"], ["sqrt", ["get", "weight"]], 1, 6, 10, 12, 50, 20],
            "circle-stroke-width": 2,
            "circle-stroke-color": cotton,
          },
        });

        m.on("click", "clusters", async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const zoom = await (m.getSource(SOURCE) as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
          m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.3 });
        });
        m.on("click", "point", (e) => {
          const id = e.features?.[0]?.properties.id;
          if (id) latest.current.onSelect?.(id);
        });
        for (const layer of ["clusters", "point"]) {
          m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
        }
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "map-popup" });
        m.on("mousemove", "point", (e) => {
          const f = e.features?.[0];
          if (f) popup.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setText(f.properties.label).addTo(m);
        });
        m.on("mouseleave", "point", () => popup.remove());

        // Visitors standing alone are drawn as their avatar, an HTML marker kept
        // in step with what the clustering leaves unclustered.
        const sync = () => {
          const shown = new Set<string>();
          const features = m.querySourceFeatures(SOURCE, { filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "avatar"], 1]] });
          for (const f of features) {
            const id = f.properties.id as string;
            if (shown.has(id)) continue;
            shown.add(id);
            if (markers.current.has(id)) continue;
            const el = document.createElement("button");
            el.type = "button";
            el.className = "map-avatar";
            el.title = f.properties.label;
            el.setAttribute("aria-label", f.properties.label);
            el.addEventListener("click", (ev) => {
              ev.stopPropagation();
              latest.current.onSelect?.(id);
            });
            const root = createRoot(el);
            root.render(<Avatar seed={id} size={28} />);
            const marker = new maplibregl.Marker({ element: el }).setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).addTo(m);
            markers.current.set(id, { marker, root });
          }
          for (const [id, { marker, root }] of markers.current) {
            if (shown.has(id)) continue;
            marker.remove();
            queueMicrotask(() => root.unmount());
            markers.current.delete(id);
          }
        };
        m.on("render", () => {
          if (m.isSourceLoaded(SOURCE)) sync();
        });

        ready.current = true;
      });
    });

    const resize = new ResizeObserver(() => map.current?.resize());
    if (box.current) resize.observe(box.current);
    return () => {
      cancelled = true;
      resize.disconnect();
      for (const { marker, root } of markers.current.values()) {
        marker.remove();
        queueMicrotask(() => root.unmount());
      }
      markers.current.clear();
      instance?.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New numbers every refresh: the data changes, the view the person chose does not,
  // except that a map opened before its first dots arrived moves to them once.
  const fitted = useRef(dots.length > 0);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(geojson(dots));
    if (!fitted.current && dots.length) {
      fitted.current = true;
      m.fitBounds(boundsOf(dots), { padding: 32, maxZoom: 9 });
    }
  }, [dots]);

  // A visitor picked in a list is brought into view.
  useEffect(() => {
    const m = map.current;
    const d = selected ? latest.current.dots.find((x) => x.id === selected) : null;
    for (const [id, { marker }] of markers.current) marker.getElement().classList.toggle("is-selected", id === selected);
    if (!m || !d) return;
    m.flyTo({ center: [d.lon, d.lat], zoom: Math.max(m.getZoom(), 9), duration: 800 });
  }, [selected]);

  return <div className="map map--live" ref={box} style={{ aspectRatio: `${1 / ratio}` }} />;
}

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "./DeckOilOverlay.css";

/* =========================================================
   OILTRACE — LAGRANGIAN PARTICLE OVERLAY

   This overlay deliberately renders the PARTICLES produced by
   Simulation/oilSimulation.js. It does not generate a second,
   unrelated plume. That keeps:

     replay time -> oil particles -> particle trails -> centreline

   on the same simulation clock.

   The canvas sits below Leaflet's marker pane so vessel markers
   remain visible while oil travels underneath them.
========================================================= */

const CATEGORY_COLORS = {
  initial: [16, 185, 129],   // green
  active: [37, 99, 235],    // blue
  stranded: [239, 68, 68],  // red
};

class OilCanvasLayer {
  constructor() {
    this._particles = [];
    this._trails = [];
    this._canvas = null;
    this._ctx = null;
    this._map = null;
    this._dpr = 1;
    this._boundRedraw = this._redraw.bind(this);
  }

  addTo(map) {
    this._map = map;

    const canvas = document.createElement("canvas");
    canvas.className = "oiltrace-oil-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.pointerEvents = "none";

    map.getContainer().appendChild(canvas);

    this._canvas = canvas;
    this._ctx = canvas.getContext("2d", { alpha: true });

    this._syncSize();
    this._redraw();

    map.on(
      "move zoom resize moveend zoomend viewreset",
      this._boundRedraw
    );
    window.addEventListener("resize", this._boundRedraw);

    return this;
  }

  remove() {
    if (this._map) {
      this._map.off(
        "move zoom resize moveend zoomend viewreset",
        this._boundRedraw
      );
    }

    window.removeEventListener("resize", this._boundRedraw);

    if (this._canvas?.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }

    this._canvas = null;
    this._ctx = null;
    this._map = null;
    this._particles = [];
    this._trails = [];
  }

  setFrame({ particles = [], trails = [] } = {}) {
    this._particles = Array.isArray(particles) ? particles : [];
    this._trails = Array.isArray(trails) ? trails : [];
    this._redraw();
  }

  _syncSize() {
    if (!this._map || !this._canvas || !this._ctx) return;

    const size = this._map.getSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this._dpr = dpr;
    this._canvas.style.width = `${size.x}px`;
    this._canvas.style.height = `${size.y}px`;
    this._canvas.width = Math.max(1, Math.round(size.x * dpr));
    this._canvas.height = Math.max(1, Math.round(size.y * dpr));

    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _redraw() {
    const canvas = this._canvas;
    const ctx = this._ctx;
    const map = this._map;

    if (!canvas || !ctx || !map) return;

    const cssWidth = canvas.width / this._dpr;
    const cssHeight = canvas.height / this._dpr;

    this._syncSize();
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    /* -------------------------------------------------------
       PARTICLE DRIFT TRAILS

       Draw a restrained subset of the simulation's actual
       particle histories. These are trails, not vessel paths.
    ------------------------------------------------------- */
    if (this._trails.length) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // The simulation supplies roughly half the particles as trails.
      // Rendering every historical segment would unnecessarily cover
      // the basemap, so keep every 4th trail and the recent portion.
      const stride = this._trails.length > 350 ? 4 : 2;

      for (let i = 0; i < this._trails.length; i += stride) {
        const trail = this._trails[i];
        if (!Array.isArray(trail?.path) || trail.path.length < 2) continue;

        const start = Math.max(0, trail.path.length - 24);
        const recent = trail.path.slice(start);
        if (recent.length < 2) continue;

        ctx.beginPath();
        let hasPoint = false;

        for (let j = 0; j < recent.length; j += 1) {
          const pair = recent[j];
          if (!Array.isArray(pair) || pair.length < 2) continue;

          const lng = Number(pair[0]);
          const lat = Number(pair[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

          const point = map.latLngToContainerPoint(L.latLng(lat, lng));

          if (!hasPoint) {
            ctx.moveTo(point.x, point.y);
            hasPoint = true;
          } else {
            ctx.lineTo(point.x, point.y);
          }
        }

        if (hasPoint) {
          ctx.strokeStyle = "rgba(59, 130, 246, 0.12)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    /* -------------------------------------------------------
       ACTIVE OIL PARTICLES

       The particle coordinates and categories come directly from
       the current simulation frame. No independent animation is
       applied here, so the map scrub and particle field stay synced.
    ------------------------------------------------------- */
    ctx.save();

    for (const particle of this._particles) {
      const lat = Number(particle?.latitude);
      const lng = Number(particle?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const point = map.latLngToContainerPoint(L.latLng(lat, lng));
      if (
        point.x < -10 ||
        point.x > cssWidth + 10 ||
        point.y < -10 ||
        point.y > cssHeight + 10
      ) {
        continue;
      }

      const [r, g, b] = CATEGORY_COLORS[particle.category] || CATEGORY_COLORS.active;
      const radius = Math.max(
        1.5,
        Math.min(5.8, Number(particle.radiusPixels) || 3.5)
      );

      // Slightly stronger particles near the centre make the plume read
      // as a field of oil parcels instead of a solid polygon.
      const alpha = particle.category === "stranded" ? 0.82 : 0.72;

      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fill();
    }

    ctx.restore();
  }
}

export default function DeckOilOverlay({
  enabled = true,
  particles = [],
  trails = [],
}) {
  const map = useMap();
  const layerRef = useRef(null);

  /* Mount exactly once for the current map/visibility state. */
  useEffect(() => {
    if (!map || !enabled) return undefined;

    const layer = new OilCanvasLayer();
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map, enabled]);

  /* Update only the frame data. Do NOT recreate the canvas layer on
     every replay tick; that caused unnecessary flicker and made the
     vessel/oil stacking unreliable. */
  useEffect(() => {
    layerRef.current?.setFrame({ particles, trails });
  }, [particles, trails]);

  return null;
}

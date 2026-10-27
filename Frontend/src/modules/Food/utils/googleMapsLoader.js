import { Loader } from "@googlemaps/js-api-loader";
import { getGoogleMapsApiKey } from "./googleMapsApiKey.js";

// A single, fixed superset of libraries used across the whole app.
// @googlemaps/js-api-loader enforces a global singleton: calling `new Loader(...)`
// a second time with different options (e.g. a different `libraries` array) throws
// "Loader must not be called again with different options". Since this is a client-side
// routed SPA (no full page reload between pages), every screen that loads Google Maps
// MUST request the exact same library set through this shared loader.
const DEFAULT_LIBRARIES = ["places", "geometry", "drawing"];

let loadPromise = null;

/**
 * Load Google Maps JS API once (web + mobile WebView).
 * Always requests the same fixed DEFAULT_LIBRARIES set — any `options.libraries`
 * passed in is ignored on purpose, so every caller shares one Loader singleton
 * instead of tripping its "different options" error on a later page/navigation.
 * @returns {Promise<typeof google>}
 */
export async function loadGoogleMaps() {
  if (typeof window !== "undefined" && window.google?.maps) {
    return window.google;
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      const apiKey = await getGoogleMapsApiKey();
      if (!apiKey) {
        throw new Error("Google Maps API key is not configured");
      }

      const loader = new Loader({
        apiKey,
        version: "weekly",
        libraries: DEFAULT_LIBRARIES,
      });

      return loader.load();
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }

  return loadPromise;
}

export function isGoogleMapsLoaded() {
  return typeof window !== "undefined" && Boolean(window.google?.maps);
}

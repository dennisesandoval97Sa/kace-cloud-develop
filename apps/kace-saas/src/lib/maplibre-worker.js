/**
 * MapLibre 6 deriva la URL del worker de import.meta.url; tras el bundling de Vite eso apunta
 * a /assets/index-*.js y el worker da 404. Hay que fijarla explícitamente.
 */
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);

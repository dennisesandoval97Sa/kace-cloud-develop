/// <reference types="vite/client" />

// Define aquí tus variables de entorno VITE_* , OS_* , EXAMPLE_* ...
interface ImportMetaEnv {
  readonly [key: `VITE_${string}`]: string;
  readonly [key: `OS_${string}`]: string;
  readonly [key: `EXAMPLE_${string}`]: string;
  // Agrega más variables según tus necesidades
  readonly OS_ENV_VAR: string;
  readonly OS_API_TEST: string;
  readonly EXAMPLE_ENV_VAR: string;
}

// Extiende import.meta para que TypeScript reconozca import.meta.env
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Declara los CSS Modules para que TypeScript los reconozca
declare module '*.module.css';

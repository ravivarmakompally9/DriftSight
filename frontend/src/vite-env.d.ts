/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_API_TARGET?: string;
  /** Set by `npm run build:static`: read exported JSON instead of the API. */
  readonly VITE_STATIC?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

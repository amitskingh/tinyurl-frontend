/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_PREFIX: string;
  readonly VITE_PUBLIC_ORIGIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Minimal typing for webpack's require.context (used by the block registry). */
declare namespace __WebpackModuleApi {
  interface RequireContext {
    keys(): string[];
    (id: string): unknown;
    resolve(id: string): string;
    id: string;
  }
}

declare namespace NodeJS {
  interface Require {
    context(directory: string, useSubdirectories?: boolean, regExp?: RegExp): __WebpackModuleApi.RequireContext;
  }
}

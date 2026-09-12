import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * Production-mode build assertion (BUILD_PROMPT_PART3 §19).
 * A production deploy must fail if DEMO_MODE=true unless the site is on a
 * preview domain. Netlify sets CONTEXT ("production" | "deploy-preview" |
 * "branch-deploy") and URL (the site's primary URL). A *.netlify.app site is
 * treated as a preview domain; a custom domain is not.
 */
function assertNotDemoInProduction(): void {
  const demo = process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const prodBuild = process.env.NODE_ENV === "production";
  const netlifyProdContext = process.env.CONTEXT === "production";
  const siteUrl = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const isPreviewDomain = /\.netlify\.app$/i.test(new URL(siteUrl || "http://localhost").hostname);
  const escapeHatch = process.env.ALLOW_DEMO_ON_CUSTOM_DOMAIN === "true";

  if (demo && prodBuild && netlifyProdContext && !isPreviewDomain && !escapeHatch) {
    throw new Error(
      `Refusing to build: DEMO_MODE=true on a production deploy to ${siteUrl}. ` +
        "Demo mode fakes payments, SMS and courier calls. Set DEMO_MODE=false (and NEXT_PUBLIC_DEMO_MODE=false), " +
        "or, only for a deliberate public demo on a custom domain, ALLOW_DEMO_ON_CUSTOM_DOMAIN=true.",
    );
  }
}
/**
 * The storefront is pre-rendered from the database at build time
 * (generateStaticParams, ISR). A missing public Supabase variable used to fail
 * deep inside "Collecting page data" with "supabaseUrl is required". Fail here
 * instead, with the fix spelled out. On Netlify the variables must be scoped to
 * BUILDS as well as Functions (Site configuration -> Environment variables).
 *
 * The phase comes from the config-function argument: `next build` only sets
 * process.env.NEXT_PHASE after the config has been loaded, so an env check
 * against it never fires in the main build process.
 */
function assertBuildEnv(phase: string): void {
  if (phase !== PHASE_PRODUCTION_BUILD) return;
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Refusing to build: ${missing.join(", ")} not set. The build pre-renders pages from Supabase. ` +
        "On Netlify add them under Site configuration > Environment variables with the Builds scope enabled " +
        "(a Functions-only scope is not visible to next build).",
    );
  }
}

function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}

export default function nextConfig(phase: string): NextConfig {
  assertNotDemoInProduction();
  assertBuildEnv(phase);

  const remoteHosts = [hostOf(process.env.NEXT_PUBLIC_SUPABASE_URL), hostOf(process.env.R2_PUBLIC_BASE_URL)].filter(
    (h): h is string => Boolean(h),
  );

  return {
    reactStrictMode: true,
    serverExternalPackages: ["sharp"],
    images: {
      formats: ["image/avif", "image/webp"],
      remotePatterns: remoteHosts.map((hostname) => ({ protocol: "https" as const, hostname })),
    },
  };
}

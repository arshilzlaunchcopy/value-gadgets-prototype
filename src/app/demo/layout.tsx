import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Every /demo/* route 404s unless DEMO_MODE=true (BUILD_PROMPT_PART3 §19, §24.7). */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  if (!isDemoMode()) notFound();
  return <div className="bg-paper-soft min-h-dvh">{children}</div>;
}

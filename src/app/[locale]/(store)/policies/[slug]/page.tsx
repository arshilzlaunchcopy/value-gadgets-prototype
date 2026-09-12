import { permanentRedirect } from "next/navigation";

/** Legacy URL: policy pages now live at /pages/{slug} (301, BUILD_PROMPT §7.6). */
export default async function LegacyPolicyPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  permanentRedirect(`${locale === "bn" ? "/bn" : ""}/pages/${slug}`);
}

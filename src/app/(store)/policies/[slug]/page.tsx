import { permanentRedirect } from "next/navigation";

/** Legacy URL: policy pages now live at /pages/{slug} (301, BUILD_PROMPT §7.6). */
export default async function LegacyPolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/pages/${slug}`);
}

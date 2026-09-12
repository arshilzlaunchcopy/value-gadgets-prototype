import { notFound } from "next/navigation";
import { CartDrawer } from "@/components/store/cart/cart-drawer";
import { CartProvider } from "@/components/store/cart/cart-provider";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { getAdminSession } from "@/lib/auth/admin";
import { PAGE_TYPES, type BlockRow, type PageType } from "@/lib/blocks/define";
import { BlockRenderer } from "@/lib/blocks/render";
import { getNavCategories } from "@/lib/catalog/queries";
import { verifyPreview } from "@/lib/preview";
import { getStoreSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Preview", robots: { index: false, follow: false } };

/**
 * Draft preview (PART2 §13.7): renders the working copy inside the store chrome.
 * Access: a valid signed token (2 h) OR a signed-in admin. Never cached.
 */
export default async function PreviewPage({ params, searchParams }: { params: Promise<{ pageType: string; target?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ pageType, target }, sp] = await Promise.all([params, searchParams]);
  if (!PAGE_TYPES.includes(pageType as PageType)) notFound();
  const targetId = target?.[0] ?? null;
  const token = typeof sp.token === "string" ? sp.token : null;
  const allowed = verifyPreview(token, pageType, targetId) || Boolean(await getAdminSession());
  if (!allowed) notFound();

  const admin = createAdminClient();
  let dq = admin.from("content_drafts").select("blocks").eq("page_type", pageType);
  dq = targetId ? dq.eq("target_id", targetId) : dq.is("target_id", null);
  const { data: draft } = await dq.maybeSingle();
  let blocks: BlockRow[] | undefined = Array.isArray(draft?.blocks) ? (draft!.blocks as unknown as BlockRow[]) : undefined;
  if (!blocks) {
    let lq = admin.from("content_blocks").select("id, block_type, settings, is_visible, visible_from, visible_until, locale, position").eq("page_type", pageType).eq("scope", targetId ? "instance" : "template").order("position");
    lq = targetId ? lq.eq("target_id", targetId) : lq.is("target_id", null);
    const { data } = await lq;
    blocks = (data ?? []).map((r) => ({ id: r.id, block_type: r.block_type, settings: (r.settings ?? {}) as Record<string, unknown>, is_visible: r.is_visible, visible_from: r.visible_from, visible_until: r.visible_until, locale: (r.locale as BlockRow["locale"]) ?? null }));
  }

  const [store, categories] = await Promise.all([getStoreSettings(), getNavCategories()]);
  return (
    <CartProvider>
      <div className="bg-amber text-ink px-3 py-1 text-center text-xs font-semibold">Preview: {pageType}{targetId ? ` · ${targetId.slice(0, 8)}` : " template"} · draft, not live</div>
      <Header store={store} categories={categories} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <BlockRenderer pageType={pageType as PageType} targetId={targetId} blocks={blocks} fallback={<p className="text-muted-foreground py-10 text-center">No blocks in this layout yet.</p>} />
      </main>
      <Footer store={store} categories={categories} />
      <CartDrawer />
    </CartProvider>
  );
}

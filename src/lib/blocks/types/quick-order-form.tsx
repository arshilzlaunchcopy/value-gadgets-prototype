import { z } from "zod";
import { QuickOrderForm, type QuickOrderProduct } from "@/components/store/blocks/quick-order-form";
import { getProductBySlug, getShippingEstimates } from "@/lib/catalog/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { defineBlock } from "../define";

const schema = z.object({
  product_slug: z.string().max(120).optional().or(z.literal("")).describe("Blank = the landing page's product"),
  heading_en: z.string().max(80).default("Order now, pay on delivery"),
  heading_bn: z.string().max(80).optional().or(z.literal("")),
  button_label_en: z.string().max(40).default("Confirm order"),
  button_label_bn: z.string().max(40).optional().or(z.literal("")),
  show_quantity: z.boolean().default(true),
  max_quantity: z.number().int().min(1).max(10).default(5),
  collect_note: z.boolean().default(false),
  success_message_en: z.string().max(200).default("Order received! We will call you to confirm before dispatch."),
});

interface Data {
  product: QuickOrderProduct;
  landing: { slug: string; otp_mode: string; otp_threshold_bdt: number } | null;
}

/**
 * quick_order_form (PART2 §15.2 / §15.6): name, phone, address, quantity on one
 * screen. Runs the same fraud check and dispatch path as checkout. OTP is a
 * per-landing-page setting (never / always / above a price threshold).
 */
export default defineBlock<typeof schema, Data | null>({
  type: "quick_order_form",
  label: "Quick order form",
  icon: "Zap",
  description: "Three-field COD order form for ad landing pages.",
  allowedOn: ["landing", "product", "custom", "page"],
  schema,
  defaults: { product_slug: "", heading_en: "Order now, pay on delivery", heading_bn: "এখনই অর্ডার করুন, ডেলিভারিতে পেমেন্ট", button_label_en: "Confirm order", button_label_bn: "অর্ডার নিশ্চিত করুন", show_quantity: true, max_quantity: 5, collect_note: false, success_message_en: "Order received! We will call you to confirm before dispatch." },
  loader: async (s, ctx) => {
    let slug = s.product_slug || "";
    let landing: Data["landing"] = null;
    if (ctx.targetId) {
      // landing page id OR its variant_b_id
      const { data: lp } = await createPublicClient().from("landing_pages").select("slug, product_id, otp_mode, otp_threshold_bdt, variant_b_id").or(`id.eq.${ctx.targetId},variant_b_id.eq.${ctx.targetId}`).maybeSingle();
      if (lp) {
        landing = { slug: lp.slug, otp_mode: lp.otp_mode, otp_threshold_bdt: lp.otp_threshold_bdt };
        if (!slug && lp.product_id) {
          const { data: p } = await createPublicClient().from("products_public").select("slug").eq("id", lp.product_id).maybeSingle();
          slug = p?.slug ?? "";
        }
      }
      if (!slug) {
        const { data: p } = await createPublicClient().from("products_public").select("slug").eq("id", ctx.targetId).maybeSingle();
        slug = p?.slug ?? "";
      }
    }
    if (!slug) return null;
    const [detail, shipping] = await Promise.all([getProductBySlug(slug), getShippingEstimates()]);
    if (!detail) return null;
    return {
      product: {
        id: detail.product.id,
        slug: detail.product.slug,
        title_en: detail.product.title_en,
        title_bn: detail.product.title_bn,
        image: detail.images[0]?.picture ?? detail.product.image,
        variants: detail.variants.map((v) => ({ id: v.id, label: v.option_value, price_bdt: v.price_bdt, compare_at_price_bdt: v.compare_at_price_bdt, available_qty: v.available_qty, is_default: v.is_default })),
        shipping: shipping.map((z) => ({ zone: z.zone, districts: z.districts, rate_bdt: z.rate_bdt, free_above_bdt: z.free_above_bdt, estimated_days: z.estimated_days })),
      },
      landing,
    };
  },
  component: ({ settings, data, locale }) => {
    if (!data) return <p className="text-muted-foreground rounded-2xl border p-6 text-center text-sm">Quick order form: choose a product for this landing page.</p>;
    return (
      <QuickOrderForm
        product={data.product}
        landingSlug={data.landing?.slug ?? null}
        heading={(locale === "bn" && settings.heading_bn) || settings.heading_en}
        buttonLabel={(locale === "bn" && settings.button_label_bn) || settings.button_label_en}
        showQuantity={settings.show_quantity}
        maxQuantity={settings.max_quantity}
        collectNote={settings.collect_note}
        successMessage={settings.success_message_en}
        locale={locale}
      />
    );
  },
});

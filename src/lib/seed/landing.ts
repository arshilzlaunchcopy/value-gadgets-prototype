import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SEED_IMAGES } from "./data/images.generated";

const img = (slug: string, i = 0): string => SEED_IMAGES[slug]?.[i]?.url ?? "";
const PRODUCT = "ugreen-8-in-1-usb-c-hub";

const row = (block_type: string, settings: Record<string, unknown>) => ({ block_type, settings, is_visible: true, visible_from: null, visible_until: null, locale: null });

function variantA() {
  return [
    row("hero_slider", { slides: [{ image_desktop: img(PRODUCT, 1), alt_text: "UGREEN 8-in-1 USB-C hub", heading_en: "One hub. Every port. Delivered to your door.", heading_bn: "একটি হাব। সব পোর্ট।", subheading_en: "4K HDMI, 100W charging, Gigabit Ethernet and card readers from one cable. Cash on delivery anywhere in Bangladesh.", cta_label_en: "Order now", cta_href: "#quick-order", text_position: "left" }], autoplay_ms: 0, show_dots: false }),
    row("feature_strip", { items: [{ icon: "banknote", label_en: "Cash on delivery", label_bn: "ক্যাশ অন ডেলিভারি" }, { icon: "truck", label_en: "1-2 days in Dhaka", label_bn: "ঢাকায় ১-২ দিনে" }, { icon: "shield-check", label_en: "12-month warranty", label_bn: "১২ মাসের ওয়ারেন্টি" }, { icon: "rotate-ccw", label_en: "7-day replacement", label_bn: "৭ দিনে রিপ্লেসমেন্ট" }], style: "dark" }),
    row("spec_highlight", { big_value: "8-in-1", big_label_en: "Every port you need from one USB-C cable", big_label_bn: "", items: [{ value: "4K@60Hz", label_en: "HDMI output" }, { value: "100W", label_en: "Pass-through charging" }, { value: "1 Gbps", label_en: "Ethernet" }, { value: "10 Gbps", label_en: "USB data" }, { value: "SD + TF", label_en: "Card readers" }, { value: "Aluminium", label_en: "Cool-running shell" }], style: "dark" }),
    row("quick_order_form", { product_slug: "", heading_en: "Order now, pay on delivery", heading_bn: "এখনই অর্ডার করুন, ডেলিভারিতে পেমেন্ট", button_label_en: "Confirm order", button_label_bn: "অর্ডার নিশ্চিত করুন", show_quantity: true, max_quantity: 5, collect_note: false, success_message_en: "Order received! We will call you to confirm before dispatch." }),
    row("testimonial_carousel", { title_en: "Buyers in Dhaka, Chattogram and Sylhet", items: [{ name: "Rafiul Islam", location: "Mirpur, Dhaka", quote: "Ordered at night, delivered next afternoon. Works with my MacBook exactly as promised.", rating: 5, avatar_image: "", product_label: "UGREEN 8-in-1 hub" }, { name: "Sadia Khanam", location: "Chattogram", quote: "3 days to Chattogram, sealed box with the warranty card, paid on delivery.", rating: 5, avatar_image: "", product_label: "UGREEN 8-in-1 hub" }, { name: "Tanvir Ahmed", location: "Sylhet", quote: "The Ethernet port alone saved my video calls. Real product, real warranty.", rating: 5, avatar_image: "", product_label: "UGREEN 8-in-1 hub" }] }),
    row("faq_accordion", { title_en: "Questions before you order", items: [{ question: "Does it work with MacBook, Windows laptops and phones?", answer: "Yes. Any device with a USB-C port that supports DisplayPort Alt Mode (all MacBooks since 2016, most Windows ultrabooks, Samsung DeX phones)." }, { question: "Is the warranty official?", answer: "12 months from UGREEN Bangladesh, registered by us. Claims are handled on WhatsApp within a day." }, { question: "Can I check the product before paying?", answer: "You can open the parcel in front of the courier and refuse it if the box is damaged." }], emit_schema: true }),
    row("whatsapp_cta", { number: "", message_en: "Hi! I have a question about the UGREEN 8-in-1 hub.", label_en: "Ask on WhatsApp", style: "floating" }),
  ];
}

/** Variant B: form first, social proof right under it; hero moves below. */
function variantB() {
  const a = variantA();
  const [hero, strip, spec, form, testimonials, faq, wa] = a;
  return [{ ...form, settings: { ...form.settings, heading_en: "Pay when it arrives at your door" } }, strip, testimonials, hero, spec, faq, wa];
}

/** Seed one published landing page with both A/B variants (PART2 §15.2). Idempotent by slug. */
export async function seedLandingPages(): Promise<{ pages: number }> {
  const admin = createAdminClient();
  const { data: product } = await admin.from("products").select("id").eq("slug", PRODUCT).maybeSingle();
  const { data: lp, error } = await admin
    .from("landing_pages")
    .upsert(
      {
        slug: "ugreen-hub-offer",
        title: "UGREEN 8-in-1 hub offer",
        product_id: product?.id ?? null,
        status: "published",
        chrome: "minimal",
        otp_mode: "above_threshold",
        otp_threshold_bdt: 5000,
        pixel_event: "Lead",
        ab_enabled: true,
        meta_title: "UGREEN 8-in-1 USB-C Hub - cash on delivery across Bangladesh",
        meta_description: "4K HDMI, 100W charging, Gigabit Ethernet and card readers. Official 12-month warranty, delivered anywhere in Bangladesh.",
        og_image_url: img(PRODUCT, 0) || null,
        published_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id, variant_b_id")
    .single();
  if (error || !lp) throw new Error(`landing_pages: ${error?.message}`);
  for (const [target, blocks, label] of [
    [lp.id, variantA(), "Seed landing A"],
    [lp.variant_b_id, variantB(), "Seed landing B"],
  ] as const) {
    const { error: pErr } = await admin.rpc("publish_page", { p_page_type: "landing", p_target_id: target, p_blocks: blocks, p_label: label, p_actor: null } as never);
    if (pErr) throw new Error(`publish_page(landing): ${pErr.message}`);
  }
  console.log("[seed] landing: 1 page, 2 variants");
  return { pages: 1 };
}

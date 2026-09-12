import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SEED_IMAGES } from "./data/images.generated";

/**
 * Seed content (BUILD_PROMPT_PART3 §21.3): a composed home page, header menus
 * with a mega panel, footer columns, announcement bar, theme settings, and the
 * demo admin owner. Idempotent: republishing replaces the same rows.
 */
const img = (slug: string, i = 0): string => SEED_IMAGES[slug]?.[i]?.url ?? "";

export function homeBlocks() {
  return [
    {
      block_type: "hero_slider",
      settings: {
        slides: [
          { image_desktop: img("ugreen-8-in-1-usb-c-hub", 1), alt_text: "UGREEN 8-in-1 USB-C hub", heading_en: "One hub. Every port.", heading_bn: "একটি হাব। সব পোর্ট।", subheading_en: "4K HDMI, 100W charging and Gigabit Ethernet from a single USB-C cable.", cta_label_en: "Shop hubs", cta_href: "/category/usb-c-hubs-adapters", text_position: "left" },
          { image_desktop: img("anker-735-ganprime-65w", 1), alt_text: "Anker 735 GaN charger", heading_en: "Eid offers on chargers", subheading_en: "GaN bricks and power banks up to 15% off, delivered anywhere in Bangladesh.", cta_label_en: "See offers", cta_href: "/collection/eid-offers", text_position: "left" },
        ],
        autoplay_ms: 6000,
        show_dots: true,
      },
    },
    { block_type: "category_tiles", settings: { title_en: "", only_top_level: true, style: "pills" } },
    { block_type: "product_carousel", settings: { title_en: "Best sellers", source: "collection", source_slug: "best-sellers", product_slugs: [], limit: 8, layout: "carousel", view_all_href: "/collection/best-sellers" } },
    { block_type: "trust_badges", settings: { badges: [{ icon: "shield-check", title: "Official warranty", text: "6 to 24 months on every product" }, { icon: "truck", title: "Fast delivery", text: "1-2 days in Dhaka, 3-5 nationwide" }, { icon: "badge-check", title: "Verified seller", text: "Trade licensed, genuine stock" }, { icon: "rotate-ccw", title: "Easy returns", text: "7-day replacement on faults" }] } },
    {
      block_type: "banner_grid",
      settings: {
        banners: [
          { image_url: img("baseus-20000mah-65w-power-bank", 2), alt_text: "Power banks", href: "/category/chargers-power-banks", caption_en: "Power banks" },
          { image_url: img("jbl-tune-510bt", 2), alt_text: "Audio", href: "/category/audio", caption_en: "Audio" },
        ],
        columns: "2",
        rounded: true,
      },
    },
    { block_type: "product_carousel", settings: { title_en: "Eid offers", source: "on_sale", source_slug: "", product_slugs: [], limit: 8, layout: "carousel", view_all_href: "/collection/eid-offers" } },
    {
      block_type: "image_with_text",
      settings: { image_url: img("anker-powerline-iii-usb-c-100w", 0), alt_text: "Anker PowerLine cable", image_side: "right", eyebrow_en: "Warranty", heading_en: "Every product ships with an official warranty", heading_bn: "প্রতিটি পণ্যে অফিসিয়াল ওয়ারেন্টি", text_en: "We register the warranty for you and handle claims within 3 working days. No running between shops.", cta_label_en: "Return & refund policy", cta_href: "/pages/refund", dark: true },
    },
    { block_type: "product_carousel", settings: { title_en: "New arrivals", source: "newest", source_slug: "", product_slugs: [], limit: 8, layout: "carousel", view_all_href: "/collection/new-arrivals" } },
    {
      block_type: "faq_accordion",
      settings: {
        title_en: "Frequently asked questions",
        items: [
          { question: "Do you deliver outside Dhaka?", answer: "Yes. 3-5 days to every district with cash on delivery. Inside Dhaka it is 1-2 days." },
          { question: "Are the products original?", answer: "Every item is sourced from the brand's authorised distributor and comes with the official warranty card." },
          { question: "Can I pay with bKash or Nagad?", answer: "Yes, choose Pay online at checkout. Cards are accepted too, and cash on delivery is available on every order." },
          { question: "What if the product is faulty?", answer: "Message us within 7 days for a replacement. After that the brand warranty applies and we handle the claim." },
        ],
        emit_schema: true,
      },
    },
    { block_type: "rich_text", settings: { heading_en: "About the store", body_markdown_en: "We are a small Dhaka-based team selling the accessories we use ourselves: **USB-C hubs, cables, chargers, audio and smart-home gadgets**.\n\n- Genuine stock only\n- Official warranty on everything\n- Real people on WhatsApp", width: "narrow" } },
  ].map((b) => ({ ...b, is_visible: true, visible_from: null, visible_until: null, locale: null }));
}

export async function seedContent(): Promise<{ blocks: number; menus: number; items: number }> {
  const admin = createAdminClient();

  // Home page: publish (replaces live rows, writes a revision, clears the draft)
  const blocks = homeBlocks();
  // nullable uuid params must be sent as explicit nulls (PostgREST drops undefined keys); the
  // generated Args type does not model nullability, hence the cast.
  const { data: n, error } = await admin.rpc("publish_page", { p_page_type: "home", p_target_id: null, p_blocks: blocks, p_label: "Seed home page", p_actor: null } as never);
  if (error) throw new Error(`publish_page: ${error.message}`);

  // Menus
  const menus = [
    { handle: "main", title: "Main menu" },
    { handle: "mobile", title: "Mobile menu" },
    { handle: "footer_col_1", title: "Footer: Shop" },
    { handle: "footer_col_2", title: "Footer: Help" },
    { handle: "footer_col_3", title: "Footer: Collections" },
    { handle: "footer_col_4", title: "Footer: Company" },
  ];
  const { data: menuRows, error: mErr } = await admin.from("navigation_menus").upsert(menus, { onConflict: "handle" }).select("id, handle");
  if (mErr) throw new Error(`navigation_menus: ${mErr.message}`);
  const menuId = new Map(menuRows!.map((m) => [m.handle, m.id]));

  // Items are replaced wholesale (seed owns them)
  await admin.from("navigation_items").delete().in("menu_id", [...menuId.values()]);
  const cats = [
    ["USB-C Hubs & Adapters", "usb-c-hubs-adapters"], ["Cables", "cables"], ["Chargers & Power Banks", "chargers-power-banks"], ["Audio", "audio"], ["Storage", "storage"], ["Phone Accessories", "phone-accessories"], ["Smart Home", "smart-home"],
  ] as const;
  const items: Record<string, unknown>[] = [];
  let pos = 0;
  items.push({
    menu_id: menuId.get("main"), label_en: "Shop", label_bn: "শপ", link_type: "category", link_target: "usb-c-hubs-adapters", is_mega: true, position: pos++,
    mega_layout: {
      columns: [
        { heading: "Categories", links: cats.map(([label, slug]) => ({ label, link_type: "category", link_target: slug })) },
        { heading: "Collections", links: [{ label: "Best sellers", link_type: "collection", link_target: "best-sellers" }, { label: "New arrivals", link_type: "collection", link_target: "new-arrivals" }, { label: "Under ৳1,000", link_type: "collection", link_target: "under-1000" }, { label: "Eid offers", link_type: "collection", link_target: "eid-offers" }] },
      ],
      featured: { image_url: img("ugreen-8-in-1-usb-c-hub", 0), heading: "UGREEN 8-in-1 hub", href: "/products/ugreen-8-in-1-usb-c-hub" },
    },
  });
  for (const [label, slug] of cats.slice(0, 5)) items.push({ menu_id: menuId.get("main"), label_en: label, link_type: "category", link_target: slug, position: pos++ });
  items.push({ menu_id: menuId.get("main"), label_en: "Eid offers", label_bn: "ঈদ অফার", link_type: "collection", link_target: "eid-offers", badge_label: "Sale", badge_color: "#FFC107", position: pos++ });

  pos = 0;
  for (const [label, slug] of cats) items.push({ menu_id: menuId.get("mobile"), label_en: label, link_type: "category", link_target: slug, position: pos++ });
  items.push({ menu_id: menuId.get("mobile"), label_en: "Eid offers", link_type: "collection", link_target: "eid-offers", badge_label: "Sale", badge_color: "#FFC107", position: pos++ });
  items.push({ menu_id: menuId.get("mobile"), label_en: "Track order", link_type: "url", link_target: "/track", position: pos++ });

  pos = 0;
  for (const [label, slug] of cats) items.push({ menu_id: menuId.get("footer_col_1"), label_en: label, link_type: "category", link_target: slug, position: pos++ });
  pos = 0;
  for (const [label, target] of [["Track your order", "/track"], ["Your account", "/account"], ["Terms & conditions", "/pages/terms"], ["Privacy policy", "/pages/privacy"], ["Return & refund policy", "/pages/refund"]]) items.push({ menu_id: menuId.get("footer_col_2"), label_en: label, link_type: "url", link_target: target, position: pos++ });
  pos = 0;
  for (const [label, slug] of [["Best sellers", "best-sellers"], ["New arrivals", "new-arrivals"], ["Under ৳1,000", "under-1000"], ["Eid offers", "eid-offers"]]) items.push({ menu_id: menuId.get("footer_col_3"), label_en: label, link_type: "collection", link_target: slug, position: pos++ });
  pos = 0;
  for (const [label, target] of [["About us", "/pages/about"], ["Contact", "/pages/contact"], ["Blog", "/blog"], ["Search", "/search"], ["Demo control panel", "/demo"]]) items.push({ menu_id: menuId.get("footer_col_4"), label_en: label, link_type: "url", link_target: target, position: pos++ });

  // bulk insert needs identical keys on every row
  const normalized = items.map((i) => ({ parent_id: null, label_bn: null, icon: null, badge_label: null, badge_color: null, is_mega: false, mega_layout: null, opens_new_tab: false, ...i }));
  const { error: iErr } = await admin.from("navigation_items").insert(normalized as never);
  if (iErr) throw new Error(`navigation_items: ${iErr.message}`);

  // Theme settings: insert defaults only when missing (admin edits survive re-seed)
  const { data: existing } = await admin.from("theme_settings").select("key");
  const have = new Set((existing ?? []).map((r) => r.key));
  const themeRows = [
    { key: "announcement", value: { enabled: true, text_en: "Free delivery inside Dhaka on orders over ৳2,000 · Eid offers live now", text_bn: "ঢাকার ভিতরে ২,০০০ টাকার বেশি অর্ডারে ফ্রি ডেলিভারি", href: "/collection/eid-offers", background_color: "#FFC107", text_color: "#1A1A1A", dismissible: true, visible_from: "", visible_until: "" } },
    { key: "header", value: { logo_image: "", logo_height: 36, mobile_logo_image: "", layout: "logo_left", sticky: true, transparent_over_hero: false, show_search: true, show_cart: true, show_track_order: true, show_phone: false, show_language_switcher: false, mobile_bottom_tab_bar: true } },
    { key: "footer", value: { columns: [{ heading_en: "Shop", menu_handle: "footer_col_1" }, { heading_en: "Help", menu_handle: "footer_col_2" }, { heading_en: "Collections", menu_handle: "footer_col_3" }, { heading_en: "Company", menu_handle: "footer_col_4" }], about_text_en: "Genuine tech accessories with official warranty, delivered across Bangladesh.", show_contact_block: true, trade_license: "TRAD/DSCC/012345/2026", tin: "", payment_badge_images: [], show_newsletter: false, copyright_en: "© {year} {store}. Cash on delivery, bKash, Nagad and cards accepted." } },
    { key: "brand", value: { primary_color: "#FFC107", ink_color: "#1A1A1A", bangla_numerals: false } },
  ].filter((r) => !have.has(r.key));
  if (themeRows.length) {
    const { error: tErr } = await admin.from("theme_settings").insert(themeRows as never);
    if (tErr) throw new Error(`theme_settings: ${tErr.message}`);
  }

  console.log(`[seed] content: ${n} home blocks, ${menus.length} menus, ${items.length} nav items, ${themeRows.length} theme rows`);
  return { blocks: n ?? 0, menus: menus.length, items: items.length };
}

/** Demo admin owner (DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD). Password is reset to the env value on every seed. */
export async function seedAdmin(): Promise<{ email: string; created: boolean }> {
  const admin = createAdminClient();
  const email = (process.env.DEMO_ADMIN_EMAIL ?? "admin@valuegadgetsbd.com").toLowerCase();
  const password = process.env.DEMO_ADMIN_PASSWORD ?? "demo-admin-1234";
  let userId: string | null = null;
  let created = false;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Store Owner" }, app_metadata: { seed: true, admin: true } });
  if (error) {
    for (let page = 1; page < 20 && !userId; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const hit = list?.users.find((u) => u.email?.toLowerCase() === email);
      if (hit) userId = hit.id;
      if (!list || list.users.length < 1000) break;
    }
    if (!userId) throw new Error(`createUser(admin): ${error.message}`);
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
  } else {
    userId = data.user.id;
    created = true;
  }
  const { error: aErr } = await admin.from("admin_users").upsert({ id: userId, email, full_name: "Store Owner", role: "owner", is_active: true }, { onConflict: "id" });
  if (aErr) throw new Error(`admin_users: ${aErr.message}`);
  console.log(`[seed] admin: ${email} (${created ? "created" : "existing"})`);
  return { email, created };
}

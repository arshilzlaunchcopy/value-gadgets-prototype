import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Default settings rows. This is a SEED file, so the brand name may appear here
 * (CLAUDE.md rule 9). Idempotent: existing keys are left untouched so admin
 * edits survive a re-seed.
 */
export const DEFAULT_SETTINGS: { key: string; is_public: boolean; value: unknown }[] = [
  {
    key: "store",
    is_public: true,
    value: {
      name: "Value Gadgets BD",
      tagline: "Genuine gadgets, delivered across Bangladesh",
      phone: "+8801700000000",
      whatsapp: "+8801700000000",
      email: "hello@valuegadgetsbd.com",
      address: "Shop 12, Level 3, Multiplan Center, New Elephant Road, Dhaka 1205",
      trade_license: "TRAD/DSCC/012345/2026",
      tin: "",
      facebook: "https://facebook.com/valuegadgetsbd",
      instagram: "",
      youtube: "",
      currency: "BDT",
    },
  },
  {
    key: "hero",
    is_public: true,
    value: {
      heading: "Genuine tech accessories, delivered anywhere in Bangladesh",
      subheading: "USB-C hubs, cables, GaN chargers, audio and smart-home gadgets. Official warranty, cash on delivery.",
      cta_label: "Shop Eid offers",
      cta_href: "/collection/eid-offers",
      secondary_label: "New arrivals",
      secondary_href: "/collection/new-arrivals",
    },
  },
  {
    key: "trust_badges",
    is_public: true,
    value: [
      { icon: "shield-check", title: "Official warranty", text: "6 to 24 months on every product" },
      { icon: "truck", title: "Fast delivery", text: "1-2 days in Dhaka, 3-5 nationwide" },
      { icon: "badge-check", title: "Verified seller", text: "Trade licensed, genuine stock" },
      { icon: "rotate-ccw", title: "Easy returns", text: "7-day replacement on faults" },
    ],
  },
  { key: "delivery", is_public: true, value: { return_days: 7, cod_available: true } },
  {
    key: "sms_templates",
    is_public: false,
    value: {
      otp: { en: "Your {store} verification code is {code}. Valid for {minutes} minutes.", bn: "আপনার {store} ভেরিফিকেশন কোড {code}। {minutes} মিনিটের জন্য বৈধ।" },
      order_confirmed: { en: "Order {order_number} confirmed. Total Tk {total}. Track: {url}", bn: "অর্ডার {order_number} নিশ্চিত হয়েছে। মোট {total} টাকা। ট্র্যাক: {url}" },
      shipped: { en: "Order {order_number} shipped via {courier}. Tracking: {tracking_id}", bn: "অর্ডার {order_number} {courier} এর মাধ্যমে পাঠানো হয়েছে। ট্র্যাকিং: {tracking_id}" },
      delivered: { en: "Order {order_number} delivered. Thank you! Review: {url}", bn: "অর্ডার {order_number} ডেলিভারি হয়েছে। ধন্যবাদ! রিভিউ: {url}" },
    },
  },
  { key: "fraud_thresholds", is_public: false, value: { review: 30, advance: 60, reverify_otp: 80, cod_auto_confirm_max: 3000, trusted_cod_multiplier: 2, auto_dispatch: true } },
  // empty districts = every district is serviced (PART2 §14.6 routes by district later)
  { key: "service_area", is_public: false, value: { districts: [] } },
  // courier raw status -> normalized status overrides (PART2 §14.4); defaults live in src/lib/courier/webhook.ts
  { key: "courier_status_map", is_public: false, value: {} },
  { key: "courier", is_public: false, value: { low_balance_warning_bdt: 5000, poll_stale_hours: 2 } },
  { key: "otp", is_public: false, value: { ttl_min: 5, per_phone_hour: 3, per_ip_hour: 10, cooldown_s: 60, max_failed: 5 } },
];

export async function seedSettings(): Promise<number> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("settings").select("key, value");
  const have = new Map((existing ?? []).map((r) => [r.key, r.value]));
  const rows = DEFAULT_SETTINGS.filter((s) => !have.has(s.key)).map((s) => ({ key: s.key, value: s.value as never, is_public: s.is_public }));
  if (rows.length) {
    const { error } = await admin.from("settings").insert(rows);
    if (error) throw new Error(`seed settings: ${error.message}`);
  }
  // Object-valued keys gain any NEW sub-keys added by later phases; admin edits to existing sub-keys survive.
  let merged = 0;
  for (const s of DEFAULT_SETTINGS) {
    const cur = have.get(s.key);
    if (!cur || typeof cur !== "object" || Array.isArray(cur) || typeof s.value !== "object" || Array.isArray(s.value)) continue;
    const missing = Object.keys(s.value as object).filter((k) => !(k in (cur as object)));
    if (!missing.length) continue;
    const { error } = await admin.from("settings").update({ value: { ...(s.value as object), ...(cur as object) } as never }).eq("key", s.key);
    if (!error) merged++;
  }
  console.log(`[seed] settings: ${rows.length} inserted, ${have.size} kept, ${merged} merged`);
  return rows.length;
}

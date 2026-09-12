import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SEED_IMAGES } from "./data/images.generated";

const img = (slug: string, i = 0): string => SEED_IMAGES[slug]?.[i]?.url ?? "";

/**
 * Pages (BUILD_PROMPT §4.7) with Bangla bodies (DBID compliance, PART2 §15.3),
 * two SEO blog posts, and the "seo" settings defaults. Idempotent: pages/posts
 * are inserted when missing, existing rows are left untouched (admin edits survive).
 */
const PAGES = [
  {
    slug: "about",
    title_en: "About us",
    title_bn: "আমাদের সম্পর্কে",
    position: 0,
    content_en: `We are a small Dhaka-based team selling the accessories we use ourselves: USB-C hubs, cables, GaN chargers, audio and smart-home gadgets.\n\n## What we promise\n\n- Genuine stock from authorised distributors\n- Official warranty on everything, registered by us\n- Cash on delivery to every district\n- Real people on WhatsApp, {phone}\n\n{store} operates under trade licence {trade_license}.`,
    content_bn: `আমরা ঢাকা-ভিত্তিক একটি ছোট দল, যে অ্যাক্সেসরিজ আমরা নিজেরা ব্যবহার করি সেগুলোই বিক্রি করি: ইউএসবি-সি হাব, কেবল, GaN চার্জার, অডিও এবং স্মার্ট-হোম গ্যাজেট।\n\n## আমাদের প্রতিশ্রুতি\n\n- অনুমোদিত পরিবেশকের আসল পণ্য\n- প্রতিটি পণ্যে অফিসিয়াল ওয়ারেন্টি, আমরাই রেজিস্টার করি\n- সব জেলায় ক্যাশ অন ডেলিভারি\n- হোয়াটসঅ্যাপে সত্যিকারের মানুষ, {phone}\n\n{store} ট্রেড লাইসেন্স {trade_license} এর অধীনে পরিচালিত।`,
  },
  {
    slug: "terms",
    title_en: "Terms & conditions",
    title_bn: "শর্তাবলী",
    position: 1,
    content_en: `These terms govern purchases from {store}. By placing an order you confirm that the phone number you verified is yours and that the delivery details are accurate.\n\n## Prices and payment\n\nPrices are in Bangladeshi taka and include VAT where applicable. Delivery charges are shown at checkout before you confirm. Online payments are processed by our payment gateway; we never store card details.\n\n## Cash on delivery\n\nCash-on-delivery orders may require phone confirmation or a small advance before dispatch. Repeated refused deliveries may lead to COD being unavailable for that number.\n\n## Warranty\n\nEvery product carries the brand warranty stated on its page. Warranty claims are handled by {store} on the customer's behalf within the brand's terms.\n\n## Contact\n\n{store}, {address}. Phone {phone}, email {email}.`,
    content_bn: `এই শর্তাবলী {store} থেকে কেনাকাটার ক্ষেত্রে প্রযোজ্য। অর্ডার দেওয়ার মাধ্যমে আপনি নিশ্চিত করছেন যে যাচাইকৃত ফোন নম্বরটি আপনার এবং ডেলিভারির তথ্য সঠিক।\n\n## মূল্য ও পেমেন্ট\n\nসব মূল্য বাংলাদেশি টাকায় এবং প্রযোজ্য ক্ষেত্রে ভ্যাট অন্তর্ভুক্ত। ডেলিভারি চার্জ চেকআউটে নিশ্চিত করার আগেই দেখানো হয়। অনলাইন পেমেন্ট আমাদের পেমেন্ট গেটওয়ে প্রক্রিয়া করে; আমরা কখনও কার্ডের তথ্য সংরক্ষণ করি না।\n\n## ক্যাশ অন ডেলিভারি\n\nক্যাশ অন ডেলিভারি অর্ডারে পাঠানোর আগে ফোনে নিশ্চিতকরণ বা সামান্য অগ্রিম প্রয়োজন হতে পারে। বারবার ডেলিভারি প্রত্যাখ্যান করলে সেই নম্বরে ক্যাশ অন ডেলিভারি বন্ধ হতে পারে।\n\n## ওয়ারেন্টি\n\nপ্রতিটি পণ্যে পণ্যের পাতায় উল্লেখিত ব্র্যান্ড ওয়ারেন্টি প্রযোজ্য। ওয়ারেন্টি দাবি {store} গ্রাহকের পক্ষে ব্র্যান্ডের শর্ত অনুযায়ী পরিচালনা করে।\n\n## যোগাযোগ\n\n{store}, {address}। ফোন {phone}, ইমেইল {email}।`,
  },
  {
    slug: "privacy",
    title_en: "Privacy policy",
    title_bn: "গোপনীয়তা নীতি",
    position: 2,
    content_en: `{store} collects your phone number, delivery address and order history to fulfil orders and provide support. We do not sell personal data.\n\n## Verification codes\n\nOne-time verification codes are sent by SMS and expire within minutes. They are stored hashed.\n\n## Payments\n\nPayment card details are handled by the payment gateway and never stored by us.\n\n## Your rights\n\nEmail {email} to view or delete the data we hold about you.`,
    content_bn: `{store} অর্ডার সম্পন্ন করা ও সহায়তা দেওয়ার জন্য আপনার ফোন নম্বর, ডেলিভারি ঠিকানা এবং অর্ডারের ইতিহাস সংগ্রহ করে। আমরা ব্যক্তিগত তথ্য বিক্রি করি না।\n\n## ভেরিফিকেশন কোড\n\nএককালীন ভেরিফিকেশন কোড এসএমএসে পাঠানো হয় এবং কয়েক মিনিটের মধ্যে মেয়াদ শেষ হয়। কোড হ্যাশ করে সংরক্ষিত হয়।\n\n## পেমেন্ট\n\nকার্ডের তথ্য পেমেন্ট গেটওয়ে পরিচালনা করে; আমরা কখনও সংরক্ষণ করি না।\n\n## আপনার অধিকার\n\nআপনার তথ্য দেখতে বা মুছতে {email} এ ইমেইল করুন।`,
  },
  {
    slug: "refund",
    title_en: "Return & refund policy",
    title_bn: "রিটার্ন ও রিফান্ড নীতি",
    position: 3,
    content_en: `Faulty items can be returned or exchanged within 7 days of delivery. Warranty claims after that period are handled through the brand warranty stated on the product page.\n\n## How to return\n\nMessage us on WhatsApp at {phone} with your order number and a photo or video of the fault. We arrange a courier pickup.\n\n## Refunds\n\nRefunds for prepaid orders are returned to the original payment method within 7 working days of the return being received. Cash-on-delivery orders are refunded by bKash.\n\n## Not covered\n\nPhysical damage, liquid damage and products without the original box and accessories.`,
    content_bn: `ত্রুটিপূর্ণ পণ্য ডেলিভারির ৭ দিনের মধ্যে ফেরত বা বদল করা যাবে। এরপরের ওয়ারেন্টি দাবি পণ্যের পাতায় উল্লেখিত ব্র্যান্ড ওয়ারেন্টির মাধ্যমে পরিচালিত হয়।\n\n## কীভাবে ফেরত দেবেন\n\nঅর্ডার নম্বর এবং ত্রুটির ছবি বা ভিডিওসহ {phone} নম্বরে হোয়াটসঅ্যাপে বার্তা দিন। আমরা কুরিয়ার পিকআপের ব্যবস্থা করি।\n\n## রিফান্ড\n\nপ্রিপেইড অর্ডারের রিফান্ড পণ্য ফেরত পাওয়ার ৭ কর্মদিবসের মধ্যে মূল পেমেন্ট মাধ্যমে ফেরত দেওয়া হয়। ক্যাশ অন ডেলিভারি অর্ডারের রিফান্ড বিকাশে দেওয়া হয়।\n\n## যা অন্তর্ভুক্ত নয়\n\nভৌত ক্ষতি, তরলের ক্ষতি এবং মূল বাক্স ও অ্যাক্সেসরিজ ছাড়া পণ্য।`,
  },
  {
    slug: "contact",
    title_en: "Contact us",
    title_bn: "যোগাযোগ",
    position: 4,
    content_en: `Fastest: WhatsApp us at {phone}, 10:00 to 20:00, Saturday to Thursday.\n\nShowroom and pickup point: {address}.\n\nFor warranty claims, send your order number and a short video of the issue.`,
    content_bn: `সবচেয়ে দ্রুত: {phone} নম্বরে হোয়াটসঅ্যাপ করুন, শনিবার থেকে বৃহস্পতিবার সকাল ১০টা থেকে রাত ৮টা।\n\nশোরুম ও পিকআপ পয়েন্ট: {address}।\n\nওয়ারেন্টি দাবির জন্য অর্ডার নম্বর এবং সমস্যার একটি ছোট ভিডিও পাঠান।`,
  },
];

const POSTS = [
  {
    slug: "best-usb-c-hubs-bangladesh-2026",
    title_en: "The best USB-C hubs you can buy in Bangladesh (2026)",
    excerpt_en: "One cable for HDMI, Ethernet, cards and charging: which hub fits a MacBook, a Windows ultrabook, or a Samsung phone, and what to check before paying.",
    content_en: `## Why a hub at all\n\nModern laptops ship with two USB-C ports and nothing else. A good hub turns one of them into a desk: monitor, wired internet, card reader and 100W charging pass-through.\n\n## What to check\n\n- **HDMI 4K@60Hz**, not 30Hz. 30Hz feels laggy on a desktop monitor.\n- **Power Delivery pass-through of 100W** so the laptop still charges at full speed.\n- **Gigabit Ethernet** if you do video calls; Wi-Fi drops are the number one complaint.\n- **Aluminium body** for heat. Plastic hubs throttle under load.\n\n## Our pick\n\nThe UGREEN 8-in-1 covers all four with a 12-month warranty we register for you.`,
    title_bn: "বাংলাদেশে সেরা ইউএসবি-সি হাব (২০২৬)",
    excerpt_bn: "এক কেবলে এইচডিএমআই, ইথারনেট, কার্ড রিডার ও চার্জিং: কোন হাব কোন ল্যাপটপের জন্য।",
    cover: "ugreen-8-in-1-usb-c-hub",
    author_name: "Store team",
    reading_minutes: 4,
    related: ["ugreen-8-in-1-usb-c-hub", "ugreen-usb-c-hdmi-adapter-4k60"],
  },
  {
    slug: "gan-charger-vs-normal-charger",
    title_en: "GaN charger vs. a normal charger: is 65W worth it?",
    excerpt_en: "GaN bricks are half the size and run cooler. Here is when the upgrade pays off and which wattage you actually need for a phone, tablet or laptop.",
    content_en: `## What GaN changes\n\nGallium nitride switches faster than silicon, so the charger wastes less energy as heat and can be much smaller for the same wattage.\n\n## Which wattage\n\n- **20-30W**: one phone, fast.\n- **45W**: phone plus tablet, or a small laptop slowly.\n- **65W**: most laptops at full speed, phone at the same time.\n\n## Cables matter\n\nA 65W charger with a 60W-rated cable charges at 60W. Buy a 100W-rated USB-C cable once and stop thinking about it.`,
    title_bn: "GaN চার্জার বনাম সাধারণ চার্জার",
    excerpt_bn: "GaN চার্জার অর্ধেক আকারের এবং কম গরম হয়। কখন আপগ্রেড সার্থক।",
    cover: "anker-735-ganprime-65w",
    author_name: "Store team",
    reading_minutes: 3,
    related: ["anker-735-ganprime-65w", "anker-powerline-iii-usb-c-100w"],
  },
];

export async function seedPages(): Promise<{ pages: number; posts: number }> {
  const admin = createAdminClient();
  const { data: existingPages } = await admin.from("pages").select("slug");
  const havePages = new Set((existingPages ?? []).map((p) => p.slug));
  const pageRows = PAGES.filter((p) => !havePages.has(p.slug)).map((p) => ({ ...p, is_published: true, show_in_footer: true }));
  if (pageRows.length) {
    const { error } = await admin.from("pages").insert(pageRows);
    if (error) throw new Error(`pages: ${error.message}`);
  }

  const { data: products } = await admin.from("products").select("id, slug");
  const idBySlug = new Map((products ?? []).map((p) => [p.slug, p.id]));
  const { data: existingPosts } = await admin.from("posts").select("slug");
  const havePosts = new Set((existingPosts ?? []).map((p) => p.slug));
  const postRows = POSTS.filter((p) => !havePosts.has(p.slug)).map((p, i) => ({
    slug: p.slug,
    title_en: p.title_en,
    excerpt_en: p.excerpt_en,
    content_en: p.content_en,
    title_bn: p.title_bn,
    excerpt_bn: p.excerpt_bn,
    content_bn: null,
    cover_image_url: img(p.cover, 0) || null,
    cover_alt: p.title_en,
    author_name: p.author_name,
    reading_minutes: p.reading_minutes,
    status: "published",
    published_at: new Date(Date.now() - (i + 3) * 86_400_000).toISOString(),
    related_product_ids: p.related.map((s) => idBySlug.get(s)).filter((x): x is string => Boolean(x)),
  }));
  if (postRows.length) {
    const { error } = await admin.from("posts").insert(postRows);
    if (error) throw new Error(`posts: ${error.message}`);
  }
  console.log(`[seed] pages: ${pageRows.length} pages, ${postRows.length} posts inserted`);
  return { pages: pageRows.length, posts: postRows.length };
}

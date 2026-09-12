/** Bangla names (Latin + Bangla script), geography and review copy for the seed. */

export const FIRST_NAMES: { en: string; bn: string; g: "m" | "f" }[] = [
  { en: "Rahim", bn: "রহিম", g: "m" }, { en: "Karim", bn: "করিম", g: "m" }, { en: "Sakib", bn: "সাকিব", g: "m" }, { en: "Tanvir", bn: "তানভীর", g: "m" },
  { en: "Rafi", bn: "রাফি", g: "m" }, { en: "Nayeem", bn: "নাঈম", g: "m" }, { en: "Shuvo", bn: "শুভ", g: "m" }, { en: "Mehedi", bn: "মেহেদী", g: "m" },
  { en: "Arif", bn: "আরিফ", g: "m" }, { en: "Fahim", bn: "ফাহিম", g: "m" }, { en: "Imran", bn: "ইমরান", g: "m" }, { en: "Sabbir", bn: "সাব্বির", g: "m" },
  { en: "Rakib", bn: "রাকিব", g: "m" }, { en: "Jubayer", bn: "জুবায়ের", g: "m" }, { en: "Hasan", bn: "হাসান", g: "m" }, { en: "Mahmud", bn: "মাহমুদ", g: "m" },
  { en: "Rifat", bn: "রিফাত", g: "m" }, { en: "Tamim", bn: "তামিম", g: "m" }, { en: "Nasir", bn: "নাসির", g: "m" }, { en: "Asif", bn: "আসিফ", g: "m" },
  { en: "Sumaiya", bn: "সুমাইয়া", g: "f" }, { en: "Nusrat", bn: "নুসরাত", g: "f" }, { en: "Farzana", bn: "ফারজানা", g: "f" }, { en: "Tasnim", bn: "তাসনিম", g: "f" },
  { en: "Mim", bn: "মিম", g: "f" }, { en: "Sadia", bn: "সাদিয়া", g: "f" }, { en: "Jannat", bn: "জান্নাত", g: "f" }, { en: "Ayesha", bn: "আয়েশা", g: "f" },
  { en: "Rima", bn: "রিমা", g: "f" }, { en: "Sharmin", bn: "শারমিন", g: "f" }, { en: "Maliha", bn: "মালিহা", g: "f" }, { en: "Nabila", bn: "নাবিলা", g: "f" },
  { en: "Tania", bn: "তানিয়া", g: "f" }, { en: "Priya", bn: "প্রিয়া", g: "f" }, { en: "Anika", bn: "আনিকা", g: "f" },
];

export const SURNAMES: { en: string; bn: string; g?: "m" | "f" }[] = [
  { en: "Ahmed", bn: "আহমেদ" }, { en: "Hossain", bn: "হোসেন" }, { en: "Islam", bn: "ইসলাম" }, { en: "Rahman", bn: "রহমান" }, { en: "Khan", bn: "খান" },
  { en: "Chowdhury", bn: "চৌধুরী" }, { en: "Sarkar", bn: "সরকার" }, { en: "Uddin", bn: "উদ্দিন", g: "m" }, { en: "Mia", bn: "মিয়া", g: "m" }, { en: "Haque", bn: "হক" },
  { en: "Siddique", bn: "সিদ্দিক" }, { en: "Bhuiyan", bn: "ভূঁইয়া" }, { en: "Talukder", bn: "তালুকদার" }, { en: "Das", bn: "দাস" }, { en: "Roy", bn: "রায়" },
  { en: "Akter", bn: "আক্তার", g: "f" }, { en: "Sultana", bn: "সুলতানা", g: "f" }, { en: "Begum", bn: "বেগম", g: "f" },
];

/** District weighting reflects where BD ecommerce orders actually come from. */
export const DISTRICT_WEIGHTS: [division: string, district: string, weight: number][] = [
  ["Dhaka", "Dhaka", 45], ["Chattogram", "Chattogram", 12], ["Dhaka", "Gazipur", 6], ["Dhaka", "Narayanganj", 5],
  ["Sylhet", "Sylhet", 4], ["Rajshahi", "Rajshahi", 4], ["Khulna", "Khulna", 4], ["Chattogram", "Cumilla", 3],
  ["Rangpur", "Rangpur", 2], ["Mymensingh", "Mymensingh", 2], ["Barishal", "Barishal", 2], ["Rajshahi", "Bogura", 2],
  ["Khulna", "Jashore", 2], ["Chattogram", "Cox's Bazar", 1], ["Dhaka", "Tangail", 1], ["Chattogram", "Feni", 1],
  ["Rangpur", "Dinajpur", 1], ["Sylhet", "Moulvibazar", 1], ["Rajshahi", "Pabna", 1], ["Khulna", "Kushtia", 1],
];

export const DHAKA_AREAS = ["Mirpur", "Dhanmondi", "Uttara", "Banani", "Gulshan", "Mohammadpur", "Bashundhara R/A", "Badda", "Khilgaon", "Motijheel", "Tejgaon", "Wari", "Jatrabari", "Rampura", "Mohakhali", "Lalmatia", "Shyamoli", "Malibagh"];
export const CTG_AREAS = ["Agrabad", "GEC Circle", "Halishahar", "Panchlaish", "Khulshi", "Nasirabad", "Chawkbazar", "Bahaddarhat"];

export const STREET_TEMPLATES = [
  "House {h}, Road {r}", "Flat {f}, House {h}, Road {r}", "{h}/{r} {a} Road", "Holding {h}, Lane {r}", "House {h}, Block {b}, Road {r}",
];

export const LANDMARKS = ["near the mosque", "opposite the pharmacy", "beside Agrani Bank", "next to the school gate", "behind the market", "", "", ""];

export const UTM = {
  sources: [["facebook", 55], ["google", 20], ["instagram", 12], ["youtube", 5], ["tiktok", 4], ["whatsapp", 4]] as [string, number][],
  mediums: { facebook: "paid_social", instagram: "paid_social", tiktok: "paid_social", google: "cpc", youtube: "video", whatsapp: "referral" } as Record<string, string>,
  campaigns: ["eid-offers-2026", "usb-c-hub-launch", "power-bank-week", "back-to-campus", "retargeting-cart", "brand-search"],
};

export const REVIEW_TEXT: Record<number, { titles: string[]; bodies: string[] }> = {
  5: {
    titles: ["Excellent product", "Exactly as described", "Worth every taka", "Fast delivery, original item", "Best purchase this year"],
    bodies: [
      "Genuine product with the official box. Delivery inside Dhaka took just one day. Highly recommended.",
      "Working perfectly with my laptop. The build quality is much better than the cheap ones in Multiplan.",
      "Got it in Chattogram in three days via courier. Packaging was solid and everything works.",
      "Second time buying from this shop. Original products, honest pricing, quick replies on WhatsApp.",
      "খুবই ভালো প্রোডাক্ট। অরিজিনাল এবং দ্রুত ডেলিভারি পেয়েছি। ধন্যবাদ।",
      "Charging speed matches the spec exactly. No heating issue after two weeks of use.",
    ],
  },
  4: {
    titles: ["Good value", "Works well", "Happy with it", "Solid, minor complaint"],
    bodies: [
      "Does what it says. Cable is a bit short for my desk setup but the quality is good.",
      "Good product, delivery took a day longer than promised. Would buy again.",
      "ভালো প্রোডাক্ট, দামটা একটু বেশি মনে হয়েছে। তবে কোয়ালিটি ঠিক আছে।",
      "Works fine with my phone and tablet. Box had a small dent but the item was perfect.",
    ],
  },
  3: {
    titles: ["Okay", "Average", "Mixed feelings"],
    bodies: ["It works but gets warm under load. Support replied quickly at least.", "Decent for the price. Expected slightly better finish.", "মোটামুটি। কাজ করে কিন্তু আশানুরূপ নয়।"],
  },
  2: {
    titles: ["Not as expected", "Disappointed"],
    bodies: ["Stopped charging at full speed after a week. Shop offered a replacement under warranty though.", "Delivery was late by four days and the box was damaged. Product itself is fine."],
  },
  1: {
    titles: ["Faulty unit", "Do not recommend"],
    bodies: ["Dead on arrival. Return was accepted, still waiting for the refund.", "Did not match the description. Returned it."],
  },
};

export const ADMIN_REPLIES = [
  "Thank you for your review! We are glad it is working well.",
  "Sorry about the delay - courier volumes were high that week. We have credited ৳50 to your next order.",
  "Thanks for the feedback. Warranty claims are handled within 3 working days; please message us on WhatsApp.",
  "ধন্যবাদ আপনার রিভিউর জন্য!",
];

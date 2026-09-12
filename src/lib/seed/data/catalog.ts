/**
 * Seed catalog: 6 brands, 7 categories, 4 collections, 40 products.
 * Prices are whole taka (int). cost_bdt is admin-only margin data.
 */
export interface SeedBrand {
  slug: string;
  name: string;
}
export interface SeedCategory {
  slug: string;
  name_en: string;
  name_bn: string;
  description_en: string;
  position: number;
}
export interface SeedCollection {
  slug: string;
  title_en: string;
  title_bn: string;
  description_en: string;
  position: number;
  /** product slugs; "auto" collections fill from rules */
  products?: string[];
  rules?: Record<string, unknown>;
}
export interface SeedVariant {
  option_value: string;
  sku_suffix: string;
  stock: number;
}
export interface SeedProduct {
  slug: string;
  title_en: string;
  title_bn?: string;
  brand: string;
  category: string;
  price: number;
  compare_at?: number;
  cost: number;
  stock: number;
  warranty_months: number;
  short: string;
  highlights: string[];
  specs: [string, string][];
  featured?: boolean;
  /** when present, one variant per entry (option_name = "Color") */
  colors?: SeedVariant[];
  weight_grams: number;
}

export const BRANDS: SeedBrand[] = [
  { slug: "anker", name: "Anker" },
  { slug: "baseus", name: "Baseus" },
  { slug: "ugreen", name: "UGREEN" },
  { slug: "xiaomi", name: "Xiaomi" },
  { slug: "jbl", name: "JBL" },
  { slug: "orico", name: "ORICO" },
];

export const CATEGORIES: SeedCategory[] = [
  { slug: "usb-c-hubs-adapters", name_en: "USB-C Hubs & Adapters", name_bn: "ইউএসবি-সি হাব ও অ্যাডাপ্টার", description_en: "Expand your laptop with HDMI, USB, card readers and Ethernet.", position: 1 },
  { slug: "cables", name_en: "Cables", name_bn: "ক্যাবল", description_en: "USB-C, Lightning and HDMI cables that last.", position: 2 },
  { slug: "chargers-power-banks", name_en: "Chargers & Power Banks", name_bn: "চার্জার ও পাওয়ার ব্যাংক", description_en: "GaN chargers and high-capacity power banks.", position: 3 },
  { slug: "audio", name_en: "Audio", name_bn: "অডিও", description_en: "Earbuds, headphones and portable speakers.", position: 4 },
  { slug: "storage", name_en: "Storage", name_bn: "স্টোরেজ", description_en: "Enclosures, card readers and flash drives.", position: 5 },
  { slug: "phone-accessories", name_en: "Phone Accessories", name_bn: "ফোন অ্যাক্সেসরিজ", description_en: "Mounts, stands, tripods and wallets.", position: 6 },
  { slug: "smart-home", name_en: "Smart Home", name_bn: "স্মার্ট হোম", description_en: "Wi-Fi bulbs, plugs and small gadgets for the home.", position: 7 },
];

export const COLLECTIONS: SeedCollection[] = [
  { slug: "new-arrivals", title_en: "New Arrivals", title_bn: "নতুন পণ্য", description_en: "Just landed.", position: 1, rules: { sort: "newest", limit: 12 } },
  { slug: "best-sellers", title_en: "Best Sellers", title_bn: "সর্বাধিক বিক্রিত", description_en: "What everyone is buying.", position: 2, products: ["ugreen-8-in-1-usb-c-hub", "anker-powerline-iii-usb-c-100w", "baseus-20000mah-65w-power-bank", "jbl-tune-510bt", "anker-735-ganprime-65w", "xiaomi-redmi-buds-4-lite", "ugreen-usb-c-hdmi-adapter-4k60", "baseus-crystal-shine-100w-cable"] },
  { slug: "under-1000", title_en: "Under ৳1,000", title_bn: "১,০০০ টাকার নিচে", description_en: "Small price, real quality.", position: 3, rules: { max_price_bdt: 1000 } },
  { slug: "eid-offers", title_en: "Eid Offers", title_bn: "ঈদ অফার", description_en: "Limited-time Eid discounts.", position: 4, rules: { on_sale: true } },
];

export const PRODUCTS: SeedProduct[] = [
  // ---------------------------------------------------------------- hubs
  {
    slug: "ugreen-8-in-1-usb-c-hub", title_en: "UGREEN 8-in-1 USB-C Hub (4K HDMI, 100W PD, SD/TF, Gigabit Ethernet)", title_bn: "ইউগ্রিন ৮-ইন-১ ইউএসবি-সি হাব", brand: "ugreen", category: "usb-c-hubs-adapters",
    price: 3850, compare_at: 4500, cost: 2700, stock: 42, warranty_months: 12, featured: true, weight_grams: 95,
    short: "One cable for HDMI 4K@60Hz, three USB 3.0 ports, SD and TF readers, Gigabit Ethernet and 100W pass-through charging.",
    highlights: ["4K@60Hz HDMI output", "100W USB-C Power Delivery pass-through", "3x USB 3.0 at 5Gbps", "Gigabit RJ45 Ethernet", "SD + microSD card slots", "Aluminium shell, braided cable"],
    specs: [["Ports", "HDMI, 3x USB-A 3.0, USB-C PD, RJ45, SD, TF"], ["HDMI", "4K@60Hz"], ["Power delivery", "100W in / 85W out"], ["Data", "5Gbps"], ["Ethernet", "10/100/1000 Mbps"], ["Cable", "15 cm, braided"], ["Material", "Aluminium alloy"]],
  },
  {
    slug: "anker-7-in-1-usb-c-hub", title_en: "Anker 7-in-1 USB-C Hub with 4K HDMI and 100W PD", brand: "anker", category: "usb-c-hubs-adapters",
    price: 4990, cost: 3600, stock: 28, warranty_months: 18, weight_grams: 110,
    short: "Anker PowerExpand hub with 4K HDMI, two USB-A, USB-C data, SD/microSD and 100W charging pass-through.",
    highlights: ["4K@30Hz HDMI", "100W Power Delivery", "USB-C data port 5Gbps", "SD / microSD readers", "18-month Anker warranty"],
    specs: [["Ports", "HDMI, 2x USB-A, USB-C data, USB-C PD, SD, TF"], ["HDMI", "4K@30Hz"], ["Power delivery", "100W in / 85W out"], ["Data", "5Gbps"], ["Cable", "12 cm"]],
  },
  {
    slug: "baseus-6-in-1-type-c-hub", title_en: "Baseus 6-in-1 Type-C Hub (HDMI, USB 3.0, PD 100W)", brand: "baseus", category: "usb-c-hubs-adapters",
    price: 2650, compare_at: 3200, cost: 1850, stock: 3, warranty_months: 6, weight_grams: 78,
    short: "Compact six-port hub for MacBook and Windows laptops with 4K HDMI and 100W charging.",
    highlights: ["4K@30Hz HDMI", "2x USB 3.0 + 1x USB 2.0", "100W PD charging", "Plug and play", "Pocket-sized"],
    specs: [["Ports", "HDMI, 2x USB 3.0, USB 2.0, USB-C PD, TF"], ["HDMI", "4K@30Hz"], ["Power delivery", "100W"], ["Length", "9.8 cm"]],
  },
  {
    slug: "ugreen-usb-c-hdmi-adapter-4k60", title_en: "UGREEN USB-C to HDMI Adapter 4K@60Hz", brand: "ugreen", category: "usb-c-hubs-adapters",
    price: 1250, cost: 820, stock: 65, warranty_months: 12, weight_grams: 30,
    short: "Thunderbolt 3 / USB-C to HDMI 2.0 adapter for crisp 4K at 60Hz.",
    highlights: ["4K@60Hz, HDR", "Works with MacBook, iPad Pro, Galaxy DeX", "Nylon-braided cable", "No driver needed"],
    specs: [["Input", "USB-C (DP Alt Mode)"], ["Output", "HDMI 2.0"], ["Resolution", "3840x2160 @ 60Hz"], ["Cable", "15 cm"]],
  },
  {
    slug: "orico-4-port-usb-3-hub", title_en: "ORICO 4-Port USB 3.0 Hub with 30cm Cable", brand: "orico", category: "usb-c-hubs-adapters",
    price: 890, compare_at: 1100, cost: 560, stock: 80, warranty_months: 12, weight_grams: 45,
    short: "Four SuperSpeed USB 3.0 ports from one USB-A port. Ideal for desktops and older laptops.",
    highlights: ["4x USB 3.0, 5Gbps", "Backwards compatible with USB 2.0", "30 cm cable", "ABS shell"],
    specs: [["Ports", "4x USB-A 3.0"], ["Speed", "5Gbps"], ["Cable", "30 cm"], ["Power", "Bus powered"]],
  },
  {
    slug: "ugreen-usb-c-gigabit-ethernet", title_en: "UGREEN USB-C to Gigabit Ethernet Adapter", brand: "ugreen", category: "usb-c-hubs-adapters",
    price: 1450, cost: 980, stock: 35, warranty_months: 12, weight_grams: 32,
    short: "Wired 1000Mbps networking for laptops without an RJ45 port.",
    highlights: ["10/100/1000 Mbps", "Driver-free on macOS, Windows, Linux, ChromeOS", "Aluminium body", "Status LED"],
    specs: [["Interface", "USB-C 3.0"], ["Speed", "1000 Mbps"], ["Chipset", "Realtek RTL8153"], ["Cable", "10 cm"]],
  },
  {
    slug: "baseus-usb-c-to-3-5mm-pd-adapter", title_en: "Baseus USB-C to 3.5mm Audio + PD Charging Adapter", brand: "baseus", category: "usb-c-hubs-adapters",
    price: 750, cost: 480, stock: 50, warranty_months: 6, weight_grams: 15,
    short: "Listen with wired earphones and charge at the same time on phones without a headphone jack.",
    highlights: ["Hi-Res DAC", "Up to 60W PD pass-through", "Works with Samsung, Pixel, iPad", "Aluminium alloy"],
    specs: [["Input", "USB-C"], ["Outputs", "3.5 mm, USB-C PD"], ["Charging", "60W max"], ["DAC", "24-bit / 96 kHz"]],
  },
  // -------------------------------------------------------------- cables
  {
    slug: "anker-powerline-iii-usb-c-100w", title_en: "Anker PowerLine III USB-C to USB-C 100W Cable (1.8m)", brand: "anker", category: "cables",
    price: 1290, compare_at: 1590, cost: 820, stock: 120, warranty_months: 12, featured: true, weight_grams: 45,
    short: "The cable Anker guarantees for 25,000 bends. 100W charging for laptops, tablets and phones.",
    highlights: ["100W (20V/5A) charging", "25,000-bend lifespan", "480Mbps data", "USB-IF certified"],
    specs: [["Connectors", "USB-C to USB-C"], ["Power", "100W"], ["Data", "USB 2.0, 480Mbps"], ["Length", "1.8 m"], ["Jacket", "TPE"]],
  },
  {
    slug: "baseus-crystal-shine-100w-cable", title_en: "Baseus Crystal Shine 100W USB-C to USB-C Cable (2m)", brand: "baseus", category: "cables",
    price: 690, cost: 400, stock: 0, warranty_months: 6, weight_grams: 55,
    short: "Transparent-tip braided cable with a 100W E-marker chip.",
    highlights: ["100W fast charging", "E-marker chip", "Nylon braid", "2 metres"],
    specs: [["Connectors", "USB-C to USB-C"], ["Power", "100W"], ["Data", "480Mbps"], ["Length", "2 m"]],
    colors: [{ option_value: "Black", sku_suffix: "BLK", stock: 0 }, { option_value: "Purple", sku_suffix: "PUR", stock: 0 }],
  },
  {
    slug: "ugreen-usb-c-lightning-mfi-1m", title_en: "UGREEN USB-C to Lightning MFi Certified Cable (1m)", brand: "ugreen", category: "cables",
    price: 1650, cost: 1100, stock: 40, warranty_months: 12, weight_grams: 30,
    short: "Apple MFi certified for fast charging iPhone from any USB-C charger.",
    highlights: ["MFi certified", "Fast charge iPhone 50% in 30 min", "Braided nylon", "Aluminium connectors"],
    specs: [["Connectors", "USB-C to Lightning"], ["Certification", "Apple MFi"], ["Power", "PD 20W+"], ["Length", "1 m"]],
  },
  {
    slug: "baseus-3-in-1-cable", title_en: "Baseus 3-in-1 Charging Cable (USB-C, Lightning, Micro-USB)", brand: "baseus", category: "cables",
    price: 550, compare_at: 700, cost: 320, stock: 90, warranty_months: 6, weight_grams: 40,
    short: "One cable for every device in the house.",
    highlights: ["3 connectors", "3.5A charging", "1.2 m braided", "Zinc alloy heads"],
    specs: [["Connectors", "USB-A to USB-C / Lightning / Micro-USB"], ["Current", "3.5A"], ["Length", "1.2 m"]],
  },
  {
    slug: "ugreen-hdmi-2-1-8k-cable-2m", title_en: "UGREEN HDMI 2.1 8K Ultra High Speed Cable (2m)", brand: "ugreen", category: "cables",
    price: 1350, cost: 850, stock: 25, warranty_months: 12, weight_grams: 120,
    short: "48Gbps HDMI 2.1 for 8K@60Hz and 4K@120Hz on PS5, Xbox Series X and modern TVs.",
    highlights: ["8K@60Hz / 4K@120Hz", "48Gbps", "eARC, VRR, ALLM", "Gold-plated"],
    specs: [["Standard", "HDMI 2.1"], ["Bandwidth", "48Gbps"], ["Length", "2 m"], ["Shielding", "Triple"]],
  },
  {
    slug: "ugreen-usb-a-to-usb-c-3a-1m", title_en: "UGREEN USB-A to USB-C 3A Fast Charging Cable (1m)", brand: "ugreen", category: "cables",
    price: 350, cost: 190, stock: 200, warranty_months: 6, weight_grams: 25,
    short: "Everyday charging cable with 3A output and a braided jacket.",
    highlights: ["3A / QC 3.0", "Nylon braid", "10,000 bend tested"],
    specs: [["Connectors", "USB-A to USB-C"], ["Current", "3A"], ["Length", "1 m"]],
  },
  {
    slug: "anker-usb-c-lightning-0-9m", title_en: "Anker 541 USB-C to Lightning Cable (0.9m)", brand: "anker", category: "cables",
    price: 1850, cost: 1250, stock: 4, warranty_months: 12, weight_grams: 28,
    short: "Bio-based MFi cable for iPhone with fast charging support.",
    highlights: ["MFi certified", "Bio-based jacket", "20,000 bends", "Fast charge"],
    specs: [["Connectors", "USB-C to Lightning"], ["Certification", "Apple MFi"], ["Length", "0.9 m"]],
  },
  // -------------------------------------------------- chargers / power banks
  {
    slug: "anker-735-ganprime-65w", title_en: "Anker 735 GaNPrime 65W 3-Port Charger", brand: "anker", category: "chargers-power-banks",
    price: 5490, compare_at: 6200, cost: 4000, stock: 22, warranty_months: 18, featured: true, weight_grams: 132,
    short: "Charge a laptop, tablet and phone from one compact GaN brick.",
    highlights: ["65W total, 2x USB-C + 1x USB-A", "PowerIQ 4.0 smart allocation", "GaNPrime, 53% smaller", "ActiveShield 2.0 temperature monitoring"],
    specs: [["Output", "65W max"], ["Ports", "2x USB-C, 1x USB-A"], ["Input", "100-240V"], ["Size", "66 x 38 x 29 mm"], ["Weight", "132 g"]],
  },
  {
    slug: "baseus-20000mah-65w-power-bank", title_en: "Baseus Blade 20000mAh 65W Laptop Power Bank", brand: "baseus", category: "chargers-power-banks",
    price: 3400, cost: 2400, stock: 30, warranty_months: 12, featured: true, weight_grams: 460,
    short: "Slim power bank that charges a MacBook Air, with a digital display.",
    highlights: ["65W USB-C output", "20000mAh / 74Wh", "Digital display", "Charges 4 devices", "Airline safe"],
    specs: [["Capacity", "20000mAh"], ["Output", "65W USB-C, 30W USB-A"], ["Input", "65W USB-C"], ["Ports", "2x USB-C, 2x USB-A"], ["Weight", "460 g"]],
  },
  {
    slug: "xiaomi-33w-charger-with-cable", title_en: "Xiaomi 33W Fast Charger with USB-C Cable", brand: "xiaomi", category: "chargers-power-banks",
    price: 1190, cost: 780, stock: 70, warranty_months: 6, weight_grams: 60,
    short: "Original Xiaomi 33W turbo charger, cable included.",
    highlights: ["33W turbo charge", "USB-A output", "Includes 1m USB-C cable", "Overcurrent protection"],
    specs: [["Output", "33W max"], ["Port", "USB-A"], ["Cable", "USB-A to USB-C, 1 m"]],
  },
  {
    slug: "ugreen-nexode-100w-gan-4-port", title_en: "UGREEN Nexode 100W GaN 4-Port Desktop Charger", brand: "ugreen", category: "chargers-power-banks",
    price: 6990, compare_at: 7800, cost: 5200, stock: 12, warranty_months: 24, weight_grams: 210,
    short: "Charge a MacBook Pro 16 and three more devices from one 100W GaN charger.",
    highlights: ["100W total", "3x USB-C + 1x USB-A", "GaN II tech", "Thermal Guard"],
    specs: [["Output", "100W max"], ["Ports", "3x USB-C, 1x USB-A"], ["Input", "100-240V"], ["Weight", "210 g"]],
  },
  {
    slug: "anker-20w-nano-usb-c", title_en: "Anker Nano 20W USB-C Charger", brand: "anker", category: "chargers-power-banks",
    price: 1150, cost: 720, stock: 95, warranty_months: 18, weight_grams: 30,
    short: "Tiny 20W charger for iPhone and Android fast charging.",
    highlights: ["20W PD", "Half the size of a 20W stock charger", "MultiProtect safety"],
    specs: [["Output", "20W"], ["Port", "USB-C"], ["Size", "45 x 27 x 27 mm"]],
  },
  {
    slug: "baseus-10000mah-magnetic-power-bank", title_en: "Baseus Magnetic 10000mAh 22.5W Power Bank (MagSafe compatible)", brand: "baseus", category: "chargers-power-banks",
    price: 2290, compare_at: 2700, cost: 1600, stock: 0, warranty_months: 12, weight_grams: 220,
    short: "Snaps onto iPhone 12-16 for 15W wireless charging on the go.",
    highlights: ["Magnetic 15W wireless", "22.5W wired", "10000mAh", "Foldable stand"],
    specs: [["Capacity", "10000mAh"], ["Wireless", "15W"], ["Wired", "22.5W USB-C"], ["Weight", "220 g"]],
  },
  {
    slug: "xiaomi-20000mah-22-5w-power-bank-3", title_en: "Xiaomi 20000mAh 22.5W Power Bank 3", brand: "xiaomi", category: "chargers-power-banks",
    price: 2650, cost: 1900, stock: 45, warranty_months: 6, weight_grams: 430,
    short: "Big, reliable, three-port power bank with 22.5W fast charging.",
    highlights: ["20000mAh", "22.5W max", "USB-C in/out", "Charges 3 devices"],
    specs: [["Capacity", "20000mAh"], ["Output", "22.5W"], ["Ports", "2x USB-A, 1x USB-C"], ["Weight", "430 g"]],
  },
  // --------------------------------------------------------------- audio
  {
    slug: "jbl-tune-510bt", title_en: "JBL Tune 510BT Wireless On-Ear Headphones", title_bn: "জেবিএল টিউন ৫১০বিটি", brand: "jbl", category: "audio",
    price: 4290, compare_at: 4990, cost: 3200, stock: 18, warranty_months: 12, featured: true, weight_grams: 160,
    short: "JBL Pure Bass sound, 40 hours of battery and multipoint Bluetooth.",
    highlights: ["JBL Pure Bass", "40h battery", "Bluetooth 5.0 multipoint", "Speed charge: 5 min = 2 h", "Foldable"],
    specs: [["Driver", "32 mm"], ["Bluetooth", "5.0"], ["Battery", "40 h"], ["Charging", "USB-C, 2 h"], ["Weight", "160 g"]],
    colors: [{ option_value: "Black", sku_suffix: "BLK", stock: 12 }, { option_value: "Blue", sku_suffix: "BLU", stock: 6 }],
  },
  {
    slug: "xiaomi-redmi-buds-4-lite", title_en: "Xiaomi Redmi Buds 4 Lite TWS Earbuds", brand: "xiaomi", category: "audio",
    price: 1890, cost: 1350, stock: 3, warranty_months: 6, weight_grams: 38,
    short: "Light, comfortable earbuds with 20 hours total playback and AI call noise cancellation.",
    highlights: ["20h total battery", "Bluetooth 5.3", "AI call noise reduction", "IP54", "Google Fast Pair"],
    specs: [["Driver", "12 mm"], ["Bluetooth", "5.3"], ["Battery", "5 h + 15 h case"], ["Water resistance", "IP54"]],
  },
  {
    slug: "baseus-bowie-e5x-tws", title_en: "Baseus Bowie E5x True Wireless Earbuds", brand: "baseus", category: "audio",
    price: 1990, compare_at: 2400, cost: 1300, stock: 40, warranty_months: 6, weight_grams: 42,
    short: "Low-latency gaming mode, ENC calls and 30 hours with the case.",
    highlights: ["30h total", "0.038 s low latency", "ENC calls", "Bluetooth 5.3"],
    specs: [["Driver", "13 mm"], ["Bluetooth", "5.3"], ["Battery", "6 h + 24 h case"], ["Charging", "USB-C"]],
  },
  {
    slug: "anker-soundcore-r50i", title_en: "Anker Soundcore R50i True Wireless Earbuds", brand: "anker", category: "audio",
    price: 2190, cost: 1550, stock: 33, warranty_months: 18, weight_grams: 45,
    short: "Big bass, 30-hour battery and 22 preset EQs in the Soundcore app.",
    highlights: ["30h playtime", "Bass boost", "22 EQ presets", "IPX5", "Fast pair"],
    specs: [["Driver", "10 mm"], ["Bluetooth", "5.3"], ["Battery", "10 h + 20 h case"], ["Water resistance", "IPX5"]],
  },
  {
    slug: "jbl-go-3-speaker", title_en: "JBL Go 3 Portable Bluetooth Speaker", brand: "jbl", category: "audio",
    price: 3690, cost: 2750, stock: 20, warranty_months: 12, weight_grams: 209,
    short: "Pocket speaker with JBL Pro Sound and IP67 waterproofing.",
    highlights: ["JBL Pro Sound", "IP67 waterproof + dustproof", "5h battery", "Bluetooth 5.1"],
    specs: [["Output", "4.2W"], ["Battery", "5 h"], ["Water resistance", "IP67"], ["Weight", "209 g"]],
    colors: [{ option_value: "Black", sku_suffix: "BLK", stock: 12 }, { option_value: "Red", sku_suffix: "RED", stock: 8 }],
  },
  {
    slug: "ugreen-bluetooth-5-3-audio-receiver", title_en: "UGREEN Bluetooth 5.3 Audio Receiver for Car and Speakers", brand: "ugreen", category: "audio",
    price: 990, cost: 620, stock: 55, warranty_months: 12, weight_grams: 20,
    short: "Add Bluetooth to any 3.5mm speaker or car stereo.",
    highlights: ["Bluetooth 5.3", "Hands-free calls", "10h battery", "Dual connection"],
    specs: [["Bluetooth", "5.3"], ["Output", "3.5 mm"], ["Battery", "10 h"], ["Range", "10 m"]],
  },
  // ------------------------------------------------------------- storage
  {
    slug: "orico-2-5-sata-enclosure-usb-c", title_en: "ORICO 2.5\" SATA to USB-C 3.1 Hard Drive Enclosure", brand: "orico", category: "storage",
    price: 1150, cost: 720, stock: 48, warranty_months: 12, weight_grams: 60,
    short: "Turn any 2.5-inch SSD or HDD into a fast external drive. Tool-free.",
    highlights: ["USB 3.1 Gen1 5Gbps", "UASP support", "Tool-free install", "Up to 6TB"],
    specs: [["Interface", "USB-C 3.1 Gen1"], ["Drive size", "2.5 inch, up to 9.5 mm"], ["Speed", "5Gbps"], ["Cable", "USB-C to USB-A, 50 cm"]],
  },
  {
    slug: "ugreen-m2-nvme-enclosure-10gbps", title_en: "UGREEN M.2 NVMe SSD Enclosure USB-C 10Gbps", brand: "ugreen", category: "storage",
    price: 2690, compare_at: 3100, cost: 1900, stock: 26, warranty_months: 12, weight_grams: 80,
    short: "10Gbps aluminium enclosure for NVMe SSDs up to 4TB.",
    highlights: ["USB 3.2 Gen2 10Gbps", "Aluminium heat dissipation", "Supports 2230-2280", "Tool-free"],
    specs: [["Interface", "USB-C 3.2 Gen2"], ["Protocol", "NVMe PCIe"], ["Speed", "10Gbps"], ["Cables", "C-to-C and C-to-A"]],
  },
  {
    slug: "orico-usb-3-2-flash-drive-128gb", title_en: "ORICO USB 3.2 Metal Flash Drive 128GB", brand: "orico", category: "storage",
    price: 1290, cost: 900, stock: 9, warranty_months: 12, weight_grams: 12,
    short: "Fast metal pen drive with a keyring loop.",
    highlights: ["128GB", "USB 3.2 Gen1", "Read up to 100MB/s", "Zinc alloy"],
    specs: [["Capacity", "128GB"], ["Interface", "USB 3.2 Gen1"], ["Read speed", "100MB/s"]],
  },
  {
    slug: "ugreen-sd-tf-card-reader-usb-c", title_en: "UGREEN 2-in-1 USB-C SD / microSD Card Reader", brand: "ugreen", category: "storage",
    price: 690, cost: 420, stock: 75, warranty_months: 12, weight_grams: 18,
    short: "Read SD and microSD cards on USB-C laptops and Android phones.",
    highlights: ["SD + TF simultaneously", "UHS-I up to 104MB/s", "OTG support", "Aluminium"],
    specs: [["Interface", "USB-C 3.0"], ["Slots", "SD, microSD"], ["Speed", "104MB/s"]],
  },
  {
    slug: "orico-3-5-hdd-docking-station", title_en: "ORICO 3.5\" / 2.5\" USB 3.0 HDD Docking Station", brand: "orico", category: "storage",
    price: 3290, cost: 2400, stock: 10, warranty_months: 12, weight_grams: 350,
    short: "Drop-in dock for SATA drives up to 18TB with a 12V power adapter.",
    highlights: ["Supports 2.5 and 3.5 inch", "Up to 18TB", "UASP", "12V/2A adapter included"],
    specs: [["Interface", "USB 3.0"], ["Drive size", "2.5 / 3.5 inch"], ["Max capacity", "18TB"], ["Power", "12V 2A"]],
  },
  // --------------------------------------------------- phone accessories
  {
    slug: "baseus-magnetic-car-mount", title_en: "Baseus Magnetic Car Phone Mount (Air Vent)", brand: "baseus", category: "phone-accessories",
    price: 890, compare_at: 1100, cost: 520, stock: 2, warranty_months: 6, weight_grams: 55,
    short: "Strong magnetic vent mount with 360-degree rotation.",
    highlights: ["N52 magnets", "360 rotation", "Metal plates included", "Fits 4-7 inch phones"],
    specs: [["Mount", "Air vent clip"], ["Rotation", "360 degrees"], ["Compatibility", "4-7 inch phones"]],
  },
  {
    slug: "ugreen-foldable-phone-stand", title_en: "UGREEN Foldable Aluminium Phone Stand", brand: "ugreen", category: "phone-accessories",
    price: 590, cost: 340, stock: 110, warranty_months: 6, weight_grams: 70,
    short: "Adjustable desk stand for phones and small tablets.",
    highlights: ["Adjustable angle", "Foldable", "Anti-slip pads", "Aluminium"],
    specs: [["Material", "Aluminium alloy"], ["Compatibility", "4-7.9 inch"], ["Weight", "70 g"]],
  },
  {
    slug: "baseus-metal-desk-phone-holder", title_en: "Baseus Metal Desk Phone Holder with Cable Slot", brand: "baseus", category: "phone-accessories",
    price: 1250, cost: 800, stock: 35, warranty_months: 6, weight_grams: 150,
    short: "Heavy-base metal holder that keeps charging cable routed.",
    highlights: ["Weighted base", "Cable routing slot", "Silicone pads", "Height adjustable"],
    specs: [["Material", "Zinc alloy"], ["Compatibility", "4-8 inch"], ["Weight", "150 g"]],
  },
  {
    slug: "xiaomi-mi-selfie-stick-tripod", title_en: "Xiaomi Mi Selfie Stick Tripod with Bluetooth Remote", brand: "xiaomi", category: "phone-accessories",
    price: 1490, cost: 1050, stock: 40, warranty_months: 6, weight_grams: 155,
    short: "Extends to 51cm, stands as a tripod, shoots with a detachable Bluetooth remote.",
    highlights: ["Tripod + selfie stick", "Bluetooth remote", "51 cm extension", "Aluminium"],
    specs: [["Length", "19-51 cm"], ["Remote", "Bluetooth 4.2"], ["Weight", "155 g"]],
  },
  {
    slug: "anker-maggo-magnetic-wallet", title_en: "Anker MagGo Magnetic Wallet for iPhone", brand: "anker", category: "phone-accessories",
    price: 1890, compare_at: 2200, cost: 1300, stock: 15, warranty_months: 18, weight_grams: 40,
    short: "Holds three cards and doubles as a kickstand.",
    highlights: ["MagSafe compatible", "Holds 3 cards", "Built-in kickstand", "Vegan leather"],
    specs: [["Compatibility", "iPhone 12-16"], ["Capacity", "3 cards"], ["Material", "Vegan leather"]],
  },
  // ---------------------------------------------------------- smart home
  {
    slug: "xiaomi-mi-smart-led-bulb-wifi", title_en: "Xiaomi Mi Smart LED Bulb (Wi-Fi, Colour)", title_bn: "শাওমি স্মার্ট এলইডি বাল্ব", brand: "xiaomi", category: "smart-home",
    price: 1290, cost: 900, stock: 60, warranty_months: 12, weight_grams: 75,
    short: "16 million colours, voice control with Google Assistant and Alexa.",
    highlights: ["16M colours", "Wi-Fi, no hub", "Google Assistant / Alexa", "9W, 950 lm", "E27"],
    specs: [["Base", "E27"], ["Power", "9W"], ["Brightness", "950 lm"], ["Connectivity", "Wi-Fi 2.4GHz"], ["Life", "25,000 h"]],
  },
  {
    slug: "xiaomi-smart-plug-wifi", title_en: "Xiaomi Smart Plug 2 (Wi-Fi)", brand: "xiaomi", category: "smart-home",
    price: 1590, compare_at: 1850, cost: 1100, stock: 38, warranty_months: 12, weight_grams: 70,
    short: "Schedule and control any appliance from your phone.",
    highlights: ["Remote on/off", "Timers and schedules", "Power monitoring", "Voice control"],
    specs: [["Max load", "3680W / 16A"], ["Connectivity", "Wi-Fi 2.4GHz"], ["Socket", "Type G (BD adapter included)"]],
  },
  {
    slug: "baseus-mini-desk-fan-usb", title_en: "Baseus Mini USB Desk Fan (Rechargeable)", brand: "baseus", category: "smart-home",
    price: 850, cost: 520, stock: 70, warranty_months: 6, weight_grams: 260,
    short: "Quiet three-speed desk fan with a 2000mAh battery.",
    highlights: ["3 speeds", "2000mAh, up to 6 h", "USB-C charging", "Tilt adjustable"],
    specs: [["Battery", "2000mAh"], ["Runtime", "3-6 h"], ["Charging", "USB-C"], ["Noise", "< 40 dB"]],
  },
];

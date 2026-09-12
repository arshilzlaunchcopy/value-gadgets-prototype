/* eslint-disable @next/next/no-img-element -- admin-uploaded payment badges */
import Link from "next/link";
import type { CategorySummary } from "@/lib/catalog/queries";
import type { StoreSettings } from "@/lib/settings";
import type { NavItem } from "@/lib/theme/get";
import type { FooterSettings } from "@/lib/theme/schema";
import { Logo } from "./header";

export interface FooterProps {
  store: StoreSettings;
  categories: CategorySummary[];
  footer?: FooterSettings;
  menus?: Record<string, NavItem[]>;
  /** pages.show_in_footer rows; used when the Help menu is empty */
  pages?: { slug: string; title_en: string; title_bn: string | null }[];
}

/** Footer builder output (PART2 §13.5): columns from menus, about, contact, trade licence, badges, copyright. */
export function Footer({ store, categories, footer, menus = {}, pages = [] }: FooterProps) {
  const year = new Date().getFullYear();
  const f: FooterSettings = footer ?? { columns: [{ heading_en: "Shop", menu_handle: "footer_col_1" }, { heading_en: "Help", menu_handle: "footer_col_2" }], about_text_en: "", show_contact_block: true, trade_license: "", tin: "", payment_badge_images: [], show_newsletter: false, copyright_en: "© {year} {store}. All rights reserved." };
  const fallbackShop: NavItem[] = categories.filter((c) => !c.parent_id).map((c) => ({ id: c.id, label_en: c.name_en, label_bn: c.name_bn, href: `/category/${c.slug}`, icon: null, badge_label: null, badge_color: null, opens_new_tab: false, is_mega: false, mega: null, children: [] }));
  const fallbackHelp: NavItem[] = [
    ["Track your order", "/track"], ["Your account", "/account"],
    ...(pages.length ? pages.map((p) => [p.title_en, `/pages/${p.slug}`] as [string, string]) : ([["Terms & conditions", "/pages/terms"], ["Privacy policy", "/pages/privacy"], ["Return & refund policy", "/pages/refund"]] as [string, string][])),
  ].map(([label, href], i) => ({ id: `h${i}`, label_en: label, label_bn: null, href, icon: null, badge_label: null, badge_color: null, opens_new_tab: false, is_mega: false, mega: null, children: [] }));
  const columns = f.columns.map((c, i) => ({ heading: c.heading_en, items: menus[c.menu_handle]?.length ? menus[c.menu_handle] : i === 0 ? fallbackShop : i === 1 ? fallbackHelp : [] })).filter((c) => c.items.length);
  const licence = f.trade_license || store.trade_license;
  const tin = f.tin || store.tin;
  const copyright = f.copyright_en.replace("{year}", String(year)).replace("{store}", store.name);

  return (
    <footer className="bg-ink text-paper/80 border-ink-line mt-12 border-t pb-14 lg:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <Logo store={store} />
          <p className="mt-3 text-sm">{f.about_text_en || store.tagline}</p>
          {(store.facebook || store.instagram || store.youtube) && (
            <p className="mt-3 flex gap-3 text-sm">
              {store.facebook && <a href={store.facebook} rel="noopener" className="hover:text-amber">Facebook</a>}
              {store.instagram && <a href={store.instagram} rel="noopener" className="hover:text-amber">Instagram</a>}
              {store.youtube && <a href={store.youtube} rel="noopener" className="hover:text-amber">YouTube</a>}
            </p>
          )}
          {licence && <p className="mt-3 text-xs">Trade licence: {licence}</p>}
          {tin && <p className="text-xs">TIN: {tin}</p>}
        </div>
        {columns.map((col) => (
          <div key={col.heading}>
            <h2 className="text-paper mb-3 text-sm font-semibold">{col.heading}</h2>
            <ul className="space-y-1.5 text-sm">
              {col.items.map((i) => (
                <li key={i.id}>
                  <Link href={i.href} target={i.opens_new_tab ? "_blank" : undefined} className="hover:text-amber">
                    {i.label_en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {f.show_contact_block && (
          <div>
            <h2 className="text-paper mb-3 text-sm font-semibold">Contact</h2>
            <ul className="space-y-1.5 text-sm">
              {store.phone && <li><a href={`tel:${store.phone}`} className="hover:text-amber">{store.phone}</a></li>}
              {store.whatsapp && <li><a href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`} className="hover:text-amber" rel="noopener">WhatsApp</a></li>}
              {store.email && <li><a href={`mailto:${store.email}`} className="hover:text-amber">{store.email}</a></li>}
              {store.address && <li className="text-xs">{store.address}</li>}
            </ul>
          </div>
        )}
      </div>
      {(f.payment_badge_images.length > 0 || f.show_newsletter) && (
        <div className="border-ink-line border-t">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
            {f.payment_badge_images.length > 0 && (
              <ul className="flex flex-wrap items-center gap-2" aria-label="Accepted payment methods">
                {f.payment_badge_images.map((src, i) => (
                  <li key={i} className="bg-paper rounded-md p-1">
                    <img src={src} alt="" className="h-6 w-auto" loading="lazy" />
                  </li>
                ))}
              </ul>
            )}
            {f.show_newsletter && <p className="text-xs">Newsletter sign-up arrives with the capture blocks (Phase 13).</p>}
          </div>
        </div>
      )}
      <div className="border-ink-line border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs">{copyright}</p>
      </div>
    </footer>
  );
}

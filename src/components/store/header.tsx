/* eslint-disable @next/next/no-img-element -- admin-uploaded logo / mega-menu images */
import { Home, LayoutGrid, Menu, PackageSearch, Phone, Search, User } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { CategorySummary } from "@/lib/catalog/queries";
import type { StoreSettings } from "@/lib/settings";
import type { NavItem } from "@/lib/theme/get";
import type { Announcement, HeaderSettings } from "@/lib/theme/schema";
import { AnnouncementBar } from "./announcement-bar";
import { CartButton } from "./cart/cart-button";
import { SearchBox } from "./search-box";

export interface HeaderProps {
  store: StoreSettings;
  categories: CategorySummary[];
  header?: HeaderSettings;
  announcement?: Announcement | null;
  mainMenu?: NavItem[];
  mobileMenu?: NavItem[];
}

export function Logo({ store, image, height = 36, className = "" }: { store: StoreSettings; image?: string; height?: number; className?: string }) {
  const [first, ...rest] = store.name.split(" ");
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`}>
      {image ? (
        <img src={image} alt={store.name} style={{ height }} className="w-auto" />
      ) : (
        <>
          <span className="bg-gradient-brand text-ink grid size-9 shrink-0 place-items-center rounded-lg text-lg font-bold">%</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-wide uppercase">{first}</span>
            {rest.length > 0 && <span className="text-amber block text-[11px] font-semibold tracking-wide uppercase">{rest.join(" ")}</span>}
          </span>
        </>
      )}
    </Link>
  );
}

function categoriesAsMenu(categories: CategorySummary[]): NavItem[] {
  return categories.filter((c) => !c.parent_id).map((c) => ({ id: c.id, label_en: c.name_en, label_bn: c.name_bn, href: `/category/${c.slug}`, icon: null, badge_label: null, badge_color: null, opens_new_tab: false, is_mega: false, mega: null, children: [] }));
}

function announcementActive(a: Announcement | null | undefined): a is Announcement {
  if (!a || !a.enabled || !a.text_en) return false;
  const now = Date.now();
  if (a.visible_from && new Date(a.visible_from).getTime() > now) return false;
  if (a.visible_until && new Date(a.visible_until).getTime() < now) return false;
  return true;
}

/** Dark chrome header (BUILD_PROMPT §3) driven by theme settings + menus (PART2 §13.4). */
export function Header({ store, categories, header, announcement, mainMenu, mobileMenu }: HeaderProps) {
  const h: HeaderSettings = header ?? { logo_image: "", logo_height: 36, mobile_logo_image: "", layout: "logo_left", sticky: true, transparent_over_hero: false, show_search: true, show_cart: true, show_track_order: true, show_phone: false, show_language_switcher: false, mobile_bottom_tab_bar: true };
  const main = mainMenu?.length ? mainMenu : categoriesAsMenu(categories);
  const mobile = mobileMenu?.length ? mobileMenu : main;
  const centered = h.layout === "logo_center";

  return (
    <>
      {announcementActive(announcement) && <AnnouncementBar a={announcement} />}
      <header className={`bg-ink text-paper z-40 ${h.sticky ? "sticky top-0" : ""}`}>
        <div className={`mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 ${centered ? "justify-between lg:grid lg:grid-cols-[1fr_auto_1fr]" : ""}`}>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger className="hover:bg-ink-soft -ml-2 rounded-lg p-2 lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side="left" className="bg-ink text-paper border-ink-line w-[85vw] max-w-sm overflow-y-auto">
                <SheetTitle className="text-paper">Menu</SheetTitle>
                <nav className="mt-4 flex flex-col" aria-label="Mobile">
                  {mobile.map((i) => (
                    <div key={i.id}>
                      <Link href={i.href} target={i.opens_new_tab ? "_blank" : undefined} className="hover:bg-ink-soft flex items-center justify-between rounded-lg px-3 py-2.5 text-sm">
                        {i.label_en}
                        {i.badge_label && <span className="text-ink rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: i.badge_color || "#FFC107" }}>{i.badge_label}</span>}
                      </Link>
                      {i.children.map((c) => (
                        <Link key={c.id} href={c.href} className="text-paper/70 hover:bg-ink-soft block rounded-lg py-2 pr-3 pl-7 text-sm">
                          {c.label_en}
                        </Link>
                      ))}
                    </div>
                  ))}
                  {h.show_track_order && (
                    <Link href="/track" className="hover:bg-ink-soft border-ink-line mt-2 rounded-lg border-t px-3 py-2.5 text-sm">
                      Track order
                    </Link>
                  )}
                  <Link href="/account" className="hover:bg-ink-soft rounded-lg px-3 py-2.5 text-sm">
                    Account
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
            {!centered && <Logo store={store} image={h.logo_image || undefined} height={h.logo_height} />}
          </div>

          {centered && <Logo store={store} image={h.logo_image || undefined} height={h.logo_height} className="justify-self-center" />}

          {h.show_search && !centered && (
            <div className="hidden flex-1 lg:block lg:px-6">
              <SearchBox />
            </div>
          )}

          <div className={`ml-auto flex items-center gap-1 ${centered ? "justify-self-end" : ""}`}>
            {h.show_phone && store.phone && (
              <a href={`tel:${store.phone}`} className="hover:bg-ink-soft hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm sm:flex">
                <Phone className="size-4" />
                {store.phone}
              </a>
            )}
            {h.show_track_order && (
              <Link href="/track" className="hover:bg-ink-soft hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm sm:flex">
                <PackageSearch className="size-4" />
                Track
              </Link>
            )}
            {h.show_language_switcher && <span className="text-paper/60 hidden px-2 text-xs sm:inline">EN · বাং</span>}
            {h.show_cart && <CartButton />}
          </div>
        </div>

        {h.show_search && (
          <div className={`px-4 pb-3 ${centered ? "lg:mx-auto lg:max-w-xl" : "lg:hidden"}`}>
            <SearchBox />
          </div>
        )}

        <nav className="border-ink-line hidden border-t lg:block" aria-label="Main">
          <ul className={`mx-auto flex max-w-6xl gap-1 px-4 ${centered ? "justify-center" : ""}`}>
            {main.map((i) => (
              <li key={i.id} className="group relative">
                <Link href={i.href} target={i.opens_new_tab ? "_blank" : undefined} className="hover:text-amber flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium">
                  {i.label_en}
                  {i.badge_label && <span className="text-ink rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: i.badge_color || "#FFC107" }}>{i.badge_label}</span>}
                </Link>
                {i.is_mega && i.mega && (i.mega.columns.length > 0 || i.mega.featured) ? (
                  <div className="bg-paper text-ink invisible absolute top-full left-0 z-50 w-[min(56rem,90vw)] rounded-b-2xl border shadow-xl group-focus-within:visible group-hover:visible">
                    <div className="grid gap-6 p-6" style={{ gridTemplateColumns: `repeat(${i.mega.columns.length + (i.mega.featured ? 1 : 0)}, minmax(0, 1fr))` }}>
                      {i.mega.columns.map((col, k) => (
                        <div key={k}>
                          {col.heading && <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">{col.heading}</p>}
                          <ul className="space-y-1">
                            {col.links.map((l, j) => (
                              <li key={j}>
                                <Link href={l.href} className="hover:text-amber-deep block py-0.5 text-sm">
                                  {l.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      {i.mega.featured && (
                        <Link href={i.mega.featured.href} className="bg-paper-soft block overflow-hidden rounded-xl border">
                          {i.mega.featured.image_url && <img src={i.mega.featured.image_url} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />}
                          {i.mega.featured.heading && <span className="block p-3 text-sm font-semibold">{i.mega.featured.heading}</span>}
                        </Link>
                      )}
                    </div>
                  </div>
                ) : i.children.length > 0 ? (
                  <ul className="bg-paper text-ink invisible absolute top-full left-0 z-50 min-w-48 rounded-b-xl border py-1 shadow-xl group-focus-within:visible group-hover:visible">
                    {i.children.map((c) => (
                      <li key={c.id}>
                        <Link href={c.href} className="hover:bg-accent block px-3 py-1.5 text-sm">
                          {c.label_en}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {h.mobile_bottom_tab_bar && (
        <nav className="bg-ink text-paper border-ink-line fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t text-[11px] lg:hidden" aria-label="Quick tabs">
          {[
            { href: "/", label: "Home", Icon: Home },
            { href: mobile[0]?.href ?? "/", label: "Shop", Icon: LayoutGrid },
            { href: "/search", label: "Search", Icon: Search },
            { href: "/cart", label: "Cart", Icon: PackageSearch },
            { href: "/account", label: "Account", Icon: User },
          ].map((t) => (
            <Link key={t.label} href={t.href} className="hover:text-amber flex flex-col items-center gap-0.5 py-2">
              <t.Icon className="size-4" />
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

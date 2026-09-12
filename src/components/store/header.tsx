import { Menu, PackageSearch } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { CategorySummary } from "@/lib/catalog/queries";
import type { StoreSettings } from "@/lib/settings";
import { CartButton } from "./cart/cart-button";
import { SearchBox } from "./search-box";

export function Logo({ store, className = "" }: { store: StoreSettings; className?: string }) {
  const [first, ...rest] = store.name.split(" ");
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${className}`}>
      <span className="bg-gradient-brand text-ink grid size-9 shrink-0 place-items-center rounded-lg text-lg font-bold">%</span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-wide uppercase">{first}</span>
        {rest.length > 0 && <span className="text-amber block text-[11px] font-semibold tracking-wide uppercase">{rest.join(" ")}</span>}
      </span>
    </Link>
  );
}

/** Dark chrome header (BUILD_PROMPT §3). Amber only on the active/CTA elements. */
export function Header({ store, categories }: { store: StoreSettings; categories: CategorySummary[] }) {
  const top = categories.filter((c) => !c.parent_id);
  return (
    <header className="bg-ink text-paper sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Sheet>
          <SheetTrigger className="hover:bg-ink-soft -ml-2 rounded-lg p-2 lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="bg-ink text-paper border-ink-line w-[85vw] max-w-sm">
            <SheetTitle className="text-paper">Categories</SheetTitle>
            <nav className="mt-4 flex flex-col">
              {top.map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`} className="hover:bg-ink-soft rounded-lg px-3 py-2.5 text-sm">
                  {c.name_en}
                </Link>
              ))}
              <Link href="/track" className="hover:bg-ink-soft mt-2 rounded-lg px-3 py-2.5 text-sm">
                Track order
              </Link>
              <Link href="/account" className="hover:bg-ink-soft rounded-lg px-3 py-2.5 text-sm">
                Account
              </Link>
            </nav>
          </SheetContent>
        </Sheet>

        <Logo store={store} />

        <div className="hidden flex-1 lg:block lg:px-6">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Link href="/track" className="hover:bg-ink-soft hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm sm:flex">
            <PackageSearch className="size-4" />
            Track
          </Link>
          <CartButton />
        </div>
      </div>

      <div className="px-4 pb-3 lg:hidden">
        <SearchBox />
      </div>

      <nav className="border-ink-line hidden border-t lg:block" aria-label="Categories">
        <ul className="mx-auto flex max-w-6xl gap-1 px-4">
          {top.map((c) => (
            <li key={c.id}>
              <Link href={`/category/${c.slug}`} className="hover:text-amber block px-3 py-2.5 text-sm font-medium">
                {c.name_en}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

import Link from "next/link";
import type { CategorySummary } from "@/lib/catalog/queries";
import type { StoreSettings } from "@/lib/settings";
import { Logo } from "./header";

export function Footer({ store, categories }: { store: StoreSettings; categories: CategorySummary[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-ink text-paper/80 border-ink-line mt-12 border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo store={store} />
          <p className="mt-3 text-sm">{store.tagline}</p>
          {store.trade_license && <p className="mt-3 text-xs">Trade licence: {store.trade_license}</p>}
          {store.tin && <p className="text-xs">TIN: {store.tin}</p>}
        </div>
        <div>
          <h2 className="text-paper mb-3 text-sm font-semibold">Shop</h2>
          <ul className="space-y-1.5 text-sm">
            {categories
              .filter((c) => !c.parent_id)
              .map((c) => (
                <li key={c.id}>
                  <Link href={`/category/${c.slug}`} className="hover:text-amber">
                    {c.name_en}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
        <div>
          <h2 className="text-paper mb-3 text-sm font-semibold">Help</h2>
          <ul className="space-y-1.5 text-sm">
            <li><Link href="/track" className="hover:text-amber">Track your order</Link></li>
            <li><Link href="/account" className="hover:text-amber">Your account</Link></li>
            <li><Link href="/policies/terms" className="hover:text-amber">Terms &amp; conditions</Link></li>
            <li><Link href="/policies/privacy" className="hover:text-amber">Privacy policy</Link></li>
            <li><Link href="/policies/refund" className="hover:text-amber">Return &amp; refund policy</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-paper mb-3 text-sm font-semibold">Contact</h2>
          <ul className="space-y-1.5 text-sm">
            {store.phone && <li><a href={`tel:${store.phone}`} className="hover:text-amber">{store.phone}</a></li>}
            {store.whatsapp && <li><a href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`} className="hover:text-amber" rel="noopener">WhatsApp</a></li>}
            {store.email && <li><a href={`mailto:${store.email}`} className="hover:text-amber">{store.email}</a></li>}
            {store.address && <li className="text-xs">{store.address}</li>}
            {store.facebook && <li><a href={store.facebook} className="hover:text-amber" rel="noopener">Facebook</a></li>}
          </ul>
        </div>
      </div>
      <div className="border-ink-line border-t">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs">
          © {year} {store.name}. Cash on delivery, bKash, Nagad and cards accepted.
        </p>
      </div>
    </footer>
  );
}

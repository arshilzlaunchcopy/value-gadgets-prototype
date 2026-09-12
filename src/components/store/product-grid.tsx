import type { ProductSummary } from "@/lib/catalog/queries";
import { ProductCard } from "./product-card";

/** First `eager` cards load eagerly (above the fold on mobile); the rest lazy. */
export function ProductGrid({ products, eager = 4, emptyMessage = "No products found." }: { products: ProductSummary[]; eager?: number; emptyMessage?: string }) {
  if (products.length === 0) return <p className="text-muted-foreground py-12 text-center">{emptyMessage}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < eager} />
        </li>
      ))}
    </ul>
  );
}

export function SectionHeading({ title, href, hrefLabel = "View all" }: { title: string; href?: string; hrefLabel?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
      {href && (
        <a href={href} className="hover:text-amber-deep text-sm font-medium underline-offset-4 hover:underline">
          {hrefLabel}
        </a>
      )}
    </div>
  );
}

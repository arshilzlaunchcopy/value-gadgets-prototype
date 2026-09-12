import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Phase 1 placeholder. The real storefront home is Phase 5.
 * Only exercises the brand tokens and the base components.
 */
export default function Home() {
  return (
    <>
      <header className="bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-brand text-ink grid size-9 place-items-center rounded-lg text-lg font-bold">
              %
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-wide">VALUE</span>
              <span className="text-amber block text-xs font-semibold tracking-wide">GADGETS BD</span>
            </span>
          </div>
          <Badge className="bg-amber text-ink rounded-lg">Phase 1</Badge>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-12">
        <h1 className="text-3xl font-semibold">Foundation is in place.</h1>
        <p className="text-muted-foreground max-w-prose">
          Brand tokens, shadcn/ui, Supabase clients, migrations and RLS are wired. Storefront pages
          arrive in Phase 5.
        </p>
        <p lang="bn" className="max-w-prose text-lg">
          বাংলাদেশ জুড়ে ডেলিভারি — ওয়ারেন্টি সহ আসল গ্যাজেট।
        </p>
        <div className="flex flex-wrap gap-3">
          <Button className="rounded-2xl">Buy Now</Button>
          <Button variant="outline" className="rounded-2xl">
            Add to Cart
          </Button>
        </div>
        <p className="price text-2xl">৳1,250</p>
      </main>

      <footer className="bg-ink text-paper/70 border-ink-line border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm">Demo build. Nothing here is a real offer.</div>
      </footer>
    </>
  );
}

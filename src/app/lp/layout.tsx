import { CartDrawer } from "@/components/store/cart/cart-drawer";
import { CartProvider } from "@/components/store/cart/cart-provider";

/**
 * Landing pages (PART2 §15.2): no storefront header/footer. Each page decides
 * whether to show the minimal chrome bar. Cart context is still mounted so
 * commerce blocks (featured product, carousels) keep working.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {children}
      <CartDrawer />
    </CartProvider>
  );
}

"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { EMPTY_CART, type CartSummary } from "@/lib/cart/types";

interface CartContextValue {
  cart: CartSummary;
  loaded: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  setCart: (c: CartSummary) => void;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartSummary>(EMPTY_CART);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      if (res.ok) setCart((await res.json()) as CartSummary);
    } catch {
      /* offline: keep what we have */
    } finally {
      setLoaded(true);
    }
  }, []);

  const value = useMemo(() => ({ cart, loaded, open, setOpen, setCart, refresh }), [cart, loaded, open, refresh]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

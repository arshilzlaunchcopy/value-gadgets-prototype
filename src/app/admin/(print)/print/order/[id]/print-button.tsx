"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" className="rounded-lg" onClick={() => window.print()}>
      Print
    </Button>
  );
}

/** navigation_items.link_type + link_target -> href at render (client-safe). */
export type LinkType = "url" | "category" | "collection" | "product" | "page" | "post" | "search";

export function resolveHref(linkType: LinkType | string, target: string | null | undefined): string {
  const t = (target ?? "").trim();
  switch (linkType) {
    case "category":
      return t ? `/category/${t}` : "/";
    case "collection":
      return t ? `/collection/${t}` : "/";
    case "product":
      return t ? `/products/${t}` : "/";
    case "page":
      return t ? `/policies/${t}` : "/";
    case "post":
      return t ? `/blog/${t}` : "/";
    case "search":
      return t ? `/search?q=${encodeURIComponent(t)}` : "/search";
    case "url":
    default:
      if (!t) return "/";
      if (/^(https?:)?\/\//i.test(t) || t.startsWith("mailto:") || t.startsWith("tel:")) return t;
      return t.startsWith("/") ? t : `/${t}`;
  }
}

export function isExternal(href: string): boolean {
  return /^(https?:)?\/\//i.test(href);
}

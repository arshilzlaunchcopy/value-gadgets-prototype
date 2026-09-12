import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env.public";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/checkout", "/cart", "/account", "/api", "/demo", "/order/", "/search?", "/*?*&*"],
      },
    ],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}

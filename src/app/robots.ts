import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Dashboard is concealed (middleware 404s it), not just disallowed
      // here — this is defense in depth, not the actual protection.
      disallow: ["/dashboard", "/access", "/concealed-404"],
    },
    sitemap: `${env.SITE_URL}/sitemap.xml`,
  };
}

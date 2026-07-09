import type { Metadata } from "next";
import type { ResolvedSeo } from "./queries";

export function toMetadata(seo: ResolvedSeo): Metadata {
  return {
    title: seo.title,
    description: seo.description ?? undefined,
    robots: seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: seo.title,
      description: seo.description ?? undefined,
      images: seo.ogImageUrl ? [seo.ogImageUrl] : undefined,
    },
  };
}

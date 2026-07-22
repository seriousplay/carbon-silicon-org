import type { Metadata } from "next";
import { absoluteUrl, siteConfig } from "@/lib/site-config";

type MetadataInput = {
  title?: string;
  description?: string;
  pathname?: string;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
};

export function createMetadata({
  title = siteConfig.title,
  description = siteConfig.description,
  pathname = "/",
  type = "website",
  publishedTime,
  modifiedTime,
}: MetadataInput = {}): Metadata {
  const canonical = absoluteUrl(pathname);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type,
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      locale: "zh_CN",
      publishedTime,
      modifiedTime,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

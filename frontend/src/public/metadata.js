import { useEffect } from "react";
import { PUBLIC_BRAND } from "./brand";

function setMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
}

function setLink(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("link");
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
}

function removeHeadElement(selector) {
  document.head.querySelector(selector)?.remove();
}

export function usePublicMetadata({ title, description = PUBLIC_BRAND.description, image, structuredData = false }) {
  useEffect(() => {
    const canonicalUrl = new URL(window.location.pathname, window.location.origin).href;
    const imageUrl = image ? new URL(image, document.baseURI).href : null;
    document.title = title;
    setMeta('meta[name="description"]', { name: "description", content: description });
    setMeta('meta[property="og:title"]', { property: "og:title", content: title });
    setMeta('meta[property="og:description"]', { property: "og:description", content: description });
    setMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
    setMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
    setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: imageUrl ? "summary_large_image" : "summary" });
    setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
    setLink('link[rel="canonical"]', { rel: "canonical", href: canonicalUrl });

    if (imageUrl) {
      setMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl });
      setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl });
    } else {
      removeHeadElement('meta[property="og:image"]');
      removeHeadElement('meta[name="twitter:image"]');
    }

    if (structuredData) {
      let script = document.head.querySelector('script[data-public-structured-data="true"]');
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.dataset.publicStructuredData = "true";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", name: PUBLIC_BRAND.companyName, url: PUBLIC_BRAND.website },
          { "@type": "SoftwareApplication", name: PUBLIC_BRAND.productName, applicationCategory: "BusinessApplication", operatingSystem: "Web browser", description, url: canonicalUrl, creator: { "@type": "Organization", name: PUBLIC_BRAND.companyName } },
        ],
      });
    } else {
      removeHeadElement('script[data-public-structured-data="true"]');
    }
  }, [description, image, structuredData, title]);
}

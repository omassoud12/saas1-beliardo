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

export function usePublicMetadata({ title, description = PUBLIC_BRAND.description }) {
  useEffect(() => {
    document.title = title;
    setMeta('meta[name="description"]', { name: "description", content: description });
    setMeta('meta[property="og:title"]', { property: "og:title", content: title });
    setMeta('meta[property="og:description"]', { property: "og:description", content: description });
    setMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
  }, [description, title]);
}

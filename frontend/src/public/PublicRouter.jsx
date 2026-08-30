import { useEffect, useState } from "react";
import { getPendingInvitation, hasPendingPasswordReset } from "../lib/authLinkState";
import { ContactPage } from "./ContactPage";
import { LandingPage } from "./LandingPage";
import { PublicFooter, PublicNavbar } from "./PublicLayout";
import { PUBLIC_ROUTES } from "./brand";
import { usePublicMetadata } from "./metadata";

function currentPath() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path.toLowerCase();
}

function hasAuthCallback() {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return Boolean(query.get("code") || query.get("token_hash") || hash.get("access_token") || hash.get("refresh_token"));
}

export function PublicRouter({ renderAuth }) {
  const [path, setPath] = useState(currentPath);
  const pendingInvitation = Boolean(getPendingInvitation());
  const pendingPasswordReset = hasPendingPasswordReset();
  const authCallback = hasAuthCallback();

  useEffect(() => {
    const handlePopState = () => setPath(currentPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const setAuthMode = (mode) => {
    const nextPath = mode === "signup" ? PUBLIC_ROUTES.register : PUBLIC_ROUTES.login;
    window.history.replaceState({}, "", nextPath);
    setPath(nextPath);
  };

  if (pendingInvitation || pendingPasswordReset || authCallback || [PUBLIC_ROUTES.login, PUBLIC_ROUTES.register, "/app"].includes(path)) {
    const mode = pendingInvitation || path === PUBLIC_ROUTES.register ? "signup" : "signin";
    return renderAuth({ mode, onModeChange: setAuthMode });
  }
  if (path === PUBLIC_ROUTES.home) return <LandingPage />;
  if (path === PUBLIC_ROUTES.contact) return <ContactPage />;
  return <PublicNotFound />;
}

function PublicNotFound() {
  usePublicMetadata({ title: `Page Not Found | Lounge Hell`, description: "The requested Lounge Hell page could not be found." });
  return <div className="public-site"><PublicNavbar currentPath="" /><main className="public-not-found"><p className="public-kicker">404 / Not found</p><h1>This page is off the floor.</h1><p>The address may have changed, or the page does not exist.</p><a className="public-button public-button--primary" href={PUBLIC_ROUTES.home}>Return home</a></main><PublicFooter /></div>;
}

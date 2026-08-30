import { useEffect, useState } from "react";
import { useAuthSession } from "../hooks/useAuthSession";
import { PUBLIC_BRAND, PUBLIC_ROUTES } from "./brand";

const navigation = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Contact", href: "/contact" },
];

export function UltraScalingLogo({ large = false }) {
  return <span className={`public-ultrascaling-symbol${large ? " public-ultrascaling-symbol--large" : ""}`} aria-hidden="true"><img src="/assets/ultrascaling-logo.png" width="1254" height="1254" alt="" /></span>;
}

export function PublicAccountActions({ compact = false }) {
  const { session, loading } = useAuthSession();
  if (loading) return <span className={`public-account-loading${compact ? " public-account-loading--compact" : ""}`} aria-label="Checking account session" />;
  if (session) return <a className="public-button public-button--primary" href={PUBLIC_ROUTES.login}>Open Dashboard</a>;
  return <div className="public-account-actions"><a className="public-button public-button--secondary" href={PUBLIC_ROUTES.login}>Login</a><a className="public-button public-button--primary" href={PUBLIC_ROUTES.register}>Create Account</a></div>;
}

export function PublicNavbar({ currentPath = window.location.pathname }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return <header className="public-nav-shell">
    <nav className="public-nav" aria-label="Public navigation">
      <a className="public-wordmark" href={PUBLIC_ROUTES.home} aria-label={`${PUBLIC_BRAND.productName} home`}>
        <UltraScalingLogo />
        <span><strong>{PUBLIC_BRAND.productName}</strong><small>by {PUBLIC_BRAND.companyName}</small></span>
      </a>
      <button className="public-menu-button" type="button" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="public-navigation-links" onClick={() => setOpen((value) => !value)} title={open ? "Close menu" : "Open menu"}>
        <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
      </button>
      <div className={`public-nav__panel${open ? " is-open" : ""}`} id="public-navigation-links">
        <div className="public-nav__links">{navigation.map((item) => {
          const active = item.href === "/contact" ? currentPath === "/contact" : item.href === "/" && currentPath === "/";
          return <a key={item.label} href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)}>{item.label}</a>;
        })}</div>
        <PublicAccountActions compact />
      </div>
    </nav>
  </header>;
}

export function PublicFooter() {
  const year = new Date().getFullYear();
  return <footer className="public-footer">
    <div className="public-footer__inner">
      <div className="public-footer__brand"><a className="public-wordmark" href={PUBLIC_ROUTES.home}><UltraScalingLogo /><span><strong>{PUBLIC_BRAND.productName}</strong><small>Powered by {PUBLIC_BRAND.companyName}</small></span></a><p>Controlled session operations, accurate billing, and business visibility for modern entertainment lounges.</p></div>
      <div className="public-footer__links"><div><strong>Product</strong><a href="/#features">Features</a><a href="/#how-it-works">How It Works</a><a href="/#analytics">Analytics</a></div><div><strong>Access</strong><a href={PUBLIC_ROUTES.login}>Login</a><a href={PUBLIC_ROUTES.register}>Create Account</a><a href={PUBLIC_ROUTES.contact}>Contact</a></div></div>
    </div>
    <div className="public-footer__legal"><span>© {year} {PUBLIC_BRAND.productName}</span><span>Powered by {PUBLIC_BRAND.companyName}</span></div>
  </footer>;
}

export function SectionHeading({ kicker, title, children, align = "left" }) {
  return <header className={`public-section-heading public-section-heading--${align}`}><p className="public-kicker">{kicker}</p><h2>{title}</h2>{children && <p>{children}</p>}</header>;
}

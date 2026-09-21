import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "../hooks/useAuthSession";
import { supabase } from "../lib/supabase";
import { PUBLIC_BRAND, PUBLIC_ROUTES } from "./brand";

const navigation = [
  { label: "Product", href: "/#features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Plans", href: "/#plans" },
  { label: "Contact", href: "/contact" },
];

export function UltraScalingLogo({ large = false }) {
  return <span className={`public-ultrascaling-symbol${large ? " public-ultrascaling-symbol--large" : ""}`} aria-hidden="true"><img src="/assets/ultrascaling-logo.png" width="1254" height="1254" alt="" /></span>;
}

export function PublicAccountActions({ compact = false }) {
  const { session, loading } = useAuthSession();
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase?.auth.signOut();
    } finally {
      setSigningOut(false);
    }
  };
  if (loading) return <span className={`public-account-loading${compact ? " public-account-loading--compact" : ""}`} aria-label="Checking account session" />;
  if (session) return <div className="public-account-actions"><a className="public-button public-button--primary" href={PUBLIC_ROUTES.login}>Open Dashboard</a><button className="public-button public-button--secondary" type="button" disabled={signingOut} onClick={handleSignOut}>{signingOut ? "Signing out..." : "Sign out"}</button></div>;
  return <div className="public-account-actions" aria-label="Account actions">
    <a className="public-account-actions__login" href={PUBLIC_ROUTES.login}>Login</a>
    <a className="public-account-actions__register" href={PUBLIC_ROUTES.register}>Create Account</a>
    <a className="public-button public-button--primary" href={PUBLIC_ROUTES.contact}>Get Started</a>
  </div>;
}

export function PublicNavbar({ currentPath = window.location.pathname }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => typeof window !== "undefined" && window.scrollY > 12);
  const menuButtonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    const handlePointerDown = (event) => {
      if (panelRef.current?.contains(event.target) || menuButtonRef.current?.contains(event.target)) return;
      setOpen(false);
      window.setTimeout(() => menuButtonRef.current?.focus(), 0);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    const focusTimer = window.setTimeout(() => panelRef.current?.querySelector("a, button")?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return <header className={`public-nav-shell${scrolled ? " is-scrolled" : ""}`}>
    <nav className="public-nav" aria-label="Public navigation">
      <a className="public-wordmark" href={PUBLIC_ROUTES.home} aria-label={`${PUBLIC_BRAND.productName} home`}>
        <UltraScalingLogo />
        <span><strong>{PUBLIC_BRAND.productName}</strong><small>by {PUBLIC_BRAND.companyName}</small></span>
      </a>
      <button ref={menuButtonRef} className="public-menu-button" type="button" aria-label={open ? "Close navigation menu" : "Open navigation menu"} aria-expanded={open} aria-controls="public-navigation-links" onClick={() => setOpen((value) => !value)} title={open ? "Close menu" : "Open menu"}>
        <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
      </button>
      <div ref={panelRef} className={`public-nav__panel${open ? " is-open" : ""}`} id="public-navigation-links">
        <div className="public-nav__links">{navigation.map((item) => {
          const active = item.href === "/contact" && currentPath === "/contact";
          return <a key={item.label} href={item.href} aria-current={active ? "page" : undefined} onClick={() => { setOpen(false); menuButtonRef.current?.focus(); }}>{item.label}</a>;
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
      <div className="public-footer__brand">
        <a className="public-wordmark" href={PUBLIC_ROUTES.home} aria-label={`${PUBLIC_BRAND.productName} home`}><UltraScalingLogo /><span><strong>{PUBLIC_BRAND.productName}</strong><small>Powered by {PUBLIC_BRAND.companyName}</small></span></a>
        <p>A connected system for managing lounge sessions and Business performance.</p>
      </div>
      <nav className="public-footer__group" aria-labelledby="footer-product-title"><h2 id="footer-product-title">Product</h2><a href="/#features">Product</a><a href="/#how-it-works">How It Works</a><a href="/#plans">Plans</a><a href={PUBLIC_ROUTES.contact}>Contact</a></nav>
      <nav className="public-footer__group" aria-labelledby="footer-account-title"><h2 id="footer-account-title">Account</h2><a href={PUBLIC_ROUTES.login}>Login</a><a href={PUBLIC_ROUTES.register}>Create Account</a></nav>
      <div className="public-footer__group" aria-labelledby="footer-company-title"><h2 id="footer-company-title">Company</h2><a href={PUBLIC_ROUTES.contact}>Contact</a><a href={PUBLIC_BRAND.website} target="_blank" rel="noreferrer">{PUBLIC_BRAND.companyName}<span className="public-footer__external" aria-hidden="true">↗</span></a></div>
    </div>
    <div className="public-footer__legal"><span>© {year} {PUBLIC_BRAND.companyName}</span><span>{PUBLIC_BRAND.productName}</span></div>
  </footer>;
}

export function SectionHeading({ kicker, title, titleId, children, align = "left" }) {
  return <header className={`public-section-heading public-section-heading--${align}`}><p className="public-kicker">{kicker}</p><h2 id={titleId}>{title}</h2>{children && <p>{children}</p>}</header>;
}

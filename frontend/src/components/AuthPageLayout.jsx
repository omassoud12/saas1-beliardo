import { PublicNavbar, UltraScalingLogo } from "../public/PublicLayout";

export function AuthPageLayout({ children }) {
  return <div className="public-site public-auth-site">
    <PublicNavbar currentPath={window.location.pathname} />
    <main className="auth-page">{children}</main>
  </div>;
}

export function AuthBrand() {
  return <a className="auth-brand-lockup" href="/" aria-label="Lounge Hell home">
    <UltraScalingLogo />
    <span><strong>Lounge Hell</strong><small>by UltraScaling Solutions</small></span>
  </a>;
}

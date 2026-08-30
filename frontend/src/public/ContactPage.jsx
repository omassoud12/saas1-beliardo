import { PUBLIC_BRAND } from "./brand";
import { PublicFooter, PublicNavbar, UltraScalingLogo } from "./PublicLayout";
import { usePublicMetadata } from "./metadata";

export function ContactPage() {
  usePublicMetadata({
    title: "Contact | Lounge Hell",
    description: "Contact UltraScaling Solutions about Lounge Hell product inquiries, support, partnerships, or a product demonstration.",
  });

  return <div className="public-site">
    <PublicNavbar currentPath="/contact" />
    <main className="public-contact">
      <header className="public-contact-hero"><div className="public-container public-contact-hero__content"><p className="public-kicker">Contact UltraScaling Solutions</p><h1>Let’s talk about your lounge.</h1><p>Questions, support, partnerships, or product demos—choose the channel that works best for you.</p></div></header>
      <section className="public-contact-content"><div className="public-container public-contact-layout">
        <section className="public-contact-info" aria-labelledby="contact-information-title">
          <div className="public-contact-company"><UltraScalingLogo large /><div><small>Product studio</small><h2 id="contact-information-title">UltraScaling Solutions</h2></div></div>
          <p>We build Lounge Hell and the tools that help entertainment lounges run smoothly.</p>
          <div className="public-contact-methods" aria-label="Contact methods">
            <a className="public-contact-method" href={`mailto:${PUBLIC_BRAND.contact.email}`}><span><small>Email</small><strong>{PUBLIC_BRAND.contact.email}</strong></span><b aria-hidden="true">↗</b></a>
            <a className="public-contact-method" href={PUBLIC_BRAND.contact.whatsapp} target="_blank" rel="noreferrer"><span><small>WhatsApp</small><strong>Start a conversation</strong></span><b aria-hidden="true">↗</b></a>
            <a className="public-contact-method" href={PUBLIC_BRAND.contact.instagram} target="_blank" rel="noreferrer"><span><small>Instagram</small><strong>@ultrascaling.div</strong></span><b aria-hidden="true">↗</b></a>
            <a className="public-contact-method" href={PUBLIC_BRAND.website} target="_blank" rel="noreferrer"><span><small>Website</small><strong>ultrascaling.com</strong></span><b aria-hidden="true">↗</b></a>
          </div>
          <dl className="public-contact-summary"><div><dt>Product</dt><dd>{PUBLIC_BRAND.productName}</dd></div><div><dt>Built for</dt><dd>PlayStation · Billiard · Ping Pong</dd></div></dl>
        </section>
      </div></section>
    </main>
    <PublicFooter />
  </div>;
}

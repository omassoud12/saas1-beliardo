import { useEffect } from "react";
import businessActivityScreenshotSmall from "../assets/landing-business-activity-small.webp";
import businessActivityScreenshot from "../assets/landing-business-activity.webp";
import stationManagementScreenshotSmall from "../assets/landing-station-management-small.webp";
import stationManagementScreenshot from "../assets/landing-station-management.webp";
import heroDashboardSmall from "../assets/lounge-hero-dashboard-small.webp";
import heroDashboard from "../assets/lounge-hero-dashboard.webp";
import { PUBLIC_ROUTES } from "./brand";
import { PublicFooter, PublicNavbar, SectionHeading } from "./PublicLayout";
import { usePublicMetadata } from "./metadata";

const trustPoints = [
  ["Built for", "PlayStation, billiard & ping-pong"],
  ["Live operations", "Session timing and cost"],
  ["Owner visibility", "Business analytics"],
  ["Team access", "Employee permissions"],
];

const transformations = [
  { from: "Notebook", to: "Live workspace", title: "Keep every session in one place.", description: "Stations, start times, statuses, and completed sessions stay organized on one live floor." },
  { from: "Mental calculation", to: "Automatic clarity", title: "Let the system track time and cost.", description: "Elapsed time and session cost stay connected to the station and its configured pricing." },
  { from: "Guessing", to: "Recorded performance", title: "Review what actually happened.", description: "Completed sessions flow into clear revenue, expense, and activity reporting." },
];

const operatingSteps = ["Station", "Start session", "Track time & cost", "End session", "Business data"];
const setupSteps = ["Create account", "Confirm email", "Approval", "Configure lounge", "Start"];
const analyticsValues = ["Revenue & expenses", "Completed sessions", "Busy periods", "Activity & station performance"];
const faqs = [
  ["Who is Lounge Hall for?", "It is built for lounges that run PlayStation, billiard, ping-pong, or a mix of these activities."],
  ["What happens after I contact you?", "Choose a contact channel and tell us about your lounge and the plan you want to activate."],
  ["How does account approval work?", "Create the Owner account, confirm its email address, and wait for the required Platform Admin approval before access begins."],
  ["Can employees use the system?", "Yes. Owners can add employees and manage their access while keeping Owner-level controls separate."],
  ["What does the subscription provide access to?", "The Lounge Hall workspace includes station and session management, configured pricing, employee access, and Business reporting."],
];

function CompactFlow({ label, title, steps }) {
  return <article className="public-workflow-card">
    <p className="public-workflow-card__label">{label}</p>
    <h3>{title}</h3>
    <ol>{steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong></li>)}</ol>
  </article>;
}

export function LandingPage() {
  usePublicMetadata({ title: "Lounge Hall | Smart Lounge Management", image: heroDashboard, structuredData: true });
  useEffect(() => {
    if (!window.location.hash) return undefined;
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const scrollToTarget = () => {
      const target = document.getElementById(targetId);
      if (!target) return;
      const previousBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      target.scrollIntoView();
      document.documentElement.style.scrollBehavior = previousBehavior;
    };
    const timers = [0, 150, 500].map((delay) => window.setTimeout(scrollToTarget, delay));
    window.addEventListener("load", scrollToTarget);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("load", scrollToTarget);
    };
  }, []);

  return <div className="public-site public-site--landing">
    <a className="public-skip-link" href="#main-content">Skip to main content</a>
    <PublicNavbar currentPath="/" />
    <main id="main-content">
      <section className="public-product-hero" aria-labelledby="public-hero-title">
        <div className="public-product-hero__backdrop" aria-hidden="true" />
        <div className="public-container public-product-hero__layout">
          <div className="public-product-hero__copy">
            <p className="public-kicker">Lounge operations, unified</p>
            <h1 id="public-hero-title">Every table. Every session. One system.</h1>
            <p>Manage PlayStation, billiard, and ping-pong sessions with accurate timing, automatic session cost calculation, employee access and permissions, and clear Business analytics.</p>
            <div className="public-hero__actions">
              <a className="public-button public-button--primary public-button--large" href={PUBLIC_ROUTES.contact}>Get Started</a>
              <a className="public-button public-button--secondary public-button--large" href="#how-it-works">Explore the Product</a>
            </div>
          </div>
          <div className="public-product-hero__visual">
            <figure className="public-hero-product-frame"><img src={heroDashboard} srcSet={`${heroDashboardSmall} 836w, ${heroDashboard} 1672w`} sizes="(max-width: 900px) calc(100vw - 32px), 58vw" width="1672" height="941" alt="Lounge Hall live floor showing available billiard and ping-pong stations" fetchpriority="high" decoding="async" /></figure>
          </div>
        </div>
      </section>

      <aside className="public-trust-strip" aria-label="Product capabilities"><div className="public-container">
        {trustPoints.map(([label, value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}
      </div></aside>

      <section className="public-band public-band--problems" aria-labelledby="problems-title"><div className="public-container public-problem-layout">
        <header className="public-section-heading"><p className="public-kicker">From manual work to control</p><h2 id="problems-title">Your lounge should not depend on a notebook.</h2><p>Lounge Hall replaces scattered notes and repeated calculations with one clear operational workspace.</p></header>
        <ol className="public-transformation-list">{transformations.map((item, index) => <li key={item.title}><span className="public-transformation-list__number">{String(index + 1).padStart(2, "0")}</span><div><p className="public-transformation-list__shift"><span>{item.from}</span><i aria-hidden="true">→</i><strong>{item.to}</strong></p><h3>{item.title}</h3><p>{item.description}</p></div></li>)}</ol>
      </div></section>

      <section className="public-band public-how" id="how-it-works" aria-labelledby="how-title"><div className="public-container">
        <SectionHeading kicker="One connected workflow" title="How Lounge Hall works" titleId="how-title">Run the floor clearly, then turn each completed session into useful Business data.</SectionHeading>
        <div className="public-workflow-grid"><CompactFlow label="A / Daily operation" title="Running the lounge" steps={operatingSteps} /><CompactFlow label="B / Account setup" title="Getting set up" steps={setupSteps} /></div>
      </div></section>

      <section className="public-band public-capabilities" id="features" aria-labelledby="features-title"><div className="public-container">
        <SectionHeading kicker="Product capabilities" title="The floor and the business stay connected" titleId="features-title">Two focused views cover the setup behind each station and the activity recorded across the day.</SectionHeading>
        <div className="public-capability-list">
          <figure className="public-capability"><figcaption><span>01 / Configuration</span><h3>Set up stations and pricing.</h3><p>Keep lounge equipment, availability, and hourly pricing organized before a session begins.</p></figcaption><div className="public-capability__media public-capability__media--configuration"><img src={stationManagementScreenshot} srcSet={`${stationManagementScreenshotSmall} 840w, ${stationManagementScreenshot} 1680w`} sizes="(max-width: 1080px) calc(100vw - 32px), 62vw" width="1680" height="945" loading="lazy" decoding="async" alt="Lounge Hall station management showing billiard tables, hourly rates, and edit controls" /></div></figure>
          <figure className="public-capability public-capability--reverse"><figcaption><span>02 / Business activity</span><h3>See when the floor gets busy.</h3><p>Review activity by hour and type without separating operations from the sessions that produced the data.</p></figcaption><div className="public-capability__media public-capability__media--analytics"><img src={businessActivityScreenshot} srcSet={`${businessActivityScreenshotSmall} 840w, ${businessActivityScreenshot} 1680w`} sizes="(max-width: 1080px) calc(100vw - 32px), 62vw" width="1680" height="945" loading="lazy" decoding="async" alt="Lounge Hall active sessions chart showing hourly billiard and ping-pong activity" /></div></figure>
        </div>
        <div className="public-owner-value" id="analytics" aria-labelledby="analytics-title"><SectionHeading kicker="Business visibility" title="A clearer view for the owner" titleId="analytics-title">Review the facts behind each operating period.</SectionHeading><ul>{analyticsValues.map((value) => <li key={value}>{value}</li>)}</ul></div>
      </div></section>

      <section className="public-band public-product-story public-subscriptions" id="plans" aria-labelledby="plans-title"><div className="public-container">
        <header className="public-subscriptions__heading"><p className="public-kicker">Subscription plans</p><h2 id="plans-title">Choose Your Plan</h2><p>Both plans provide access to the Lounge Hall operations and Business workspace.</p></header>
        <div className="public-subscription-grid">
          <a className="public-subscription-card" href={PUBLIC_ROUTES.contact} aria-label="Contact us for the $15 monthly plan with one free month on the first subscription"><span className="public-subscription-card__badge">First-time offer</span><h3>Monthly Plan</h3><p className="public-subscription-card__price" dir="ltr"><strong>$15</strong><span>/ month</span></p><p className="public-subscription-card__offer" lang="ar" dir="rtl">أول دفعة: <bdi>$15</bdi> مقابل شهرين</p><p className="public-subscription-card__description" lang="ar" dir="rtl">أول اشتراك بيعطيك شهر إضافي مجاناً، وبعدها <bdi>$15</bdi> بالشهر.</p><span className="public-subscription-card__action"><span>Contact Us for Monthly</span><span aria-hidden="true">→</span></span><span className="public-subscription-card__cue">Contact us to activate your account.</span></a>
          <a className="public-subscription-card public-subscription-card--featured" href={PUBLIC_ROUTES.contact} aria-label="Contact us for the yearly plan, $150 for 13 months"><span className="public-subscription-card__badge">Best Value</span><h3>Yearly Plan</h3><p className="public-subscription-card__price" dir="ltr"><strong>$150</strong><span>/ 13 months</span></p><p className="public-subscription-card__offer" lang="ar" dir="rtl">اشتراك سنة + شهر مجاني</p><p className="public-subscription-card__description" lang="ar" dir="rtl">بتاخد <bdi>13</bdi> شهر كاملين بسعر <bdi>$150</bdi>.</p><span className="public-subscription-card__action"><span>Contact Us for Yearly</span><span aria-hidden="true">→</span></span><span className="public-subscription-card__cue">Contact us to activate your account.</span></a>
        </div>
      </div></section>

      <section className="public-approval" aria-labelledby="approval-title"><div className="public-container public-approval__inner">
        <div><p className="public-kicker">Account access</p><h2 id="approval-title">A short, reviewed setup.</h2><p>Create your account, confirm your email, and receive approval before entering the workspace.</p></div>
        <ol aria-label="Account approval steps"><li>Create account</li><li>Confirm email</li><li>Approval</li><li>Start</li></ol>
      </div></section>

      <section className="public-band public-faq" aria-labelledby="faq-title"><div className="public-container public-faq__layout">
        <SectionHeading kicker="Before you start" title="Frequently asked questions" titleId="faq-title">Clear answers about the product and account access.</SectionHeading>
        <div className="public-faq__list">{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
      </div></section>

      <section className="public-final-cta" aria-labelledby="final-cta-title"><div className="public-container"><p className="public-kicker">Ready to begin?</p><h2 id="final-cta-title">Bring your lounge into one clear workspace.</h2><p>Contact us to discuss your lounge and activate the right plan.</p><div className="public-final-cta__actions"><a className="public-button public-button--primary public-button--large" href={PUBLIC_ROUTES.contact}>Get Started</a><a className="public-final-cta__account" href={PUBLIC_ROUTES.register}>Create your account <span>— approval required</span></a></div></div></section>
    </main>
    <PublicFooter />
  </div>;
}

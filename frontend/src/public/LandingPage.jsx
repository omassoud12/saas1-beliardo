import { useAuthSession } from "../hooks/useAuthSession";
import loungeHeroDashboard from "../assets/lounge-hero-dashboard.png";
import { PUBLIC_BRAND, PUBLIC_ROUTES } from "./brand";
import { PublicFooter, PublicNavbar, SectionHeading } from "./PublicLayout";
import { usePublicMetadata } from "./metadata";

const screenshots = Object.freeze({
  floor: { src: "/assets/product-screenshots/live-floor-overview.png", width: 1905, height: 820, alt: "Lounge Hell live floor showing available billiard and ping-pong stations in one operational overview" },
  stations: { src: "/assets/product-screenshots/station-management.png", width: 1915, height: 796, alt: "Lounge Hell station management screen with billiard tables, hourly rates, and edit controls" },
  summary: { src: "/assets/product-screenshots/monthly-business-summary.png", width: 1896, height: 833, alt: "Lounge Hell monthly business summary showing tracked days, completed sessions, and monthly hours" },
  analytics: { src: "/assets/product-screenshots/revenue-analytics.png", width: 1010, height: 737, alt: "Lounge Hell revenue analytics showing monthly revenue, revenue by day, and daily session volume charts" },
});

const problems = [
  ["Manual timing", "Separate timers and handwritten notes make corrections harder to verify."],
  ["Inconsistent billing", "Small differences in duration or pricing create avoidable disputes."],
  ["Fragmented operations", "Multiple activity types are difficult to monitor as one live floor."],
  ["Limited visibility", "Owners need performance reporting without rebuilding it by hand."],
];

const features = [
  ["01", "Live floor visibility", "See PlayStation, billiard, and ping-pong stations together with clear availability and session status."],
  ["02", "Accurate time and cost", "Keep elapsed time, paused duration, configured rates, and final cost in one controlled workflow."],
  ["03", "Station configuration", "Add equipment, set hourly pricing, and maintain the stations available to the floor."],
  ["04", "Business analytics", "Review daily activity, monthly revenue, session volume, and performance by activity type."],
  ["05", "Employee permissions", "Give employees operational access while owner and platform responsibilities remain separated."],
  ["06", "PDF reporting", "Export daily, monthly, and yearly business reports from the same reporting workspace."],
];

const onboarding = [
  ["Create", "Register the lounge owner account."],
  ["Confirm", "Verify the email address through Supabase Auth."],
  ["Approve", "Complete Platform Admin review and approval."],
  ["Configure", "Add stations, activity types, and hourly pricing."],
  ["Operate", "Manage sessions and review business performance."],
];

function HeroActions() {
  const { session, loading } = useAuthSession();
  return <div className="public-hero__actions">
    {loading ? <span className="public-account-loading" aria-label="Checking account session" /> : <a className="public-button public-button--primary public-button--large" href={session ? PUBLIC_ROUTES.login : PUBLIC_ROUTES.register}>{session ? "Open Dashboard" : "Create Your Account"}</a>}
    <a className="public-button public-button--secondary public-button--large" href="#how-it-works">See How It Works</a>
  </div>;
}

function ScreenshotFrame({ screenshot, label, className = "" }) {
  return <figure className={`public-screen-frame ${className}`.trim()}>
    <figcaption className="public-screen-frame__bar"><span aria-hidden="true"><i /><i /><i /></span><strong>{label}</strong><small>Real product interface</small></figcaption>
    <img src={screenshot.src} width={screenshot.width} height={screenshot.height} alt={screenshot.alt} loading="lazy" decoding="async" />
  </figure>;
}

function ProductPoints({ children }) {
  return <ul className="public-product-points">{children}</ul>;
}

export function LandingPage() {
  usePublicMetadata({ title: "Lounge Hell | Smart Lounge Management" });
  return <div className="public-site">
    <PublicNavbar currentPath="/" />
    <main>
      <section className="public-product-hero" aria-labelledby="public-hero-title">
        <div className="public-product-hero__backdrop" aria-hidden="true" />
        <div className="public-container public-product-hero__layout">
          <div className="public-product-hero__copy">
            <p className="public-kicker">Lounge operations, unified</p>
            <h1 id="public-hero-title">Every table. Every session. One system.</h1>
            <p>Manage PlayStation, billiard, and ping-pong sessions with accurate timing, automatic billing, employee control, and clear business analytics.</p>
            <HeroActions />
            <ul className="public-product-hero__scope" aria-label="Supported lounge activities">
              <li>PlayStation</li>
              <li>Billiards</li>
              <li>Ping Pong</li>
            </ul>
          </div>

          <div className="public-product-hero__visual">
            <figure className="public-hero-product-frame">
              <img
                src={loungeHeroDashboard}
                width="1672"
                height="941"
                alt="Lounge Hell station management dashboard"
                fetchpriority="high"
                decoding="async"
              />
            </figure>
            <p className="public-powered">Powered by <strong>{PUBLIC_BRAND.companyName}</strong></p>
          </div>
        </div>
      </section>

      <section className="public-band public-band--problems"><div className="public-container public-problem-layout"><SectionHeading kicker="Operational clarity" title="Replace scattered checks with one operating picture.">A busy lounge moves quickly. Timing, station availability, and pricing should remain easy to see and verify.</SectionHeading><div className="public-problem-list">{problems.map(([title, text], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>

      <section className="public-band public-product-story" id="product-tour"><div className="public-container public-showcase-row">
        <div className="public-showcase-copy"><p className="public-kicker">Configure the floor</p><h2>Build the workspace around your equipment.</h2><p>Keep station setup and hourly rates organized in the same system your team uses every day.</p><ProductPoints><li>Add and maintain lounge stations</li><li>Set station-specific hourly rates</li><li>See availability before making changes</li></ProductPoints></div>
        <ScreenshotFrame screenshot={screenshots.stations} label="Dashboard / Station management" className="public-screen-frame--showcase" />
      </div></section>

      <section className="public-band" id="features"><div className="public-container"><SectionHeading kicker="Connected operations" title="Built around the work a lounge repeats every day.">The interface keeps floor control, configuration, access, and reporting connected without splitting the operation across separate tools.</SectionHeading><div className="public-feature-grid public-feature-grid--compact">{features.map(([number, title, text]) => <article className="public-feature-card" key={title}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section className="public-band public-band--how" id="how-it-works"><div className="public-container"><SectionHeading kicker="Approval to operation" title="A controlled path onto the platform.">Registration, confirmation, and approval remain explicit before a lounge can operate.</SectionHeading><ol className="public-onboarding">{onboarding.map(([title, text], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></div></section>

      <section className="public-band public-band--analytics" id="analytics"><div className="public-container public-analytics-story">
        <div className="public-showcase-copy"><p className="public-kicker">Business visibility</p><h2>Move from completed sessions to decisions you can explain.</h2><p>Monthly totals provide the overview. Revenue and session charts reveal when activity happened and which lounge type contributed.</p><ProductPoints><li>Tracked days, sessions, and completed usage</li><li>Revenue by day and daily session volume</li><li>Daily, monthly, and yearly reporting views</li></ProductPoints></div>
        <div className="public-layered-screens">
          <ScreenshotFrame screenshot={screenshots.summary} label="Business / Monthly summary" className="public-screen-frame--summary" />
          <ScreenshotFrame screenshot={screenshots.analytics} label="Monthly report / Revenue detail" className="public-screen-frame--analytics-detail" />
        </div>
      </div></section>

      <section className="public-band public-band--security"><div className="public-container"><SectionHeading kicker="Roles and isolation" title="Access follows responsibility.">The interface changes with the role, while sensitive authorization remains enforced behind the public website.</SectionHeading><div className="public-role-grid"><article><span>Platform</span><h3>Platform Admin</h3><p>Reviews lounge registrations and controls platform-level approval.</p></article><article><span>Business</span><h3>Lounge Owner</h3><p>Configures stations, employees, pricing, analytics, and business reports.</p></article><article><span>Floor</span><h3>Employee</h3><p>Receives limited operational access for the lounge where they work.</p></article></div><p className="public-security-note"><strong>Separated by design.</strong> Each lounge has isolated data, and sensitive permissions are enforced through the backend and Supabase RLS.</p></div></section>

      <section className="public-band public-platform-overview"><div className="public-container"><SectionHeading kicker="One connected platform" title="The floor and the business stay in the same picture.">Four real product views show the operating path from station setup to live visibility and monthly performance.</SectionHeading><div className="public-product-mosaic">
        <figure className="public-mosaic-item public-mosaic-item--floor"><img src={screenshots.floor.src} width={screenshots.floor.width} height={screenshots.floor.height} loading="lazy" decoding="async" alt={screenshots.floor.alt} /><figcaption>Live floor</figcaption></figure>
        <figure className="public-mosaic-item public-mosaic-item--stations"><img src={screenshots.stations.src} width={screenshots.stations.width} height={screenshots.stations.height} loading="lazy" decoding="async" alt={screenshots.stations.alt} /><figcaption>Station management</figcaption></figure>
        <figure className="public-mosaic-item public-mosaic-item--summary"><img src={screenshots.summary.src} width={screenshots.summary.width} height={screenshots.summary.height} loading="lazy" decoding="async" alt={screenshots.summary.alt} /><figcaption>Monthly summary</figcaption></figure>
        <figure className="public-mosaic-item public-mosaic-item--charts"><img src={screenshots.analytics.src} width={screenshots.analytics.width} height={screenshots.analytics.height} loading="lazy" decoding="async" alt={screenshots.analytics.alt} /><figcaption>Revenue analytics</figcaption></figure>
      </div></div></section>

      <section className="public-final-cta"><div className="public-container"><p className="public-kicker">Take control of the floor</p><h2>Your lounge deserves a clearer operating system.</h2><p>Bring sessions, pricing, employees, and business performance into one controlled workspace.</p><div><a className="public-button public-button--primary public-button--large" href={PUBLIC_ROUTES.register}>Create Account</a><a className="public-button public-button--secondary public-button--large" href={PUBLIC_ROUTES.contact}>Contact Us</a></div></div></section>
    </main>
    <PublicFooter />
  </div>;
}

import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "../hooks/useAuthSession";
import carouselActiveSessions from "../assets/carousel-active-sessions.png";
import carouselDailySummary from "../assets/carousel-daily-summary.png";
import carouselStationManagement from "../assets/carousel-station-management.png";
import loungeHeroDashboard from "../assets/lounge-hero-dashboard.png";
import { PUBLIC_BRAND, PUBLIC_ROUTES } from "./brand";
import { PublicFooter, PublicNavbar, SectionHeading } from "./PublicLayout";
import { usePublicMetadata } from "./metadata";

const screenshots = Object.freeze({
  floor: { src: "/assets/product-screenshots/live-floor-overview.png", width: 1905, height: 820, alt: "Lounge Hell live floor showing available billiard and ping-pong stations in one operational overview" },
  stations: { src: "/assets/product-screenshots/station-management.png", width: 1915, height: 796, alt: "Lounge Hell station management screen with billiard tables, hourly rates, and edit controls" },
});

const platformSlides = Object.freeze([
  {
    src: screenshots.floor.src,
    width: screenshots.floor.width,
    height: screenshots.floor.height,
    title: "Live floor",
    category: "Operations",
    description: "See every available and active station in one view.",
    alt: screenshots.floor.alt,
  },
  {
    src: carouselStationManagement,
    width: 1680,
    height: 945,
    title: "Station control",
    category: "Configuration",
    description: "Keep equipment and hourly pricing organized.",
    alt: "Lounge Hell station management showing three billiard tables, hourly rates, and edit controls",
  },
  {
    src: carouselDailySummary,
    width: 1680,
    height: 945,
    title: "Business summary",
    category: "Daily clarity",
    description: "Review sessions, usage, peak activity, and revenue.",
    alt: "Lounge Hell daily business summary showing session, hours, peak activity, and revenue totals",
  },
  {
    src: carouselActiveSessions,
    width: 1680,
    height: 945,
    title: "Activity analytics",
    category: "Business rhythm",
    description: "See session activity by hour and activity type.",
    alt: "Lounge Hell active sessions chart showing hourly billiard and ping-pong session activity",
  },
]);

const transformations = [
  {
    from: "Notebook",
    to: "Live workspace",
    title: "No more handwritten session records.",
    description: "Every station, start time, status, and completed session stays organized in one live workspace.",
  },
  {
    from: "Mental calculation",
    to: "Automatic clarity",
    title: "No more repeated calculations.",
    description: "Elapsed time and session cost remain clear, consistent, and connected to the station being used.",
  },
  {
    from: "Guessing",
    to: "Measurable performance",
    title: "See how the business changes over time.",
    description: "Review daily and monthly performance to understand activity, revenue, and business growth.",
  },
];

const operations = [
  ["Open a station", "Choose an available station from the live floor."],
  ["Start and control the session", "Start, pause, resume, or keep the session as service changes."],
  ["Track elapsed time and cost", "Duration and configured pricing remain visible together."],
  ["End the session", "Close the session with its final time and cost recorded."],
  ["Review the result", "Completed activity flows into the business reporting view."],
];

const onboarding = [
  ["Create your Owner account", "Register the lounge and its Owner details."],
  ["Confirm your email", "Verify the address linked to the new account."],
  ["Receive Platform Admin approval", "Access begins only after the required platform review."],
  ["Configure stations and pricing", "Add the equipment and hourly rates used on the floor."],
  ["Start managing operations", "Open the live floor and manage the first session."],
];

function HeroActions() {
  const { session, loading } = useAuthSession();
  return <div className="public-hero__actions">
    {loading ? <span className="public-account-loading" aria-label="Checking account session" /> : <a className="public-button public-button--primary public-button--large" href={session ? PUBLIC_ROUTES.login : PUBLIC_ROUTES.register}>{session ? "Open Dashboard" : "Create Your Account"}</a>}
    <a className="public-button public-button--secondary public-button--large" href="#how-it-works">See How It Works</a>
  </div>;
}

function ProductCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [timerRevision, setTimerRevision] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const carouselRef = useRef(null);
  const touchStart = useRef(null);
  const autoplayPaused = isHovered || hasFocus || isTouching || !isInViewport || !isDocumentVisible || prefersReducedMotion;

  const resetAutoplay = () => setTimerRevision((revision) => revision + 1);
  const showPrevious = () => {
    setActiveIndex((index) => (index - 1 + platformSlides.length) % platformSlides.length);
    resetAutoplay();
  };
  const showNext = () => {
    setActiveIndex((index) => (index + 1) % platformSlides.length);
    resetAutoplay();
  };
  const showSlide = (index) => {
    setActiveIndex(index);
    resetAutoplay();
  };

  useEffect(() => {
    const node = carouselRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsInViewport(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsInViewport(entry.isIntersecting && entry.intersectionRatio >= 0.35);
    }, { threshold: [0, 0.35, 1] });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setIsDocumentVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionPreference = (event) => setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener("change", handleMotionPreference);
    return () => mediaQuery.removeEventListener("change", handleMotionPreference);
  }, []);

  useEffect(() => {
    if (autoplayPaused) return undefined;
    const timer = window.setTimeout(() => {
      const modalOpen = document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]');
      if (modalOpen) {
        setTimerRevision((revision) => revision + 1);
        return;
      }
      setActiveIndex((index) => (index + 1) % platformSlides.length);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, autoplayPaused, timerRevision]);

  const handleKeyDown = (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    }
  };

  const handlePointerDown = (event) => {
    if (event.pointerType !== "touch") return;
    touchStart.current = { x: event.clientX, y: event.clientY };
    setIsTouching(true);
    resetAutoplay();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerUp = (event) => {
    if (event.pointerType !== "touch") return;
    setIsTouching(false);
    if (!touchStart.current) return;
    const distanceX = event.clientX - touchStart.current.x;
    const distanceY = event.clientY - touchStart.current.y;
    touchStart.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (Math.abs(distanceX) < 45 || Math.abs(distanceX) <= Math.abs(distanceY)) return;
    if (distanceX > 0) showPrevious();
    else showNext();
  };

  return <div
    className="public-product-carousel"
    ref={carouselRef}
    role="region"
    aria-roledescription="carousel"
    aria-label="Lounge Hell product screenshots"
    tabIndex="0"
    onKeyDown={handleKeyDown}
    onPointerDown={handlePointerDown}
    onPointerUp={handlePointerUp}
    onPointerCancel={() => { touchStart.current = null; setIsTouching(false); }}
    onMouseEnter={() => setIsHovered(true)}
    onMouseLeave={() => setIsHovered(false)}
    onFocus={() => setHasFocus(true)}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false); }}
  >
    <div className="public-product-carousel__viewport">
      <div className="public-product-carousel__track">
        {platformSlides.map((slide, index) => <figure
          className={`public-product-carousel__slide${index === activeIndex ? " is-active" : ""}`}
          key={slide.title}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of ${platformSlides.length}: ${slide.title}`}
          aria-hidden={index !== activeIndex}
        >
          <img
            src={slide.src}
            width={slide.width}
            height={slide.height}
            alt={slide.alt}
            loading="lazy"
            decoding="async"
            draggable="false"
          />
          <figcaption>
            <span>{slide.category}</span>
            <strong>{slide.title}</strong>
            <p>{slide.description}</p>
          </figcaption>
        </figure>)}
      </div>
    </div>

    <div className="public-product-carousel__navigation">
      <button type="button" onClick={showPrevious} aria-label="Show previous product screenshot">
        <span aria-hidden="true">←</span> Previous
      </button>
      <div className="public-product-carousel__pagination" aria-label="Choose product screenshot">
        {platformSlides.map((slide, index) => <button
          type="button"
          key={slide.title}
          className={index === activeIndex ? "is-active" : ""}
          onClick={() => showSlide(index)}
          aria-label={`Show ${slide.title}`}
          aria-current={index === activeIndex ? "true" : undefined}
        ><span>{String(index + 1).padStart(2, "0")}</span></button>)}
      </div>
      <button type="button" onClick={showNext} aria-label="Show next product screenshot">
        Next <span aria-hidden="true">→</span>
      </button>
    </div>
    <p className="public-product-carousel__status" aria-live={autoplayPaused ? "polite" : "off"}>{platformSlides[activeIndex].title}, slide {activeIndex + 1} of {platformSlides.length}</p>
  </div>;
}

export function LandingPage() {
  usePublicMetadata({ title: "Lounge Hell | Smart Lounge Management" });
  return <div className="public-site public-site--landing">
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
            <p className="public-product-hero__signature"><span>by</span><a href={PUBLIC_BRAND.website} target="_blank" rel="noreferrer">{PUBLIC_BRAND.companyName}</a></p>
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
          </div>
        </div>
      </section>

      <section className="public-band public-band--problems" aria-labelledby="problems-title"><div className="public-container public-problem-layout">
        <header className="public-section-heading"><p className="public-kicker">From manual work to control</p><h2 id="problems-title">Your lounge should not depend on a notebook.</h2><p>Lounge Hell replaces scattered notes, repeated calculations, and uncertain reporting with one clear operational system.</p></header>
        <ol className="public-transformation-list">{transformations.map((item, index) => <li key={item.title}><span className="public-transformation-list__number">{String(index + 1).padStart(2, "0")}</span><div><p className="public-transformation-list__shift"><span>{item.from}</span><i aria-hidden="true">→</i><strong>{item.to}</strong></p><h3>{item.title}</h3><p>{item.description}</p></div></li>)}</ol>
      </div></section>

      <section className="public-band public-product-story" id="product-tour" aria-labelledby="product-story-title"><div className="public-container public-editorial-product">
        <div className="public-editorial-product__copy"><p className="public-kicker">Configure the floor</p><h2 id="product-story-title">Build the workspace around your equipment.</h2><p>Keep station setup and hourly rates organized in the same system your team uses every day.</p><dl className="public-product-observations"><div><dt>Equipment</dt><dd>Add and maintain the stations available to the lounge.</dd></div><div><dt>Pricing</dt><dd>Keep each station connected to its configured hourly rate.</dd></div><div><dt>Availability</dt><dd>Review current status before making a floor change.</dd></div></dl></div>
        <figure className="public-editorial-product__visual"><img src={screenshots.stations.src} width={screenshots.stations.width} height={screenshots.stations.height} loading="lazy" decoding="async" alt={screenshots.stations.alt} /><figcaption><span>Station management</span><strong>Configuration stays connected to daily operations.</strong></figcaption></figure>
      </div></section>

      <section className="public-band public-band--operations" id="features"><div className="public-container"><SectionHeading kicker="Daily workflow" title="Connected operations">One session moves through a clear sequence—from opening a station to reviewing the recorded result.</SectionHeading><ol className="public-operation-flow">{operations.map(([title, text], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{text}</p></li>)}</ol></div></section>

      <section className="public-band public-band--how" id="how-it-works"><div className="public-container"><SectionHeading kicker="Getting started" title="How to start with Lounge Hell">Create your account, complete approval, and prepare your lounge for its first managed session.</SectionHeading><ol className="public-onboarding">{onboarding.map(([title, text], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></div></section>

      <section className="public-band public-band--analytics" id="analytics"><div className="public-container"><SectionHeading kicker="Business visibility" title="Business data becomes useful when it stays connected to the floor.">Move from completed sessions to a daily picture you can read, compare, and explain.</SectionHeading><div className="public-visibility-panels">
        <figure className="public-visibility-panel"><figcaption><span>01 / Daily clarity</span><h3>See the whole business day.</h3><p>See sessions, completed activity, total hours, peak activity, and revenue in one business view.</p></figcaption><img src={carouselDailySummary} width="1680" height="945" loading="lazy" decoding="async" alt="Lounge Hell Daily Summary with total sessions, completed activity, total hours, peak activity, revenue, and activity breakdown" /></figure>
        <figure className="public-visibility-panel public-visibility-panel--reverse"><figcaption><span>02 / Activity across the day</span><h3>Understand when the floor gets busy.</h3><p>See when PlayStation, billiard, and ping-pong activity rises throughout the operating day.</p></figcaption><img src={carouselActiveSessions} width="1680" height="945" loading="lazy" decoding="async" alt="Lounge Hell Business Day Active Sessions chart showing activity by hour for PlayStation, billiard, and ping-pong" /></figure>
      </div></div></section>

      <section className="public-band public-platform-overview"><div className="public-container"><SectionHeading kicker="Product tour" title="One connected platform">The floor and the business stay in the same picture.</SectionHeading><ProductCarousel /></div></section>

      <section className="public-final-cta"><div className="public-container"><p className="public-kicker">Take control of the floor</p><h2>Your lounge deserves a clearer operating system.</h2><p>Bring sessions, pricing, employees, and business performance into one controlled workspace.</p><div><a className="public-button public-button--primary public-button--large" href={PUBLIC_ROUTES.register}>Create Account</a><a className="public-button public-button--secondary public-button--large" href={PUBLIC_ROUTES.contact}>Contact Us</a></div><p className="public-final-signature">by <a href={PUBLIC_BRAND.website} target="_blank" rel="noreferrer">{PUBLIC_BRAND.companyName}</a></p></div></section>
    </main>
    <PublicFooter />
  </div>;
}

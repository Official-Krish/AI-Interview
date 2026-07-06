import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useSession } from "@/lib/auth";

const ease = [0.22, 1, 0.36, 1] as const;

export function Opening() {
  const { data: session } = useSession();
  const user = session?.user ?? null;

  return (
    <section className="opening-hero">
      {/* Ambient dot grid — subtle texture across the full viewport */}
      <div className="opening-dot-grid" aria-hidden />

      {/* Combined atmosphere — aurora glow + vignette + scrim in one layer */}
      <div className="opening-atmosphere" aria-hidden />

      {/* Corner ticks — editorial framing */}
      <div className="opening-corners" aria-hidden>
        <span className="opening-corner opening-corner-tl" />
        <span className="opening-corner opening-corner-tr" />
        <span className="opening-corner opening-corner-bl" />
        <span className="opening-corner opening-corner-br" />
      </div>

      {/* Content */}
      <div className="opening-content">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="opening-badge-wrap"
        >
          <span className="opening-badge">
            <span className="opening-badge-dot" />
            <span className="opening-badge-label">Early Access</span>
            <span className="opening-badge-sep" />
            <span className="opening-badge-meta">Limited spots open</span>
          </span>
          <div className="opening-badge-connector" aria-hidden />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.2, ease }}
          className="opening-headline"
        >
          <span className="opening-headline-line">Every interview</span>
          <span className="opening-headline-line opening-headline-italic">
            leaves a <span className="opening-headline-dot">fingerprint.</span>
          </span>
        </motion.h1>

        {/* Description — editorial pull-quote style */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45, ease }}
          className="opening-description"
        >
          <div className="opening-desc-rule" aria-hidden />
          <p className="opening-desc-lead">
            Practice realistic AI interviews. Every session updates a living
            profile of how you think, communicate, and make decisions under
            pressure.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6, ease }}
          className="opening-cta-area"
        >
          <Link to={user ? "/dashboard" : "/signup"} className="opening-cta">
            <span className="opening-cta-label">
              {user ? "Go to dashboard" : "Start a session"}
            </span>
            <span className="opening-cta-arrow" aria-hidden>
              →
            </span>
          </Link>

          <div className="opening-assurance">
            <span>No credit card</span>
            <span className="opening-assurance-dot" />
            <span>Free during early access</span>
            <span className="opening-assurance-dot" />
            <span>3 sessions / week</span>
          </div>
        </motion.div>

        {/* Metrics strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.8, ease }}
          className="opening-metrics"
        >
          <div className="opening-metric" tabIndex={0}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opening-metric-icon"
              aria-hidden
            >
              <circle cx="12" cy="5" r="2" />
              <circle cx="5" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
              <line x1="12" y1="7" x2="12" y2="17" />
              <line x1="12" y1="5" x2="5" y2="12" />
              <line x1="12" y1="5" x2="19" y2="12" />
              <line x1="5" y1="12" x2="12" y2="19" />
              <line x1="19" y1="12" x2="12" y2="19" />
            </svg>
            <div className="opening-metric-body">
              <span className="opening-metric-title">How you think</span>
              <span className="opening-metric-desc">
                Structuring ambiguity under pressure
              </span>
            </div>
          </div>
          <div className="opening-metric" tabIndex={0}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opening-metric-icon"
              aria-hidden
            >
              <line x1="4" y1="9" x2="4" y2="15" />
              <line x1="8" y1="6" x2="8" y2="18" />
              <line x1="12" y1="3" x2="12" y2="21" />
              <line x1="16" y1="8" x2="16" y2="16" />
              <line x1="20" y1="10" x2="20" y2="14" />
            </svg>
            <div className="opening-metric-body">
              <span className="opening-metric-title">How you communicate</span>
              <span className="opening-metric-desc">
                Clarity, confidence, signal strength
              </span>
            </div>
          </div>
          <div className="opening-metric" tabIndex={0}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opening-metric-icon"
              aria-hidden
            >
              <path d="M12 22V13m0 0a5 5 0 0 1 5-5h3m-8 5a5 5 0 0 0-5-5H3m17 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM3 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
            </svg>
            <div className="opening-metric-body">
              <span className="opening-metric-title">How you decide</span>
              <span className="opening-metric-desc">
                Trade-offs, adaptability, ownership
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

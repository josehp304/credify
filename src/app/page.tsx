"use client";
import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import styles from "./page.module.css";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const CAPABILITIES = [
  {
    index: "01",
    name: "Refund photos",
    href: "/features/refund-verification",
    desc: "Forensic models score every damage photo for AI generation, backed by metadata analysis. A convincing fake stops being convincing.",
  },
  {
    index: "02",
    name: "Document watermarks",
    href: "/features/document-watermark",
    desc: "An invisible watermark written into the pixels of a certificate. Any AI edit or re-render destroys it, so absence itself is the tamper signal.",
  },
  {
    index: "03",
    name: "ID verification",
    href: "/features/id-verification",
    desc: "A signed QR code anchors each card to a database record. OCR cross-checks the photographed card against that ground truth, field by field.",
  },
  {
    index: "04",
    name: "Review credibility",
    href: "/features/review-scoring",
    desc: "Reviews are scored for AI text and spam patterns, then weighted by the author's history. A clean review from a burned identity still gets flagged.",
  },
];

export default function Home() {
  const reduce = useReducedMotion();

  return (
    <div className={styles.page}>
      {/* ============ Hero ============ */}
      <section className={styles.hero}>
        <motion.div
          className={styles.heroCopy}
          initial={reduce ? false : "hidden"}
          animate="visible"
          transition={{ staggerChildren: 0.09 }}
        >
          <motion.h1
            className={styles.heroTitle}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
            }}
          >
            Know what&apos;s real.
          </motion.h1>
          <motion.p
            className={styles.heroSub}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
            }}
          >
            Credify inspects images, documents, IDs, and reviews for AI generation
            and tampering, then remembers the verdict. Every check feeds one
            persistent trust score that fraud can&apos;t outrun.
          </motion.p>
          <motion.div
            className={styles.heroActions}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
            }}
          >
            <Link href="/signup" className={styles.primaryCta}>
              Start verifying
              <ArrowRight size={16} strokeWidth={2.25} />
            </Link>
            <Link href="/dashboard" className={styles.secondaryCta}>
              Open the dashboard
            </Link>
          </motion.div>
        </motion.div>

        <motion.aside
          className={styles.report}
          aria-label="Example evidence report"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: EASE }}
        >
          <header className={styles.reportHead}>
            <span>Evidence report</span>
            <span className={styles.reportId}>log&nbsp;#4821</span>
          </header>
          <dl className={styles.reportBody}>
            <div className={styles.reportRow}>
              <dt>File</dt>
              <dd>refund-photo.jpg</dd>
            </div>
            <div className={styles.reportRow}>
              <dt>AI forensics</dt>
              <dd>
                0.94 <em className={styles.flagFail}>flagged</em>
              </dd>
            </div>
            <div className={styles.reportRow}>
              <dt>Metadata</dt>
              <dd>
                3 anomalies <em className={styles.flagFail}>flagged</em>
              </dd>
            </div>
            <div className={styles.reportRow}>
              <dt>Identity history</dt>
              <dd>2 prior flags</dd>
            </div>
            <div className={styles.reportRow}>
              <dt>Trust score</dt>
              <dd>
                62 <span className={styles.scoreArrow} aria-hidden>&#8594;</span> 47
              </dd>
            </div>
          </dl>
          <footer className={styles.reportVerdict}>
            <span className={styles.verdictLabel}>Verdict</span>
            <span className={styles.verdictValue}>Refund denied</span>
          </footer>
          <p className={styles.reportMeta}>Checked in 1.8s · Hive AI v3 · EXIF forensics</p>
        </motion.aside>
      </section>

      {/* ============ Capabilities ============ */}
      <section id="features" className={styles.capabilities}>
        <Reveal>
          <h2 className={styles.sectionTitle}>Four checks. One score.</h2>
          <p className={styles.sectionSub}>
            Each verification stands on its own. Together they build a memory of
            who can be trusted.
          </p>
        </Reveal>
        <div className={styles.capList} role="list">
          {CAPABILITIES.map((cap, i) => (
            <Reveal key={cap.index} delay={i * 0.05}>
              <Link href={cap.href} className={styles.capRow} role="listitem">
                <span className={styles.capIndex}>{cap.index}</span>
                <span className={styles.capName}>{cap.name}</span>
                <span className={styles.capDesc}>{cap.desc}</span>
                <span className={styles.capLink} aria-hidden>
                  <ArrowRight size={18} strokeWidth={1.75} />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ Trust score ============ */}
      <section className={styles.trust}>
        <Reveal className={styles.trustInner}>
          <h2 className={styles.trustTitle}>
            Trust is slow to earn and fast to lose. By design.
          </h2>
          <p className={styles.trustSub}>
            Every verification moves a permanent score tied to an identity, not an
            account. Five clean checks never erase one fraud.
          </p>

          <div className={styles.deltas}>
            <div className={styles.delta}>
              <span className={`${styles.deltaValue} ${styles.deltaPass}`}>+3</span>
              <span className={styles.deltaName}>Clean check</span>
            </div>
            <div className={styles.delta}>
              <span className={styles.deltaValue}>&minus;5</span>
              <span className={styles.deltaName}>Suspicious</span>
            </div>
            <div className={styles.delta}>
              <span className={`${styles.deltaValue} ${styles.deltaFail}`}>&minus;15</span>
              <span className={styles.deltaName}>Confirmed fraud</span>
            </div>
          </div>

          <div className={styles.scale} aria-hidden>
            <div className={styles.scaleTrack}>
              <div className={styles.scaleDeny} />
              <div className={styles.scaleReview} />
              <div className={styles.scaleMark} style={{ left: "80%" }} />
            </div>
            <div className={styles.scaleLabels}>
              <span>0 &middot; below 50, requests are denied outright</span>
              <span>below 80, extra review</span>
              <span>new identities start at 80</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ Extension ============ */}
      <section className={styles.extension}>
        <Reveal className={styles.extCopy}>
          <h2 className={styles.sectionTitle}>Bring it to the storefront.</h2>
          <p className={styles.sectionSub}>
            The Credify extension reads reviews as you shop and labels the ones
            written by machines. No account, no setup, works on any store.
          </p>
          <a href="/extension.zip" download className={styles.primaryCta}>
            Download the extension
            <ArrowRight size={16} strokeWidth={2.25} />
          </a>
          <p className={styles.extNote}>
            Loads unpacked in Chrome: open <code>chrome://extensions</code>, turn on
            Developer mode, and choose the extracted folder.
          </p>
        </Reveal>

        <Reveal delay={0.1} className={styles.extMock}>
          <div className={styles.mockReview}>
            <span className={`${styles.mockBadge} ${styles.mockBadgeAi}`}>AI likely</span>
            <p className={styles.mockText}>
              &ldquo;This product changed my life! Truly a testament to modern
              innovation. In conclusion, five stars.&rdquo;
            </p>
            <span className={styles.mockStars}>&#9733;&#9733;&#9733;&#9733;&#9733;</span>
          </div>
          <div className={styles.mockReview}>
            <span className={`${styles.mockBadge} ${styles.mockBadgeOk}`}>Genuine</span>
            <p className={styles.mockText}>
              &ldquo;Zipper broke after two weeks but the seller sent a replacement
              quickly. Runs a size small.&rdquo;
            </p>
            <span className={styles.mockStars}>&#9733;&#9733;&#9733;&#9733;&#9734;</span>
          </div>
        </Reveal>
      </section>

      {/* ============ Closing ============ */}
      <section className={styles.closing}>
        <Reveal className={styles.closingInner}>
          <h2 className={styles.closingTitle}>Start with one file.</h2>
          <p className={styles.closingSub}>
            Upload something you doubt. Get a verdict with the evidence attached.
          </p>
          <Link href="/signup" className={styles.primaryCta}>
            Create an account
            <ArrowRight size={16} strokeWidth={2.25} />
          </Link>
        </Reveal>
      </section>
    </div>
  );
}

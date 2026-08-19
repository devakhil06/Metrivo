"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import styles from "./home.module.css";

const answers = [
  { question: "Can I afford to hire next month?", answer: "Yes—with a buffer. Your current cash trend supports one hire up to ₹62K/month while keeping a 6-month runway.", source: "Cash flow · Payroll · Forecast" },
  { question: "Why did profit dip in June?", answer: "Shipping and material costs rose 14.2%. Revenue held steady, so those two categories explain nearly all of the margin change.", source: "Expenses · Margin · June 2026" },
  { question: "Where is the easiest growth?", answer: "Repeat orders are the clearest opportunity. A 9% lift from returning customers would add roughly ₹74K in monthly revenue.", source: "Customers · Revenue · Opportunity" },
];
const graphBars = [26, 34, 31, 43, 39, 55, 49, 66, 60, 77, 72, 91];

export default function HomePage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [activeAnswer, setActiveAnswer] = useState(0);

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setDemoOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  return (
    <main className={styles.landing}>
      <div className={styles.ambientOne} /><div className={styles.ambientTwo} />
      <header className={styles.header}>
        <Link href="#top" className={styles.brand} aria-label="Metrivo home"><BrandLogo size={32} priority /><span>Metrivo</span></Link>
        <Link href="/login" className={styles.headerCta}>Log in <span>↗</span></Link>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><i /> Your finances, finally fluent</p>
          <h1>See the story<br /><span>inside your numbers.</span></h1>
          <div className={styles.heroActions}>
            <Link href="#account" className={styles.primaryButton}>Start making sense <span>↗</span></Link>
            <button type="button" className={styles.secondaryButton} onClick={() => setDemoOpen(true)}><span className={styles.play}>▶</span> Watch the story</button>
          </div>
          <div className={styles.trustRow}><span>◇ Private by design</span><i>•</i><span>Clear in minutes</span><i>•</i><span>No finance degree required</span></div>
        </div>

        <div className={styles.heroVisual} aria-label="Metrivo dashboard preview">
          <div className={styles.orbit} />
          <div className={styles.dashboard}>
            <div className={styles.dashboardTop}><strong><i /> Overview</strong><span>Jan – Dec 2026⌄</span><b>AK</b></div>
            <div className={styles.dashboardBody}>
              <aside><i className={styles.activeDot} /><i /><i /><i /><i /></aside>
              <div className={styles.dashboardMain}>
                <div className={styles.dashboardIntro}><div><small>Good morning, Akhil</small><h2>Your business is moving forward.</h2></div><span><i /> Strong health</span></div>
                <div className={styles.metrics}>
                  <article><small>Net revenue</small><strong>₹8.42L</strong><span>↗ 18.2%</span></article>
                  <article><small>Net profit</small><strong>₹2.18L</strong><span>↗ 12.4%</span></article>
                  <article><small>Cash runway</small><strong>8.4 mo</strong><em>Healthy</em></article>
                </div>
                <div className={styles.chartCard}><div><small>Cash flow</small><strong>₹5.76L</strong><span>+24.8% this year</span></div><div className={styles.graph}>{graphBars.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>
              </div>
            </div>
          </div>
          <div className={`${styles.floatingCard} ${styles.riskCard}`}><b>!</b><span><small>Risk caught early</small><strong>Vendor costs rising</strong></span><em>+18%</em></div>
          <div className={`${styles.floatingCard} ${styles.aiCard}`}><b>✦</b><span><small>AI Analyst</small><strong>3 opportunities found</strong></span><em>↗</em></div>
        </div>
      </section>

      <section className={styles.signalStrip} aria-label="Metrivo capabilities"><p>One upload. A clearer business.</p><div><span>Revenue</span><i /><span>Expenses</span><i /><span>Forecasts</span><i /><span>Anomalies</span><i /><span>Opportunities</span></div></section>

      <section className={styles.section} id="product">
        <div className={styles.sectionHeading}><p className={styles.eyebrow}><i /> From noise to knowing</p><h2>Clarity has a sequence.</h2><p>Context first. Meaning second. Action last.</p></div>
        <div className={styles.sequenceGrid}>
          <article><div><span>01</span><b>⇧</b></div><div className={styles.fileStack}><i>CSV</i><i>XLS</i><i>UPI</i></div><h3>Bring the messy data.</h3><p>Upload statements in the formats you already use. Metrivo cleans, normalizes, and deduplicates every row.</p></article>
          <article className={styles.featured}><div><span>02</span><b>⌁</b></div><div className={styles.radar}><i /><i /><b>✦</b></div><h3>See what changed—and why.</h3><p>Deterministic analytics surface trends, risks, anomalies, and the forces moving your business.</p></article>
          <article><div><span>03</span><b>ϟ</b></div><div className={styles.actionList}><i>✓ Protect next month’s margin</i><i>✓ Follow the repeat-order lift</i><i>✓ Renegotiate top vendor</i></div><h3>Know the next move.</h3><p>Recommendations arrive with evidence and impact, so your attention goes where it matters most.</p></article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.insights}`}>
        <div className={styles.insightsCopy}><p className={styles.eyebrow}><i /> Business intelligence, without the fog</p><h2>Every signal.<br /><span>One calm view.</span></h2><p>Revenue, expenses, profit, cash flow, and forecasts tell one connected story—not five disconnected charts.</p><Link href="#account">Explore your business story →</Link></div>
        <div className={styles.bento}>
          <article><small>↗ 90-day forecast</small><strong>₹10.8L</strong><p>Likely closing balance</p><div className={styles.microBars}>{graphBars.slice(2).map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div></article>
          <article><small><b>!</b> Anomaly</small><p>Software spend is <strong>2.4×</strong> its usual range.</p><div className={styles.meter}><i /></div><em>Detected before month-end</em></article>
          <article className={styles.opportunity}><small>✦ Best opportunity</small><h3>Repeat buyers are spending 22% more.</h3><p>A focused win-back campaign could add ₹74K/month.</p><span>High confidence <b>94%</b></span></article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.analyst}`}>
        <div className={styles.analystCopy}><div className={styles.analystOrb}>⌘</div><p className={styles.eyebrow}>Meet your AI Analyst</p><h2>Ask the business.<br />Get an honest answer.</h2><div className={styles.analystPoints}><span>✓ Grounded in your data</span><span>✓ Concise by default</span><span>✓ Evidence attached</span></div></div>
        <div className={styles.analystChat}><header><strong>✦ AI Analyst</strong><span>● Online</span></header><div className={styles.question}><small>You</small>{answers[activeAnswer].question}</div><div className={styles.answer}><b>✦</b><div><small>Metrivo Analyst</small><p>{answers[activeAnswer].answer}</p><em>▣ {answers[activeAnswer].source}</em></div></div><div className={styles.queryChips}>{answers.map((item, index) => <button type="button" key={item.question} className={activeAnswer === index ? styles.activeChip : ""} onClick={() => setActiveAnswer(index)}>{item.question}</button>)}</div></div>
      </section>

      <section className={`${styles.section} ${styles.security}`}>
        <div className={styles.securityVisual}><div className={styles.outerRing}><span>CSRF</span><span>RBAC</span><span>AES</span></div><div className={styles.innerRing} /><div className={styles.securityCore}><b>▢</b><strong>Protected<br />by design</strong></div></div>
        <div className={styles.securityCopy}><p className={styles.eyebrow}><i /> Trust is part of the product</p><h2>Your financial data stays yours.</h2><p>Privacy-focused controls form a security boundary around every upload, session, and insight—without adding friction to your day.</p><div className={styles.securityList}><div><b>♢</b><strong>Hardened authentication</strong></div><div><b>▢</b><strong>Protected uploads</strong></div><div><b>▤</b><strong>Grounded AI</strong></div></div></div>
      </section>

      <section className={`${styles.section} ${styles.account}`} id="account"><div className={styles.accountGlow} /><p className={styles.eyebrow}><i /> Your Metrivo account</p><h2>Welcome back—or<br />start making sense.</h2><p>Log in to continue to your dashboard, or create an account to turn your transactions into clear decisions.</p><div><Link href="/login">Log in <span>↗</span></Link><Link href="/register">Create account <span>→</span></Link></div><small>Secure access. Your financial data stays private.</small></section>
      <footer className={styles.footer}><Link href="#top" className={styles.brand}><BrandLogo size={28} /><span>Metrivo</span></Link><p>Clearer numbers. More confident decisions.</p><span>© 2026 Metrivo</span></footer>

      {demoOpen && <div className={styles.modalBackdrop} onMouseDown={() => setDemoOpen(false)}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="demo-title" onMouseDown={(event) => event.stopPropagation()}><button type="button" onClick={() => setDemoOpen(false)} aria-label="Close demo">×</button><div>▶</div><p className={styles.eyebrow}>A 60-second story</p><h2 id="demo-title">From messy statement to clear next move.</h2><p>Upload a statement, let Metrivo structure the noise, then explore a business story grounded entirely in your own numbers.</p><Link href="/register">Start with Metrivo ↗</Link></section></div>}
    </main>
  );
}

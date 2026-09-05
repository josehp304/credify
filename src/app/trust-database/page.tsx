'use client';

import React from 'react';
import styles from './page.module.css';
import { Card } from '@/components/ui/Card';

const NETWORK_NODES = [
  { label: 'Aura', x: 20, y: 10 },
  { label: 'Urban', x: 80, y: 15 },
  { label: 'Zion', x: 15, y: 80 },
  { label: 'Global', x: 85, y: 75 },
  { label: 'Neon', x: 50, y: 90 },
];

const TRUST_LOGS = [
  { id: 'tx_8892', store: 'Aura Electronics', date: '2026-03-21', action: 'VERIFIED_PURCHASE', impact: '+15', status: 'positive' },
  { id: 'tx_7731', store: 'UrbanKicks Market', date: '2026-03-18', action: 'DISPUTE_OPENED', impact: '-5', status: 'negative' },
  { id: 'tx_6104', store: 'Global Traders', date: '2026-03-10', action: 'ACCOUNT_AGE', impact: '+2', status: 'positive' },
  { id: 'tx_5592', store: 'Zion Retail', date: '2026-03-05', action: 'REVIEW_VALIDATED', impact: '+8', status: 'positive' },
  { id: 'tx_4021', store: 'NeonSupply Co', date: '2026-02-28', action: 'FAST_RESOLVE', impact: '0', status: 'neutral' },
];

export default function TrustDatabase() {
  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <h1 className={styles.title}>One reputation, every storefront.</h1>
        <p className={styles.subtitle}>
          Every verification writes to a single ledger tied to an identity. The
          history follows the person, not the account, so a record earned in one
          store counts in all of them.
        </p>
        <p className={styles.demoNote}>The data below is an illustrative sample.</p>
      </section>

      <div className={styles.dashboardSection}>
        {/* Node Network Map */}
        <Card className={styles.networkCard}>
          <h3 className={styles.sectionTitle}>Cross-store identity</h3>
          <p className={styles.cardSub}>How one identity maps across storefronts.</p>
          <div className={styles.networkVisualization}>
            <div className={`${styles.node} ${styles.nodeCenter}`}>You</div>
            {NETWORK_NODES.map((node) => {
              const dx = (node.x - 50) * 3;
              const dy = (node.y - 50) * 3;
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);
              const distance = Math.sqrt(dx * dx + dy * dy);

              return (
                <React.Fragment key={node.label}>
                  <div
                    className={styles.connectionLine}
                    style={{
                      left: '50%',
                      top: '50%',
                      width: `${distance}px`,
                      transform: `rotate(${angle}deg)`,
                    }}
                  />
                  <div
                    className={styles.node}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  >
                    {node.label}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </Card>

        {/* Trust Score */}
        <Card className={styles.scoreCard}>
          <div className={styles.scoreVisualizer}>
            <div className={styles.scoreCircle}>
              <div className={styles.scoreContent}>
                <div className={styles.scoreValue}>94</div>
                <div className={styles.scoreLabel}>Trust score</div>
              </div>
            </div>
            <p className={styles.cardSub}>
              A single score, moved by every verification and read by every check.
            </p>
          </div>
        </Card>

        {/* Audit Log */}
        <Card className={styles.fullWidthCard} style={{ gridColumn: '1 / -1' }}>
          <h3 className={styles.sectionTitle}>Audit log</h3>
          <div className={styles.logTableContainer}>
            <div className={styles.logHeader}>
              <div style={{ flex: 1 }}>Origin</div>
              <div style={{ flex: 1, textAlign: 'center' }}>Event</div>
              <div style={{ flex: 0.5, textAlign: 'right' }}>Delta</div>
            </div>

            {TRUST_LOGS.map((log) => (
              <div key={log.id} className={styles.logRow}>
                <div className={styles.logStore} style={{ flex: 1 }}>
                  {log.store}
                  <small>{log.date} · {log.id}</small>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <span className={styles.logAction}>{log.action}</span>
                </div>
                <div style={{ flex: 0.5, textAlign: 'right' }} className={`${styles.logTrust} ${styles[log.status]}`}>
                  {log.impact}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

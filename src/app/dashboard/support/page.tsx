"use client";
import React from "react";
import styles from "./page.module.css";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BackButton } from "@/components/ui/BackButton";
import { 
  MessageSquare, 
  Mail, 
  HelpCircle, 
  ExternalLink,
  LifeBuoy
} from "lucide-react";

export default function SupportPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <BackButton />
        <h1 className={styles.title}>Help & Support</h1>
        <p className={styles.subtitle}>Our team of security experts is here to help you secure your platform.</p>
      </div>

      <div className={styles.grid}>
          <section className={styles.formSection}>
              <Card glass className={styles.supportCard}>
                  <h3 className={styles.faqQuestion}>Send us a message</h3>
                  <p className={styles.faqAnswer} style={{ marginBottom: '2rem' }}>
                      Typical response time: Under 2 hours.
                  </p>
                  <form className={styles.form} onClick={(e) => e.preventDefault()}>
                      <div className={styles.formGroup}>
                          <label className={styles.label}>Subject</label>
                          <input type="text" className={styles.input} placeholder="API Integration Issue" />
                      </div>
                      <div className={styles.formGroup}>
                          <label className={styles.label}>Message</label>
                          <textarea className={styles.textarea} placeholder="Describe the issue you're facing..." />
                      </div>
                      <Button variant="primary" size="lg" leftIcon={<MessageSquare size={18} />}>
                          Submit Request
                      </Button>
                  </form>
              </Card>
          </section>

          <section className={styles.faqSection}>
              <div className={styles.faqItem}>
                  <div className={styles.faqQuestion}>Integration Documentation</div>
                  <div className={styles.faqAnswer}>
                      Comprehensive guides for all SDKs and API endpoints.
                  </div>
                  <Button variant="ghost" size="sm" style={{ marginTop: '1rem', padding: 0 }} rightIcon={<ExternalLink size={14} />}>
                      Read Docs
                  </Button>
              </div>

              <div className={styles.faqItem}>
                  <div className={styles.faqQuestion}>API Status</div>
                  <div className={styles.faqAnswer}>
                      Check real-time system performance and uptime.
                  </div>
                  <Button variant="ghost" size="sm" style={{ marginTop: '1rem', padding: 0 }} rightIcon={<ExternalLink size={14} />}>
                      Status Page
                  </Button>
              </div>

              <div className={styles.faqItem}>
                  <div className={styles.faqQuestion}>Community Discord</div>
                  <div className={styles.faqAnswer}>
                      Join 500+ security-focused developers.
                  </div>
                  <Button variant="ghost" size="sm" style={{ marginTop: '1rem', padding: 0 }} rightIcon={<ExternalLink size={14} />}>
                      Join Chat
                  </Button>
              </div>
          </section>
      </div>
    </div>
  );
}

"use client";
import React, { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MessageSquareWarning, Bot, MessageSquareOff, UserX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/ui/BackButton";

export default function ReviewScoringPage() {
  const resultRef = useRef<HTMLDivElement>(null);

  const [reviewText, setReviewText] = useState("This product is absolutely amazing! I have never seen anything like it before in my entire life, it works perfectly and everyone should buy it right now!");
  const [platformId, setPlatformId] = useState("shop_123");
  const [isScoring, setIsScoring] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (result && window.innerWidth <= 900) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [result]);


  const handleScore = async () => {
    if (!reviewText.trim()) return;
    setIsScoring(true);
    setResult(null);

    try {
      // Reviewer identity is attached server-side from the signed-in session.
      const response = await fetch(`/api/backend/review/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_text: reviewText,
          platform_id: platformId
        }),
      });

      const data = await response.json();
      if (data.success) {
        setResult(data.result);
      } else {
        console.error("API error", data.error);
        setResult({ error: data.error });
      }
    } catch (error) {
      console.error("Fetch error", error);
      setResult({ error: "Network error" });
    } finally {
      setIsScoring(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.backButtonWrapper}>
        <BackButton />
      </div>
      <div className={styles.header}>
        <h1 className={styles.title}>Review Credibility Scoring</h1>
        <p className={styles.subtitle}>
          Analyze product reviews across three dimensions: AI Generation, Spam Rings, and global User Trust Score.
        </p>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.inputCol}>
          <Card glass className={styles.inputCard}>
            <div className={styles.cardHeader}>
              <MessageSquareWarning className={styles.cardIcon} />
              <h3>Evaluate Review</h3>
            </div>
            
            <div className={styles.formGroup}>
              <label>Platform ID</label>
              <input 
                type="text" 
                className={styles.input} 
                value={platformId} 
                onChange={(e) => setPlatformId(e.target.value)} 
              />
            </div>

            <div className={styles.formGroup}>
              <label>Review Content</label>
              <textarea 
                className={styles.textarea} 
                rows={6}
                value={reviewText}
                onChange={(e) => {
                  setReviewText(e.target.value);
                  setResult(null);
                }}
              />
            </div>

            <Button 
              className={styles.actionBtn}
              size="lg" 
              disabled={!reviewText.trim() || isScoring} 
              isLoading={isScoring}
              onClick={handleScore}
            >
              Calculate Credibility Score
            </Button>
          </Card>
        </div>

        <div className={styles.resultCol} ref={resultRef}>
          <Card glass className={styles.resultCard}>
            <AnimatePresence mode="wait">
              {!result && !isScoring && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.emptyState}>
                  <p>Submit a review to see the multi-dimensional credibility analysis.</p>
                </motion.div>
              )}

              {isScoring && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.processingState}>
                  <div className={styles.spinner} />
                  <h4>Scoring review</h4>
                  <p>Checking for AI text, spam patterns, and reviewer history...</p>
                </motion.div>
              )}

              {result && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.resultData}>
                  <div className={styles.scoreBanner}>
                    <div className={styles.scoreCircleWrapper}>
                      <svg viewBox="0 0 36 36" className={styles.circularChart}>
                        <path className={styles.circleBg}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path className={cn(styles.circle, result.recommendation === "DISPLAY" ? styles.circleHigh : result.recommendation === "FLAG_FOR_REVIEW" ? styles.circleMid : styles.circleLow)}
                          strokeDasharray={`${result.credibility_score}, 100`}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className={styles.scoreTextOverlay}>
                        <span className={styles.scoreNumber}>{result.credibility_score}</span>
                      </div>
                    </div>
                    <div className={styles.scoreDetails}>
                      <span className={styles.scoreLabel}>Credibility score</span>
                      <h2>{result.recommendation === "HIDE" ? "Low credibility" : result.recommendation === "FLAG_FOR_REVIEW" ? "Needs review" : "High credibility"}</h2>
                      <div className={styles.recommendationBadge}>
                        Action: {result.recommendation}
                      </div>
                    </div>
                  </div>

                  <div className={styles.signalsList}>
                    <div className={styles.signalCard}>
                      <div className={styles.signalIconWrapper}><Bot size={20} className={styles.iconFail} /></div>
                      <div className={styles.signalContent}>
                        <h4>AI Generation</h4>
                        <p>{result.ai_probability}% probability of LLM generation.</p>
                      </div>
                      <div className={cn(styles.signalVerdict, result.signals?.ai_detection?.result === "PASS" ? styles.badgePass : styles.badgeFail)}>
                        {result.signals?.ai_detection?.result || "FAIL"}
                      </div>
                    </div>

                    <div className={styles.signalCard}>
                      <div className={styles.signalIconWrapper}><MessageSquareOff size={20} className={result.signals?.spam_check?.result === "PASS" ? styles.iconPass : styles.iconFail} /></div>
                      <div className={styles.signalContent}>
                        <h4>Spam Heuristics</h4>
                        <p>Flags: {result.spam_flags?.length > 0 ? result.spam_flags.join(", ").replace(/_/g, " ") : "None detected"}</p>
                      </div>
                      <div className={cn(styles.signalVerdict, result.signals?.spam_check?.result === "PASS" ? styles.badgePass : styles.badgeFail)}>
                        {result.signals?.spam_check?.result || "FAIL"}
                      </div>
                    </div>

                    <div className={styles.signalCard}>
                      <div className={styles.signalIconWrapper}><UserX size={20} className={result.signals?.trust_score?.result === "PASS" ? styles.iconPass : styles.iconFail} /></div>
                      <div className={styles.signalContent}>
                        <h4>Global Trust Score</h4>
                        <p>Score: {result.reviewer_trust_score}/100 based on network history.</p>
                      </div>
                      <div className={cn(styles.signalVerdict, result.signals?.trust_score?.result === "PASS" ? styles.badgePass : styles.badgeFail)}>
                        {result.signals?.trust_score?.result || "FAIL"}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      </div>
    </div>
  );
}

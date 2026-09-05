"use client";
import React, { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UploadCloud, ScanLine, AlertTriangle, ShieldCheck, Image as ImageIcon, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RefundVerificationPage() {
  const resultRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (result && window.innerWidth <= 900) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [result]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("image/")) {
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setResult(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
    }
  };

  const scanFile = async () => {
    if (!file) return;
    setIsScanning(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      // Identity is attached server-side from the signed-in session.

      const response = await fetch(`/api/backend/refund/verify`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data.result);
      } else {
        console.error("API error:", data.error);
        setResult({ error: data.error || "Failed to scan image." });
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setResult({ error: "Network error occurred." });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.backButtonWrapper}>
        <BackButton />
      </div>
      <div className={styles.header}>
        <h1 className={styles.title}>Refund Image Verification</h1>
        <p className={styles.subtitle}>
          Detect AI-generated product damage images used to claim fraudulent refunds across partner networks.
        </p>
      </div>

      <div className={styles.grid}>
        {/* Upload Zone */}
        <div className={styles.leftCol}>
          <Card glass className={styles.uploadCard}>
            {!preview ? (
              <div 
                className={styles.dropzone}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <div className={styles.dropContext}>
                  <UploadCloud size={48} className={styles.dropIcon} />
                  <h3>Upload Damage Image</h3>
                  <p>Drag & drop or click to browse</p>
                  <Button variant="secondary" size="sm" onClick={() => document.getElementById('file-upload')?.click()}>
                    Select File
                  </Button>
                  <input 
                    id="file-upload" 
                    type="file" 
                    accept="image/*" 
                    className={styles.hiddenInput} 
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            ) : (
              <div className={styles.previewContainer}>
                <img src={preview} alt="Preview" className={styles.previewImage} />
                <div className={styles.previewOverlay}>
                  <Button variant="secondary" size="sm" onClick={() => { setFile(null); setPreview(null); setResult(null); }}>
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Button
            className={styles.scanBtn}
            size="lg" 
            disabled={!file || isScanning} 
            isLoading={isScanning}
            onClick={scanFile}
            leftIcon={<ScanLine />}
          >
            {isScanning ? "Analyzing image..." : "Run verification"}
          </Button>
        </div>

        {/* Results Visualizer */}
        <div className={styles.rightCol}>
          <Card glass className={styles.resultCard}>
            <AnimatePresence mode="wait">
              {!result && !isScanning && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className={styles.emptyState}
                >
                  <ImageIcon size={48} className={styles.emptyIcon} />
                  <p>Upload an image and run verification to see the analysis report.</p>
                </motion.div>
              )}

              {isScanning && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className={styles.scanningState}
                >
                  <p className={styles.scanText}>Running AI forensics and metadata analysis...</p>
                </motion.div>
              )}

              {result && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className={styles.resultData}
                >
                  <div className={styles.resultHeader}>
                    <div className={cn(styles.verdictBox, result.overall_risk === "LOW" && styles.success, result.overall_risk === "MEDIUM" && styles.warning)}>
                      <span className={styles.verdictLabel}>Verdict</span>
                      <h2 className={cn(styles.verdictText, result.overall_risk === "LOW" && styles.success, result.overall_risk === "MEDIUM" && styles.warning)}>
                        {result.recommended_action}
                      </h2>
                    </div>
                    <div className={cn(styles.scoreBox, result.overall_risk === "LOW" && styles.success, result.overall_risk === "MEDIUM" && styles.warning)}>
                      <span className={styles.scoreLabel}>Trust score</span>
                      <h2 className={cn(styles.scoreText, result.overall_risk === "LOW" && styles.success, result.overall_risk === "MEDIUM" && styles.warning)}>
                        {result.trust_score}
                      </h2>
                    </div>
                  </div>

                  <div className={styles.signalsList}>
                    <h3 className={styles.signalsTitle}>Detection Pipeline</h3>
                    
                    <div className={styles.signalItem}>
                      <div className={styles.signalHeader}>
                        {result.signal_breakdown.ai_forensics.result === "PASS" ? (
                          <CheckCircle className={styles.signalIconPass} />
                        ) : (
                          <AlertTriangle className={styles.signalIconFail} />
                        )}
                        <h4>AI Generation Forensics</h4>
                        <span className={result.signal_breakdown.ai_forensics.result === "PASS" ? styles.signalBadgePass : styles.signalBadgeFail}>
                          {result.signal_breakdown.ai_forensics.confidence}% Match
                        </span>
                      </div>
                      <p className={styles.signalDesc}>{result.signal_breakdown.ai_forensics.details}</p>
                    </div>

                    <div className={styles.signalItem}>
                      <div className={styles.signalHeader}>
                        {result.signal_breakdown.exif_analysis.result === "PASS" ? (
                          <CheckCircle className={styles.signalIconPass} />
                        ) : (
                          <AlertTriangle className={styles.signalIconFail} />
                        )}
                        <h4>EXIF Metadata Analysis</h4>
                        <span className={result.signal_breakdown.exif_analysis.result === "PASS" ? styles.signalBadgePass : styles.signalBadgeFail}>
                          {result.signal_breakdown.exif_analysis.result === "PASS" ? "Clean" : "Anomalies"}
                        </span>
                      </div>
                      <p className={styles.signalDesc}>{result.signal_breakdown.exif_analysis.details}</p>
                    </div>

                    <div className={styles.signalItem}>
                      <div className={styles.signalHeader}>
                        {result.signal_breakdown.trust_score_check.result === "PASS" ? (
                          <ShieldCheck className={styles.signalIconPass} />
                        ) : (
                          <ShieldCheck className={styles.signalIconFail} />
                        )}
                        <h4>Global Trust Network</h4>
                        <span className={result.signal_breakdown.trust_score_check.result === "PASS" ? styles.signalBadgePass : styles.signalBadgeFail}>
                          {result.signal_breakdown.trust_score_check.result === "PASS" ? "Trusted" : "History"}
                        </span>
                      </div>
                      <p className={styles.signalDesc}>{result.signal_breakdown.trust_score_check.details}</p>
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

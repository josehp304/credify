"use client";
import React, { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/ui/BackButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FileBadge, Lock, Fingerprint, ShieldAlert, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function DocumentWatermarkPage() {
  const resultRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<"issue" | "verify">("issue");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (result && window.innerWidth <= 900) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [result]);
 // changed to allow dynamic payload
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResult(null);
      setDownloadUrl(null);
    }
  };

  const processFile = async () => {
    if (!file) return;
    setIsProcessing(true);
    setResult(null);
    setDownloadUrl(null);

    try {
      const formData = new FormData();
      formData.append("document", file);

      if (mode === "issue") {
        formData.append("issuer_id", "demo-issuer-123");
        formData.append("recipient_name", "John Doe");
        formData.append("document_type", "Certificate");
        
        const response = await fetch(`/api/backend/document/watermark`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
           const blob = await response.blob();
           const url = window.URL.createObjectURL(blob);
           setDownloadUrl(url);
           setResult({ success: true, mode: "issue", hash: "Hidden in image" });
        } else {
           setResult({ success: false, mode: "issue", error: "Failed to apply watermark" });
        }
      } else {
        const response = await fetch(`/api/backend/document/verify`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (data.success) {
           setResult({ success: true, mode: "verify", ...data.result });
        } else {
           setResult({ success: false, mode: "verify", error: data.error || "Verification failed" });
        }
      }
    } catch (error) {
      console.error("API error", error);
      setResult({ success: false, mode, error: "Network error" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.backButtonWrapper}>
        <BackButton />
      </div>
      <div className={styles.header}>
        <h1 className={styles.title}>Document Watermarking & Verification</h1>
        <p className={styles.subtitle}>
          Harden digital certificates with invisible cryptographic fingerprints that break upon AI tampering.
        </p>
      </div>

      <div className={styles.tabs}>
        <button 
          className={mode === "issue" ? styles.tabActive : styles.tab} 
          onClick={() => { setMode("issue"); setFile(null); setResult(null); setDownloadUrl(null); }}
        >
          <Lock size={18} /> Issue Document
        </button>
        <button 
          className={mode === "verify" ? styles.tabActive : styles.tab}
          onClick={() => { setMode("verify"); setFile(null); setResult(null); setDownloadUrl(null); }}
        >
          <Fingerprint size={18} /> Verify Document
        </button>
      </div>

      <div className={styles.mainContent}>
        <Card glass className={styles.actionCard}>
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div 
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={styles.inputState}
              >
                <div className={styles.uploadBox}>
                  {mode === "issue" ? <Lock size={40} className={styles.uploadIcon} /> : <Fingerprint size={40} className={styles.uploadIcon} />}
                  <h3>{mode === "issue" ? "Upload to Embed Watermark" : "Upload to Verify Integrity"}</h3>
                  <p>Accepts PNG, JPG, or PDF (first page)</p>
                  
                  {file && <div className={styles.selectedFile}>{file.name}</div>}

                  <Button variant="secondary" onClick={() => document.getElementById('doc-upload')?.click()}>
                    {file ? "Change File" : "Select Document"}
                  </Button>
                  <input id="doc-upload" type="file" className={styles.hiddenInput} onChange={handleFileChange} />
                </div>

                <div className={styles.actionRow}>
                  <Button 
                    size="lg" 
                    disabled={!file || isProcessing}
                    isLoading={isProcessing}
                    onClick={processFile}
                    className={styles.submitBtn}
                  >
                    {isProcessing 
                      ? (mode === "issue" ? "Encoding Payload..." : "Extracting DCT Watermark...") 
                      : (mode === "issue" ? "Generate Secured Document" : "Verify Integrity")
                    }
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={styles.resultState}
              >
                {mode === "issue" ? (
                  result.success ? (
                    <div className={styles.successResult}>
                      <ShieldCheck size={64} className={styles.successIcon} />
                      <h2>Document Secured</h2>
                      <p>Cryptography embedded in DCT domain. Any AI regeneration or modification will destroy the invisible payload.</p>
                      <div className={styles.payloadPreview}>
                        <strong>Status:</strong> <span>{result.hash}</span>
                      </div>
                      <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "1rem" }}>
                        {downloadUrl && (
                          <a href={downloadUrl} download={`secured_${file?.name}`}>
                            <Button>Download Image</Button>
                          </a>
                        )}
                        <Button variant="outline" onClick={() => { setFile(null); setResult(null); setDownloadUrl(null); }}>Issue Another</Button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.failResult}>
                      <ShieldAlert size={64} className={styles.failIcon} />
                      <h2>Issue Failed</h2>
                      <p>{result.error}</p>
                      <Button variant="outline" onClick={() => { setFile(null); setResult(null); }}>Try Again</Button>
                    </div>
                  )
                ) : (
                  result.verdict === "VERIFIED" ? (
                    <div className={styles.successResult}>
                      <ShieldCheck size={64} className={styles.successIcon} />
                      <h2>Verification Passed</h2>
                      <p>Invisible watermark extracted successfully. Payload matches database ground truth.</p>
                      <ul className={styles.proofList}>
                        <li><ShieldCheck size={16}/> Cryptographic signature valid</li>
                        <li><ShieldCheck size={16}/> Document hash unchanged</li>
                        <li><ShieldCheck size={16}/> No AI regeneration detected</li>
                        {result.document_data && <li><ShieldCheck size={16}/> Recipient: {result.document_data.recipient_name}</li>}
                      </ul>
                      <Button onClick={() => { setFile(null); setResult(null); setDownloadUrl(null); }}>Verify Another</Button>
                    </div>
                  ) : (
                    <div className={styles.failResult}>
                      <ShieldAlert size={64} className={styles.failIcon} />
                      <h2>Tampering Detected</h2>
                      <p>{result.reason || "The spread-spectrum watermark is unreadable or heavily degraded. This document has been mathematically proven to be altered or AI-regenerated."}</p>
                      <Button variant="outline" onClick={() => { setFile(null); setResult(null); setDownloadUrl(null); }}>Verify Another</Button>
                    </div>
                  )
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Info Col */}
        <div className={styles.infoCol}>
          <div className={styles.infoBlock}>
            <Fingerprint className={styles.infoIcon} />
            <h4>Why AI Destroys Watermarks</h4>
            <p>Generative AI doesn&apos;t copy pixels; it creates completely new ones from scratch based on a distribution. This permanently destroys our invisible steganographic pattern.</p>
          </div>
          <div className={styles.infoBlock}>
            <FileBadge className={styles.infoIcon} />
            <h4>Supported Certificates</h4>
            <p>University degrees, online course completions, signed legal agreements, and professional credentials.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Scan({ size, className }: { size?: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

"use client";
import React, { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScanFace, UserCheck, AlertTriangle, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/ui/BackButton";

export default function IdVerificationPage() {
  const resultRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<"generate" | "verify">("verify");
  
  // Verification states
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (result && window.innerWidth <= 900) {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [result]);


  // Generation states
  const [userIdData, setUserIdData] = useState({ name: "", course: "", student_id: "", expiry: "" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQr, setGeneratedQr] = useState<string | null>(null);
  const [generationMsg, setGenerationMsg] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResultReady(false);
      setResult(null);
    }
  };

  const scanFile = async () => {
    if (!file) return;
    setIsScanning(true);
    setResultReady(false);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(`/api/backend/id/verify`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data.result);
      } else {
        console.error("API error:", data.error);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setIsScanning(false);
      setResultReady(true);
    }
  };

  const generateId = async () => {
    setIsGenerating(true);
    setGeneratedQr(null);
    setGenerationMsg("");

    try {
      const response = await fetch(`/api/backend/id/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userIdData),
      });

      const data = await response.json();
      if (data.success) {
        setGeneratedQr(data.result.qr_code);
        setGenerationMsg("ID Generated/Updated Successfully!");
      } else {
        setGenerationMsg(`Error: ${data.error}`);
      }
    } catch (error) {
      setGenerationMsg("Network error.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.backButtonWrapper}>
        <BackButton />
      </div>
      <div className={styles.header}>
        <h1 className={styles.title}>Physical ID Verification</h1>
        <p className={styles.subtitle}>
          Compare visual OCR text against signed QR-code ground truth data to detect AI inpainting and physical tampering.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Button variant={mode === "verify" ? "primary" : "secondary"} onClick={() => setMode("verify")}>Verify ID Card</Button>
        <Button variant={mode === "generate" ? "primary" : "secondary"} onClick={() => setMode("generate")}>Generate User ID</Button>
      </div>

      <div className={styles.mainContent}>
        {mode === "verify" && (
          <>
            <div className={styles.scanCol}>
              <Card glass className={styles.uploadCard}>
            {!preview ? (
              <div className={styles.uploadBox}>
                <ScanFace size={48} className={styles.uploadIcon} />
                <h3>Upload ID Card Photo</h3>
                <p>Ensure the QR code and text are clearly visible</p>
                <Button variant="secondary" onClick={() => document.getElementById('id-upload')?.click()}>
                  Browse Files
                </Button>
                <input id="id-upload" type="file" accept="image/*" className={styles.hiddenInput} onChange={handleFileChange} />
              </div>
            ) : (
              <div className={styles.previewContainer}>
                <img src={preview} alt="ID Preview" className={styles.previewImage} />

                <div className={styles.clearBtnWrapper}>
                  {!isScanning && (
                    <Button variant="secondary" size="sm" onClick={() => { setFile(null); setPreview(null); setResultReady(false); setResult(null); }}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Button 
            className={styles.actionBtn}
            size="lg" 
            disabled={!file || isScanning || resultReady} 
            isLoading={isScanning}
            onClick={scanFile}
          >
            {resultReady ? "Scan Complete" : (isScanning ? "Processing..." : "Verify ID Card")}
          </Button>
        </div>

        <div className={styles.resultCol} ref={resultRef}>
          <Card glass className={styles.resultCard}>
            <AnimatePresence mode="wait">
              {!resultReady && !isScanning && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.emptyState}>
                  <UserCheck size={48} className={styles.emptyIcon} />
                  <p>Upload an ID card to see field-level comparison results.</p>
                </motion.div>
              )}

              {isScanning && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.processingState}>
                  <QrCode size={32} className={styles.processingIcon} />
                  <h4>Reading QR token</h4>
                  <p>Loading the issuance record and comparing it against the photographed card...</p>
                </motion.div>
              )}

              {resultReady && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={styles.resultData}>
                  {result && result.verdict === "UNVERIFIED" ? (
                    <div className={styles.verdictHeader}>
                      <AlertTriangle size={32} className={styles.warningText} />
                      <div>
                        <h2 className={styles.warningText}>Unverified</h2>
                        <p>{result.reason}</p>
                      </div>
                    </div>
                  ) : result && result.verdict === "FRAUD_FLAG" ? (
                    <div className={styles.verdictHeader}>
                      <AlertTriangle size={32} className={styles.destructiveText} />
                      <div>
                        <h2 className={styles.destructiveText}>Fraud flag</h2>
                        <p>{result.reason}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.verdictHeader}>
                        {result && result.verdict === "HIGH_FRAUD_PROBABILITY" ? (
                          <>
                            <AlertTriangle size={32} className={styles.destructiveText} />
                            <div>
                              <h2 className={styles.destructiveText}>Fraud detected</h2>
                              <p>{result.tampered_fields.length} fields show signs of physical or digital tampering.</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <UserCheck size={32} className={styles.successText} />
                            <div>
                              <h2 className={styles.successText}>Verified</h2>
                              <p>All fields match the issuance record.</p>
                            </div>
                          </>
                        )}
                      </div>

                      {result && result.all_checks && (
                        <div className={styles.comparisonTable}>
                          <div className={styles.tableHeader}>
                            <div>Field</div>
                            <div>Ground Truth (QR)</div>
                            <div>Extracted (OCR)</div>
                            <div>Status</div>
                          </div>
                          
                          {result.all_checks.map((row: { field: string; gt: string; ocr: string; pass: boolean }, i: number) => (
                            <div key={i} className={styles.tableRow}>
                              <div className={styles.fieldLabel}>{row.field}</div>
                              <div className={styles.groundTruthText}>{row.gt}</div>
                              <div className={cn(styles.ocrText, !row.pass && styles.mismatchText)}>
                                {row.ocr}
                              </div>
                              <div className={styles.statusCell}>
                                {row.pass ? (
                                  <span className={styles.badgePass}>PASS</span>
                                ) : (
                                  <span className={styles.badgeFail}>FAIL</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      </>
        )}

        {mode === "generate" && (
          <>
            <div className={styles.generateLeftCol}>
              <Card glass hoverEffect className={styles.generateFormCard}>
                <h3 style={{ marginBottom: "0.5rem", fontSize: "1.4rem", fontWeight: "700", letterSpacing: "-0.015em" }}>Card details</h3>
                <p style={{ color: "var(--muted-foreground)", marginBottom: "2rem", fontSize: "0.95rem", lineHeight: "1.6" }}>These details become the ground truth the signed QR points to.</p>
                <div className={styles.generateFormSpacing}>
                  <div className={styles.inputGrid}>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Full Name</label>
                      <input 
                        className={styles.glassInput}
                        value={userIdData.name} 
                        onChange={e => setUserIdData({...userIdData, name: e.target.value})} 
                        placeholder="e.g. John Doe" 
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Student/Employee ID</label>
                      <input 
                        className={styles.glassInput}
                        value={userIdData.student_id} 
                        onChange={e => setUserIdData({...userIdData, student_id: e.target.value})} 
                        placeholder="e.g. 20210445" 
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Course / Title</label>
                      <input 
                        className={styles.glassInput}
                        value={userIdData.course} 
                        onChange={e => setUserIdData({...userIdData, course: e.target.value})} 
                        placeholder="e.g. BSc Computer Science" 
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label className={styles.inputLabel}>Expiry Date</label>
                      <input 
                        className={styles.glassInput}
                        value={userIdData.expiry} 
                        onChange={e => setUserIdData({...userIdData, expiry: e.target.value})} 
                        placeholder="e.g. August 2026" 
                      />
                    </div>
                  </div>

                  <div style={{ flexGrow: 1 }} />
                  <Button 
                    size="lg"
                    className={styles.actionBtn}
                    onClick={generateId} 
                    disabled={isGenerating || !userIdData.name || !userIdData.student_id}
                    isLoading={isGenerating}
                    style={{ marginTop: "1rem" }}
                  >
                    Generate signed QR
                  </Button>
                </div>
              </Card>
            </div>
            
            <div className={styles.generateRightCol}>
              <Card glass hoverEffect className={styles.qrDisplayCard}>
                <AnimatePresence mode="wait">
                  {!generatedQr && !isGenerating && (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      style={{ textAlign: "center", margin: "auto" }}
                    >
                      <QrCode size={48} style={{ color: "var(--muted-foreground)", opacity: 0.5, marginBottom: "1.25rem" }} />
                      <p style={{ color: "var(--muted-foreground)", fontSize: "0.95rem" }}>Fill in the card details to generate a QR.</p>
                    </motion.div>
                  )}
                  {isGenerating && (
                    <motion.div 
                      key="generating"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ margin: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}
                    >
                      <div className={styles.processingIcon}><QrCode size={32} /></div>
                      <p style={{ color: "var(--muted-foreground)", fontSize: "0.95rem" }}>Generating signed QR...</p>
                    </motion.div>
                  )}
                  {generatedQr && (
                    <motion.div 
                      key="result"
                      initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                      style={{ textAlign: "center", margin: "auto" }}
                    >
                      <img src={generatedQr} alt="Secure QR Code" className={styles.qrImage} />
                      <p style={{ marginTop: "20px", color: "var(--success)", fontWeight: "600", fontSize: "1rem" }}>{generationMsg}</p>
                      <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--muted-foreground)", lineHeight: "1.6" }}>
                        Print this QR on the physical card. Verification reads the signed token from it, loads the issuance record, and cross-checks the photographed card with OCR.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
                {generationMsg && !generatedQr && <p style={{ color: "var(--destructive)", margin: "auto", fontSize: "1.1rem" }}>{generationMsg}</p>}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

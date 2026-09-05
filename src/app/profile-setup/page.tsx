"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { BackButton } from "@/components/ui/BackButton";
import { authClient } from "@/lib/auth/client";

export default function ProfileSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { data: session } = authClient.useSession();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    company: "",
    role: ""
  });

  // Autofill from session when it loads
  React.useEffect(() => {
    if (session?.user) {
      setFormData(prev => ({
        ...prev,
        fullName: prev.fullName || session.user.name || "",
        email: prev.email || session.user.email || ""
      }));
    }
  }, [session]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    setLoading(true);
    try {
      // 1. Create organization in Neon Auth (optional, keeps current logic)
      if (formData.company) {
        await authClient.organization.create({
          name: formData.company,
          slug: formData.company.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        });
      }

      // 2. Save profile details to our backend
      // userId is attached server-side from the session by the proxy.
      const response = await fetch(`/api/backend/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save profile");
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("Profile setup failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.topNav}>
        <BackButton />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className={styles.setupCard}>
          <div className={styles.header}>
            <h1 className={styles.title}>Welcome to Credify</h1>
            <p className={styles.subtitle}>A few details finish your profile. Your name and email come from your account.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.row}>
                <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="fullName">Full name</label>
                    <div className={styles.inputWrapper}>
                        <User className={styles.inputIcon} size={17} />
                        <input
                            id="fullName"
                            name="fullName"
                            type="text"
                            className={styles.input}
                            value={formData.fullName}
                            onChange={handleChange}
                            placeholder="Priya Raman"
                            required
                        />
                    </div>
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="email">Email address</label>
                    <div className={styles.inputWrapper}>
                        <Mail className={styles.inputIcon} size={17} />
                        <input
                            id="email"
                            name="email"
                            type="email"
                            className={`${styles.input} ${styles.inputReadonly}`}
                            value={formData.email}
                            readOnly
                        />
                    </div>
                </div>
            </div>

            <div className={styles.row}>
                <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="phone">Phone number</label>
                    <div className={styles.inputWrapper}>
                        <Phone className={styles.inputIcon} size={17} />
                        <input
                            id="phone"
                            name="phone"
                            type="tel"
                            className={styles.input}
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+1 (312) 847-1928"
                            required
                        />
                    </div>
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="location">Location</label>
                    <div className={styles.inputWrapper}>
                        <MapPin className={styles.inputIcon} size={17} />
                        <input
                            id="location"
                            name="location"
                            type="text"
                            className={styles.input}
                            value={formData.location}
                            onChange={handleChange}
                            placeholder="Chicago, USA"
                            required
                        />
                    </div>
                </div>
            </div>

            <div className={styles.row}>
                <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="company">Company or organization</label>
                    <div className={styles.inputWrapper}>
                        <Building2 className={styles.inputIcon} size={17} />
                        <input
                            id="company"
                            name="company"
                            type="text"
                            className={styles.input}
                            value={formData.company}
                            onChange={handleChange}
                            placeholder="Halvorsen Goods"
                            required
                        />
                    </div>
                </div>
                <div className={styles.formGroup}>
                    <label className={styles.label} htmlFor="role">Your role</label>
                    <div className={styles.inputWrapper}>
                        <Briefcase className={styles.inputIcon} size={17} />
                        <input
                            id="role"
                            name="role"
                            type="text"
                            className={styles.input}
                            value={formData.role}
                            onChange={handleChange}
                            placeholder="Operations lead"
                            required
                        />
                    </div>
                </div>
            </div>

            <Button type="submit" variant="primary" size="lg" className={styles.submitBtn} rightIcon={<ArrowRight />} disabled={loading}>
                {loading ? "Saving..." : "Complete profile"}
            </Button>
          </form>

          <p className={styles.footerNote}>
              Need help? <span>Contact support</span>.
          </p>
        </Card>
      </motion.div>
    </div>
  );
}

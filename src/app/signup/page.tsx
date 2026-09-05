"use client";
import React from "react";
import styles from "../login/page.module.css";
import { AuthView } from "@neondatabase/auth/react";

export default function SignupPage() {
  return (
    <div className={styles.container}>
      <AuthView path="sign-up" />
    </div>
  );
}

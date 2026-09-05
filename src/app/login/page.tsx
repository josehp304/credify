"use client";
import React from "react";
import styles from "./page.module.css";
import { AuthView } from "@neondatabase/auth/react";

export default function LoginPage() {
  return (
    <div className={styles.container}>
      <AuthView path="sign-in" />
    </div>
  );
}

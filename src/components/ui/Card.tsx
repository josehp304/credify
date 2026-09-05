"use client";
import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import styles from "./Card.module.css";
import { cn } from "@/lib/utils";

export interface CardProps extends Omit<HTMLMotionProps<"div">, "ref" | "children"> {
  children?: React.ReactNode;
  hoverEffect?: boolean;
  /** Legacy prop, kept for API compatibility. Cards no longer glow. */
  glowColor?: string;
  /** Legacy prop, kept for API compatibility. Cards render flat. */
  glass?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverEffect = false, glass, glowColor, children, ...props }, ref) => {
    void glass;
    void glowColor;
    return (
      <motion.div
        ref={ref}
        className={cn(styles.card, hoverEffect && styles.hoverEffect, className)}
        whileHover={hoverEffect ? { y: -2, transition: { duration: 0.2 } } : {}}
        {...props}
      >
        <div className={styles.inner}>{children}</div>
      </motion.div>
    );
  }
);
Card.displayName = "Card";

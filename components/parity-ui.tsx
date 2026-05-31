"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

export function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass-card ${className}`.trim()}>{children}</section>;
}

export function InsightCard({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <GlassCard>
      <div className="insight-row">
        <span className="insight-icon" aria-hidden>
          {icon}
        </span>
        <div>
          <p className="insight-title">{title}</p>
          <p className="muted">{subtitle}</p>
        </div>
      </div>
    </GlassCard>
  );
}

export function AnimatedCurrency({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 180, damping: 28 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (latest) => {
      setDisplay(Math.round(latest).toLocaleString("en-IN"));
    });
    return () => unsubscribe();
  }, [spring]);

  return <motion.span className="metric-hero">Rs {display}</motion.span>;
}

export function ProgressRing({ progress, size = 92 }: { progress: number; size?: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  const offset = c * (1 - p);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,.12)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={c}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
        />
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#42E6B8" />
          </linearGradient>
        </defs>
      </svg>
      <span className="ring-label">{Math.round(p * 100)}%</span>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <GlassCard className="skeleton-card">
      <div className="skeleton-line w60 shimmer" />
      <div className="skeleton-line w40 shimmer" />
    </GlassCard>
  );
}

export function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="fab" type="button" onClick={onClick} aria-label="Add transaction">
      +
    </button>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import type { Transaction } from "@/lib/types";
import type { ExportPeriod, ExportType, ExportOptions } from "@/lib/pdf-engine";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL   = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function ExportModal({
  open,
  onClose,
  transactions,
  selectedMonth,
  selectedYear,
}: {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
  selectedMonth: string;
  selectedYear: number;
}) {
  const [period, setPeriod] = useState<ExportPeriod>("current_month");
  const [exportType, setExportType] = useState<ExportType>("monthly");
  const [generating, setGenerating] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    includeCharts: true,
    includeCategoryAnalysis: true,
    includeRunningBalance: true,
    includeCompletionMetrics: true,
  });

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth <= 767); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const drawerAnim = useMemo(() => isMobile
    ? { initial: { y: "100%", opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: "100%", opacity: 0 } }
    : { initial: { x: "100%", opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: "100%", opacity: 0 } },
  [isMobile]);

  // Custom month picker state
  const currentYear = new Date().getFullYear();
  const [customMonthIndex, setCustomMonthIndex] = useState(Number(selectedMonth.split("-")[1]) - 1);
  const [customYear, setCustomYear]   = useState(selectedYear);

  const monthIndex = Number(selectedMonth.split("-")[1]) - 1;

  // ── Derived logic ──────────────────────────────────────────────────────────
  const annualAllowed  = period === "full_year";
  const monthlyAllowed = period !== "full_year"; // current_month + custom_month

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Auto-correct report type when period changes
  function handlePeriodChange(next: ExportPeriod) {
    setPeriod(next);
    if (next === "full_year" && exportType !== "annual")  setExportType("annual");
    if (next !== "full_year" && exportType !== "monthly") setExportType("monthly");
  }

  function toggleOption(key: keyof ExportOptions) {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Compute the actual month string for the PDF engine
  function resolveMonth(): string {
    if (period === "custom_month") {
      return `${customYear}-${String(customMonthIndex + 1).padStart(2, "0")}`;
    }
    return selectedMonth;
  }

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    try {
      const { generatePDF } = await import("@/lib/pdf-engine");
      generatePDF({
        period,
        exportType,
        options,
        selectedMonth: resolveMonth(),
        selectedYear: period === "custom_month" ? customYear : selectedYear,
        transactions,
      });
    } finally {
      setGenerating(false);
    }
  }

  // Helper text below Report Type section
  const reportTypeHint =
    period === "full_year"
      ? "Monthly summaries are only available for single-month exports."
      : "Annual reports are only available for Full Year exports.";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="export-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="export-drawer"
            initial={drawerAnim.initial}
            animate={drawerAnim.animate}
            exit={drawerAnim.exit}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            {/* ── Header ── */}
            <div className="export-header">
              <div>
                <h2 className="export-title">Export Financial Report</h2>
                <p className="export-subtitle">Generate professional financial reports for personal tracking and analysis.</p>
              </div>
              <motion.button
                className="export-close"
                type="button"
                onClick={onClose}
                aria-label="Close export panel"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                </svg>
              </motion.button>
            </div>

            <div className="export-body">

              {/* ── Section 1: Export Period ── */}
              <div className="export-section">
                <h3 className="export-section-title">Export Period</h3>
                <div className="export-radio-group">

                  {/* Current Month */}
                  <label className={`export-radio ${period === "current_month" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="period"
                      checked={period === "current_month"}
                      onChange={() => handlePeriodChange("current_month")}
                    />
                    <span className="export-radio-dot" />
                    <span className="export-radio-label">
                      <span>Current Month</span>
                      <span className="export-radio-meta">{MONTH_LABELS[monthIndex]} {selectedYear}</span>
                    </span>
                  </label>

                  {/* Custom Month */}
                  <label className={`export-radio ${period === "custom_month" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="period"
                      checked={period === "custom_month"}
                      onChange={() => handlePeriodChange("custom_month")}
                    />
                    <span className="export-radio-dot" />
                    <span className="export-radio-label">
                      <span>Custom Month</span>
                      {period !== "custom_month" && (
                        <span className="export-radio-meta">Pick any month</span>
                      )}
                    </span>
                  </label>

                  {/* Custom Month Picker — only visible when selected */}
                  <AnimatePresence initial={false}>
                    {period === "custom_month" && (
                      <motion.div
                        className="export-custom-picker"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="export-picker-row">
                          <select
                            className="export-picker-select"
                            value={customMonthIndex}
                            onChange={e => setCustomMonthIndex(Number(e.target.value))}
                          >
                            {MONTH_FULL.map((m, i) => (
                              <option key={m} value={i}>{m}</option>
                            ))}
                          </select>
                          <select
                            className="export-picker-select"
                            value={customYear}
                            onChange={e => setCustomYear(Number(e.target.value))}
                          >
                            {Array.from({ length: 6 }, (_, i) => currentYear - 2 + i).map(y => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                        <p className="export-picker-preview">
                          {MONTH_FULL[customMonthIndex]} {customYear}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Full Year */}
                  <label className={`export-radio ${period === "full_year" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="period"
                      checked={period === "full_year"}
                      onChange={() => handlePeriodChange("full_year")}
                    />
                    <span className="export-radio-dot" />
                    <span className="export-radio-label">
                      <span>Full Year</span>
                      <span className="export-radio-meta">{selectedYear}</span>
                    </span>
                  </label>

                </div>
              </div>

              {/* ── Section 2: Report Type ── */}
              <div className="export-section">
                <h3 className="export-section-title">Report Type</h3>
                <div className="export-type-group">

                  {/* Monthly Summary */}
                  <button
                    type="button"
                    className={`export-type-card ${exportType === "monthly" ? "active" : ""} ${!monthlyAllowed ? "disabled" : ""}`}
                    onClick={() => monthlyAllowed && setExportType("monthly")}
                    disabled={!monthlyAllowed}
                    title={!monthlyAllowed ? "Select Current Month or Custom Month to use this report type" : undefined}
                  >
                    <span className="export-type-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M3 8h14" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M7 2v4M13 2v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    </span>
                    <div>
                      <span className="export-type-name">Monthly Summary</span>
                      <span className="export-type-desc">Income, expenses, savings, category analysis, completion metrics</span>
                    </div>
                  </button>

                  {/* Annual Report */}
                  <button
                    type="button"
                    className={`export-type-card ${exportType === "annual" ? "active" : ""} ${!annualAllowed ? "disabled" : ""}`}
                    onClick={() => annualAllowed && setExportType("annual")}
                    disabled={!annualAllowed}
                    title={!annualAllowed ? "Select Full Year to use this report type" : undefined}
                  >
                    <span className="export-type-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M3 14l4-5 3 3 4-6 3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                      </svg>
                    </span>
                    <div>
                      <span className="export-type-name">Annual Report</span>
                      <span className="export-type-desc">Monthly performance, trends, top categories, year summary</span>
                    </div>
                  </button>

                </div>
                <p className="export-type-hint">{reportTypeHint}</p>
              </div>

              {/* ── Section 3: Include Options ── */}
              <div className="export-section">
                <h3 className="export-section-title">Include in Report</h3>
                <div className="export-check-group">
                  {([
                    ["includeCharts",            "Charts & Visualizations"],
                    ["includeCategoryAnalysis",  "Category Analysis"],
                    ["includeRunningBalance",    "Running Balance"],
                    ["includeCompletionMetrics", "Completion Metrics"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="export-check">
                      <input
                        type="checkbox"
                        checked={options[key]}
                        onChange={() => toggleOption(key)}
                      />
                      <span className="export-check-box">
                        {options[key] ? (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : null}
                      </span>
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>

            {/* ── Generate Button ── */}
            <div className="export-footer">
              <motion.button
                className="export-generate-btn"
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                whileHover={generating ? {} : { scale: 1.01, y: -1 }}
                whileTap={generating ? {} : { scale: 0.98 }}
              >
                {generating ? (
                  <span className="export-btn-loading">
                    <span className="export-spinner" />
                    Generating Report...
                  </span>
                ) : (
                  <span className="export-btn-ready">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 2v10m0 0l-3.5-3.5M9 12l3.5-3.5M3 15h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Generate PDF
                  </span>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

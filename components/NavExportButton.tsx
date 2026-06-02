"use client";

export function NavExportButton() {
  return (
    <button
      type="button"
      className="nav-action-btn"
      onClick={() => window.dispatchEvent(new CustomEvent("open-export-modal"))}
    >
      Export PDF
    </button>
  );
}

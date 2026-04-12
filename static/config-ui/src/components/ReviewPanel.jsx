/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState } from "react";
import { invoke } from "@forge/bridge";

const VERDICT_STYLES = {
  good: { color: "var(--success-color)", bg: "rgba(22, 163, 106, 0.06)", border: "var(--success-color)", icon: "\u2705" },
  needs_attention: { color: "#d97706", bg: "rgba(217, 119, 6, 0.06)", border: "#d97706", icon: "\u26A0\uFE0F" },
  has_issues: { color: "var(--error-color)", bg: "rgba(220, 38, 38, 0.06)", border: "var(--error-color)", icon: "\u274C" },
};

const ITEM_ICONS = { success: "\u2705", warning: "\u26A0\uFE0F", error: "\u274C", tip: "\uD83D\uDCA1" };

export default function ReviewPanel({ configType, config }) {
  const [reviewing, setReviewing] = useState(false);
  const [result, setResult] = useState(null);

  const handleReview = async () => {
    setReviewing(true);
    setResult(null);
    try {
      const res = await invoke("reviewConfig", { configType, config });
      setResult(res);
    } catch (e) {
      setResult({ success: false, error: e.message });
    }
    setReviewing(false);
  };

  return (
    <div className="review-panel">
      <button
        className="btn-review"
        onClick={handleReview}
        disabled={reviewing}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
        <span>{reviewing ? "Reviewing..." : "AI Review"}</span>
      </button>

      {result && (
        <div className="review-result">
          {result.success && result.review ? (
            <>
              <div
                className="review-verdict"
                style={{
                  background: VERDICT_STYLES[result.review.verdict]?.bg || VERDICT_STYLES.good.bg,
                  borderColor: VERDICT_STYLES[result.review.verdict]?.border || VERDICT_STYLES.good.border,
                }}
              >
                <span className="review-verdict-icon">
                  {VERDICT_STYLES[result.review.verdict]?.icon || "\u2705"}
                </span>
                <span className="review-verdict-text">{result.review.summary}</span>
                <button className="test-dismiss" onClick={() => setResult(null)}>&times;</button>
              </div>
              {result.review.items && result.review.items.length > 0 && (
                <div className="review-items">
                  {result.review.items.map((item, i) => (
                    <div key={i} className={`review-item review-item-${item.type}`}>
                      <span className="review-item-icon">{ITEM_ICONS[item.type] || ""}</span>
                      <span>{item.message}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.tokens && (
                <div className="review-meta">{result.tokens} tokens used</div>
              )}
            </>
          ) : (
            <div className="review-verdict" style={{ background: VERDICT_STYLES.has_issues.bg, borderColor: VERDICT_STYLES.has_issues.border }}>
              <span className="review-verdict-icon">{"\u274C"}</span>
              <span className="review-verdict-text">{result.error || "Review failed"}</span>
              <button className="test-dismiss" onClick={() => setResult(null)}>&times;</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

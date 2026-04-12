/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@forge/bridge";

/**
 * Type-ahead issue picker for selecting a Jira issue to test against.
 * Searches by issue key or summary text.
 */
export default function IssuePicker({ value, onChange, projectKey }) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const searchTimer = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback(async (text) => {
    if (!text || text.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const result = await invoke("searchIssues", { query: text, projectKey });
      if (result.success) {
        setResults(result.issues || []);
        setOpen(result.issues.length > 0);
        setHighlighted(0);
      }
    } catch (e) {
      console.error("Issue search failed:", e);
    }
    setLoading(false);
  }, [projectKey]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);

    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(val), 400);
  };

  const selectIssue = (issue) => {
    setQuery(issue.key);
    onChange(issue.key);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((p) => Math.min(p + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0 && highlighted < results.length) {
      e.preventDefault();
      selectIssue(results[highlighted]);
    }
  };

  return (
    <div className="issue-picker" ref={wrapRef}>
      <div className="issue-picker-input-wrap">
        <svg className="issue-picker-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="issue-picker-input"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Search by key (PROJ-123) or summary text..."
        />
        {loading && <span className="issue-picker-loading">...</span>}
        {query && !loading && (
          <button
            className="issue-picker-clear"
            onClick={() => { setQuery(""); onChange(""); setResults([]); setOpen(false); }}
          >
            &times;
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="issue-picker-dropdown">
          {results.map((issue, i) => (
            <div
              key={issue.key}
              className={`issue-picker-item ${i === highlighted ? "issue-picker-highlighted" : ""}`}
              onClick={() => selectIssue(issue)}
              onMouseEnter={() => setHighlighted(i)}
            >
              <div className="issue-picker-item-key">
                <span className="issue-picker-type-icon">{issue.type === "Bug" ? "\u{1F41B}" : issue.type === "Story" ? "\u{1F4D7}" : issue.type === "Epic" ? "\u{26A1}" : "\u{2611}"}</span>
                <strong>{issue.key}</strong>
              </div>
              <div className="issue-picker-item-summary">{issue.summary}</div>
              <div className="issue-picker-item-meta">
                <span className="issue-picker-status">{issue.status}</span>
                {issue.priority && <span className="issue-picker-priority">{issue.priority}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

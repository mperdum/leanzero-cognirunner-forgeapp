/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState, useRef, useEffect, useCallback } from "react";

/**
 * Custom dropdown select matching the LeanZero design system.
 * Automatically flips to open upward when near the bottom of the viewport.
 *
 * Props:
 *   value        - currently selected value
 *   onChange      - (value) => void
 *   options       - array of { value, label, meta?, group? } or strings
 *   groups        - optional array of { label, filter: (opt) => bool } for grouping
 *   placeholder   - text when nothing selected
 *   searchable    - show search input (default: false for <10 options, true for >=10)
 *   searchPlaceholder - placeholder for search input
 *   error         - show error border
 *   disabled      - disable interaction
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  groups,
  placeholder = "Select...",
  searchable,
  searchPlaceholder = "Search...",
  error,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(-1);
  const [flipUp, setFlipUp] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options to { value, label, meta, group }
  const normalized = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );

  const showSearch = searchable !== undefined ? searchable : normalized.length >= 10;

  // Filter by search
  const filtered = normalized.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.label.toLowerCase().includes(q) ||
      o.value.toLowerCase().includes(q) ||
      (o.meta && o.meta.toLowerCase().includes(q))
    );
  });

  // Find selected option's label
  const selectedOpt = normalized.find((o) => o.value === value);

  // Measure available space and decide direction
  const measureDirection = useCallback(() => {
    if (!wrapRef.current) return;
    const triggerRect = wrapRef.current.getBoundingClientRect();
    const panelHeight = 280; // max-height of dropdown-panel
    const spaceBelow = window.innerHeight - triggerRect.bottom - 8;
    const spaceAbove = triggerRect.top - 8;

    if (spaceBelow < panelHeight && spaceAbove > spaceBelow) {
      setFlipUp(true);
    } else {
      setFlipUp(false);
    }
  }, []);

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

  // Measure direction and focus search on open
  useEffect(() => {
    if (open) {
      measureDirection();
      if (showSearch && searchRef.current) {
        searchRef.current.focus();
      }
    }
  }, [open, showSearch, measureDirection]);

  // Reset highlight on search change
  useEffect(() => { setHighlighted(0); }, [search]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!open || highlighted < 0) return;
    const item = listRef.current?.querySelector(`[data-idx="${highlighted}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((p) => Math.min(p + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((p) => Math.max(p - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < filtered.length) {
        onChange(filtered[highlighted].value);
        setOpen(false);
        setSearch("");
      }
    }
  };

  const selectOption = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setSearch("");
  };

  // Render grouped or flat
  const renderItems = () => {
    if (groups && groups.length > 0) {
      return groups.map((g) => {
        const groupItems = filtered.filter(g.filter);
        if (groupItems.length === 0) return null;
        return (
          <React.Fragment key={g.label}>
            <div className="dropdown-group-label">{g.label}</div>
            {groupItems.map((opt) => {
              const flatIdx = filtered.indexOf(opt);
              return renderItem(opt, flatIdx);
            })}
          </React.Fragment>
        );
      });
    }
    return filtered.map((opt, i) => renderItem(opt, i));
  };

  const renderItem = (opt, idx) => (
    <div
      key={opt.value}
      data-idx={idx}
      className={`dropdown-item${opt.value === value ? " dropdown-selected" : ""}${idx === highlighted ? " dropdown-highlighted" : ""}`}
      onClick={() => selectOption(opt)}
      onMouseEnter={() => setHighlighted(idx)}
    >
      {opt.icon && <span className="dropdown-item-icon" dangerouslySetInnerHTML={{ __html: opt.icon }} />}
      <span className="dropdown-item-name">{opt.label}</span>
      {opt.meta && <span className="dropdown-item-meta">{opt.meta}</span>}
      {opt.type && <span className="dropdown-item-type">{opt.type}</span>}
    </div>
  );

  return (
    <div className="dropdown" ref={wrapRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={`dropdown-trigger${open ? " dropdown-open" : ""}${error ? " dropdown-error" : ""}${disabled ? " dropdown-disabled" : ""}`}
        onClick={() => { if (!disabled) { setOpen((o) => !o); setSearch(""); } }}
        disabled={disabled}
      >
        {selectedOpt ? (
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {selectedOpt.icon && <span className="dropdown-item-icon" dangerouslySetInnerHTML={{ __html: selectedOpt.icon }} />}
            {selectedOpt.label}
          </span>
        ) : (
          <span className="dropdown-placeholder">{placeholder}</span>
        )}
        <span className="dropdown-chevron">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div
          className={`dropdown-panel${flipUp ? " dropdown-panel-up" : ""}`}
          ref={panelRef}
        >
          {showSearch && (
            <div className="dropdown-search">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </div>
          )}
          <div className="dropdown-list" ref={listRef}>
            {filtered.length === 0 ? (
              <div className="dropdown-empty">No results found</div>
            ) : (
              renderItems()
            )}
          </div>
        </div>
      )}
    </div>
  );
}

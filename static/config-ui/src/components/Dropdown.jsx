/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState, useEffect, useRef } from "react";

/**
 * Dropdown Component - Reusable dropdown with keyboard navigation
 */
export const Dropdown = ({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No items found",
  renderOption,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const item = listRef.current?.querySelector(`[data-index="${highlightedIndex}"]`);
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    const visibleOptions = options.filter((opt) => true);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, visibleOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < visibleOptions.length) {
        onChange(visibleOptions[highlightedIndex]);
        setIsOpen(false);
        setSearch("");
      }
    }
  };

  const filteredOptions = options.filter((opt) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return renderOption
      ? renderOption(opt).toLowerCase().includes(q)
      : opt.label?.toLowerCase().includes(q) || opt.id?.toLowerCase().includes(q);
  });

  const selectedLabel = value
    ? options.find((o) => o.id === value)?.label || value
    : null;

  return (
    <div ref={containerRef} className="dropdown" onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={`dropdown-trigger${isOpen ? " dropdown-open" : ""}`}
        onClick={() => { setIsOpen((o) => !o); }}
      >
        <span>{selectedLabel || placeholder}</span>
        <span className="dropdown-chevron">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="dropdown-panel">
          <div className="dropdown-search">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
          <div className="dropdown-list" ref={listRef}>
            {filteredOptions.length === 0 ? (
              <div className="dropdown-empty">{emptyMessage}</div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const displayLabel = renderOption
                  ? renderOption(opt)
                  : opt.label;
                return (
                  <div
                    key={opt.id || idx}
                    data-index={idx}
                    className={`dropdown-item${value === (opt.id ?? idx) ? " dropdown-selected" : ""}${idx === highlightedIndex ? " dropdown-highlighted" : ""}`}
                    onClick={() => { onChange(opt); setIsOpen(false); setSearch(""); }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <span className="dropdown-item-name">{displayLabel}</span>
                    <span className="dropdown-item-meta">
                      {opt.description || opt.id}
                    </span>
                    {opt.type && (
                      <span className="dropdown-item-type">{opt.type}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;

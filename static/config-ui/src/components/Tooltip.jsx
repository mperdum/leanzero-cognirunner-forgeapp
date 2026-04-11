/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useState, useRef, useEffect } from "react";

export default function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState("bottom");
  const tipRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (visible && tipRef.current && wrapRef.current) {
      const tipRect = tipRef.current.getBoundingClientRect();
      if (tipRect.bottom > window.innerHeight) {
        setPosition("top");
      } else {
        setPosition("bottom");
      }
    }
  }, [visible]);

  return (
    <span
      className="tooltip-wrap"
      ref={wrapRef}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children || (
        <span className="tooltip-icon" aria-label="More info">?</span>
      )}
      {visible && (
        <span className={`tooltip-bubble tooltip-${position}`} ref={tipRef} role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}

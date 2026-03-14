/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React, { useEffect } from "react";

/**
 * ThemeInjector Component
 * Enables dark mode support via Forge's view.theme API
 */
function ThemeInjector() {
  useEffect(() => {
    const enableTheme = async () => {
      try {
        const { view } = await import("@forge/bridge");
        if (view && view.theme && view.theme.enable) {
          await view.theme.enable();
        }
      } catch (e) {
        console.log("Could not enable theme:", e);
      }
    };
    enableTheme();
  }, []);

  return null;
}

export default ThemeInjector;

/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import JiraPromptsManager from './JiraPromptsManager';

// Prism.js for syntax highlighting
import 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';

const container = document.getElementById('root');
const root = createRoot(container);

// Load prompts data and render appropriate component
let JIRA_PROMPTS = {};
try {
  // Import the JIRA_PROMPTS from our module
  const { JIRA_PROMPTS: prompts } = require('./prompts-data.js');
  if (prompts) JIRA_PROMPTS = prompts;
} catch (e) {
  console.log('Could not load JIRA_PROMPTS:', e);
}

// Create prompts data export for the manager component
const PROMPTS_EXPORT = { JIRA_PROMPTS };
const moduleExports = { JIRA_PROMPTS, ...PROMPTS_EXPORT };

// Export for browser window access
window.JIRA_PROMPTS_DATA = JIRA_PROMPTS;

root.render(<JiraPromptsManager />);
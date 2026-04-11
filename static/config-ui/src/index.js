/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './frontend/App';

// Import Prism.js for syntax highlighting
import 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-json';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(<App />);

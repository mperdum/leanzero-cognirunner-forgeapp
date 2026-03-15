# CogniRunner

**AI-powered semantic workflow validation for Jira.**

Part of the [LeanZero](https://leanzero.atlascrafted.com) ecosystem.

---

## Quick Links

| | |
|---|---|
| **Marketplace** | [Install from Atlassian Marketplace](https://marketplace.atlassian.com/apps/298437877/cognirunner?hosting=cloud&tab=overview) |
| **License** | [AGPL-3.0](LICENSE) - First open-source Forge app |

---

## What is CogniRunner?

CogniRunner brings semantic intelligence to Jira workflows. Write a plain-English prompt, pick a field, and CogniRunner handles the rest. What was previously impossible to assess — the actual meaning of text fields, content of attached documents, quality of descriptions — is now trivial.

### Why It Exists

Jira's built-in workflow validators are limited to structural checks: "field is required", "field matches regex", "field is not empty". They can't understand **meaning**.

CogniRunner changes that. It adds a semantic layer by sending field content to an AI model and evaluating it against natural-language criteria.

| Before (Impossible) | Now with CogniRunner |
|---------------------|----------------------|
| Description must contain steps to reproduce | Just write that prompt |
| Acceptance criteria in Given/When/Then format | AI validates structure |
| No placeholder text like TBD or TODO | AI detects and rejects |
| Check if a duplicate issue exists | Agentic mode searches Jira |
| Attached mockup must be a UI screenshot | Multimodal image analysis |

### Ease of Use

Configuration takes **30 seconds**: pick a field from a dropdown, write what "valid" means in plain English, done. No regex, no scripting, no ScriptRunner required.

> **Status: Early / Raw.** This codebase was built quickly and is deployed on the Atlassian Marketplace. It works and does its job — but needs refactoring. The backend has been modularized into a clean 3-layer architecture. Contributions are welcome. Expect rough edges, and expect them to get smoothed out.

---

## Features Overview

### Core Validation

| Feature | Description |
|---------|-------------|
| Workflow Validators | Block transitions if AI validation fails with clear error messages |
| Workflow Conditions | Hide transitions entirely based on AI evaluation |
| Attachment Validation | Analyze images, PDFs, Word docs, Excel files directly (multimodal) |
| Smart Field Selector | Context-aware: resolves screen schemes to show only relevant fields |

### Post-Functions

| Feature | Description |
|---------|-------------|
| Semantic Post Function | AI-powered field modifications after transition completes |
| Static Post Function | Custom JavaScript execution in sandboxed environment with Jira API access |

### Advanced Features

| Feature | Description |
|---------|-------------|
| Agentic Validation | AI autonomously searches Jira for context (duplicates, related issues) |
| Admin Panel | Global overview of all rules across workflows with enable/disable toggles |
| Validation Logs | Last 50 validations stored with AI reasoning and tool metadata |
| License-Aware | Validation skipped when license inactive (fail-open design) |

---

## Examples & Use Cases

### Workflow Validators

Block transitions until field content meets your criteria:

    The description must contain steps to reproduce, expected behavior,
    and actual behavior for bug reports.

    Acceptance criteria must be written in Given/When/Then format.
    Reject if missing any of the three sections.

    This field must not contain profanity, PII (personal identifiable information),
    or placeholder text like TBD, TODO, or fill this in.

### Agentic Validation (Duplicate Detection)

Enable Jira Search to let AI autonomously find related issues:

    Check if a similar issue already exists in this project.
    Search for matching keywords from the summary and description.
    Only flag as duplicate if there's strong evidence of the same issue.

The AI will:
1. Extract key phrases from the field being validated
2. Construct and execute JQL queries against your project
3. Compare search results with the current issue
4. Render a pass/fail judgment with reasoning

### Semantic Post Functions

Automatically modify fields based on AI analysis after transition:

**Example 1: Auto-categorize issues**

    Condition: The description mentions a security vulnerability or data breach
    Action: Add Security label and set priority to Highest

**Example 2: Translate descriptions**

    Condition: The description is written in English
    Action: Translate the description to Spanish and output only the translation
    Target Field: customfield_12345 (Description - Spanish)

**Example 3: Extract action items**

    Condition: Always run
    Action: Extract all TODO items from the description as a numbered list
    Target Field: customfield_67890 (Action Items)

### Static Post Functions

Run custom JavaScript with full Jira API access:

    // Example: Create subtasks from checklist items
    const issue = await api.getIssue(ctx.issueKey);
    const checklist = issue.fields.customfield_12345; // Checklist field

    for (const item of checklist.filter(i => !i.completed)) {
      await api.updateIssue(ctx.issueKey, {
        fields: {
          summary: Complete: ${item.text},
          issuetype: { name: "Sub-task" },
          parent: { key: ctx.issueKey }
        }
      });
    }

    log(`Created subtasks for incomplete items`);

---

## Detailed Documentation

### Workflow Validators

Validators run when a user attempts to transition an issue. If validation fails, the transition is blocked and the user sees the AI's reasoning as an error message.

**Configuration:**
1. Go to Project Settings -> Workflows
2. Edit a workflow transition
3. Add Validator -> Select CogniRunner Field Validator
4. Choose field from dropdown (context-aware: shows only fields on that screen)
5. Write your validation prompt in plain English
6. Optionally configure Jira Search toggle (Auto/On/Off)
7. Publish workflow

**Validation Flow:**
1. User triggers a workflow transition in Jira
2. CogniRunner extracts the configured field value from the issue
3. The field value is sent to OpenAI with your validation prompt
4. OpenAI returns { isValid, reason } as JSON
5. If isValid=false, the transition is blocked with the reason displayed
6. If isValid=true, the transition proceeds normally

**Prompt Design Tips:**
- Be specific about what makes content valid or invalid
- Include examples in your prompt when possible
- Specify format requirements (e.g., "use bullet points", "include three sections")
- Mention what to reject explicitly (profanity, placeholders, unclear text)

### Workflow Conditions

Conditions control whether a transition is visible to users. If the condition fails, the transition button is hidden entirely.

**Use case:** Hide Deploy to Production unless all acceptance criteria are met and verified.

Configuration is identical to validators — select CogniRunner Field Condition instead.

### Semantic Post Functions

Post-functions execute **after** a transition completes successfully. The semantic post function uses AI to analyze field content and automatically modify fields based on natural language instructions.

**How it works:**
1. **Condition Check** (optional): AI evaluates whether current field content meets a condition
2. **Action Execution**: If condition passes, AI analyzes target field and generates new value
3. **Field Update**: New value is written to the target field

**Configuration:**
1. Edit workflow transition -> Add Post-Function
2. Select CogniRunner Semantic Post Function
3. Configure:
   - Condition Prompt (optional): When should this run?
   - Action Prompt: What should the AI do?
   - Source Field: Which field to analyze?
   - Target Field: Where to write the result?
4. Enable dry-run mode for testing

**Advanced Use Cases:**
- **Auto-translations**: Translate descriptions to multiple languages based on user locale
- **Data enrichment**: Add computed fields (sentiment score, readability index)
- **Content extraction**: Pull specific data points into structured fields
- **Template completion**: Fill in missing sections of templates with AI-generated content

### Static Post Functions

Execute custom JavaScript code in a sandboxed environment with Jira API access.

**Sandbox API:**

    ctx: {
      issueKey: string,        // Current issue key
      issueId: string,         // Current issue ID
      transitionId: string,    // Current transition ID
      modifiedFields: object   // Fields modified on this transition
    }

    api: {
      getIssue: async (key) => Promise<{ key, fields }>
      updateIssue: async (key, fields) => Promise<{ success }>
      searchJql: async (jql) => Promise<{ total, issues }>
      transitionIssue: async (key, transitionId) => Promise<{ success }>
      log: (...args) => void
    }

**Common Patterns:**
- **Bulk operations**: Iterate over multiple issues to update related work
- **Conditional logic**: Complex business rules beyond simple field updates
- **External integrations**: Sync Jira data with external systems
- **Notification automation**: Create comments or notifications based on changes

### Agentic Validation

CogniRunner can autonomously search your Jira project to make context-aware decisions. This is powered by an agentic loop where the AI model calls tools, analyzes results, and iterates before rendering a final verdict.

**Activation:**
- **Auto-detect (default)**: CogniRunner analyzes your prompt for keywords like duplicate, similar issues, already exists
- **Manual toggle**: Set Jira Search option to Always enabled or Always disabled

**Safety:**
- 22-second timeout budget (Forge validators have 25-second limit)
- Maximum 3 tool-call rounds per validation
- JQL searches automatically scoped to current project
- Fail-open design: if time runs out, transition is allowed

**Agentic Data Flow:**

    User Configures Rule with Agentic Prompt
              |
              v
    validate() extracts field value from issue
              |
              v
    callOpenAIWithTools() sends prompt + field value to AI
              |
              v
    AI analyzes and calls search_jira_issues tool
              |
              v
    CogniRunner executes JQL against Jira REST API
              |
              v
    Results returned to AI for analysis
              |
              v
    AI may issue additional searches (up to 3 rounds)
              |
              v
    AI renders final { isValid, reason } verdict
              |
              v
    Tool metadata stored in validation log
              |
              v
    Jira blocks or allows transition

**Tool Registry:**
- **search_jira_issues**: Search for issues using JQL with automatic project scoping
  - Returns up to 10 issues per query
  - Includes key, summary, status, and validated field content (truncated)
  - Scoped to current project automatically

### Admin Panel

Global overview of all configured rules across all workflows. Accessible from Jira's main navigation under CogniRunner Admin.

**Features:**
- List all validators, conditions, and post-functions
- Enable/disable individual rules without removing them
- Automatic orphan cleanup for deleted transitions
- View validation logs with AI reasoning

**Orphan Cleanup Logic:**
When retrieving configured rules, the admin panel checks each rule against the actual workflow configuration. If a transition has been deleted since the rule was created, that rule is automatically removed from the registry.

### Supported Field Types

| Category | Field Types |
|----------|-------------|
| Text | Summary, single-line text, multi-line text |
| Rich Text | Description, any ADF field (full parsing: mentions, dates, emojis, nested blocks) |
| Select | Single select, radio buttons, priority, status, resolution |
| Multi-Select | Multi-select, checkboxes, labels, components, versions |
| Users | Assignee, reporter, user/group pickers (single/multi) |
| Dates | Date picker, date-time picker, due date |
| Numeric | Number fields, time tracking |
| Links | URL fields, issue links, parent issue |
| Complex | Cascading select, sprint, project picker, security level |
| Attachments | Images (PNG/JPEG/GIF/WebP), PDFs, Word docs, Excel, PowerPoint |

---

## Architecture

### Project Structure

    CogniRunner/
    ├── manifest.yml                  # Forge app definition
    ├── src/
    │   ├── index.js                  # Main entry point (~200 lines)
    │   ├── core/                     # Core business logic modules
    │   │   ├── validator/            # Validation logic
    │   │   │   ├── index.js          # Main validator entry point
    │   │   │   ├── openai-client.js  # OpenAI API integration
    │   │   │   └── attachments.js    # Attachment processing
    │   │   ├── post-function/        # Post function execution
    │   │   │   ├── index.js          # Post function aggregator
    │   │   │   ├── semantic.js       # Semantic post function
    │   │   │   └── static.js         # Static (JavaScript) post function
    │   │   └── config/               # Configuration management
    │   │       ├── index.js          # Config module aggregator
    │   │       ├── registry.js       # KVS storage/retrieval
    │   │       └── logger.js         # Validation logging
    │   └── integration/              # Integration layers
    │       ├── prompts/              # Prompt definitions by category
    │       ├── jira-api/             # Jira API helpers
    │       │   ├── fields.js         # Field extraction and formatting
    │       │   ├── workflows.js      # Workflow fetching
    │       │   └── screens.js        # Screen-based field resolution
    │       └── tools/                # Agentic tool registry
    ├── static/
    │   ├── config-ui/                # React app: configure validator/condition
    │   ├── config-view/              # React app: read-only view + logs
    │   └── admin-panel/              # React app: global admin dashboard
    ├── LICENSE                       # AGPL-3.0
    ├── NOTICE                        # Trademark + attribution
    └── README.md

### Backend Architecture (3-Layer)

**Layer 1: Core Business Logic (`src/core/`)**
- Validator Module — Standard and agentic AI validation
- Post-Function Module — Semantic and static post-function execution
- Config Module — Configuration registry and validation logs

**Layer 2: Integration Layers (`src/integration/`)**
- Prompts Module — Organized prompt definitions by category (issues, projects, users, groups, workflows, etc.)
- Jira API Module — Field extraction, workflow fetching, screen resolution
- Tools Module — Agentic tool registry for OpenAI function definitions

**Layer 3: Entry Point (`src/index.js`)**
- Exports resolver definitions and provides backward compatibility
- Imports and coordinates all core and integration modules

### Frontend (3 React Apps)

| App | Purpose |
|-----|---------|
| config-ui | Field selector + prompt editor + JQL toggle. Context-aware screen resolution. |
| config-view | Read-only config summary + validation logs + enable/disable toggle. |
| admin-panel | Global admin dashboard listing all rules across workflows. |

All three support Jira's light and dark themes via CSS custom properties.

### Data Flow Diagrams

**Standard Validation Flow:**

    User Transition -> validate() -> extractFieldValue()
                          |
                          v
                    callOpenAI(fieldValue, prompt)
                          |
                          v
                    { isValid, reason }
                          |
                          v
                    storeLog() + return result to Jira

**Agentic Validation Flow:**

    User Transition -> validate() -> callOpenAIWithTools()
                          |              |
                          |              v (repeated up to 3x)
                          |           AI calls tool -> executeJqlSearch()
                          |              |              |
                          |              v              v
                          |         Return results -> AI analyzes
                          |
                          v
                    Final verdict { isValid, reason }

---

## Development Setup

### Prerequisites

- **Node.js 22+** (Forge runtime is `nodejs22.x`)
- **Atlassian Forge CLI**: `npm install -g @forge/cli`
- **An Atlassian Cloud developer site** ([get one free](https://developer.atlassian.com/platform/forge/getting-started/))
- **An OpenAI API key**

### Installation

    # Clone and install root dependencies
    git clone https://github.com/mperdum/leanzero-cognirunner-forgeapp.git
    cd CogniRunner
    npm install

    # Install frontend dependencies (3 separate React apps)
    cd static/config-ui && npm install && cd ../..
    cd static/config-view && npm install && cd ../..
    cd static/admin-panel && npm install && cd ../..

### Register and Configure

    # Register a new Forge app (updates manifest.yml with your app ID)
    forge register

    # Set environment variables
    forge variables set OPENAI_API_KEY your-openai-api-key
    forge variables set OPENAI_MODEL gpt-5-mini    # optional, this is the default

### Build Frontends

    cd static/config-ui && npm run build && cd ../..
    cd static/config-view && npm run build && cd ../..
    cd static/admin-panel && npm run build && cd ../..

**Important:** The `build/` directories are committed because Forge deploys them directly. Always rebuild after changing frontend source.

### Deploy and Install

    forge deploy
    forge install    # Select your Jira site when prompted

### Development Workflow

    # Run Forge tunnel for live backend reloading
    forge tunnel

    # Watch mode for frontend changes (separate terminals)
    cd static/config-ui && npm run start
    cd static/config-view && npm run start
    cd static/admin-panel && npm run start

    # Lint
    npm run lint

### Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| OPENAI_API_KEY | Yes | -- | OpenAI API authentication |
| OPENAI_MODEL | No | `gpt-5-mini` | OpenAI model to use |
| VALIDATE_FIELD_ID | No | description | Fallback field ID if not configured |
| VALIDATION_PROMPT | No | *(generic quality check)* | Fallback prompt if not configured |

Set via: `forge variables set KEY value`

---

## Troubleshooting

### Validation Always Passes

**Possible causes:**
1. **License inactive**: Check Marketplace subscription status
2. **Rule disabled**: Verify rule is enabled in Admin Panel or config-view
3. **Wrong field**: Ensure the configured field is actually on the transition screen

**Debug steps:**

    forge logs --tail 50

### Validation Always Fails

**Possible causes:**
1. **Prompt too strict**: Relax your validation criteria
2. **Field empty**: AI may reject empty content depending on prompt
3. **OpenAI API error**: Check `OPENAI_API_KEY` is valid and has credits

**Debug steps:**
- View validation logs in config-view to see AI reasoning
- Test with a simpler prompt first

### Agentic Mode Not Working

**Possible causes:**
1. **Prompt doesn't trigger auto-detect**: Use keywords like duplicate, similar issues, already exists
2. **Manual toggle set to Off**: Change Jira Search option to Auto or On
3. **Permissions missing**: Ensure app has `read:jira-work` scope

### Field Selector Shows No Fields

**Possible causes:**
1. **Project not resolved**: Screen-based resolution requires project context
2. **Create transition**: Some fields unavailable on issue creation (use fallback list)

**Workaround:** Use manual field ID text input if dropdown is empty

### Post-Function Not Executing

**Possible causes:**
1. **License inactive**: Post-functions skip when license is inactive
2. **Rule disabled**: Check Admin Panel for rule status
3. **Dry-run mode enabled**: Disable dry-run to apply changes

---

## FAQ

### What AI models are supported?

Currently OpenAI only (configured via `OPENAI_MODEL` environment variable). Anthropic (Claude), Google (Gemini), and local inference engines are on the roadmap.

### Can I use my own OpenAI key?

BYOK (Bring Your Own Key) is architecturally supported but not yet exposed in the UI. Future work will add per-project key configuration.

### How many validations can I run?

Limited by your OpenAI API quota and Forge compute limits. Each validation is a single API call (standard mode) or up to 3 tool-call rounds (agentic mode).

### Are validation logs stored permanently?

No. Logs are capped at 50 entries in Forge Storage (FIFO). For audit trails, export logs regularly from the Admin Panel.

### Can I validate attachments on issue creation?

No. Jira doesn't expose attachments in `modifiedFields` during CREATE. Attachment validation works only on transitions of existing issues.

### What happens if OpenAI is down?

Fail-open design. If AI validation fails due to API errors, the transition is allowed (not blocked).

### Can I fork and self-host this?

Yes! The AGPL-3.0 license allows forking and modification. However, Forge apps run on Atlassian's infrastructure — you can't truly "self-host" a Forge app. You can deploy your own fork to the Marketplace or use it privately.

### Is there a free tier?

Check the [Marketplace listing](https://marketplace.atlassian.com/apps/298437877/cognirunner) for current pricing. The licensing fee covers infrastructure costs — if it could be free without the author paying out of pocket, it would be.

---

## Known Limitations

| Limitation | Status |
|------------|--------|
| No test framework | Planned |
| CSS triple-definition (Forge iframe quirks) | Intentional but ugly |
| No i18n support | All strings hardcoded in English |
| Attachment validation skipped on CREATE | Jira API limitation |
| 50-log limit in Forge Storage | FIFO overflow |
| OpenAI only (no other providers yet) | On roadmap |
| Agentic mode adds latency (~2-5 seconds) | Expected behavior |

---

## Permissions

The app requests the following Forge permissions:

| Scope | Purpose |
|-------|---------|
| read:jira-work | Read issue fields, data, and execute JQL searches |
| read:workflow:jira | Read workflow definitions for orphan cleanup |
| read:project:jira | Resolve project context for screen-based field filtering |
| storage:app | Persist validation logs and config registry |
| read:issue-type-screen-scheme:jira | Screen-based field resolution |
| read:screen-scheme:jira | Screen-based field resolution |
| read:screen-tab:jira | Screen-based field resolution |
| read:screenable-field:jira | Screen-based field resolution |

External fetch: `https://api.openai.com` (for AI validation calls).

---

## Contributing

Contributions are welcome and encouraged. This is the first open-source Forge app — help set the standard.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

By contributing, you agree that your contributions will be licensed under AGPL-3.0.

**Note:** The CogniRunner name and branding are trademarked. See [NOTICE](NOTICE) for details. Derivative works must use a different name.

---

## License & Trademark

Copyright (C) 2025 LeanZero

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See [LICENSE](LICENSE) for the full text.

### What AGPL-3.0 Means for You

- You can use, modify, and distribute this software freely
- You must share your source code if you distribute or run a modified version as a network service
- You must keep the copyright notices and license intact
- You cannot use the CogniRunner name/branding for derivative works

### Trademark

CogniRunner is a trademark of LeanZero. The name and branding are **not** covered by the AGPL license. If you fork this project, you must use a different name and branding. See [NOTICE](NOTICE) for full details.

---

Part of [LeanZero](https://leanzero.atlascrafted.com) by Mihai Perdum.
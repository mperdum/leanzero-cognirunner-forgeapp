# CogniRunner

**AI-powered semantic workflow validation for Jira.**

Part of the [LeanZero](https://leanzero.atlascrafted.com) ecosystem.

**[Live on the Atlassian Marketplace](https://marketplace.atlassian.com/apps/298437877/cognirunner?hosting=cloud&tab=overview)** -- install it directly into your Jira Cloud instance.

CogniRunner is the **first open-source Atlassian Forge app**, licensed under [AGPL-3.0](LICENSE). It brings semantic intelligence to Jira workflows -- what was previously impossible to assess (the actual meaning of a text field, the content of an attached document, the quality of a description) is now child's play. Write a plain-English prompt, pick a field, and CogniRunner handles the rest.

> **Status: Early / Raw.** This codebase was built in one week. It works, it's deployed on the Atlassian Marketplace, and it does its job -- but it needs a refactor. The backend is a single monolithic file, there are no tests, and the frontend CSS is triple-defined due to Forge iframe quirks. There's a massive appetite from the author to improve and maintain this project. Contributions are welcome. Expect rough edges, and expect them to get smoothed out.

---

## Why CogniRunner Exists

Jira's built-in workflow validators are limited to structural checks: "field is required", "field matches regex", "field is not empty". They can't understand meaning.

CogniRunner changes that. It adds a **semantic layer** to Jira workflows by sending field content to an AI model and evaluating it against natural-language criteria. This means you can now enforce things like:

- "The description must contain steps to reproduce, expected behavior, and actual behavior"
- "Acceptance criteria must be in Given/When/Then format"
- "The attached design mockup must be a UI screenshot, not a stock photo"
- "This field must not contain profanity, PII, or placeholder text like 'TBD'"
- "Check if a similar or duplicate issue already exists in the project"

None of this was possible before. CogniRunner makes it trivial.

### Ease of Use

Configuration takes 30 seconds: pick a field from a dropdown, write what "valid" means in plain English, done. No regex, no scripting, no ScriptRunner. The field selector is context-aware -- it resolves the project's screen scheme and shows only the fields that are actually on the relevant screen for that transition, so you're not scrolling through hundreds of irrelevant fields.

---

## What It Does

### Core Validation

- **Workflow Validators** -- Block a transition if a field's content doesn't pass AI validation. The user sees a clear error message with the AI's reasoning.
- **Workflow Conditions** -- Hide a transition entirely if the field doesn't meet criteria.
- **Attachment Validation** -- Downloads and sends images, PDFs, Word docs, Excel files, and presentations directly to OpenAI for content-aware validation. Validates what's *in* the file, not just that a file exists.
- **Smart Field Selector** -- Resolves the project's issue type screen scheme to show only the fields present on the relevant screen (create vs. edit/view). Falls back to all fields when screen resolution isn't possible.

### Agentic Validation

CogniRunner doesn't just evaluate text in isolation -- it can **autonomously search your Jira project** to make context-aware decisions. This is powered by an agentic loop where the AI model can call tools, analyze results, and iterate before rendering a final verdict.

**How it works:**

1. The AI receives the field content and your validation prompt
2. If the prompt involves cross-issue concerns (duplicates, similarity, prior work), the AI autonomously constructs JQL queries and searches your Jira project
3. It analyzes the search results, compares field values, and may refine its search with additional queries (up to 3 tool-call rounds)
4. Once it has enough context, it renders a pass/fail judgment with reasoning

**Use cases:**

- **Duplicate detection** -- "Check if a similar issue already exists in this project." The AI searches by key phrases, compares descriptions, and only flags true duplicates (not merely related issues).
- **Cross-referencing** -- "Verify this bug hasn't already been reported or resolved." The AI checks open and closed issues for matches.
- **Consistency checks** -- "Ensure this task doesn't overlap with existing work in the current sprint." The AI queries sprint-scoped issues and compares scope.

**Activation:**

The agentic flow activates in one of two ways:
- **Auto-detect (default)** -- CogniRunner analyzes your prompt for keywords like "duplicate", "similar issues", "already exists", "cross-reference", etc. If detected, tools are enabled automatically.
- **Manual toggle** -- In the config UI, set the Jira Search (JQL) option to "Always enabled" or "Always disabled" to override auto-detection.

**Safety:**

- The agentic loop operates within a 22-second timeout budget (Forge validators have a 25-second limit). If time runs out, the transition is allowed (fail-open).
- Maximum 3 tool-call rounds per validation to bound latency.
- JQL searches are automatically scoped to the current project.
- The judgment is calibrated to minimize false rejections: partial topic overlap is not grounds for blocking a transition.

### Administration

- **Admin Panel** -- Global overview of all configured rules across all workflows, with enable/disable toggles and automatic orphan cleanup for rules whose transitions have been deleted.
- **Enable/Disable Rules** -- Toggle individual rules on and off from the admin panel or config-view without removing them from the workflow. Disabled rules are skipped during validation (fail-open).
- **Validation Logs** -- Stores the last 50 validation results (pass/fail, AI reasoning, issue key, timestamp) in Forge Storage. When agentic mode was used, logs include the JQL queries executed, number of tool-call rounds, and total results returned.
- **License-Aware** -- When the Marketplace license is inactive, validation is skipped entirely (fail-open). Transitions are never blocked due to licensing issues.

### Supported Field Types

CogniRunner can validate virtually any Jira field type. The field extraction engine handles:

| Category | Field Types |
|----------|-------------|
| **Text** | Summary, single-line text, multi-line text |
| **Rich Text** | Description, Environment, any ADF field (full Atlassian Document Format parsing including mentions, dates, status lozenges, inline cards, emojis, and nested block structures) |
| **Select** | Single select, radio buttons, priority, status, resolution, issue type |
| **Multi-Select** | Multi-select, checkboxes, labels, components, fix versions, affected versions |
| **Users** | Assignee, reporter, single/multi user picker, single/multi group picker |
| **Dates** | Date picker, date-time picker, due date, created, updated |
| **Numeric** | Number fields, time tracking (original/remaining/spent) |
| **Links** | URL fields, issue links (with summary), parent issue |
| **Complex** | Cascading select, sprint, project picker, security level |
| **Attachments** | Images (PNG, JPEG, GIF, WebP), PDFs, Word docs (DOCX/DOC/RTF/ODT), Excel (XLSX/XLS/CSV/TSV), PowerPoint (PPTX/PPT) -- downloaded and sent as multimodal content |
| **Third-Party** | Checklist for Jira (Okapya), Xray Manual Test Steps, Jira Assets/Insight objects, ScriptRunner fields, Tempo accounts, Elements Connect |

Any field type not explicitly handled gets a best-effort extraction (readable key-value pairs or JSON fallback).

---

## Architecture

```
CogniRunner/
├── manifest.yml                  # Forge app definition
├── src/
│   ├── index.js                  # Main entry point (resolvers + exports)
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
│       ├── prompts/              # Prompt definitions
│       │   ├── index.js          # Prompts aggregator
│       │   ├── helpers.js        # Prompt helper functions
│       │   └── categories/       # Category-specific prompts
│       ├── jira-api/             # Jira API helpers
│       │   ├── index.js          # API aggregator
│       │   ├── fields.js         # Field extraction/formatting
│       │   ├── workflows.js      # Workflow fetching
│       │   └── screens.js        # Screen-based field resolution
│       └── tools/                # Agentic tool registry
├── static/
│   ├── config-ui/src/            # React app: configure validator/condition
│   ├── config-view/src/          # React app: read-only view + logs
│   └── admin-panel/src/          # React app: global admin dashboard
├── LICENSE                       # AGPL-3.0
├── NOTICE                        # Trademark + attribution
└── README.md
```

### Backend Architecture

The backend has been refactored into a clean, modular 3-layer architecture:

**Layer 1: Core Business Logic (`src/core/`)**
- **Validator Module** (`core/validator/`) - Handles all validation logic including standard and agentic AI validation
- **Post-Function Module** (`core/post-function/`) - Executes post-function logic (semantic and static)
- **Config Module** (`core/config/`) - Manages configuration registry and validation logs

**Layer 2: Integration Layers (`src/integration/`)**
- **Prompts Module** (`integration/prompts/`) - Organized prompt definitions by category with helper functions
- **Jira API Module** (`integration/jira-api/`) - Jira API helpers for field extraction, workflow fetching, and screen resolution
- **Tools Module** (`integration/tools/`) - Agentic tool registry for OpenAI function definitions and executors

**Layer 3: Entry Point (`src/index.js`)**
- Main entry point that exports resolver definitions and provides backward compatibility
- Imports and coordinates all core and integration modules
- ~200 lines (down from ~1700 lines)

### Core Modules

**Validator Module** (`src/core/validator/`)
- **`validate`** - Main validation entry point that receives issue data + configuration
- **`callOpenAI`** - Standard single-turn validation: sends field content + prompt, returns `{ isValid, reason }`
- **`callOpenAIWithTools`** - Agentic multi-turn validation with tool-calling support
- **`downloadAttachment` / `buildAttachmentContentParts`** - Attachment processing for AI validation

**Post-Function Module** (`src/core/post-function/`)
- **`executePostFunction`** - Main post function executor
- **`executeSemanticPostFunction`** - AI-powered semantic post functions (uses OpenAI to analyze and modify fields)
- **`executeStaticPostFunction`** - Static JavaScript post functions (runs custom JavaScript code in a sandbox)

**Config Module** (`src/core/config/`)
- **`registerConfig` / `getConfigs`** - Configuration registry management
- **`storeLog` / `getLogs` / `clearLogs`** - Validation log storage and retrieval
- **`enableRule` / `disableRule`** - Rule enable/disable functionality
- **`registerPostFunction` / `getPostFunctionStatus`** - Post function management

### Integration Modules

**Prompts Module** (`src/integration/prompts/`)
- **`index.js`** - Aggregates all prompt categories
- **`helpers.js`** - Helper functions: `calculateSimilarity`, `searchPrompts`, `buildJqlFromIntent`
- **`categories/`** - Organized prompt definitions by category:
  - `issues.js` - Issue-related prompts
  - `projects.js` - Project-related prompts
  - `users.js` - User-related prompts
  - `groups.js` - Group-related prompts
  - `workflows.js` - Workflow-related prompts
  - `field-configs.js` - Field configuration prompts
  - `screens.js` - Screen-related prompts
  - `custom-fields.js` - Custom field prompts
  - `statuses-resolutions.js` - Status/resolution prompts
  - `issue-types.js` - Issue type prompts
  - `security.js` - Security level prompts
  - `notifications.js` - Notification prompts
  - `permissions.js` - Permission prompts
  - `automation.js` - Automation prompts
  - `attachments-versions.js` - Attachment/version prompts

**Jira API Module** (`src/integration/jira-api/`)
- **`index.js`** - Aggregates all Jira API helpers
- **`fields.js`** - Field extraction and formatting (`formatField`, `sortFields`, `getFallbackFields`)
- **`workflows.js`** - Workflow fetching (`fetchWorkflowTransitions`, `fetchProjectsForWorkflow`)
- **`screens.js`** - Screen-based field resolution

**Tools Module** (`src/integration/tools/`)
- **Tool Registry** - Extensible registry mapping tool names to OpenAI function definitions and executors
- Currently includes `search_jira_issues` tool for agentic validation
- Designed for easy addition of new tools

### Frontend (3 React Apps)

Each is a separate React 18 app bundled with Webpack + Babel, running as Forge Custom UI inside Jira's sandboxed iframe:

| App | Purpose |
|-----|---------|
| `config-ui` | Field selector + prompt editor + JQL toggle (auto/on/off). Context-aware: resolves screen fields for the workflow's project. |
| `config-view` | Read-only config summary + validation logs (with agentic metadata) + enable/disable toggle. |
| `admin-panel` | Jira admin page listing all rules across all workflows, with orphan cleanup. |

All three support Jira's light and dark themes via CSS custom properties and `view.theme.enable()`.

### Data Flow

**Standard validation:**
```
User configures rule in Jira Workflow Editor
  -> config-ui saves { fieldId, prompt, enableTools } as JSON string
  -> Forge stores config in the workflow rule
  -> On each transition, Forge calls validate()
  -> validate() extracts field value from issue
  -> Calls AI model with the value + prompt
  -> Returns { result: true/false, errorMessage }
  -> Jira blocks or allows the transition accordingly
```

**Agentic validation (when tools are enabled):**
```
validate() extracts field value from issue
  -> Calls callOpenAIWithTools() with field value, prompt, and issue context
  -> AI analyzes the prompt and decides whether to search Jira
  -> AI calls search_jira_issues tool with a JQL query
  -> CogniRunner executes JQL against Jira REST API, returns results
  -> AI analyzes results, may issue additional searches (up to 3 rounds)
  -> AI renders final { isValid, reason } verdict
  -> Tool metadata (queries, rounds, results) stored in validation log
  -> Jira blocks or allows the transition accordingly
```

---

## Roadmap

### BYOK (Bring Your Own Key)

CogniRunner currently uses OpenAI via a Forge environment variable. The architecture already supports BYOK -- you set your own API key. Future work will add a UI for key management and per-project key configuration.

### Additional AI Connectors

The AI integration is cleanly separated into `callOpenAI` (standard) and `callOpenAIWithTools` (agentic). Planned connectors:

- **Anthropic (Claude)** -- For teams that prefer Anthropic's models
- **Google (Gemini)** -- For Google Cloud-oriented organizations
- **Local inference engines** -- Inferencer, LM Studio, vLLM, Ollama -- for teams that need to keep data on-premises or want zero API costs

The goal is a connector dropdown in the config UI where you pick your provider.

### Additional Agentic Tools

The tool registry is designed for extensibility. Planned additions:

- **Confluence search** -- Cross-reference field content against documentation
- **Component/label lookup** -- Validate that referenced components or labels exist
- **Custom field lookups** -- Query specific custom field values across issues

### Code Quality

- Split `src/index.js` into modules
- Add a test framework
- Consolidate the CSS triple-definition pattern
- Add i18n support

---

## Prerequisites

- **Node.js 22+** (Forge runtime is `nodejs22.x`)
- **Atlassian Forge CLI** (`npm install -g @forge/cli`)
- **An Atlassian Cloud developer site** ([get one free](https://developer.atlassian.com/platform/forge/getting-started/))
- **An OpenAI API key**

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/mperdum/leanzero-cognirunner-forgeapp.git
cd CogniRunner
npm install
cd static/config-ui && npm install && cd ../..
cd static/config-view && npm install && cd ../..
cd static/admin-panel && npm install && cd ../..
```

### 2. Register a new Forge app

```bash
forge register
```

This will update the `app.id` in `manifest.yml` with your own app ID.

### 3. Set environment variables

```bash
forge variables set OPENAI_API_KEY your-openai-api-key
forge variables set OPENAI_MODEL gpt-5-mini    # optional, this is the default
```

### 4. Build the frontends

```bash
cd static/config-ui && npm run build && cd ../..
cd static/config-view && npm run build && cd ../..
cd static/admin-panel && npm run build && cd ../..
```

### 5. Deploy and install

```bash
forge deploy
forge install    # Select your Jira site when prompted
```

### 6. Use it

1. Go to **Project Settings > Workflows** in Jira
2. Edit a workflow transition
3. Add a **Validator** or **Condition** and select "CogniRunner Field Validator" / "CogniRunner Field Condition"
4. Pick the field to validate and write your prompt
5. Optionally configure the Jira Search (JQL) toggle for agentic features
6. Publish the workflow

---

## Development

```bash
# Run Forge tunnel for live backend reloading
forge tunnel

# Watch mode for frontend changes (in separate terminals)
cd static/config-ui && npm run start
cd static/config-view && npm run start
cd static/admin-panel && npm run start

# Lint
npm run lint
```

**Important:** The `build/` directories are committed because Forge deploys them directly. After changing frontend source, always rebuild before deploying.

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `OPENAI_API_KEY` | Yes | -- | OpenAI API authentication |
| `OPENAI_MODEL` | No | `gpt-5-mini` | OpenAI model to use |
| `VALIDATE_FIELD_ID` | No | `description` | Fallback field ID if not configured |
| `VALIDATION_PROMPT` | No | *(generic quality check)* | Fallback prompt if not configured |

Set via `forge variables set KEY value`.

---

## Known Limitations

Some rough edges are expected:

- **No tests.** Testing is done manually via `forge tunnel` and `forge deploy`. A test framework is planned.
- **Backend refactoring complete.** The monolithic `src/index.js` has been successfully refactored into a modular 3-layer architecture with separate directories for core logic, integration layers, and organized prompt definitions. The main entry point is now ~200 lines.
- **CSS triple-definition.** Due to Forge Custom UI iframe quirks, styles are defined in three places per UI app (CSS file, HTML `<style>` block, and `injectStyles()` in JS). This is intentional but ugly.
- **No i18n.** All strings are hardcoded in English.
- **Attachment validation on CREATE.** Jira doesn't expose attachments in `modifiedFields` during issue creation, so attachment validation is skipped on create transitions.
- **50-log limit.** Validation logs are capped at 50 entries in Forge Storage (FIFO).
- **OpenAI only.** Additional AI providers are on the roadmap but not yet implemented.
- **Agentic latency.** When the agentic flow is active, validation takes longer (multiple AI round-trips + JQL searches). The 22-second timeout ensures transitions aren't blocked indefinitely.

---

## Permissions

The app requests the following Forge permissions:

| Scope | Purpose |
|-------|---------|
| `read:jira-work` | Read issue fields, data, and execute JQL searches |
| `read:workflow:jira` | Read workflow definitions for orphan cleanup |
| `read:project:jira` | Resolve project context for screen-based field filtering |
| `storage:app` | Persist validation logs and config registry |
| `read:issue-type-screen-scheme:jira` | Screen-based field resolution |
| `read:screen-scheme:jira` | Screen-based field resolution |
| `read:screen-tab:jira` | Screen-based field resolution |
| `read:screenable-field:jira` | Screen-based field resolution |

External fetch: `https://api.openai.com` (for AI validation calls).

---

## Contributing

Contributions are welcome and encouraged. This is the first open-source Forge app -- help set the standard.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

By contributing, you agree that your contributions will be licensed under AGPL-3.0.

Please note: The "CogniRunner" name and branding are trademarked. See [NOTICE](NOTICE) for details. Derivative works must use a different name.

---

## Pricing Philosophy

CogniRunner's Marketplace listing will never have a per-user license cost that exceeds its own runtime costs. The minimal licensing fee exists solely to cover infrastructure -- API hosting, Forge compute, and maintenance time. If it could be free without the author paying out of pocket, it would be. The open-source license ensures that if you want to self-host or run your own fork, you absolutely can.

---

## License

Copyright (C) 2025 LeanZero

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See [LICENSE](LICENSE) for the full text.

### What AGPL-3.0 means for you

- **You can** use, modify, and distribute this software freely
- **You must** share your source code if you distribute or run a modified version as a network service
- **You must** keep the copyright notices and license intact
- **You cannot** use the "CogniRunner" name/branding for derivative works (see [NOTICE](NOTICE))

This is the first Forge app released under an open-source license. The AGPL was chosen deliberately: it ensures that any derivative work must also be open-source, while allowing the community to learn from, build on, and improve the codebase.

### Trademark

"CogniRunner" is a trademark of LeanZero. The name and branding are **not** covered by the AGPL license. If you fork this project, you must use a different name and branding. See [NOTICE](NOTICE) for full details.

---

Part of [LeanZero](https://leanzero.atlascrafted.com) by Mihai Perdum.

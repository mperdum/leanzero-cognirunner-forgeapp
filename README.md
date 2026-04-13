# CogniRunner

**AI-powered workflow automation for Jira -- validators, conditions, and post-functions.**

Part of the [LeanZero](https://leanzero.atlascrafted.com) ecosystem.

**[Live on the Atlassian Marketplace](https://marketplace.atlassian.com/apps/298437877/cognirunner?hosting=cloud&tab=overview)** -- install it directly into your Jira Cloud instance.

CogniRunner is the **first open-source Atlassian Forge app**, licensed under [AGPL-3.0](LICENSE). It brings semantic intelligence to Jira workflows -- what was previously impossible to assess (the actual meaning of a text field, the content of an attached document, the quality of a description) is now child's play. Write a plain-English prompt, pick a field, and CogniRunner handles the rest.

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

Configuration takes 30 seconds: pick a field from a dropdown, write what "valid" means in plain English, done. No regex, no scripting, no ScriptRunner. The field selector is context-aware -- it resolves the project's screen scheme and shows only the fields that are actually on the relevant screen for that transition.

---

## What It Does

### Core Validation

- **Workflow Validators** -- Block a transition if a field's content doesn't pass AI validation. The user sees a clear error message with the AI's reasoning.
- **Workflow Conditions** -- Hide a transition entirely if the field doesn't meet criteria.
- **Attachment Validation** -- Downloads and sends images, PDFs, Word docs, Excel files, and presentations directly to the AI for content-aware validation. Validates what's *in* the file, not just that a file exists.
- **Smart Field Selector** -- Resolves the project's issue type screen scheme to show only the fields present on the relevant screen.

### Post-Functions

CogniRunner adds two types of workflow post-functions that execute **after** a transition completes:

- **Semantic Post-Functions** -- AI evaluates a condition on one field and modifies a target field based on natural-language instructions. Example: "After transition to Done, summarize the description into the 'Release Notes' field."
- **Static Post-Functions** -- Chain multiple operations with AI-generated JavaScript code. Build multi-step automations: search for issues via JQL, update fields, call REST APIs, log results -- all without AI cost at runtime (code is generated once, runs directly).

**Function Builder features:**
- Chain up to 50 operation steps with variable passing between them
- Operation types: JQL Search, Jira REST API, External API, Confluence API, Debug Log
- AI-powered code generation with full Jira API reference
- CodeMirror editor with syntax highlighting and api.* autocompletion
- Test Run with real Jira data (dry-run mode -- no writes)
- AI Review for configuration analysis

### Agentic Validation

CogniRunner doesn't just evaluate text in isolation -- it can **autonomously search your Jira project** to make context-aware decisions. This is powered by an agentic loop where the AI model can call tools, analyze results, and iterate before rendering a final verdict.

**How it works:**

1. The AI receives the field content and your validation prompt
2. If the prompt involves cross-issue concerns (duplicates, similarity, prior work), the AI autonomously constructs JQL queries and searches your Jira project
3. It analyzes the search results, compares field values, and may refine its search with additional queries (up to 3 tool-call rounds)
4. Once it has enough context, it renders a pass/fail judgment with reasoning

**Use cases:**

- **Duplicate detection** -- "Check if a similar issue already exists in this project."
- **Cross-referencing** -- "Verify this bug hasn't already been reported or resolved."
- **Consistency checks** -- "Ensure this task doesn't overlap with existing work in the current sprint."

**Safety:**

- The agentic loop operates within a 22-second timeout budget (Forge validators have a 25-second limit). If time runs out, the transition is allowed (fail-open).
- Maximum 3 tool-call rounds per validation to bound latency.
- JQL searches are automatically scoped to the current project.
- The judgment is calibrated to minimize false rejections.

### Multi-Provider BYOK

CogniRunner supports **multiple AI providers** via Bring Your Own Key:

| Provider | Default Model | Notes |
|----------|--------------|-------|
| **OpenAI** | `gpt-5.4-mini` | Native support, full model listing |
| **Azure OpenAI** | `gpt-5.4-mini` | Custom endpoint URL required |
| **OpenRouter** | `openai/gpt-4o-mini` | Aggregator with access to many models |
| **Anthropic** | `claude-haiku-4-5` | Full adapter layer for Messages API |

**Key features:**
- **Per-provider key storage** -- Keys are stored separately per provider. Switching providers never deletes your existing keys.
- **Factory key fallback** -- Without a BYOK key, the app uses the factory key set via `forge variables`. No model selection available with factory key.
- **Model selection** -- With a BYOK key, fetch available models from the provider and select one from a dropdown.
- **Provider switching** -- Change providers with a single click. Your previous provider's key is preserved for when you switch back.

### Administration

- **Admin Panel** -- Global overview of all configured rules (validators, conditions, and post-functions) across all workflows, with type filtering, enable/disable toggles, and automatic orphan cleanup.
- **Role-Based Permissions** -- Three roles (Viewer, Editor, Admin) with scope control (Own Rules / All Rules).
- **Validation Logs** -- Stores the last 50 validation results with AI reasoning, agentic metadata (JQL queries, tool rounds), and execution traces.
- **Documentation Library** -- Shared context documents that can be attached to any rule for AI reference.
- **AI Review** -- Async configuration review with actionable feedback (runs via @forge/events Queue for 120s timeout).
- **License-Aware** -- When the Marketplace license is inactive, validation is skipped entirely (fail-open).

### Permission Model

| Role | Scope | Can See Rules | Can Edit Rules | Permissions Tab | Settings Tab |
|------|-------|--------------|----------------|----------------|-------------|
| **Viewer** | Own | Own rules only | No | No | No |
| **Viewer** | All | All rules | No | No | No |
| **Editor** | Own | All rules | Own rules only | No | No |
| **Editor** | All | All rules | All rules | No | No |
| **Admin** | (always all) | All rules | All rules | Yes | Yes |

Jira site administrators always have Admin access. The first user is automatically bootstrapped as Admin.

### Supported Field Types

CogniRunner can validate virtually any Jira field type:

| Category | Field Types |
|----------|-------------|
| **Text** | Summary, single-line text, multi-line text |
| **Rich Text** | Description, Environment, any ADF field (full Atlassian Document Format parsing) |
| **Select** | Single select, radio buttons, priority, status, resolution, issue type |
| **Multi-Select** | Multi-select, checkboxes, labels, components, fix versions, affected versions |
| **Users** | Assignee, reporter, single/multi user picker, single/multi group picker |
| **Dates** | Date picker, date-time picker, due date, created, updated |
| **Numeric** | Number fields, time tracking (original/remaining/spent) |
| **Links** | URL fields, issue links (with summary), parent issue |
| **Complex** | Cascading select, sprint, project picker, security level |
| **Attachments** | Images (PNG, JPEG, GIF, WebP), PDFs, Word docs, Excel, PowerPoint |
| **Third-Party** | Checklist for Jira, Xray, Jira Assets/Insight, ScriptRunner, Tempo, Elements Connect |

---

## Architecture

```
CogniRunner/
├── manifest.yml                  # Forge app definition (modules, permissions, resources)
├── src/
│   ├── index.js                  # Main backend (resolvers, validation, post-functions)
│   └── async-handler.js          # Async event consumer (AI review, 120s timeout)
├── static/
│   ├── config-ui/src/            # React app: configure validators/conditions/post-functions
│   │   └── components/           # CustomSelect, CodeEditor, FunctionBuilder, IssuePicker, etc.
│   ├── config-view/src/          # React app: read-only summary + execution logs
│   └── admin-panel/src/          # React app: admin dashboard (rules, docs, permissions, settings)
│       └── components/           # TabBar, OpenAIConfig, PermissionsTab, DocsTab, etc.
├── LICENSE                       # AGPL-3.0
├── NOTICE                        # Trademark + attribution
└── README.md
```

### Backend (`src/index.js`)

Single file containing all server-side logic:
- **Validator/Condition handler** (`validate`) -- Extracts field value, routes to standard or agentic AI validation, returns pass/fail.
- **Post-Function handler** (`executePostFunction`) -- Routes to semantic or static execution based on config type.
- **AI adapter** (`callAIChat`) -- Unified function supporting OpenAI-compatible providers and Anthropic (with full request/response translation).
- **Standard validation** (`callOpenAI`) -- Single-turn: field content + prompt -> `{ isValid, reason }`.
- **Agentic validation** (`callOpenAIWithTools`) -- Multi-turn tool-calling loop with JQL search capability.
- **Semantic post-function** (`executeSemanticPostFunction`) -- AI condition evaluation + field update with editmeta pre-flight check and auto-formatting.
- **Static post-function** (`executeStaticPostFunction`) -- Sandboxed JavaScript execution with API surface (getIssue, updateIssue, searchJql, transitionIssue, log).
- **Tool registry** -- Extensible registry mapping tool names to function definitions and executors.
- **Field extraction** -- Converts any Jira field type to plain text for AI consumption.
- **Screen-aware field resolution** -- Walks the Jira screen scheme chain to show relevant fields.
- **Role-based permissions** -- getUserPermissions, requireRole, canActOnConfig with scope-aware checks.
- **Per-provider BYOK** -- Provider config, per-provider key/model storage with in-memory caching.

### Backend (`src/async-handler.js`)

Async event consumer for long-running AI tasks (120s timeout vs 25s resolver limit):
- Receives tasks via @forge/events Queue
- Stores results in KVS keyed by taskId
- Frontend polls for completion

### Frontend (3 React Apps)

Each is a React 18 app bundled with Webpack + Babel, running as Forge Custom UI inside Jira's sandboxed iframe:

| App | Purpose |
|-----|---------|
| `config-ui` | Configuration form for validators, conditions, and post-functions. Field selector, prompt editor, function builder, code editor, test run, AI review. |
| `config-view` | Read-only config summary + execution logs with traces, recommendations, and AI metadata. |
| `admin-panel` | Dashboard with tabs: Rules (type filter + ownership filter), Documentation, Permissions (role + scope management), Settings (AI provider config). |

All three support Jira's light and dark themes via LeanZero design system with CSS custom properties.

### Data Flow

**Standard validation:**
```
User configures rule in Jira Workflow Editor
  -> config-ui saves config as JSON string via onConfigure callback
  -> On transition, Forge calls validate()
  -> validate() extracts field value, calls AI provider
  -> Returns { result: true/false, errorMessage }
  -> Jira blocks or allows the transition
```

**Semantic post-function:**
```
Transition completes
  -> Forge calls executePostFunction()
  -> Reads source field, fetches context docs
  -> Checks target field editability via editmeta API
  -> Calls AI with condition + action prompts
  -> Auto-formats value for field schema (select, number, etc.)
  -> PUTs updated value to Jira REST API
  -> Logs execution trace
```

**Agentic validation:**
```
validate() calls callOpenAIWithTools()
  -> AI analyzes prompt, decides to search Jira
  -> AI calls search_jira_issues tool with JQL
  -> CogniRunner executes JQL, returns results
  -> AI may issue up to 3 search rounds
  -> AI renders final { isValid, reason } verdict
  -> Tool metadata stored in validation log
```

---

## Prerequisites

- **Node.js 22+** (Forge runtime is `nodejs22.x`)
- **Atlassian Forge CLI** (`npm install -g @forge/cli`)
- **An Atlassian Cloud developer site** ([get one free](https://developer.atlassian.com/platform/forge/getting-started/))
- **An AI API key** (OpenAI, Azure OpenAI, OpenRouter, or Anthropic)

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
forge variables set OPENAI_API_KEY your-api-key
forge variables set OPENAI_MODEL gpt-5.4-mini    # optional, this is the default
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
3. Add a **Validator**, **Condition**, or **Post Function** and select a CogniRunner module
4. Configure the rule: pick fields, write prompts, build functions
5. Publish the workflow
6. Optionally, visit **Apps > CogniRunner Admin** for the admin dashboard

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
| `OPENAI_API_KEY` | Yes* | -- | Factory AI API key (not needed if all users provide BYOK keys) |
| `OPENAI_MODEL` | No | `gpt-5.4-mini` | Factory model (used when no BYOK key is configured) |
| `VALIDATE_FIELD_ID` | No | `description` | Fallback field ID if not configured in UI |
| `VALIDATION_PROMPT` | No | *(generic quality check)* | Fallback prompt if not configured in UI |

Set via `forge variables set KEY value`.

---

## Known Limitations

- **CSS triple-definition.** Due to Forge Custom UI iframe quirks, styles are defined in three places per UI app (CSS file, HTML `<style>` block, and `injectStyles()` in JS). This is intentional.
- **No i18n.** All strings are hardcoded in English.
- **Attachment validation on CREATE.** Jira doesn't expose attachments in `modifiedFields` during issue creation.
- **50-log limit.** Validation logs are capped at 50 entries in Forge Storage (FIFO).
- **Agentic latency.** When the agentic flow is active, validation takes longer (multiple AI round-trips + JQL searches). The 22-second timeout ensures transitions aren't blocked indefinitely.
- **Post-function fail-open.** Post-functions always return `{ result: true }` -- they cannot block transitions. Errors are logged but don't prevent the transition.
- **Anthropic file attachments.** Document types (PDF, DOCX) use Anthropic's `document` format; compatibility depends on model capabilities.

---

## Permissions

The app requests the following Forge permissions:

| Scope | Purpose |
|-------|---------|
| `read:jira-work` | Read issue fields, data, and execute JQL searches |
| `write:jira-work` | Update issue fields (post-functions) |
| `read:jira-user` | Resolve user information for field extraction |
| `manage:jira-configuration` | Admin group membership checks, field metadata |
| `read:workflow:jira` | Read workflow definitions for orphan cleanup |
| `read:project:jira` | Resolve project context for screen-based field filtering |
| `storage:app` | Persist validation logs, config registry, BYOK keys, permissions |
| `read:issue-type-screen-scheme:jira` | Screen-based field resolution |
| `read:screen-scheme:jira` | Screen-based field resolution |
| `read:screen-tab:jira` | Screen-based field resolution |
| `read:screenable-field:jira` | Screen-based field resolution |

**External fetch whitelist:**

| Domain | Purpose |
|--------|---------|
| `api.openai.com` | OpenAI API |
| `*.openai.azure.com` | Azure OpenAI Service |
| `openrouter.ai` | OpenRouter API |
| `api.anthropic.com` | Anthropic API |

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

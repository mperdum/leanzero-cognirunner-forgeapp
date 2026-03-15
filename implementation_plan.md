# Frontend Architecture Reference

**Status: ✅ COMPLETED** - This document describes the frontend refactoring that was completed to modularize the CogniRunner UI components.

---

## Overview

The CogniRunner Forge app consists of three separate React applications, each serving a specific purpose in the Jira workflow configuration experience. The codebase has been refactored from monolithic `App.js` files into a clean component-based architecture with shared utilities.

### Architecture Goals Achieved

- ✅ Extracted reusable UI components into dedicated modules
- ✅ Separated styles from JavaScript logic
- ✅ Created shared component library for consistency across apps
- ✅ Reduced code duplication between the three UI apps
- ✅ Improved maintainability and testability

---

## Application Structure

```
static/
├── config-ui/                    # Configuration UI (create/edit mode)
│   ├── src/
│   │   ├── index.js              # React root mount
│   │   ├── App.js                # Legacy main component
│   │   ├── styles.css            # CSS custom properties (light/dark theme)
│   │   └── components/           # Extracted components
│   │       ├── Dropdown.jsx      # Reusable dropdown with search
│   │       ├── FieldSelector.jsx # Context-aware field selector
│   │       ├── FunctionBlock.jsx # Single function configuration UI
│   │       ├── FunctionBuilder.jsx # Code editor wrapper
│   │       ├── SemanticConfig.jsx # Semantic post-function form
│   │       ├── StandardValidator.jsx # Validator/Condition form
│   │       └── ThemeInjector.jsx # CSS variable injection for theming
│   └── build/                    # Webpack output (committed)
│
├── config-view/                  # Read-only view + validation logs
│   ├── src/
│   │   ├── index.js              # React root mount
│   │   ├── App.js                # Legacy main component
│   │   ├── styles.css            # CSS custom properties
│   │   └── components/           # Extracted components
│   │       ├── ConfigViewer.jsx  # Configuration display
│   │       ├── LogsSection.jsx   # Validation logs viewer
│   │       └── StatusBanner.jsx  # Rule status indicator
│   └── build/                    # Webpack output (committed)
│
├── admin-panel/                  # Global administration dashboard
│   ├── src/
│   │   ├── index.js              # React root mount
│   │   ├── App.js                # Legacy main component
│   │   ├── styles.css            # CSS custom properties
│   │   └── components/           # Extracted components
│   │       ├── LicenseBanner.jsx # License status display
│   │       ├── LogsSection.jsx   # Shared logs viewer
│   │       └── RuleTable.jsx     # Rules listing table
│   └── build/                    # Webpack output (committed)
│
└── shared/                       # Shared component library
    └── components/
        └── common/
            ├── Button.jsx         # Reusable button component
            ├── Card.jsx           # Card container component
            └── Spinner.jsx        # Loading spinner component
```

---

## Component Reference

### config-ui Components

#### `FieldSelector.jsx`
Context-aware field selector that resolves screen schemes to show only relevant fields.

**Props:**
- `value`: Current selected field ID
- `onChange`: Callback when selection changes
- `fields`: Array of available `{ id, name, type, custom }` objects
- `label`: Optional label text
- `required`: Whether field is required

#### `ThemeInjector.jsx`
Injects CSS variables for Jira's light/dark theme support.

**Props:**
- `stylesId`: Optional custom style element ID
- `additionalStyles`: Optional additional CSS to inject

#### `StandardValidator.jsx`
Form component for configuring standard validators and conditions.

**Features:**
- Field selection dropdown
- Validation prompt textarea
- Jira Search (JQL) toggle (Auto/On/Off)
- Prompt library integration

#### `SemanticConfig.jsx`
Form component for configuring semantic post-functions.

**Features:**
- Condition prompt input (optional)
- Action prompt input
- Source field selector
- Target field selector
- Dry-run mode toggle

#### `FunctionBuilder.jsx` / `FunctionBlock.jsx`
Components for building and editing static post-function JavaScript code.

---

### config-view Components

#### `ConfigViewer.jsx`
Displays current configuration in read-only format.

**Features:**
- Field ID display
- Prompt preview (truncated)
- Jira Search mode indicator
- Configuration timestamp

#### `LogsSection.jsx`
Validation logs viewer with filtering and actions.

**Features:**
- Last 50 validation entries
- Pass/fail status indicators
- AI reasoning display
- Agentic metadata (queries, rounds, results)
- Refresh and clear actions

#### `StatusBanner.jsx`
Rule enable/disable status indicator and toggle.

---

### admin-panel Components

#### `RuleTable.jsx`
Global rules listing across all workflows.

**Features:**
- Rule type badges (validator/condition/post-function)
- Workflow context display
- Enable/disable toggles
- Edit links to workflow configuration
- Orphan detection indicators

#### `LicenseBanner.jsx`
Displays current Marketplace license status.

---

### Shared Components

#### `Button.jsx`
Reusable button with variant support.

**Props:**
- `variant`: 'primary' | 'secondary' | 'danger' (default: 'primary')
- `onClick`: Click handler
- `disabled`: Disabled state
- `children`: Button content

#### `Card.jsx`
Card container component for grouping related content.

#### `Spinner.jsx`
Loading spinner component.

---

## Component Interfaces (TypeScript Reference)

```typescript
// Field Selector
interface FieldSelectorProps {
  value: string;
  onChange: (value: string) => void;
  fields: Array<{ id: string; name: string; type: string; custom: boolean }>;
  label?: string;
  required?: boolean;
}

// Theme Injector
interface ThemeInjectorProps {
  stylesId?: string;
  additionalStyles?: string;
}

// Rule Table (admin-panel)
interface RuleTableProps {
  configs: Array<{
    id: string;
    type: string;
    fieldId: string;
    prompt: string;
    updatedAt: string;
    disabled?: boolean;
    workflow?: {
      workflowName?: string;
      transitionFromName?: string;
      transitionToName?: string;
    };
  }>;
  onEdit?: (workflowId: string, siteUrl: string) => void;
  onToggle?: (id: string, currentlyDisabled: boolean) => void;
}

// Logs Section
interface LogsSectionProps {
  visible: boolean;
  logs: Array<{
    id: string;
    isValid: boolean;
    issueKey: string;
    timestamp: string;
    fieldId: string;
    reason: string;
    toolMeta?: {
      toolsUsed: boolean;
      toolRounds: number;
      queries: string[];
      totalResults: number;
    };
  }>;
  onToggleVisible?: () => void;
  onClear?: () => void;
  onRefresh?: () => void;
}

// Button (shared)
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}
```

---

## Styling Architecture

### CSS Custom Properties (Theming)

All three apps use CSS custom properties for Jira's light/dark theme support:

```css
/* Light theme (default) */
:root {
  --color-primary: #0052CC;
  --color-text: #172B4D;
  --color-background: #FFFFFF;
  --color-border: #DFE1E6;
  /* ... more variables */
}

/* Dark theme */
html[data-color-mode="dark"] {
  --color-primary: #4C9AFF;
  --color-text: #M672B0;
  --color-background: #1D1F21;
  --color-border: #3E4B5E;
  /* ... more variables */
}
```

### Triple-Definition Pattern

Due to Forge Custom UI iframe quirks, styles are defined in three places per app:

1. **`src/styles.css`** — Canonical CSS source (imported in `index.js`)
2. **`public/index.html` `<style>` block** — Ensures styles load before JS hydration
3. **Component `injectStyles()` or ThemeInjector** — Inline injection as fallback

This pattern is intentional and should be maintained for reliable theme rendering.

---

## Build Process

Each app is built independently with Webpack:

```bash
# config-ui
cd static/config-ui && npm run build

# config-view  
cd static/config-view && npm run build

# admin-panel
cd static/admin-panel && npm run build
```

**Important:** The `build/` directories are committed to the repository. Forge deploys these directly. Always rebuild after changing frontend source before deploying.

---

## Development Workflow

### Watch Mode (Hot Reload)

Run in separate terminals:

```bash
cd static/config-ui && npm run start
cd static/config-view && npm run start
cd static/admin-panel && npm run start
```

### Backend Tunnel

```bash
forge tunnel
```

This enables live backend reloading while frontend watch modes handle UI changes.

---

## Testing Guidelines

### Manual Testing Checklist

- [ ] config-ui - Standard validator form works (field selection, prompt entry)
- [ ] config-ui - Semantic post-function form works (condition/action prompts)
- [ ] config-ui - Function builder works (add/remove/edit functions)
- [ ] admin-panel - Rule table displays correctly with all rule types
- [ ] admin-panel - Toggle rule enable/disable works
- [ ] admin-panel - Logs display and refresh work
- [ ] config-view - Config display shows current settings
- [ ] config-view - Validation logs show AI reasoning
- [ ] Dark mode works across all apps (toggle Jira theme)

### Integration Testing

Test the full flow:
1. Create a validator in config-ui
2. Verify it appears in admin-panel
3. Run a workflow transition to generate validation log
4. View the log in config-view and admin-panel
5. Toggle rule disabled status
6. Verify validation is skipped when disabled

---

## Future Improvements

### Planned Enhancements

- [ ] Add unit tests with Jest + React Testing Library
- [ ] Migrate to TypeScript for better type safety
- [ ] Extract more shared components (form inputs, modals)
- [ ] Implement i18n support for multi-language UIs
- [ ] Add component storybook for isolated development

### Technical Debt

- CSS triple-definition pattern is ugly but necessary for Forge iframe compatibility
- Some legacy `App.js` files still exist alongside new components (can be cleaned up after verification)
- No formal test suite yet — testing is manual via `forge tunnel`

---

## Related Documentation

- [README.md](../README.md) - Main project documentation
- [CLAUDE.md](../CLAUDE.md) - Developer guidance for AI assistants
- [Atlassian Forge Docs](https://developer.atlassian.com/platform/forge/) - Official Forge platform docs
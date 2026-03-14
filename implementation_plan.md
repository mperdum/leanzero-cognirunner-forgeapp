# Implementation Plan: Forge App Component Refactoring

## Overview

Split large React components across three Forge app frontend directories (config-ui, admin-panel, config-view) following Atlassian Forge best practices. This will extract reusable UI components into a shared folder and separate styles from JavaScript logic.

**Why this is needed:**
- Current `App.js` files are 500-800 lines each with mixed concerns
- Styles are embedded in JavaScript (injected via inline CSS)
- No component extraction - everything is monolithic
- Code duplication across the three UI apps

---

## Types

### New Component Types/Interfaces

```typescript
// Component Props Interfaces
interface FieldSelectorProps {
  value: string;
  onChange: (value: string) => void;
  fields: Array<{ id: string; name: string; type: string; custom: boolean }>;
  label?: string;
  required?: boolean;
}

interface ThemeInjectorProps {
  stylesId?: string;
  additionalStyles?: string;
}

interface FunctionBlockProps {
  func: FunctionConfig;
  index: number;
  onUpdate: (id: string, updates: Partial<FunctionConfig>) => void;
  onRemove: (id: string) => void;
}

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

interface LogsSectionProps {
  visible: boolean;
  logs: Array<{
    id: string;
    isValid: boolean;
    issueKey: string;
    timestamp: string;
    fieldId: string;
    reason: string;
  }>;
  onToggleVisible?: () => void;
  onClear?: () => void;
  onRefresh?: () => void;
}
```

---

## Files

### New Files to Create

```
static/config-ui/src/frontend/components/          (NEW FOLDER)
├── ThemeInjector.jsx                              (NEW - Extracted from App.js)
├── FieldSelector.jsx                              (NEW - Dropdown component)
├── FunctionBuilder/
│   ├── index.js                                   (NEW - Barrel export)
│   ├── FunctionBlock.jsx                          (NEW - Function block UI)
│   └── FunctionEditor.jsx                         (NEW - Code editor)
├── SemanticConfig.jsx                             (NEW - Semantic post function form)
└── StandardValidator.jsx                          (NEW - Standard validator form)

static/config-ui/src/frontend/styles.css           (NEW - Extracted CSS)

static/admin-panel/src/frontend/                   (NEW FOLDER)
├── App.jsx                                        (NEW - Cleaned up)
├── styles.css                                     (NEW - Extracted CSS)
└── components/
    ├── ThemeInjector.jsx                          (NEW - Reusable)
    ├── RuleTable.jsx                              (NEW)
    ├── LogsSection.jsx                            (NEW)
    └── LicenseBanner.jsx                          (NEW)

static/config-view/src/frontend/                   (NEW FOLDER)
├── App.jsx                                        (NEW - Cleaned up)
├── styles.css                                     (NEW - Extracted CSS)
└── components/
    ├── ThemeInjector.jsx                          (NEW - Reusable)
    ├── ConfigViewer.jsx                           (NEW)
    └── RuleStatusBanner.jsx                       (NEW)

static/shared/components/                          (SHARED COMPONENTS FOLDER)
├── common/
│   ├── Button.jsx                                 (NEW - Reusable button)
│   ├── Card.jsx                                   (NEW - Card container)
│   └── Spinner.jsx                                (NEW - Loading spinner)
└── index.js                                       (BARREL EXPORT)

static/shared/styles/                              (SHARED STYLES FOLDER)
├── themes.css                                     (NEW - CSS variables)
└── index.js                                       (BARREL EXPORT)
```

### Files to Modify

| File | Changes |
|------|---------|
| `static/config-ui/src/index.js` | Update import paths, add styles import |
| `static/admin-panel/src/index.js` | Update import paths, create frontend folder structure |
| `static/config-view/src/index.js` | Update import paths, create frontend folder structure |

### Files to Delete/Deprecate

None (we'll keep existing files as backups during migration)

---

## Functions

### Removed from App.js (config-ui)

| Function | Location | Replacement |
|----------|----------|-------------|
| `injectStyles()` | App.js line 17-263 | `ThemeInjector.jsx` component |
| `handleFieldKeyDown()` | App.js line ~450 | `FieldSelector.jsx` |
| `handleActionFieldKeyDown()` | App.js line ~510 | `FieldSelector.jsx` |
| `handlePostFunctionTypeKeyDown()` | App.js line ~390 | `StandardValidator.jsx` / `SemanticConfig.jsx` |

### New Functions

```javascript
// static/shared/components/common/Button.jsx
export function Button({ children, variant = 'primary', onClick, disabled }) { ... }

// static/config-ui/src/frontend/components/FieldSelector.jsx
export function FieldSelector({ value, onChange, fields, label, required }) { ... }

// static/admin-panel/src/frontend/components/RuleTable.jsx  
export function RuleTable({ configs, onEdit, onToggle }) { ... }
```

---

## Classes

### New Component Classes

| File | Component Name | Purpose |
|------|---------------|---------|
| `ThemeInjector.jsx` | ThemeInjector | Injects CSS variables for dark/light mode |
| `FieldSelector.jsx` | FieldSelector | Reusable dropdown with search functionality |
| `FunctionBlock.jsx` | FunctionBlock | Single function configuration UI |
| `FunctionEditor.jsx` | FunctionEditor | Code editor with syntax highlighting |
| `StandardValidator.jsx` | StandardValidator | Validator/Condition form (replaces part of App.js) |
| `SemanticConfig.jsx` | SemanticConfig | Semantic post function form |
| `RuleTable.jsx` | RuleTable | Admin panel rule listing table |
| `LogsSection.jsx` | LogsSection | Configurable logs display section |
| `LicenseBanner.jsx` | LicenseBanner | License status banner component |

---

## Dependencies

### No New Dependencies Required

All existing packages are sufficient:
- `react`, `react-dom` - Already present
- `@forge/bridge` - Already present
- `@forge/react` - Already present

---

## Testing

### Test Approach

1. **Unit Tests**: Verify each extracted component renders correctly
2. **Integration Tests**: Ensure App.js works with new component imports
3. **Visual Regression**: Check that styles remain consistent after extraction

### Test Commands

```bash
cd static/config-ui && npm run test
cd static/admin-panel && npm run test  
cd static/config-view && npm run test
```

### Manual Testing Checklist

- [ ] config-ui - Standard validator form works
- [ ] config-ui - Semantic post function form works
- [ ] config-ui - Function builder works (add/remove functions)
- [ ] admin-panel - Rule table displays correctly
- [ ] admin-panel - Toggle rule works
- [ ] admin-panel - Logs display and refresh work
- [ ] config-view - Config display works
- [ ] Dark mode works across all apps

---

## Implementation Order

### Phase 1: Shared Infrastructure (Days 1-2)
1. Create `static/shared/components/common/Button.jsx`
2. Create `static/shared/components/common/Card.jsx`  
3. Create `static/shared/components/common/Spinner.jsx`
4. Create `static/shared/styles/themes.css`
5. Create barrel exports in shared folders

### Phase 2: config-ui Refactoring (Days 3-5)
6. Create `static/config-ui/src/frontend/` folder
7. Extract CSS to `styles.css` from App.js
8. Create `ThemeInjector.jsx` component
9. Create `FieldSelector.jsx` (combines field/action dropdowns)
10. Create `FunctionBuilder/FunctionBlock.jsx`
11. Create `FunctionBuilder/FunctionEditor.jsx`
12. Create `StandardValidator.jsx`
13. Create `SemanticConfig.jsx`
14. Refactor App.js to use new components
15. Update `index.js` with new imports

### Phase 3: admin-panel Refactoring (Days 6-7)
16. Create `static/admin-panel/src/frontend/` folder
17. Extract CSS to `styles.css`
18. Copy reusable components from shared (Button, Spinner)
19. Create `RuleTable.jsx`
20. Create `LogsSection.jsx`
21. Create `LicenseBanner.jsx`
22. Refactor App.js to use new components

### Phase 4: config-view Refactoring (Days 8-9)
23. Create `static/config-view/src/frontend/` folder
24. Extract CSS to `styles.css`
25. Copy reusable components from shared
26. Create `ConfigViewer.jsx`
27. Create `RuleStatusBanner.jsx`
28. Refactor App.js to use new components

### Phase 5: Final (Day 10)
29. Run tests on all three apps
30. Manual verification of all UI elements
31. Update documentation if needed

---

## Risk Mitigation

- **Backup**: Keep original files during migration
- **Incremental**: Each phase can be tested independently
- **Rollback**: Easy to revert by switching imports back
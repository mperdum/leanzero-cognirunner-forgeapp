# Implementation Plan: Modular Architecture Refactoring

## Overview

Refactor the monolithic `src/index.js` (1700+ lines) into a clean, hierarchical 3-layer architecture with separate directories for core business logic, integration layers, and organized prompt definitions. This will improve maintainability, testability, and scalability.

**Why this change?**
- Current single-file architecture is difficult to navigate and maintain
- Multiple concerns mixed together (validation, post functions, config, OpenAI calls)
- Hard to write unit tests for individual components
- No clear separation between business logic and external integrations

---

## Types

### New Module Exports Structure

```javascript
// Core modules export consistent interfaces:

// validator module
export const validate = async (args) => { ... }  // Main validation entry point
export const callOpenAI = async (...) => { ... }
export const callOpenAIWithTools = async (...) => { ... }

// post-function module  
export const executePostFunction = async (args) => { ... }
export const executeSemanticPostFunction = async (...) => { ... }
export const executeStaticPostFunction = async (...) => { ... }

// config module
export const registerConfig = async (payload) => { ... }
export const getConfigs = async () => { ... }
export const storeLog = async (logEntry) => { ... }
```

### Data Structures

```javascript
// Tool registry entry structure
{
  definition: {
    type: "function",
    function: { name, description, parameters }
  },
  execute: async (args, validatedFieldId) => { ... }
}

// Config registry entry
{
  id: string,
  type: "validator" | "condition" | "postfunction-semantic" | "postfunction-static",
  fieldId: string,
  prompt?: string,
  conditionPrompt?: string,
  actionPrompt?: string,
  code?: string,
  workflow?: {
    workflowName?: string,
    transitionId?: string,
    projectId?: string
  },
  disabled?: boolean,
  createdAt: string,
  updatedAt: string
}

// Validation log entry
{
  id: string,
  timestamp: string,
  issueKey: string,
  fieldId: string,
  fieldValue: string,
  prompt: string,
  isValid: boolean,
  reason: string,
  toolMeta?: {
    toolsUsed: boolean,
    toolRounds: number,
    queries: string[],
    totalResults: number
  }
}
```

---

## Files

### New Files to Create

| Path | Purpose |
|------|---------|
| `src/core/index.js` | Core module aggregator (re-export all core modules) |
| `src/core/validator/index.js` | Main validator entry point and OpenAI integration |
| `src/core/validator/openai-client.js` | OpenAI API client with tool-calling support |
| `src/core/validator/attachments.js` | Attachment processing for AI validation |
| `src/core/post-function/index.js` | Post function executor aggregator |
| `src/core/post-function/semantic.js` | Semantic post function execution logic |
| `src/core/post-function/static.js` | Static (JavaScript builder) post function logic |
| `src/core/config/index.js` | Config module aggregator |
| `src/core/config/registry.js` | KVS config storage/retrieval |
| `src/core/config/logger.js` | Validation logging helpers |
| `src/integration/prompts/index.js` | Replaces src/jira-prompts/index.js |
| `src/integration/prompts/categories/index.js` | Category modules aggregator |
| `src/integration/prompts/categories/issues.js` | Issue prompt definitions (moved from jira-prompts) |
| `src/integration/prompts/categories/projects.js` | Project prompt definitions |
| `src/integration/prompts/categories/users.js` | User prompt definitions |
| `src/integration/prompts/categories/groups.js` | Group prompt definitions |
| `src/integration/prompts/categories/workflows.js` | Workflow prompt definitions |
| `src/integration/prompts/categories/field-configs.js` | Field configuration prompts |
| `src/integration/prompts/categories/screens.js` | Screen prompt definitions |
| `src/integration/prompts/categories/custom-fields.js` | Custom field prompts |
| `src/integration/prompts/categories/statuses-resolutions.js` | Status/resolution prompts |
| `src/integration/prompts/categories/issue-types.js` | Issue type prompts |
| `src/integration/prompts/categories/security.js` | Security level prompts |
| `src/integration/prompts/categories/notifications.js` | Notification prompts |
| `src/integration/prompts/categories/permissions.js` | Permission prompts |
| `src/integration/prompts/categories/automation.js` | Automation prompts |
| `src/integration/prompts/categories/attachments-versions.js` | Attachment/version prompts |
| `src/integration/prompts/helpers.js` | Prompt helper functions (moved from jira-prompts) |
| `src/integration/jira-api/index.js` | JIRA API integration aggregator |
| `src/integration/jira-api/fields.js` | Field extraction and formatting helpers |
| `src/integration/jira-api/workflows.js` | Workflow fetching helpers |
| `src/integration/jira-api/screens.js` | Screen-based field resolution |
| `src/integration/jira-api/attachments.js` | Attachment download helpers |
| `src/integration/tools/index.js` | Agentic tool registry (JQL search, etc.) |

### Files to Delete

| Path | Reason |
|------|--------|
| `src/jira-prompts/*.js` (all 17 files) | Replaced by integration/prompts/categories/ |
| `src/jira-prompts/index.js` | Replaced by integration/prompts/index.js |
| `src/jira-tool-executor.js` | Integration moved to integration/jira-api/ |

### Files to Modify

| Path | Changes |
|------|---------|
| `src/index.js` | Remove all business logic, only keep entry point glue code and export handler |
| `static/config-ui/src/prompts-data.js` | Update import path from `../jira-prompts/index.js` to `../../src/integration/prompts/index.js` |

---

## Functions

### New Functions

#### src/core/validator/openai-client.js
```javascript
export const callOpenAI = async (fieldValue, validationPrompt, attachmentParts) => { ... }
export const callOpenAIWithTools = async (...) => { ... }  // Agentic mode with tool-calling
```

#### src/core/validator/attachments.js
```javascript
export const downloadAttachment = async (attachment) => { ... }
export const buildAttachmentContentParts = (downloadedAttachments) => { ... }
```

#### src/core/post-function/semantic.js
```javascript
export const executeSemanticPostFunction = async ({ issueContext, conditionPrompt, actionPrompt, fieldId, actionFieldId, dryRun }) => { ... }
```

#### src/core/post-function/static.js
```javascript
export const executeStaticPostFunction = async ({ issueContext, code, dryRun }) => { ... }
export const executeStaticCodeSandbox = async ({ issueContext, code, dryRun, simulationMode }) => { ... }
```

#### src/core/config/registry.js
```javascript
export const registerConfig = async ({ payload }) => { ... }
export const removeConfig = async ({ payload }) => { ... }
export const disableRule = async ({ payload }) => { ... }
export const enableRule = async ({ payload }) => { ... }
export const registerPostFunction = async ({ payload }) => { ... }
export const removePostFunction = async ({ payload }) => { ... }
export const disablePostFunction = async ({ payload }) => { ... }
export const enablePostFunction = async ({ payload }) => { ... }
export const getPostFunctionStatus = async ({ payload }) => { ... }
export const getConfigs = async () => { ... }  // Returns configs with orphan cleanup
```

#### src/core/config/logger.js
```javascript
export const storeLog = async (logEntry) => { ... }
export const MAX_LOGS = 50
export const LOGS_STORAGE_KEY = "validation_logs"
```

### Modified Functions

| Current Location | New Location | Changes |
|-----------------|--------------|---------|
| `validate` in src/index.js | `src/core/validator/index.js:validate` | Extract logic, add imports from new modules |
| `executePostFunction` in src/index.js | `src/core/post-function/index.js:executePostFunction` | Extract logic, add imports from new modules |
| All JIRA prompts exports | `src/integration/prompts/categories/*.js` | Move each category to its own file |

### Removed Functions

| Function | Reason | Migration |
|----------|--------|-----------|
| All functions in src/jira-prompts/ | Replaced by integration/prompts/ | Use new import paths |
| executeJiraEndpoint, executePrompt | Replaced by integration/jira-api/ | Use new jira-api module |

---

## Classes

### New Class Structures (No Classes Needed)

This refactor focuses on functional decomposition. No classes are required as the existing codebase uses a functional style with exported objects.

**Tool Registry Pattern (Object-based):**
```javascript
export const TOOL_REGISTRY = {
  search_jira_issues: {
    definition: { type: "function", function: { name, description, parameters } },
    execute: async (args, validatedFieldId) => { ... }
  }
}
```

---

## Dependencies

### Package.json Changes (None Required)

No new npm packages required. The existing dependencies are sufficient:
- `@forge/api` - Forge API for JIRA integration
- `@forge/resolver` - Resolver for backend functions

---

## Testing

### Test File Structure

```
src/
├── core/
│   ├── validator/__tests__/
│   │   ├── openai-client.test.js
│   │   └── attachments.test.js
│   ├── post-function/__tests__/
│   │   ├── semantic.test.js
│   │   └── static.test.js
│   └── config/__tests__/
│       ├── registry.test.js
│       └── logger.test.js
└── integration/
    ├── prompts/__tests__/
    │   └── helpers.test.js
    └── jira-api/__tests__/
        ├── fields.test.js
        ├── workflows.test.js
        └── screens.test.js
```

### Test Strategy

1. **Unit Tests**: Each module should have its own test file
2. **Mock External Dependencies**: Use mocks for KVS storage, JIRA API calls
3. **Integration Tests**: Test the full `validate` and `executePostFunction` flows

---

## Implementation Order

### Phase 1: Setup Directory Structure (Steps 1-4)

1. Create new directory structure:
   ```
   src/core/
   src/core/validator/
   src/core/post-function/
   src/core/config/
   src/integration/
   src/integration/prompts/categories/
   src/integration/jira-api/
   src/integration/tools/
   ```

2. Move helper functions to `src/integration/prompts/helpers.js`:
   - `calculateSimilarity`
   - `searchPrompts`
   - `buildJqlFromIntent`

3. Create prompt category files in `src/integration/prompts/categories/`:
   - Copy from `src/jira-prompts/` each file
   - Update exports to be named exports

4. Create main prompts aggregator at `src/integration/prompts/index.js`

### Phase 2: Extract Validator Logic (Steps 5-8)

5. Create `src/core/validator/openai-client.js`:
   - Move `callOpenAI` function
   - Move `callOpenAIWithTools` function
   - Move tool registry (`TOOL_REGISTRY`)
   - Move OpenAI helpers (`getOpenAIKey`, `getOpenAIModel`)

6. Create `src/core/validator/attachments.js`:
   - Move `downloadAttachment`
   - Move `buildAttachmentContentParts`

7. Create `src/core/validator/index.js`:
   - Import from new modules
   - Export `validate` with complete validation logic

8. Update main index to use validator module

### Phase 3: Extract Post Function Logic (Steps 9-12)

9. Create `src/core/post-function/static.js`:
   - Move `executeStaticPostFunction`
   - Move `executeStaticCodeSandbox`

10. Create `src/core/post-function/semantic.js`:
    - Move `executeSemanticPostFunction`

11. Create `src/core/post-function/index.js`:
    - Import from new modules
    - Export `executePostFunction`

12. Update main index to use post-function module

### Phase 4: Extract Config/Logger (Steps 13-15)

13. Create `src/core/config/logger.js`:
    - Move `storeLog`
    - Define constants (`MAX_LOGS`, `LOGS_STORAGE_KEY`)

14. Create `src/core/config/registry.js`:
    - Move config registry functions
    - Move post function registry functions

15. Create `src/core/config/index.js`:
    - Import from new modules
    - Export all config-related resolvers

### Phase 5: Extract JIRA API Helpers (Steps 16-20)

16. Create `src/integration/jira-api/fields.js`:
    - Move `formatField`
    - Move `sortFields`
    - Move `getFallbackFields`

17. Create `src/integration/jira-api/workflows.js`:
    - Move `fetchWorkflowTransitions`
    - Move `fetchProjectsForWorkflow`

18. Create `src/integration/jira-api/screens.js`:
    - Move screen resolution helpers
    - Move `getScreenFields` resolver

19. Create `src/integration/jira-api/attachments.js`:
    - Move attachment-related helpers if any remain

20. Create `src/integration/jira-api/index.js`:
    - Export all JIRA API helpers

### Phase 6: Refactor Main Entry Point (Steps 21-23)

21. Update `src/index.js`:
    - Remove all business logic
    - Import from new modules
    - Keep only resolver definitions and handler export
    - Should be under ~200 lines after refactor

22. Verify all imports are correct:
    ```
    import { validate, executePostFunction } from './core/validator.js'
    ```

23. Test the application still works

### Phase 7: Update Frontend Imports (Steps 24-25)

24. Update `static/config-ui/src/prompts-data.js`:
    - Change imports to use new path structure
    - Or copy relevant prompt data if needed for browser compatibility

25. Verify config UI still works correctly

### Phase 8: Cleanup (Step 26)

26. Delete old files after verification:
    - Remove `src/jira-prompts/` directory
    - Remove `src/jira-tool-executor.js`

---

## Files Reference

### New Module Import Paths

```javascript
// In src/index.js
import { validate, executePostFunction } from './core/index.js'
import { TOOL_REGISTRY } from './integration/tools/index.js'

// In core modules
import { downloadAttachment, buildAttachmentContentParts } from './validator/attachments.js'
import { callOpenAI, callOpenAIWithTools } from './validator/openai-client.js'

// In integration/prompts
import { issues, projects, users } from './categories/index.js'
import { calculateSimilarity, searchPrompts } from './helpers.js'
```

### Resolver Functions to Export

```javascript
export const handler = resolver.getDefinitions()

// Resolvers (move to core/config/index.js):
- getJiraPrompts
- searchJiraPrompts
- getJiraPromptById
- getJiraCategories
- checkLicense
- getLogs
- clearLogs
- registerConfig
- removeConfig
- disableRule
- enableRule
- registerPostFunction
- removePostFunction
- disablePostFunction
- enablePostFunction
- getPostFunctionStatus
- getConfigs
- getRuleStatus
- getFields
- getScreenFields
```

---

## Validation Checklist

After implementation, verify:

- [ ] All existing resolvers work correctly
- [ ] Validation function works with new module structure
- [ ] Post functions execute correctly
- [ ] Config registry stores/retrieves data properly
- [ ] Logs are stored and retrieved
- [ ] JIRA API calls work through new helpers
- [ ] OpenAI integration works (both normal and tool-calling modes)
- [ ] Frontend config UI loads prompts correctly
- [ ] No broken imports across the codebase
- [ ] Application builds successfully (`npm run build`)
- [ ] Existing tests still pass (if any)

---

## Rollback Plan

If issues arise:
1. The old `src/jira-prompts/` and `src/jira-tool-executor.js` files can be restored
2. Keep the old code commented out in `src/index.js` with TODO to remove later
3. Changes are additive first, then old code is removed after verification

---

## Estimated Impact

- **Lines of Code**: ~1700 → ~200 (main entry)
- **Files**: 19 files → 45+ files (properly organized)
- **Maintainability Score**: Major improvement
- **Test Coverage Potential**: From ~0% to easily testable
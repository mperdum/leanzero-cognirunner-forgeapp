# Implementation Plan: JIRA Prompt System for AI-Driven API Selection

[Overview]
Create a chain-of-thought prompt system using Atlassian Forge KVS that helps the AI decide which JIRA REST API endpoint to use based on user natural language requests. The system uses keyword matching to select appropriate prompts, then executes JIRA API calls with proper parameter handling.

## Types
The prompt system defines structured objects with the following schema:

```javascript
{
  id: "unique_prompt_identifier",
  category: "issues|groups|users|projects|workflows|field-configs|screens|custom-fields|statuses|resolutions|issue-types|security",
  keywords: ["array", "of", "common", "user", "phrases"],
  endpoint: "/rest/api/3/endpoint/path",
  method: "GET|POST|PUT|DELETE",
  description: "Detailed explanation of when to use this endpoint",
  parameters: {
    required: ["param1", "param2"],
    optional: ["optional1"]
  },
  response_format: {
    // Description of expected response structure
  },
  when_to_use: "Specific guidance on application scenarios",
  example_queries: ["User query example 1", "Example 2"],
  fields_suggestions: ["field1", "field2"], // For search endpoints
  example_jql: "project = PROJ AND status = Open" // For JQL search
}
```

## Files

### New Files to Create:
1. **`src/jira-prompts.js`** - Core prompt definitions and matching logic
   - Contains `JIRA_PROMPTS` object with all endpoint definitions
   - Implements fuzzy keyword matching for intent detection
   - Provides helper functions: `matchPrompt()`, `getPromptById()`, `searchPrompts()`
   - Includes `buildJqlFromIntent()` for JQL query construction
   - Handles KVS storage and retrieval via `loadPrompts()`, `storePrompts()`

2. **`src/jira-tool-executor.js`** - API execution engine
   - `executeJiraEndpoint(endpoint, method, parameters)` - Direct endpoint calling
   - `executePrompt(prompt, parameters)` - Prompt-based execution with validation
   - `executePaginated(prompt, parameters)` - Handles paginated list endpoints
   - `buildQueryParams(endpoint, parsedIntent)` - Constructs query parameters
   - Implements pagination for large result sets

### Existing Files to Modify:
1. **`src/index.js`** - Already updated in this implementation
   - Added imports: `JIRA_PROMPTS`, `matchPrompt`, `getPromptById`, `buildJqlFromIntent`
   - Added imports: `executeJiraEndpoint`, `executePrompt`, `executePaginated`, `buildQueryParams`
   - The existing agentic validation loop can now optionally use prompt matching

## Functions

### New Functions in src/jira-prompts.js:

| Function | Parameters | Return | Purpose |
|----------|------------|--------|---------|
| `matchPrompt(userQuery, prompts)` | string, object | array | Find best-matching prompts by keyword similarity |
| `getPromptById(promptId, prompts)` | string, object | object|null | Retrieve specific prompt by ID |
| `getPromptsByCategory(category, prompts)` | string, object | array | Get all prompts in a category |
| `getAllCategories(prompts)` | object | array | List all available categories |
| `loadPrompts(key)` | string | Promise<object> | Load from KVS or return defaults |
| `storePrompts(key)` | string | Promise<void> | Store prompts to KVS |
| `searchPrompts(searchQuery, prompts)` | string, object | array | Search across all prompt fields |
| `buildJqlFromIntent(userQuery)` | string | object|null | Construct JQL from natural language |

### New Functions in src/jira-tool-executor.js:

| Function | Parameters | Return | Purpose |
|----------|------------|--------|---------|
| `executeJiraEndpoint(endpoint, method, parameters)` | string, string, object | Promise<object> | Execute raw API call |
| `executePrompt(prompt, parameters)` | object, object | Promise<object> | Execute with validation |
| `executePaginated(prompt, parameters)` | object, object | Promise<object> | Handle paginated results |
| `buildQueryParams(endpoint, parsedIntent)` | string, object | object | Build query string params |

## Classes
No new classes required. The system uses:
- Plain JavaScript objects for prompt definitions
- Module-level exported functions for stateless operations
- KVS for persistence (handled via Forge storage API)

## Dependencies
**No external dependencies required:**
- Uses existing `@forge/api` imports (`api`, `route`, `storage`)
- No new npm packages needed
- Compatible with current Forge runtime (nodejs22.x)

## Testing
### Unit Test Strategy:
1. **Prompt Matching Tests:**
   - Verify fuzzy keyword matching works for various user queries
   - Test edge cases: empty input, partial matches, exact matches
   - Validate scoring algorithm ranks correct prompts highest

2. **Execution Tests:**
   - Mock Forge API responses using `@forge/api` mocks
   - Test parameter validation (required vs optional)
   - Verify error handling for failed API calls

3. **Integration Tests:**
   - End-to-end flow: user query → prompt matching → execution
   - Test pagination with large result sets
   - Verify KVS persistence across invocations

### Test Commands:
```bash
# Run existing tests (if any)
npm test

# Lint check
npm run lint

# Build for Forge
forge build --force
```

## Implementation Order

1. **Create `src/jira-prompts.js`** - Main prompt definitions and matching logic
   - Define all JIRA endpoint prompts (issues, groups, users, workflows, etc.)
   - Implement similarity calculation algorithm
   - Add helper functions for loading/storing in KVS

2. **Create `src/jira-tool-executor.js`** - API execution engine
   - Implement pagination handling
   - Create response formatting functions
   - Add parameter validation and error handling

3. **Update `src/index.js`** - Integration with existing codebase
   - Import new modules (already done)
   - Wire up agentic validation to optionally use prompt matching
   - Ensure backward compatibility with existing TOOL_REGISTRY

4. **Build and Deploy:**
   - Run `forge build --force`
   - Test in development Jira instance
   - Monitor for any API errors or rate limiting

5. **Optional Enhancements:**
   - Create admin UI component to view/edit prompts (in static/config-ui)
   - Add logging for prompt matching decisions
   - Implement prompt versioning and updates via KVS
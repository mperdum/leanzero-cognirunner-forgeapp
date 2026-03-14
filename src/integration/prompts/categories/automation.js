/*
 * JIRA Automation Prompts - Automation operations for JIRA REST API
 */

/**
 * Automation prompt definitions for JIRA REST API operations
 */
export const automation = {
  // --- AUTOMATION ---

  get_automation_rules: {
    id: "get_automation_rules",
    category: "automation",
    keywords: [
      "automation rules", "auto rules", "rule list"
    ],
    endpoint: "/rest/automate/1.0/project/{projectId}/rules",
    method: "GET",
    description: "Get all automation rules for a project.",
    parameters: {
      required: ["projectId"],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      total: "Total number of rules",
      values: "Array of rule objects with name, trigger, actions"
    },
    when_to_use: "Use when user asks about automation rules or automatic workflows.",
    example_queries: [
      "List all automation rules for PROJ",
      "Show me project rules"
    ]
  },

  run_automation_rule: {
    id: "run_automation_rule",
    category: "automation",
    keywords: [
      "run automation", "execute rule", "trigger rule"
    ],
    endpoint: "/rest/automate/1.0/project/{projectId}/rules/{ruleId}/run",
    method: "POST",
    description: "Manually run an automation rule on a specific issue.",
    parameters: {
      required: ["projectId", "ruleId"],
      optional: ["issueKey"]
    },
    response_format: {
      success: true,
      executionId: "Run ID"
    },
    when_to_use: "Use when user asks to manually trigger an automation rule.",
    example_queries: [
      "Run 'Close stale tickets' rule on PROJ-123",
      "Execute automation rule ABC-456"
    ]
  },

  create_automation_rule: {
    id: "create_automation_rule",
    category: "automation",
    keywords: [
      "create automation", "add rule", "new rule"
    ],
    endpoint: "/rest/automate/1.0/project/{projectId}/rules",
    method: "POST",
    description: "Create a new automation rule for a project.",
    parameters: {
      required: ["projectId"],
      optional: ["name", "trigger", "conditions", "actions"]
    },
    response_format: {
      id: "Rule ID",
      name: "Rule name"
    },
    when_to_use: "Use when user asks to create or add a new automation rule.",
    example_queries: [
      "Create an automation rule that assigns tickets to me",
      "Add new automatic workflow"
    ]
  }
};
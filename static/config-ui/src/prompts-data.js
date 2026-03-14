/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * JIRA Prompts Data Export for Config UI
 * 
 * This file contains a copy of the JIRA_PROMPTS object for use in the config-ui.
 * The full prompt definitions have been split into modular files under src/jira-prompts/.
 * This file provides a browser-compatible subset for static configuration display.
 */

// The full prompt definitions - this would be imported from the source module
// For now, we include a subset that can be loaded directly

export const JIRA_PROMPTS = {
  // Issues endpoints (17 total)
  get_all_issues_with_subtasks: {
    id: "get_all_issues_with_subtasks",
    category: "issues",
    keywords: ["all issues", "list all issues", "show me issues", "fetch issues"],
    endpoint: "/rest/api/3/search/jql",
    method: "POST",
    description: "Search for Jira issues using JQL (Jira Query Language). Returns paginated results.",
    parameters: { required: ["jql"], optional: ["fields", "maxResults", "startAt", "expand"] },
    response_format: { total: "Total issues matching query", issues: "Array of issue objects" },
    when_to_use: "Use when user asks to list, find, search, or browse issues with various criteria.",
    example_queries: ["Get all open bugs in project PROJ", "List all issues assigned to me"]
  },

  create_issue: {
    id: "create_issue",
    category: "issues",
    keywords: ["create issue", "file bug", "raise ticket", "add new issue"],
    endpoint: "/rest/api/3/issue",
    method: "POST",
    description: "Creates a new Jira issue or subtask.",
    parameters: { required: ["fields"], optional: ["update", "reporter", "assignee", "project"] },
    response_format: { id: "Issue ID", key: "Issue key" },
    when_to_use: "Use when user asks to create, file, open, or submit a new issue/ticket.",
    example_queries: ["Create a bug for login failure in PROJ project"]
  },

  get_issue_by_key: {
    id: "get_issue_by_key",
    category: "issues",
    keywords: ["issue by key", "get PROJ-123", "fetch issue"],
    endpoint: "/rest/api/3/issue/{id}",
    method: "GET",
    description: "Get detailed information for a specific Jira issue by its key.",
    parameters: { required: ["id"], optional: ["fields", "expand"] },
    response_format: { id: "Issue ID", key: "Issue key" }
  },

  update_issue: {
    id: "update_issue",
    category: "issues",
    keywords: ["update issue", "edit ticket", "modify bug"],
    endpoint: "/rest/api/3/issue/{id}",
    method: "PUT",
    description: "Update an existing Jira issue.",
    parameters: { required: ["fields"], optional: ["update"] }
  },

  get_subtasks: {
    id: "get_subtasks",
    category: "issues",
    keywords: ["subtasks", "child issues", "children"],
    endpoint: "/rest/api/3/issue/{id}/subtasks",
    method: "GET",
    description: "Get all subtasks for a specific parent issue.",
    parameters: { required: ["id"] }
  },

  get_issue_transitions: {
    id: "get_issue_transitions",
    category: "issues",
    keywords: ["transitions", "available actions", "status changes"],
    endpoint: "/rest/api/3/issue/{id}/transitions",
    method: "GET",
    description: "Get available workflow transitions for an issue.",
    parameters: { required: ["id"] }
  },

  transition_issue: {
    id: "transition_issue",
    category: "issues",
    keywords: ["transition", "move issue", "change status"],
    endpoint: "/rest/api/3/issue/{id}/transitions",
    method: "POST",
    description: "Execute a workflow transition to change issue status.",
    parameters: { required: ["transition", "id"], optional: ["fields"] }
  },

  get_issue_fields: {
    id: "get_issue_fields",
    category: "issues",
    keywords: ["issue fields", "field metadata"],
    endpoint: "/rest/api/3/issue/{id}/editmeta",
    method: "GET",
    description: "Get edit meta for creating/updating an issue.",
    parameters: { required: ["id"] }
  },

  // Projects (2)
  get_all_projects: {
    id: "get_all_projects",
    category: "projects",
    keywords: ["all projects", "list projects"],
    endpoint: "/rest/api/3/project/search",
    method: "POST",
    description: "Search for Jira projects with pagination.",
    parameters: { required: [], optional: ["startAt", "maxResults"] }
  },

  get_project_by_key: {
    id: "get_project_by_key",
    category: "projects",
    keywords: ["project by key"],
    endpoint: "/rest/api/3/project/{projectIdOrKey}",
    method: "GET",
    description: "Get detailed information for a specific project.",
    parameters: { required: ["projectIdOrKey"] }
  },

  // Users (2)
  search_users: {
    id: "search_users",
    category: "users",
    keywords: ["search users", "find user", "lookup user"],
    endpoint: "/rest/api/3/user/search",
    method: "GET",
    description: "Search for active Jira users.",
    parameters: { required: [], optional: ["query", "accountId"] }
  },

  get_user_by_account_id: {
    id: "get_user_by_account_id",
    category: "users",
    keywords: ["user by account"],
    endpoint: "/rest/api/3/user",
    method: "GET",
    description: "Get detailed information for a specific user.",
    parameters: { required: ["accountId"] }
  },

  // Groups (5)
  get_groups_for_user: {
    id: "get_groups_for_user",
    category: "groups",
    keywords: ["user groups", "group membership"],
    endpoint: "/rest/api/3/user/groups",
    method: "GET",
    description: "Get all groups a specific user belongs to.",
    parameters: { required: ["accountId"] }
  },

  search_groups: {
    id: "search_groups",
    category: "groups",
    keywords: ["search groups", "find group"],
    endpoint: "/rest/api/3/groups/picker",
    method: "GET",
    description: "Search for Jira groups by name.",
    parameters: { required: ["query"], optional: ["maxResults"] }
  },

  add_user_to_group: {
    id: "add_user_to_group",
    category: "groups",
    keywords: ["add user to group", "invite to group"],
    endpoint: "/rest/api/3/group/user",
    method: "POST",
    description: "Add a user to a Jira group.",
    parameters: { required: ["groupname"], optional: ["accountId"] }
  },

  remove_user_from_group: {
    id: "remove_user_from_group",
    category: "groups",
    keywords: ["remove user from group", "kick from group"],
    endpoint: "/rest/api/3/group/user",
    method: "DELETE",
    description: "Remove a user from a Jira group.",
    parameters: { required: ["groupname"], optional: ["accountId"] }
  },

  get_users_from_group: {
    id: "get_users_from_group",
    category: "groups",
    keywords: ["group members", "users in group"],
    endpoint: "/rest/api/3/group/member",
    method: "GET",
    description: "Get paginated list of all users in a Jira group.",
    parameters: { required: ["groupId"], optional: ["startAt", "maxResults"] }
  },

  // Workflows (2)
  search_workflows: {
    id: "search_workflows",
    category: "workflows",
    keywords: ["all workflows", "list workflows"],
    endpoint: "/rest/api/3/workflows/search",
    method: "GET",
    description: "Search for Jira workflows.",
    parameters: { required: [], optional: ["queryString"] }
  },

  get_workflow_transitions: {
    id: "get_workflow_transitions",
    category: "workflows",
    keywords: ["workflow transitions"],
    endpoint: "/rest/api/3/workflow/{workflowId}/transitions",
    method: "GET",
    description: "Get all transitions defined in a specific workflow.",
    parameters: { required: ["workflowId"] }
  },

  // Field Configurations (3)
  get_field_configurations: {
    id: "get_field_configurations",
    category: "field-configs",
    keywords: ["field configurations"],
    endpoint: "/rest/api/3/fieldconfiguration",
    method: "GET",
    description: "Get all field configuration schemes.",
    parameters: { required: [], optional: ["startAt"] }
  },

  get_field_configuration_schemes: {
    id: "get_field_configuration_schemes",
    category: "field-configs",
    keywords: ["field configuration schemes"],
    endpoint: "/rest/api/3/fieldconfigurationscheme",
    method: "GET",
    description: "Get all field configuration schemes with project mappings.",
    parameters: { required: [], optional: ["startAt"] }
  },

  get_field_configuration_fields: {
    id: "get_field_configuration_fields",
    category: "field-configs",
    keywords: ["fields in config"],
    endpoint: "/rest/api/3/fieldconfiguration/{id}/fields",
    method: "GET",
    description: "Get all fields visible in a specific field configuration.",
    parameters: { required: ["id"] }
  },

  // Screens (3)
  get_screens: {
    id: "get_screens",
    category: "screens",
    keywords: ["all screens", "list screens"],
    endpoint: "/rest/api/3/screens",
    method: "GET",
    description: "Get all issue screen schemes.",
    parameters: { required: [], optional: ["startAt"] }
  },

  get_screen_tabs: {
    id: "get_screen_tabs",
    category: "screens",
    keywords: ["screen tabs"],
    endpoint: "/rest/api/3/screens/{id}/tabs",
    method: "GET",
    description: "Get all tabs for a specific issue screen.",
    parameters: { required: ["id"] }
  },

  get_screen_tab_fields: {
    id: "get_screen_tab_fields",
    category: "screens",
    keywords: ["screen fields"],
    endpoint: "/rest/api/3/screens/{id}/tabs/{tabId}/fields",
    method: "GET",
    description: "Get all fields displayed on a specific screen tab.",
    parameters: { required: ["id", "tabId"] }
  },

  // Custom Fields (4)
  get_custom_fields: {
    id: "get_custom_fields",
    category: "custom-fields",
    keywords: ["custom fields"],
    endpoint: "/rest/api/3/field",
    method: "GET",
    description: "Get all system and custom fields.",
    parameters: { required: [], optional: ["startAt"] }
  },

  create_custom_field: {
    id: "create_custom_field",
    category: "custom-fields",
    keywords: ["create custom field"],
    endpoint: "/rest/api/3/field",
    method: "POST",
    description: "Create a new custom field.",
    parameters: { required: ["name", "type"], optional: ["description"] }
  },

  update_custom_field: {
    id: "update_custom_field",
    category: "custom-fields",
    keywords: ["edit custom field"],
    endpoint: "/rest/api/3/field/{id}",
    method: "PUT",
    description: "Update an existing custom field.",
    parameters: { required: ["id"], optional: ["name", "description"] }
  },

  delete_custom_field: {
    id: "delete_custom_field",
    category: "custom-fields",
    keywords: ["delete custom field"],
    endpoint: "/rest/api/3/field/{id}",
    method: "DELETE",
    description: "Delete a custom field.",
    parameters: { required: ["id"] }
  },

  // Statuses & Resolutions (2)
  get_statuses: {
    id: "get_statuses",
    category: "statuses",
    keywords: ["all statuses", "list statuses"],
    endpoint: "/rest/api/3/status",
    method: "GET",
    description: "Get all issue statuses.",
    parameters: { required: [] }
  },

  get_resolutions: {
    id: "get_resolutions",
    category: "resolutions",
    keywords: ["all resolutions", "list resolutions"],
    endpoint: "/rest/api/3/resolution",
    method: "GET",
    description: "Get all issue resolutions.",
    parameters: { required: [] }
  },

  // Issue Types (2)
  get_issue_types: {
    id: "get_issue_types",
    category: "issue-types",
    keywords: ["all issue types", "list issue types"],
    endpoint: "/rest/api/3/issuetype",
    method: "GET",
    description: "Get all issue types.",
    parameters: { required: [] }
  },

  get_security_levels: {
    id: "get_security_levels",
    category: "security",
    keywords: ["security levels", "issue security"],
    endpoint: "/rest/api/3/project/{projectIdOrKey}/securitylevel",
    method: "GET",
    description: "Get all security levels for a specific project.",
    parameters: { required: ["projectIdOrKey"] }
  }
};

export default JIRA_PROMPTS;
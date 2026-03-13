/*
 * JIRA Prompt Definitions - Chain-of-Thought System for AI-Driven API Selection
 * 
 * This module provides:
 * 1. Pre-defined prompt templates for common JIRA REST API operations
 * 2. Fuzzy keyword matching to select appropriate prompts based on user queries
 * 3. Helper functions for loading, searching, and executing JIRA endpoints
 */

import { storage } from "@forge/api";

// ============================================
// PROMPT DEFINITIONS
// ============================================

/**
 * JIRA REST API endpoint definitions
 * Each prompt enables the AI to understand:
 * - When to use this endpoint (keywords)
 * - Required/optional parameters
 * - Expected response format
 * - Sample user queries that map to this endpoint
 */
export const JIRA_PROMPTS = {
  // --- ISSUES ---
  
  get_all_issues_with_subtasks: {
    id: "get_all_issues_with_subtasks",
    category: "issues",
    keywords: [
      "all issues", "list all issues", "show me issues", "fetch issues", 
      "get issue list", "browse issues", "display all tickets"
    ],
    endpoint: "/rest/api/3/search/jql",
    method: "POST",
    description: "Search for Jira issues using JQL (Jira Query Language). Returns paginated results with up to 10 issues per request.",
    parameters: {
      required: ["jql"],
      optional: ["fields", "maxResults", "startAt", "expand"]
    },
    response_format: {
      total: "Total number of issues matching the query",
      maxResults: "Number of issues returned in this page",
      startAt: "Index of first issue returned",
      isLast: "Boolean indicating if this is the last page",
      issues: "Array of issue objects containing key, fields (summary, status, etc.)"
    },
    when_to_use: "Use when user asks to list, find, search, or browse issues with various criteria.",
    example_queries: [
      "Get all open bugs in project PROJ",
      "List all issues assigned to me sorted by creation date",
      "Show me all tickets created this week"
    ],
    fields_suggestions: ["summary", "status", "assignee", "reporter", "created", "updated"],
    example_jql: "project = PROJ AND status = Open ORDER BY created DESC"
  },

  create_issue: {
    id: "create_issue",
    category: "issues",
    keywords: [
      "create issue", "file bug", "raise ticket", "add new issue", 
      "open ticket", "submit issue", "new task"
    ],
    endpoint: "/rest/api/3/issue",
    method: "POST",
    description: "Creates a new Jira issue or subtask. For subtasks, set issueType as subtask and provide parent reference.",
    parameters: {
      required: ["fields"],
      optional: ["update", "reporter", "assignee", "project"]
    },
    response_format: {
      id: "Issue ID",
      key: "Issue key (e.g., PROJ-123)",
      self: "API URL to access this issue",
      transition: "Transition information if auto-transitioned"
    },
    when_to_use: "Use when user asks to create, file, open, or submit a new issue/ticket.",
    example_queries: [
      "Create a bug for login failure in PROJ project",
      "File an issue with summary 'API timeout error'",
      "Add a task to implement feature X"
    ],
    required_fields: ["summary", "issuetype", "project"],
    optional_fields: ["description", "assignee", "reporter", "priority", "labels"]
  },

  get_issue_by_key: {
    id: "get_issue_by_key",
    category: "issues",
    keywords: [
      "issue by key", "get PROJ-123", "fetch issue PROJ", 
      "show issue details", "issue information"
    ],
    endpoint: "/rest/api/3/issue/{id}",
    method: "GET",
    description: "Get detailed information for a specific Jira issue by its key (e.g., PROJ-123).",
    parameters: {
      required: ["id"],
      optional: ["fields", "expand", "properties"]
    },
    response_format: {
      id: "Issue ID",
      key: "Issue key",
      fields: "All requested field values",
      renderedFields: "Pre-rendered HTML versions of fields"
    },
    when_to_use: "Use when user provides an issue key (PROJ-123) or asks for specific issue details.",
    example_queries: [
      "Show me details for PROJ-456",
      "Get information about issue ABC-789",
      "What is the status of issue XYZ-100?"
    ]
  },

  update_issue: {
    id: "update_issue",
    category: "issues",
    keywords: [
      "update issue", "edit ticket", "modify bug", "change issue",
      "fix fields", "update description", "change priority"
    ],
    endpoint: "/rest/api/3/issue/{id}",
    method: "PUT",
    description: "Update an existing Jira issue. Use when user wants to modify any field value.",
    parameters: {
      required: ["fields"],
      optional: ["update"]
    },
    response_format: {
      id: "Updated issue ID",
      key: "Updated issue key"
    },
    when_to_use: "Use when user asks to update, edit, change, or modify an existing issue.",
    example_queries: [
      "Update description for PROJ-123",
      "Change the priority of issue ABC-456 to High",
      "Modify fields on XYZ-789"
    ]
  },

  get_subtasks: {
    id: "get_subtasks",
    category: "issues",
    keywords: [
      "subtasks", "child issues", "children", "linked tasks",
      "task breakdown", "work items"
    ],
    endpoint: "/rest/api/3/issue/{id}/subtasks",
    method: "GET",
    description: "Get all subtasks for a specific parent issue.",
    parameters: {
      required: ["id"]
    },
    response_format: {
      issues: "Array of subtask objects with key, summary, status"
    },
    when_to_use: "Use when user asks about subtasks, children, or breakdown of tasks under an issue.",
    example_queries: [
      "Show me all subtasks for PROJ-123",
      "List child issues of ABC-456",
      "What are the work items under XYZ-789?"
    ]
  },

  get_issue_transitions: {
    id: "get_issue_transitions",
    category: "issues",
    keywords: [
      "transitions", "available actions", "status changes", 
      "workflow steps", "can transition"
    ],
    endpoint: "/rest/api/3/issue/{id}/transitions",
    method: "GET",
    description: "Get available workflow transitions for an issue (what status changes are possible).",
    parameters: {
      required: ["id"]
    },
    response_format: {
      transitions: "Array of {id, name, to: {name}} objects"
    },
    when_to_use: "Use when user asks about workflow transitions, available actions, or status change options.",
    example_queries: [
      "What transitions are available for PROJ-123?",
      "Show me possible status changes for ABC-456",
      "List available actions on XYZ-789"
    ]
  },

  transition_issue: {
    id: "transition_issue",
    category: "issues",
    keywords: [
      "transition", "move issue", "change status", 
      "workflow action", "update status", "resolve ticket"
    ],
    endpoint: "/rest/api/3/issue/{id}/transitions",
    method: "POST",
    description: "Execute a workflow transition to change issue status.",
    parameters: {
      required: ["transition", "id"],
      optional: ["fields"]
    },
    response_format: {
      success: true
    },
    when_to_use: "Use when user asks to move, transition, or change the status of an issue.",
    example_queries: [
      "Transition PROJ-123 to In Progress",
      "Move ABC-456 to Done status",
      "Resolve XYZ-789"
    ]
  },

  get_issue_fields: {
    id: "get_issue_fields",
    category: "issues",
    keywords: [
      "issue fields", "field metadata", "available fields",
      "field list", "field configuration"
    ],
    endpoint: "/rest/api/3/issue/{id}/editmeta",
    method: "GET",
    description: "Get edit meta (field information) for creating/updating an issue.",
    parameters: {
      required: ["id"]
    },
    response_format: {
      fields: "Object with field definitions including schema, required flag"
    },
    when_to_use: "Use when user needs to understand what fields can be set on an issue.",
    example_queries: [
      "What fields are available for PROJ-123?",
      "Show me edit metadata for ABC-456",
      "List editable fields for XYZ-789"
    ]
  },

  // --- PROJECTS ---
  
  get_all_projects: {
    id: "get_all_projects",
    category: "projects",
    keywords: [
      "all projects", "list projects", "show me projects",
      "fetch project list", "browse projects"
    ],
    endpoint: "/rest/api/3/project/search",
    method: "POST",
    description: "Search for Jira projects with pagination support.",
    parameters: {
      required: [],
      optional: ["startAt", "maxResults", "sortBy", "direction"]
    },
    response_format: {
      maxResults: "Number of projects returned",
      startAt: "Index of first project",
      isLast: "Boolean indicating if this is the last page",
      values: "Array of project objects"
    },
    when_to_use: "Use when user asks to list, find, or browse all projects.",
    example_queries: [
      "List all projects in Jira",
      "Show me available projects",
      "Get project directory"
    ]
  },

  get_project_by_key: {
    id: "get_project_by_key",
    category: "projects",
    keywords: [
      "project by key", "get PROJ details", "fetch project ABC"
    ],
    endpoint: "/rest/api/3/project/{projectIdOrKey}",
    method: "GET",
    description: "Get detailed information for a specific project.",
    parameters: {
      required: ["projectIdOrKey"]
    },
    response_format: {
      id: "Project ID",
      key: "Project key",
      name: "Project name",
      projectTypeKey: "Type (software, business, service)",
      avatarUrls: "Object with avatar URLs"
    },
    when_to_use: "Use when user asks for specific project details by key or name.",
    example_queries: [
      "Show me details for PROJ",
      "Get information about ABC project",
      "What is the configuration of XYZ?"
    ]
  },

  // --- USERS ---

  search_users: {
    id: "search_users",
    category: "users",
    keywords: [
      "search users", "find user", "lookup user", 
      "get user by name", "user picker"
    ],
    endpoint: "/rest/api/3/user/search",
    method: "GET",
    description: "Search for active Jira users by display name, email, or account ID.",
    parameters: {
      required: [],
      optional: ["query", "accountId", "startAt", "maxResults"]
    },
    response_format: {
      accountId: "User's account ID",
      accountType: "atlassian or app",
      active: "Boolean",
      displayName: "Full name",
      emailAddress: "Email (may be hidden based on privacy)",
      avatarUrls: "Object with avatar URLs"
    },
    when_to_use: "Use when user asks to search, find, lookup, or pick users by name.",
    example_queries: [
      "Find user 'John Smith'",
      "Search for john@example.com",
      "Lookup user by account ID abc123"
    ],
    example_query_values: ["query=john", "accountId=abc-123-def"]
  },

  get_user_by_account_id: {
    id: "get_user_by_account_id",
    category: "users",
    keywords: [
      "user by account", "get user details", "fetch user info"
    ],
    endpoint: "/rest/api/3/user",
    method: "GET",
    description: "Get detailed information for a specific user by account ID.",
    parameters: {
      required: ["accountId"]
    },
    response_format: {
      accountId: "User's account ID",
      accountType: "atlassian or app",
      active: "Boolean",
      displayName: "Full name",
      email: "Email address (if visible)",
      timezone: "User's timezone"
    },
    when_to_use: "Use when user provides an account ID and asks for details.",
    example_queries: [
      "Show me details for account abc-123-def",
      "Get information about user with ID xyz789"
    ]
  },

  // --- GROUPS ---

  get_groups_for_user: {
    id: "get_groups_for_user",
    category: "groups",
    keywords: [
      "user groups", "group membership", "what groups is user in"
    ],
    endpoint: "/rest/api/3/user/groups",
    method: "GET",
    description: "Get all groups a specific user belongs to.",
    parameters: {
      required: ["accountId"]
    },
    response_format: {
      groups: "Array of {name, groupId} objects"
    },
    when_to_use: "Use when user asks about which groups a member belongs to.",
    example_queries: [
      "What groups is John Smith in?",
      "Show me group membership for abc-123",
      "List all groups user xyz789 belongs to"
    ]
  },

  search_groups: {
    id: "search_groups",
    category: "groups",
    keywords: [
      "search groups", "find group", "lookup group",
      "group picker", "list groups"
    ],
    endpoint: "/rest/api/3/groups/picker",
    method: "GET",
    description: "Search for Jira groups by name. Returns matching groups with member counts.",
    parameters: {
      required: ["query"],
      optional: ["maxResults", "exclude"]
    },
    response_format: {
      groups: "Array of {name, groupId, total, isSelected} objects"
    },
    when_to_use: "Use when user asks to search, find, or pick groups by name.",
    example_queries: [
      "Search for group 'jira-admin'",
      "Find groups matching 'developer'",
      "List all groups"
    ]
  },

  add_user_to_group: {
    id: "add_user_to_group",
    category: "groups",
    keywords: [
      "add user to group", "invite to group", "grant membership",
      "make member of group", "assign to group"
    ],
    endpoint: "/rest/api/3/group/user",
    method: "POST",
    description: "Add a user to a Jira group. Requires group name and user accountId.",
    parameters: {
      required: ["groupname"],
      optional: ["accountId"]
    },
    response_format: {
      accountId: "Added user's account ID",
      groupName: "Group name",
      self: "API URL for this group membership"
    },
    when_to_use: "Use when user asks to add, invite, grant, or make someone a member of a group.",
    example_queries: [
      "Add John Smith to jira-developers group",
      "Invite abc-123 to the testers group",
      "Make xyz789 a member of project-admins"
    ]
  },

  remove_user_from_group: {
    id: "remove_user_from_group",
    category: "groups",
    keywords: [
      "remove user from group", "kick from group", "revoke membership",
      "delete from group", "unassign from group"
    ],
    endpoint: "/rest/api/3/group/user",
    method: "DELETE",
    description: "Remove a user from a Jira group. Requires group name and user accountId.",
    parameters: {
      required: ["groupname"],
      optional: ["accountId"]
    },
    response_format: {
      success: true
    },
    when_to_use: "Use when user asks to remove, kick, revoke, or delete someone from a group.",
    example_queries: [
      "Remove John Smith from jira-developers",
      "Kick abc-123 from the testers group",
      "Delete xyz789 from project-admins"
    ]
  },

  get_users_from_group: {
    id: "get_users_from_group",
    category: "groups",
    keywords: [
      "group members", "users in group", "who is in group"
    ],
    endpoint: "/rest/api/3/group/member",
    method: "GET",
    description: "Get paginated list of all users in a specific Jira group.",
    parameters: {
      required: ["groupId"],  // Can use groupName as query param
      optional: ["includeInactiveUsers", "startAt", "maxResults"]
    },
    response_format: {
      isLast: "Boolean indicating if last page",
      maxResults: "Number of users in this page",
      startAt: "Index of first user",
      total: "Total members in group",
      values: "Array of user objects"
    },
    when_to_use: "Use when user asks to list, view, or see who's in a group.",
    example_queries: [
      "List all members of jira-developers",
      "Show users in the testers group",
      "Who belongs to project-admins?"
    ]
  },

  // --- WORKFLOWS ---

  search_workflows: {
    id: "search_workflows",
    category: "workflows",
    keywords: [
      "all workflows", "list workflows", "show workflows",
      "find workflow", "workflow list"
    ],
    endpoint: "/rest/api/3/workflows/search",
    method: "GET",
    description: "Search for Jira workflows with optional filtering by name.",
    parameters: {
      required: [],
      optional: ["queryString", "scope", "isActive", "startAt", "maxResults"]
    },
    response_format: {
      total: "Total matching workflows",
      values: "Array of workflow objects"
    },
    when_to_use: "Use when user asks to list, search, or find workflows.",
    example_queries: [
      "List all workflows in Jira",
      "Find workflow 'Classic Workflow'",
      "Show available workflows for PROJ"
    ]
  },

  get_workflow_transitions: {
    id: "get_workflow_transitions",
    category: "workflows",
    keywords: [
      "workflow transitions", "transition rules", "workflow steps",
      "status changes in workflow"
    ],
    endpoint: "/rest/api/3/workflow/{workflowId}/transitions",
    method: "GET",
    description: "Get all transitions defined in a specific workflow.",
    parameters: {
      required: ["workflowId"]
    },
    response_format: {
      transitions: "Array of {id, name, type, from, to} objects"
    },
    when_to_use: "Use when user asks about workflow step definitions or transition rules.",
    example_queries: [
      "Show me all transitions in 'Classic Workflow'",
      "List steps in ABC-123 workflow",
      "What are the workflow transitions for XYZ?"
    ]
  },

  // --- FIELD CONFIGURATIONS ---

  get_field_configurations: {
    id: "get_field_configurations",
    category: "field-configs",
    keywords: [
      "field configurations", "field config schemes", "field settings"
    ],
    endpoint: "/rest/api/3/fieldconfiguration",
    method: "GET",
    description: "Get all field configuration schemes in Jira.",
    parameters: {
      required: [],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      maxResults: "Number of configurations returned",
      startAt: "Index of first result",
      isLast: "Boolean indicating if last page",
      values: "Array of field configuration objects"
    },
    when_to_use: "Use when user asks about field configuration schemes.",
    example_queries: [
      "List all field configurations",
      "Show me field config schemes",
      "What are the available field settings?"
    ]
  },

  get_field_configuration_schemes: {
    id: "get_field_configuration_schemes",
    category: "field-configs",
    keywords: [
      "field configuration schemes", "config scheme mapping"
    ],
    endpoint: "/rest/api/3/fieldconfigurationscheme",
    method: "GET",
    description: "Get all field configuration schemes with their project mappings.",
    parameters: {
      required: [],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      maxResults: "Number of schemes returned",
      startAt: "Index of first result",
      isLast: "Boolean indicating if last page",
      values: "Array of scheme objects with project associations"
    },
    when_to_use: "Use when user asks about field configuration scheme mappings.",
    example_queries: [
      "Show me all field config schemes",
      "List field configuration mappings"
    ]
  },

  get_field_configuration_fields: {
    id: "get_field_configuration_fields",
    category: "field-configs",
    keywords: [
      "fields in config", "configuration fields", "visible fields"
    ],
    endpoint: "/rest/api/3/fieldconfiguration/{id}/fields",
    method: "GET",
    description: "Get all fields visible in a specific field configuration.",
    parameters: {
      required: ["id"]
    },
    response_format: {
      fields: "Array of {id, name} objects"
    },
    when_to_use: "Use when user asks which fields are configured or visible in a scheme.",
    example_queries: [
      "Show me fields in config ID 12345",
      "List fields in 'Default Configuration'"
    ]
  },

  update_field_configuration_fields: {
    id: "update_field_configuration_fields",
    category: "field-configs",
    keywords: [
      "add field to config", "remove field from config", 
      "configure fields", "modify configuration"
    ],
    endpoint: "/rest/api/3/fieldconfiguration/{id}/fields",
    method: "PUT",
    description: "Update which fields are visible in a field configuration.",
    parameters: {
      required: ["id", "fields"]
    },
    response_format: {
      success: true
    },
    when_to_use: "Use when user asks to add, remove, or modify which fields appear in a configuration.",
    example_queries: [
      "Add summary field to config 12345",
      "Remove description from 'Default Configuration'",
      "Update visible fields in scheme"
    ]
  },

  // --- SCREENS ---

  get_screens: {
    id: "get_screens",
    category: "screens",
    keywords: [
      "all screens", "list screens", "show screen list"
    ],
    endpoint: "/rest/api/3/screens",
    method: "GET",
    description: "Get all issue screen schemes in Jira.",
    parameters: {
      required: [],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      maxResults: "Number of screens returned",
      startAt: "Index of first result",
      isLast: "Boolean indicating if last page",
      values: "Array of screen objects with tabs"
    },
    when_to_use: "Use when user asks to list, search, or find screens.",
    example_queries: [
      "List all issue screens",
      "Show me available screens",
      "What screens are configured?"
    ]
  },

  get_screen_tabs: {
    id: "get_screen_tabs",
    category: "screens",
    keywords: [
      "screen tabs", "tabs in screen", "screen organization"
    ],
    endpoint: "/rest/api/3/screens/{id}/tabs",
    method: "GET",
    description: "Get all tabs for a specific issue screen.",
    parameters: {
      required: ["id"]
    },
    response_format: {
      id: "Tab ID",
      name: "Tab name"
    },
    when_to_use: "Use when user asks about screen tab structure or organization.",
    example_queries: [
      "Show me tabs for screen 12345",
      "List all tabs in 'Default Screen'"
    ]
  },

  get_screen_tab_fields: {
    id: "get_screen_tab_fields",
    category: "screens",
    keywords: [
      "screen fields", "fields in tab", "visible on screen"
    ],
    endpoint: "/rest/api/3/screens/{id}/tabs/{tabId}/fields",
    method: "GET",
    description: "Get all fields displayed on a specific screen tab.",
    parameters: {
      required: ["id", "tabId"]
    },
    response_format: {
      id: "Field ID (e.g., summary, description)",
      name: "Human-readable field name"
    },
    when_to_use: "Use when user asks which fields are on a specific screen tab.",
    example_queries: [
      "Show me fields on screen 12345 tab 67890",
      "List all fields in 'Details' tab"
    ]
  },

  // --- CUSTOM FIELDS ---

  get_custom_fields: {
    id: "get_custom_fields",
    category: "custom-fields",
    keywords: [
      "custom fields", "all custom fields", "list custom fields",
      "show custom field list"
    ],
    endpoint: "/rest/api/3/field",
    method: "GET",
    description: "Get all system and custom fields in Jira.",
    parameters: {
      required: [],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      id: "Field ID (e.g., summary, customfield_10000)",
      name: "Field name",
      custom: "Boolean indicating if custom field",
      schema: "Field type definition"
    },
    when_to_use: "Use when user asks to list or find custom fields.",
    example_queries: [
      "List all custom fields",
      "Show me customfield_10000 details",
      "What custom fields are available?"
    ]
  },

  create_custom_field: {
    id: "create_custom_field",
    category: "custom-fields",
    keywords: [
      "create custom field", "new custom field", "add custom field"
    ],
    endpoint: "/rest/api/3/field",
    method: "POST",
    description: "Create a new custom field with specified configuration.",
    parameters: {
      required: ["name", "type"],
      optional: ["description", "searcherKey"]
    },
    response_format: {
      id: "customfield_XXXXX",
      name: "Field name",
      custom: true
    },
    when_to_use: "Use when user asks to create, add, or make a new custom field.",
    example_queries: [
      "Create a custom field called 'Priority Level'",
      "Add new text field for customer feedback"
    ]
  },

  update_custom_field: {
    id: "update_custom_field",
    category: "custom-fields",
    keywords: [
      "edit custom field", "modify custom field", "update field settings"
    ],
    endpoint: "/rest/api/3/field/{id}",
    method: "PUT",
    description: "Update an existing custom field configuration.",
    parameters: {
      required: ["id"],
      optional: ["name", "description", "searcherKey"]
    },
    response_format: {
      id: "Field ID",
      name: "Updated name"
    },
    when_to_use: "Use when user asks to edit, modify, or update custom field settings.",
    example_queries: [
      "Edit 'Priority Level' custom field",
      "Modify customfield_10000 configuration"
    ]
  },

  delete_custom_field: {
    id: "delete_custom_field",
    category: "custom-fields",
    keywords: [
      "delete custom field", "remove custom field", "drop custom field"
    ],
    endpoint: "/rest/api/3/field/{id}",
    method: "DELETE",
    description: "Delete a custom field. Use with caution!",
    parameters: {
      required: ["id"]
    },
    response_format: {
      success: true
    },
    when_to_use: "Use when user asks to delete, remove, or drop a custom field.",
    example_queries: [
      "Delete customfield_10000",
      "Remove 'Priority Level' custom field"
    ]
  },

  get_custom_field_options: {
    id: "get_custom_field_options",
    category: "custom-fields",
    keywords: [
      "field options", "select options", "dropdown values"
    ],
    endpoint: "/rest/api/3/field/{fieldId}/option",
    method: "GET",
    description: "Get all available options for select list custom fields.",
    parameters: {
      required: ["fieldId"]
    },
    response_format: {
      maxResults: "Number of options returned",
      startAt: "Index of first option",
      isLast: "Boolean indicating if last page",
      values: "Array of option objects with id, value"
    },
    when_to_use: "Use when user asks about available options for select fields.",
    example_queries: [
      "Show me options for customfield_10000",
      "List dropdown values in Priority field"
    ]
  },

  // --- STATUS AND RESOLUTION ---

  get_statuses: {
    id: "get_statuses",
    category: "statuses",
    keywords: [
      "all statuses", "list statuses", "show status list",
      "workflow statuses"
    ],
    endpoint: "/rest/api/3/status",
    method: "GET",
    description: "Get all issue statuses in Jira.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      id: "Status ID (e.g., 1, 2)",
      name: "Status name (Open, In Progress, Done)",
      statusCategory: "TODO, IN_PROGRESS, DONE"
    },
    when_to_use: "Use when user asks to list or view all statuses.",
    example_queries: [
      "List all issue statuses",
      "Show me available status values"
    ]
  },

  get_resolutions: {
    id: "get_resolutions",
    category: "resolutions",
    keywords: [
      "all resolutions", "list resolutions", "show resolution list"
    ],
    endpoint: "/rest/api/3/resolution",
    method: "GET",
    description: "Get all issue resolutions in Jira.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      id: "Resolution ID",
      name: "Resolution name (Fixed, Won't Fix, Duplicate)",
      description: "Resolution description"
    },
    when_to_use: "Use when user asks about resolutions or resolution values.",
    example_queries: [
      "List all resolutions",
      "Show me available resolution options"
    ]
  },

  // --- ISSUE TYPES ---

  get_issue_types: {
    id: "get_issue_types",
    category: "issue-types",
    keywords: [
      "all issue types", "list issue types", "show type list",
      "bug, task, story types"
    ],
    endpoint: "/rest/api/3/issuetype",
    method: "GET",
    description: "Get all issue types in Jira.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      id: "Issue type ID",
      name: "Issue type name (Bug, Story, Task)",
      description: "Issue type description",
      iconUrl: "URL to issue type icon"
    },
    when_to_use: "Use when user asks about issue types or creating specific types.",
    example_queries: [
      "List all issue types",
      "Show me available issue type options"
    ]
  },

  get_issue_type_hierarchy: {
    id: "get_issue_type_hierarchy",
    category: "issue-types",
    keywords: [
      "issue hierarchy", "parent child types", "subtask types"
    ],
    endpoint: "/rest/api/3/issuetypes",
    method: "GET",
    description: "Get all issue types including subtasks and their hierarchy.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      id: "Issue type ID",
      name: "Issue type name",
      subTask: "Boolean indicating if subtask type"
    },
    when_to_use: "Use when user asks about issue hierarchies or subtasks.",
    example_queries: [
      "Show me all issue types including subtasks",
      "List parent and child issue types"
    ]
  },

  // --- SECURITY LEVELS ---

  get_security_levels: {
    id: "get_security_levels",
    category: "security",
    keywords: [
      "security levels", "issue security", "visibility levels"
    ],
    endpoint: "/rest/api/3/project/{projectIdOrKey}/securitylevel",
    method: "GET",
    description: "Get all security levels for a specific project.",
    parameters: {
      required: ["projectIdOrKey"]
    },
    response_format: {
      id: "Security level ID",
      name: "Security level name"
    },
    when_to_use: "Use when user asks about issue security or visibility settings.",
    example_queries: [
      "Show me security levels for PROJ",
      "List available security levels"
    ]
  },

  // --- NOTIFICATIONS ---

  get_notification_schemes: {
    id: "get_notification_schemes",
    category: "notifications",
    keywords: [
      "notification schemes", "email notifications", "alert schemes"
    ],
    endpoint: "/rest/api/3/notificationscheme",
    method: "GET",
    description: "Get all notification schemes in Jira.",
    parameters: {
      required: [],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      maxResults: "Number of schemes returned",
      startAt: "Index of first result",
      isLast: "Boolean indicating if last page",
      values: "Array of notification scheme objects"
    },
    when_to_use: "Use when user asks about email notifications, alerts, or who gets notified.",
    example_queries: [
      "List all notification schemes",
      "Show me available notification schemes"
    ]
  },

  get_events: {
    id: "get_events",
    category: "notifications",
    keywords: [
      "events", "workflow events", "issue events"
    ],
    endpoint: "/rest/api/3/events",
    method: "GET",
    description: "Get all system and custom issue events.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      id: "Event ID",
      name: "Event name (e.g., Issue Created, Issue Updated)",
      description: "Event description"
    },
    when_to_use: "Use when user asks about workflow events or triggers.",
    example_queries: [
      "List all issue events",
      "Show me available workflow event types"
    ]
  },

  // --- PERMISSIONS ---

  get_permissions: {
    id: "get_permissions",
    category: "permissions",
    keywords: [
      "permissions", "permission scheme", "user permissions"
    ],
    endpoint: "/rest/api/3/permissions",
    method: "GET",
    description: "Get all available permissions and their descriptions.",
    parameters: {
      required: [],
      optional: []
    },
    response_format: {
      permissions: "Array of {key, name, description} objects"
    },
    when_to_use: "Use when user asks about permissions or access control.",
    example_queries: [
      "List all available permissions",
      "Show me permission scheme details"
    ]
  },

  get_permission_schemes: {
    id: "get_permission_schemes",
    category: "permissions",
    keywords: [
      "permission schemes", "access control", "project permissions"
    ],
    endpoint: "/rest/api/3/permissionscheme",
    method: "GET",
    description: "Get all permission schemes in Jira.",
    parameters: {
      required: [],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      maxResults: "Number of schemes returned",
      startAt: "Index of first result",
      isLast: "Boolean indicating if last page",
      values: "Array of permission scheme objects"
    },
    when_to_use: "Use when user asks about permission schemes or access control.",
    example_queries: [
      "List all permission schemes",
      "Show me available permission schemes"
    ]
  },

  get_my_permissions: {
    id: "get_my_permissions",
    category: "permissions",
    keywords: [
      "my permissions", "my access", "what can I do"
    ],
    endpoint: "/rest/api/3/mypermissions",
    method: "GET",
    description: "Get the current user's permissions across projects.",
    parameters: {
      required: [],
      optional: ["projectKey", "projectId", "issueKey"]
    },
    response_format: {
      permissions: "Object with permission keys and granted status"
    },
    when_to_use: "Use when user asks what permissions they have or can perform.",
    example_queries: [
      "What permissions do I have?",
      "Show me my access rights",
      "Can I create issues in PROJ?"
    ]
  },

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
  },

  // --- ATTACHMENTS ---

  get_attachments: {
    id: "get_attachments",
    category: "attachments",
    keywords: [
      "attachments", "files", "attached documents"
    ],
    endpoint: "/rest/api/3/issue/{id}/attachments",
    method: "GET",
    description: "Get all attachments for a specific issue.",
    parameters: {
      required: ["id"]
    },
    response_format: {
      attachmentCount: "Total number of attachments",
      items: "Array of attachment objects with filename, size, mimetype"
    },
    when_to_use: "Use when user asks about issue attachments or files.",
    example_queries: [
      "Show me all attachments for PROJ-123",
      "List attached files on ABC-456"
    ]
  },

  add_attachment: {
    id: "add_attachment",
    category: "attachments",
    keywords: [
      "add attachment", "upload file", "attach document"
    ],
    endpoint: "/rest/api/3/issue/{id}/attachments",
    method: "POST",
    description: "Add an attachment to a Jira issue. Content-Type must be multipart/form-data.",
    parameters: {
      required: ["id"],
      optional: []
    },
    response_format: {
      id: "Attachment ID",
      filename: "Attached file name"
    },
    when_to_use: "Use when user asks to add, upload, or attach a file to an issue.",
    example_queries: [
      "Attach screenshot.png to PROJ-123",
      "Upload document to ABC-456"
    ]
  },

  delete_attachment: {
    id: "delete_attachment",
    category: "attachments",
    keywords: [
      "delete attachment", "remove file", "detach document"
    ],
    endpoint: "/rest/api/3/attachment/{id}",
    method: "DELETE",
    description: "Delete a specific attachment by ID.",
    parameters: {
      required: ["id"]
    },
    response_format: {
      success: true
    },
    when_to_use: "Use when user asks to delete, remove, or detach an attachment.",
    example_queries: [
      "Delete attachment 12345 from issue",
      "Remove file attached to PROJ-123"
    ]
  },

  // --- VERSIONS (RELEASES) ---

  get_versions: {
    id: "get_versions",
    category: "versions",
    keywords: [
      "versions", "releases", "sprints", "milestones"
    ],
    endpoint: "/rest/api/3/project/{projectIdOrKey}/version",
    method: "GET",
    description: "Get all versions (releases) for a project.",
    parameters: {
      required: ["projectIdOrKey"],
      optional: ["startAt", "maxResults", "orderBy"]
    },
    response_format: {
      maxResults: "Number of versions returned",
      startAt: "Index of first version",
      isLast: "Boolean indicating if last page",
      values: "Array of version objects"
    },
    when_to_use: "Use when user asks about versions, releases, or milestones.",
    example_queries: [
      "List all versions for PROJ",
      "Show me project releases"
    ]
  },

  create_version: {
    id: "create_version",
    category: "versions",
    keywords: [
      "create version", "add release", "new milestone"
    ],
    endpoint: "/rest/api/3/version",
    method: "POST",
    description: "Create a new project version (release).",
    parameters: {
      required: ["project", "name"],
      optional: ["description", "startDate", "releaseDate"]
    },
    response_format: {
      id: "Version ID",
      name: "Version name"
    },
    when_to_use: "Use when user asks to create or add a new version/release.",
    example_queries: [
      "Create version 2.0 for PROJ",
      "Add new release milestone"
    ]
  },

  // --- COMMENT ---

  get_comments: {
    id: "get_comments",
    category: "comments",
    keywords: [
      "comments", "replies", "issue comments"
    ],
    endpoint: "/rest/api/3/issue/{id}/comment",
    method: "GET",
    description: "Get all comments for a specific issue.",
    parameters: {
      required: ["id"],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      startAt: "Index of first comment",
      maxResults: "Number of comments returned",
      total: "Total number of comments",
      comments: "Array of comment objects"
    },
    when_to_use: "Use when user asks about issue comments or discussions.",
    example_queries: [
      "Show me all comments on PROJ-123",
      "List discussion on ABC-456"
    ]
  },

  add_comment: {
    id: "add_comment",
    category: "comments",
    keywords: [
      "add comment", "write comment", "reply to issue"
    ],
    endpoint: "/rest/api/3/issue/{id}/comment",
    method: "POST",
    description: "Add a new comment to an issue.",
    parameters: {
      required: ["id"],
      optional: ["body", "visibility"]
    },
    response_format: {
      id: "Comment ID",
      body: "Comment text"
    },
    when_to_use: "Use when user asks to add, write, or reply with a comment.",
    example_queries: [
      "Add comment 'Fixed in latest build' to PROJ-123",
      "Write response on ABC-456"
    ]
  },

  // --- WORKLOG ---

  get_worklogs: {
    id: "get_worklogs",
    category: "worklog",
    keywords: [
      "worklogs", "time logged", "time spent"
    ],
    endpoint: "/rest/api/3/issue/{id}/worklog",
    method: "GET",
    description: "Get all worklogs (time entries) for an issue.",
    parameters: {
      required: ["id"],
      optional: ["startAt", "maxResults"]
    },
    response_format: {
      startAt: "Index of first worklog",
      maxResults: "Number of worklogs returned",
      total: "Total number of worklogs",
      worklogs: "Array of worklog objects"
    },
    when_to_use: "Use when user asks about time tracking or logged hours.",
    example_queries: [
      "Show me worklogs for PROJ-123",
      "List time entries on ABC-456"
    ]
  },

  add_worklog: {
    id: "add_worklog",
    category: "worklog",
    keywords: [
      "add worklog", "log time", "record hours"
    ],
    endpoint: "/rest/api/3/issue/{id}/worklog",
    method: "POST",
    description: "Add a new worklog (time entry) to an issue.",
    parameters: {
      required: ["id"],
      optional: ["timeSpent", "started", "comment"]
    },
    response_format: {
      id: "Worklog ID",
      timeSpent: "Duration (e.g., '2h 30m')"
    },
    when_to_use: "Use when user asks to log time, record hours, or add worklog.",
    example_queries: [
      "Log 4 hours on PROJ-123",
      "Record time spent on ABC-456"
    ]
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate similarity score between two strings using Jaro-Winkler-like approach
 * @param {string} a - First string
 * @param {string} b - Second string  
 * @returns {number} Similarity score (0-1)
 */
const calculateSimilarity = (a, b) => {
  if (!a || !b) return 0;
  
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  
  // Exact match
  if (aLower === bLower) return 1.0;
  
  // Length-based penalty
  const maxLen = Math.max(aLower.length, bLower.length);
  const minLen = Math.min(aLower.length, bLower.length);
  const lengthRatio = minLen / maxLen;
  
  // Character matching
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (aLower[i] === bLower[i]) matches++;
  }
  
  return (matches / maxLen) * lengthRatio;
};

/**
 * Find the best matching prompt(s) based on user query
 * @param {string} userQuery - User's natural language request
 * @param {object} prompts - Optional custom prompts object, uses JIRA_PROMPTS by default
 * @returns {array} Array of matched prompts with scores, sorted by relevance
 */
export const matchPrompt = (userQuery, prompts = JIRA_PROMPTS) => {
  if (!userQuery || typeof userQuery !== 'string') return [];
  
  const queryLower = userQuery.toLowerCase().trim();
  const results = [];
  
  for (const [key, prompt] of Object.entries(prompts)) {
    // Calculate score based on keyword matches
    let maxKeywordScore = 0;
    let matchedKeywords = [];
    
    for (const keyword of prompt.keywords || []) {
      const score = calculateSimilarity(queryLower, keyword);
      if (score > maxKeywordScore) {
        maxKeywordScore = score;
        if (score >= 0.5) matchedKeywords.push(keyword);
      }
      
      // Also check if query contains the keyword
      if (queryLower.includes(keyword)) {
        maxKeywordScore = Math.max(maxKeywordScore, 0.8 + (keyword.length / queryLower.length));
      }
    }
    
    // Bonus for exact endpoint path matches in query
    let endpointBonus = 0;
    const endpointPath = prompt.endpoint.replace('{id}', '').replace('{fieldId}', '').replace('{tabId}', '');
    if (queryLower.includes(endpointPath.replace('/rest/api/3/', ''))) {
      endpointBonus = 0.2;
    }
    
    // Calculate final score
    const finalScore = Math.min(1.0, maxKeywordScore + endpointBonus);
    
    if (finalScore >= 0.4) { // Threshold for inclusion
      results.push({
        id: prompt.id,
        category: prompt.category,
        endpoint: prompt.endpoint,
        method: prompt.method,
        description: prompt.description,
        score: finalScore,
        matchedKeywords,
        parameters: prompt.parameters || {}
      });
    }
  }
  
  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
};

/**
 * Get a specific prompt by ID
 * @param {string} promptId - The prompt ID to retrieve
 * @param {object} prompts - Optional custom prompts object
 * @returns {object|null} Prompt object or null if not found
 */
export const getPromptById = (promptId, prompts = JIRA_PROMPTS) => {
  return prompts[promptId] || null;
};

/**
 * Get all prompts in a specific category
 * @param {string} category - Category name (e.g., 'issues', 'groups')
 * @param {object} prompts - Optional custom prompts object
 * @returns {array} Array of prompt objects in the category
 */
export const getPromptsByCategory = (category, prompts = JIRA_PROMPTS) => {
  return Object.values(prompts).filter(p => p.category === category);
};

/**
 * Get all available categories
 * @param {object} prompts - Optional custom prompts object
 * @returns {array} Array of unique category names
 */
export const getAllCategories = (prompts = JIRA_PROMPTS) => {
  return [...new Set(Object.values(prompts).map(p => p.category))];
};

/**
 * Store prompts in KVS for persistence across function calls
 * @param {string} key - Storage key (default: 'jira_prompts')
 * @returns {Promise<void>}
 */
export const storePrompts = async (key = 'jira_prompts') => {
  try {
    await storage.set(key, JIRA_PROMPTS);
    console.log(`Stored ${Object.keys(JIRA_PROMPTS).length} prompts in KVS`);
  } catch (error) {
    console.error('Failed to store prompts:', error);
  }
};

/**
 * Load prompts from KVS if stored, otherwise use default
 * @param {string} key - Storage key (default: 'jira_prompts')
 * @returns {Promise<object>} Prompts object
 */
export const loadPrompts = async (key = 'jira_prompts') => {
  try {
    const stored = await storage.get(key);
    if (stored) {
      console.log(`Loaded ${Object.keys(stored).length} prompts from KVS`);
      return stored;
    }
    
    // Store default prompts on first load
    await storePrompts(key);
    return JIRA_PROMPTS;
  } catch (error) {
    console.error('Failed to load prompts, using defaults:', error);
    return JIRA_PROMPTS;
  }
};

/**
 * Search for prompts by keyword across all categories
 * @param {string} searchQuery - Search query string
 * @param {object} prompts - Optional custom prompts object
 * @returns {array} Array of matching prompt objects with scores
 */
export const searchPrompts = (searchQuery, prompts = JIRA_PROMPTS) => {
  if (!searchQuery || typeof searchQuery !== 'string') return [];
  
  const queryLower = searchQuery.toLowerCase().trim();
  const results = [];
  
  for (const [key, prompt] of Object.entries(prompts)) {
    // Check against multiple fields
    const checks = [
      { text: prompt.description?.toLowerCase(), weight: 2 },
      ...((prompt.keywords || []).map(k => ({ text: k.toLowerCase(), weight: 3 }))),
      { text: prompt.endpoint?.toLowerCase(), weight: 1 }
    ];
    
    let maxScore = 0;
    
    for (const check of checks) {
      if (check.text.includes(queryLower)) {
        const score = calculateSimilarity(queryLower, check.text) * check.weight;
        maxScore = Math.max(maxScore, score);
      }
    }
    
    // Category match
    if (prompt.category?.toLowerCase().includes(queryLower)) {
      maxScore = Math.max(maxScore, 1.5);
    }
    
    if (maxScore > 0.5) {
      results.push({
        id: prompt.id,
        category: prompt.category,
        endpoint: prompt.endpoint,
        method: prompt.method,
        description: prompt.description,
        keywords: prompt.keywords || [],
        score: maxScore
      });
    }
  }
  
  return results.sort((a, b) => b.score - a.score);
};

/**
 * Build JQL query from user intent (specialized helper for issue search)
 * @param {string} userQuery - User's request about searching issues
 * @returns {object|null} Object with jql and explanation, or null if no match
 */
export const buildJqlFromIntent = (userQuery) => {
  if (!userQuery || typeof userQuery !== 'string') return null;
  
  const queryLower = userQuery.toLowerCase().trim();
  
  // Common patterns for JQL construction
  const patterns = [
    {
      keywords: ['open', 'in progress'],
      field: 'status',
      operator: '=',
      pattern: /status\s+(?:is|are)\s+(open|in\s+progress)/,
      examples: ["all open issues", "issues in progress"]
    },
    {
      keywords: ['priority'],
      field: 'priority',
      operator: '=',
      pattern: /priority\s+(?:is|equals|of)\s+(\w+)/,
      examples: ["high priority tickets", "critical bugs"]
    },
    {
      keywords: ['assignee', 'assigned to'],
      field: 'assignee',
      operator: '=',
      pattern: /(?:assignee|owner)\s+([^\s,]+)/,
      examples: ["tickets assigned to John", "issues by reporter"]
    },
    {
      keywords: ['project', 'in project'],
      field: 'project',
      operator: '=',
      pattern: /(?:project|in)\s+(?:[a-zA-Z]+[-_])?([A-Z0-9]+)/,
      examples: ["bugs in PROJ", "issues in ABC project"]
    },
    {
      keywords: ['created', 'date'],
      field: 'created',
      operator: '>=',
      pattern: /(?:created|since)\s+(?:on\s+)?(\d{4}-\d{2}-\d{2}|\w+)/,
      examples: ["issues created today", "tickets since last week"]
    },
    {
      keywords: ['reporter'],
      field: 'reporter',
      operator: '=',
      pattern: /(?:reported|by)\s+(?:reporter\s+)?(\w+)/,
      examples: ["bugs by John", "issues from reporter"]
    }
  ];
  
  // Extract project key
  let jqlParts = [];
  const projectMatch = queryLower.match(/project[-_]?\s*([a-z]+)/i);
  if (projectMatch) {
    jqlParts.push(`project = ${projectMatch[1].toUpperCase()}`);
  }
  
  // Check for assignee patterns
  if (/assignee|owner|assigned to/.test(queryLower)) {
    const assigneeMatch = queryLower.match(/(?:assignee|owner|to)\s+([a-z]+)/i);
    if (assigneeMatch) {
      jqlParts.push(`assignee = ${assigneeMatch[1]}`);
    } else if (queryLower.includes('me')) {
      jqlParts.push('assignee = currentUser()');
    }
  }
  
  // Check for status patterns
  const statusKeywords = ['open', 'inprogress', 'in progress', 'done', 'closed'];
  for (const status of statusKeywords) {
    if (queryLower.includes(status)) {
      jqlParts.push(`status = ${status.replace(' ', '')}`);
      break;
    }
  }
  
  // Check for priority patterns
  const priorityKeywords = ['critical', 'high', 'medium', 'low'];
  for (const priority of priorityKeywords) {
    if (queryLower.includes(priority)) {
      jqlParts.push(`priority = ${priority.charAt(0).toUpperCase() + priority.slice(1)}`);
      break;
    }
  }
  
  // Check for reporter patterns
  if (/reporter/.test(queryLower)) {
    const reporterMatch = queryLower.match(/(?:reporter|by)\s+([a-z]+)/i);
    if (reporterMatch) {
      jqlParts.push(`reporter = ${reporterMatch[1]}`);
    } else if (queryLower.includes('my') || queryLower.includes('me')) {
      jqlParts.push('reporter = currentUser()');
    }
  }
  
  // Check for date patterns
  const datePatterns = [
    { keyword: 'today', value: 'startOfDay()' },
    { keyword: 'week', value: '-1w' },
    { keyword: 'month', value: '-1m' },
    { keyword: 'yesterday', value: '-1d' }
  ];
  
  for (const pattern of datePatterns) {
    if (queryLower.includes(pattern.keyword)) {
      jqlParts.push(`created >= ${pattern.value}`);
      break;
    }
  }
  
  // If we have any matched conditions, build JQL
  if (jqlParts.length > 0) {
    return {
      jql: jqlParts.join(' AND '),
      explanation: `Built from user query: "${userQuery}"`,
      confidence: Math.min(1.0, 0.5 + (jqlParts.length * 0.1))
    };
  }
  
  // No structured pattern found
  return null;
};

/**
 * Export functions for use in index.js and other modules
 */
export default {
  JIRA_PROMPTS,
  matchPrompt,
  getPromptById,
  getPromptsByCategory,
  getAllCategories,
  loadPrompts,
  storePrompts,
  searchPrompts,
  buildJqlFromIntent
};
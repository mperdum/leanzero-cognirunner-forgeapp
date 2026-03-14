/*
 * JIRA Custom Fields Prompts - Custom field operations for JIRA REST API
 */

/**
 * Custom field prompt definitions for JIRA REST API operations
 */
export const customFields = {
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
  }
};
/*
 * JIRA Field Configurations Prompts - Field configuration operations for JIRA REST API
 */

/**
 * Field configuration prompt definitions for JIRA REST API operations
 */
export const fieldConfigs = {
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
  }
};
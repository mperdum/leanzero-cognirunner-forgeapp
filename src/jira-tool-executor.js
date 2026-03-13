/*
 * JIRA Tool Executor - Executes JIRA REST API calls based on prompt selection
 * 
 * This module provides functions to:
 * 1. Execute JIRA API endpoints based on selected prompts
 * 2. Handle pagination for list operations
 * 3. Format responses for AI consumption
 */

import api, { route } from "@forge/api";

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Handle pagination for list endpoints
 * @param {string} endpoint - Base endpoint path
 * @param {object} params - Query parameters
 * @returns {Promise<object>} All results paginated
 */
const paginateResults = async (endpoint, params = {}) => {
  const allResults = [];
  let startAt = 0;
  let isLast = false;

  while (!isLast) {
    const response = await api.asApp().requestJira(route`${endpoint}?startAt=${startAt}&maxResults=${DEFAULT_PAGE_SIZE}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return { error: `Failed to fetch ${endpoint}: ${response.status}` };
    }

    const data = await response.json();
    
    // Extract values from common pagination structures
    const values = data.values || data.results || data;
    
    if (Array.isArray(values)) {
      allResults.push(...values);
    } else if (data) {
      allResults.push(data);
    }
    
    startAt += DEFAULT_PAGE_SIZE;
    isLast = data.isLast === true || (data.maxResults && startAt >= data.total);

    // Safety limit to prevent infinite loops
    if (allResults.length > 500) break;
  }

  return { values: allResults, total: allResults.length };
};

/**
 * Format JQL search results for AI consumption
 * @param {object} data - Raw JIRA search response
 * @returns {object} Formatted response with key info only
 */
const formatSearchResults = (data) => {
  const issues = (data.issues || []).map(issue => ({
    key: issue.key,
    summary: issue.fields?.summary || "(no summary)",
    status: issue.fields?.status?.name || "Unknown",
    assignee: issue.fields?.assignee?.displayName || null,
    reporter: issue.fields?.reporter?.displayName || null,
    created: issue.fields?.created || null,
    updated: issue.fields?.updated || null,
    priority: issue.fields?.priority?.name || null
  }));

  return {
    total: data.total || issues.length,
    maxResults: data.maxResults || issues.length,
    startAt: data.startAt || 0,
    isLast: data.isLast !== undefined ? data.isLast : true,
    issues: issues.slice(0, 10) // Limit for AI token budget
  };
};

/**
 * Format user search results
 * @param {object} data - Raw JIRA user search response
 * @returns {object} Formatted response
 */
const formatUserResults = (data) => {
  if (!Array.isArray(data)) return { users: [] };
  
  const users = data.map(user => ({
    accountId: user.accountId,
    displayName: user.displayName,
    emailAddress: user.emailAddress || null,
    active: user.active,
    accountType: user.accountType
  }));

  return { users, total: users.length };
};

/**
 * Format group search results
 * @param {object} data - Raw JIRA group picker response
 * @returns {object} Formatted response
 */
const formatGroupResults = (data) => {
  const groups = (data.groups || []).map(group => ({
    name: group.name,
    groupId: group.groupId,
    total: group.total || 0,
    isSelected: group.isSelected || false
  }));

  return { groups, total: groups.length };
};

/**
 * Execute a JIRA API endpoint based on prompt configuration
 * @param {string} endpoint - The JIRA REST endpoint (e.g., "/rest/api/3/search/jql")
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {object} parameters - Request parameters
 * @returns {Promise<object>} API response or error
 */
export const executeJiraEndpoint = async (endpoint, method, parameters = {}) => {
  try {
    // Normalize endpoint path for route helper
    let urlPath = endpoint;
    
    // Handle dynamic path parameters like {id}, {fieldId}, etc.
    if (parameters.id && endpoint.includes("{id}")) {
      urlPath = endpoint.replace("{id}", encodeURIComponent(parameters.id));
    }
    if (parameters.fieldId && endpoint.includes("{fieldId}")) {
      urlPath = endpoint.replace("{fieldId}", encodeURIComponent(parameters.fieldId));
    }
    if (parameters.tabId && endpoint.includes("{tabId}")) {
      urlPath = endpoint.replace("{tabId}", encodeURIComponent(parameters.tabId));
    }
    if (parameters.workflowId && endpoint.includes("{workflowId}")) {
      urlPath = endpoint.replace("{workflowId}", encodeURIComponent(parameters.workflowId));
    }
    if (parameters.projectIdOrKey && endpoint.includes("{projectIdOrKey}")) {
      urlPath = endpoint.replace("{projectIdOrKey}", encodeURIComponent(parameters.projectIdOrKey));
    }

    // Build URL
    const url = route`${urlPath}`;

    // Prepare request options
    const requestOptions = {
      method: method,
      headers: { Accept: "application/json" },
    };

    // Add body for POST/PUT/PATCH
    if (["POST", "PUT", "PATCH"].includes(method) && parameters) {
      // Build the request body, excluding path parameters
      const bodyParams = { ...parameters };
      
      // Remove path parameters that shouldn't be in body
      delete bodyParams.id;
      delete bodyParams.fieldId;
      delete bodyParams.tabId;
      delete bodyParams.workflowId;
      delete bodyParams.projectIdOrKey;

      // For search/jql, transform parameters to JQL format
      if (endpoint.includes("/search/jql") && parameters.jql) {
        requestOptions.body = JSON.stringify({
          jql: parameters.jql,
          fields: parameters.fields || ["summary", "status"],
          maxResults: parameters.maxResults || DEFAULT_PAGE_SIZE,
          startAt: parameters.startAt || 0
        });
      } else if (endpoint.includes("/issue") && method === "POST" && bodyParams.fields) {
        // Create issue request
        requestOptions.body = JSON.stringify({ fields: bodyParams.fields });
        if (bodyParams.update) {
          requestOptions.body = JSON.stringify({
            update: bodyParams.update,
            fields: bodyParams.fields
          });
        }
      } else if (endpoint.includes("/group/user") && method === "POST" && bodyParams.groupname) {
        // Add user to group
        requestOptions.body = JSON.stringify({ 
          name: bodyParams.groupname,
          accountId: parameters.accountId || null
        });
      } else if (Object.keys(bodyParams).length > 0) {
        requestOptions.body = JSON.stringify(bodyParams);
      }
    }

    // Make the API request
    const response = await api.asApp().requestJira(url, requestOptions);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`JIRA API error (${method} ${endpoint}):`, response.status, errorBody);
      
      return {
        success: false,
        error: `JIRA API returned ${response.status}`,
        details: errorBody.substring(0, 500)
      };
    }

    const data = await response.json();

    // Format response based on endpoint type
    if (endpoint.includes("/search/jql")) {
      return { ...formatSearchResults(data), success: true };
    }
    
    if (endpoint.includes("/user/search") || (Array.isArray(data) && data[0]?.accountId)) {
      return { ...formatUserResults(data), success: true };
    }
    
    if (endpoint.includes("/groups/picker")) {
      return { ...formatGroupResults(data), success: true };
    }

    if (endpoint.includes("/group/member") || endpoint.includes("/user/groups")) {
      const values = Array.isArray(data) ? data : (data.values || []);
      return { values, total: values.length, success: true };
    }

    // Generic response for other endpoints
    return { data, success: true };

  } catch (error) {
    console.error("Error executing JIRA endpoint:", error);
    return {
      success: false,
      error: `Execution error: ${error.message}`,
      details: error.stack?.substring(0, 500)
    };
  }
};

/**
 * Execute a prompt-based API call
 * @param {object} prompt - The prompt object with endpoint configuration
 * @param {object} parameters - Request parameters extracted from user intent
 * @returns {Promise<object>} API response or error
 */
export const executePrompt = async (prompt, parameters = {}) => {
  if (!prompt || !prompt.endpoint) {
    return {
      success: false,
      error: "No endpoint specified in prompt"
    };
  }

  // Validate required parameters
  if (prompt.parameters?.required) {
    for (const reqParam of prompt.parameters.required) {
      if (!(reqParam in parameters)) {
        return {
          success: false,
          error: `Missing required parameter: ${reqParam}`,
          requiredParameters: prompt.parameters.required,
          providedParameters: Object.keys(parameters)
        };
      }
    }
  }

  // Execute the endpoint
  const result = await executeJiraEndpoint(
    prompt.endpoint,
    prompt.method || "GET",
    parameters
  );

  return {
    ...result,
    promptId: prompt.id,
    description: prompt.description
  };
};

/**
 * Get paginated results for a list endpoint
 * @param {object} prompt - The prompt object with endpoint configuration
 * @param {object} parameters - Query parameters
 * @returns {Promise<object>} All paginated results
 */
export const executePaginated = async (prompt, parameters = {}) => {
  if (!prompt || !prompt.endpoint) {
    return {
      success: false,
      error: "No endpoint specified in prompt"
    };
  }

  // For GET requests that support pagination
  if (prompt.method === "GET" || !prompt.method) {
    const result = await paginateResults(prompt.endpoint, parameters);
    
    // If paginated results contain issues or similar structured data
    if (result.values && Array.isArray(result.values)) {
      return {
        values: result.values.slice(0, 50), // Limit for AI token budget
        total: result.total,
        success: true
      };
    }
  }

  // Fallback to regular execution for non-GET or special cases
  return executePrompt(prompt, parameters);
};

/**
 * Build query parameters from user intent
 * @param {string} endpoint - The target endpoint
 * @param {object} parsedIntent - Parsed user intent with extracted values
 * @returns {object} Query parameters object
 */
export const buildQueryParams = (endpoint, parsedIntent) => {
  const params = {};

  // JQL search endpoints
  if (endpoint.includes("/search/jql")) {
    if (parsedIntent.jql) params.jql = parsedIntent.jql;
    if (parsedIntent.fields) params.fields = parsedIntent.fields;
    if (parsedIntent.maxResults) params.maxResults = parsedIntent.maxResults;
    if (parsedIntent.startAt) params.startAt = parsedIntent.startAt;
  }

  // Issue endpoints
  if (endpoint.includes("/issue") || endpoint.includes("/issues")) {
    if (parsedIntent.issueKey || parsedIntent.id) {
      params.id = parsedIntent.issueKey || parsedIntent.id;
    }
    if (parsedIntent.fields) params.fields = parsedIntent.fields;
  }

  // User/group endpoints
  if (endpoint.includes("/user") && !endpoint.includes("/groups/picker")) {
    if (parsedIntent.accountId) params.accountId = parsedIntent.accountId;
    if (parsedIntent.query) params.query = parsedIntent.query;
  }

  if (endpoint.includes("/group")) {
    if (parsedIntent.groupname || parsedIntent.groupName) {
      params.groupname = parsedIntent.groupname || parsedIntent.groupName;
    }
    if (parsedIntent.query) params.query = parsedIntent.query;
  }

  // Field configuration endpoints
  if (endpoint.includes("/fieldconfiguration")) {
    if (parsedIntent.id || parsedIntent.fieldConfigurationId) {
      params.id = parsedIntent.id || parsedIntent.fieldConfigurationId;
    }
  }

  // Project endpoints
  if (endpoint.includes("/project")) {
    if (parsedIntent.projectKey || parsedIntent.projectIdOrKey) {
      params.projectIdOrKey = parsedIntent.projectKey || parsedIntent.projectIdOrKey;
    }
  }

  // Workflow endpoints
  if (endpoint.includes("/workflow") && !endpoint.includes("search")) {
    if (parsedIntent.workflowId || parsedIntent.id) {
      params.workflowId = parsedIntent.workflowId || parsedIntent.id;
    }
    if (parsedIntent.transitionId) {
      params.transition = { id: parsedIntent.transitionId };
    }
  }

  // Status endpoints
  if (endpoint.includes("/status") && endpoint.includes("search")) {
    if (parsedIntent.query) params.queryString = parsedIntent.query;
  }

  return params;
};

/**
 * Export functions for use in index.js and other modules
 */
export default {
  executeJiraEndpoint,
  executePrompt,
  executePaginated,
  buildQueryParams
};
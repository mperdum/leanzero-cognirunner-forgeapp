/*
 * OpenAI Client - Handles OpenAI API integration for validation
 */

import api, { route } from '@forge/api';
import { storage } from '@forge/kvs';
import { 
  FILE_MIME_TYPES, 
  IMAGE_MIME_TYPES, 
  downloadAttachment, 
  buildAttachmentContentParts 
} from './attachments';

// For testing purposes
export const isTestEnv = process.env.NODE_ENV === 'test';

// Configuration constants
export const MAX_TOOL_ROUNDS = 3;
export const AGENTIC_TIMEOUT_MS = 22000; // 22s budget within Forge's 25s validator limit

export const MAX_JQL_RESULTS = 10;

/**
 * Get the OpenAI API key from Forge KVS or environment variables
 */
export const getOpenAIKey = async () => {
  try {
    const kvsKey = await storage.get('COGNIRUNNER_OPENAI_API_KEY');
    if (kvsKey) {
      return kvsKey;
    }
  } catch (error) {
    console.error("Error reading OpenAI API key from KVS:", error);
  }
  return process.env.OPENAI_API_KEY;
};

/**
 * Get the OpenAI model from KVS or environment variables (defaults to gpt-4o-mini)
 */
export const getOpenAIModel = async () => {
  try {
    const kvsModel = await storage.get('COGNIRUNNER_OPENAI_MODEL');
    if (kvsModel) {
      return kvsModel;
    }
  } catch (error) {
    console.error("Error reading OpenAI model from KVS:", error);
  }
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
};

// Export for testing
export const mockGetOpenAIKey = () => {
  return "mock-key";
};

export const mockGetOpenAIModel = () => {
  return "gpt-4o-mini";
};

// Tool trigger patterns for agentic mode
export const TOOL_TRIGGER_PATTERN = /\b(duplicat(?:e[ds]?|ion)|already\s+(?:exists?|reported|created|filed|logged)|previously\s+(?:reported|created|filed|logged)|existing\s+(?:issues?|tickets?|bugs?|stor(?:y|ies)|tasks?)|redundan(?:t|cy)\s+(?:issues?|tickets?|bugs?|entries?)|identical\s+(?:issues?|tickets?|bugs?|stor(?:y|ies)|tasks?|entries?)|(?:similar|resembl(?:es?|ing))\s+(?:issues?|tickets?|bugs?|stor(?:y|ies)|tasks?|entries?)|no\s+duplicat|(?:search|query|check)\s+jira|find\s+(?:related|matching|existing)\s+(?:issues?|tickets?|bugs?|stor(?:y|ies)|tasks?)|cross[- ]?reference|compare\s+(?:against|with)\s+(?:existing|other|jira))\b/i;

/**
 * Extract text from Jira Atlassian Document Format (ADF) content
 * Handles headings, lists, tables, code blocks, mentions, emojis, etc.
 */
export const extractTextFromADF = (adfContent) => {
  if (!adfContent) return "";
  if (typeof adfContent === "string") return adfContent;

  const parts = [];

  // Block-level node types that should be separated by newlines
  const blockTypes = new Set([
    "paragraph", "heading", "blockquote", "codeBlock",
    "rule", "mediaSingle", "mediaGroup", "bulletList",
    "orderedList", "listItem", "table", "tableRow",
    "tableHeader", "tableCell", "panel", "decisionList",
    "decisionItem", "taskList", "taskItem", "expand",
  ]);

  const extractFromNode = (node) => {
    if (!node) return;

    // Text nodes
    if (node.type === "text" && node.text) {
      parts.push(node.text);
    }

    // Inline nodes with attrs-based content
    if (node.type === "mention" && node.attrs?.text) {
      parts.push(node.attrs.text);
    } else if (node.type === "emoji" && node.attrs?.shortName) {
      parts.push(node.attrs.shortName);
    } else if (node.type === "inlineCard" && node.attrs?.url) {
      parts.push(node.attrs.url);
    } else if (node.type === "date" && node.attrs?.timestamp) {
      // Convert Unix timestamp to readable date
      const ts = Number(node.attrs.timestamp);
      parts.push(isNaN(ts) ? node.attrs.timestamp : new Date(ts).toISOString().split("T")[0]);
    } else if (node.type === "status" && node.attrs?.text) {
      parts.push(node.attrs.text);
    } else if (node.type === "hardBreak") {
      parts.push("\n");
    }

    // Recurse into child content
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach((child, index) => {
        extractFromNode(child);
        // Add newline after block-level children (except the last one)
        if (blockTypes.has(child.type) && index < node.content.length - 1) {
          parts.push("\n");
        }
      });
    }
  };

  extractFromNode(adfContent);
  return parts.join("").trim();
};

/**
 * Check if a validation prompt's wording implies the need for JQL search tools.
 */
export const promptRequiresTools = (prompt) => {
  if (!prompt || typeof prompt !== "string") return false;
  return TOOL_TRIGGER_PATTERN.test(prompt);
};

// === Agentic tool infrastructure ===

/**
 * Extract display value from a Jira field (handles complex types like ADF, users, arrays)
 */
export const extractFieldDisplayValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  
  // Boolean
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  
  // ADF content
  if (value.type === "doc" && value.content) {
    return extractTextFromADF(value);
  }
  
  // Attachment objects — { id, filename, size, mimeType, author, created, ... }
  if (value.filename && value.mimeType !== undefined) {
    const parts = [value.filename];
    if (value.size !== undefined) parts.push(`(${Math.round(value.size / 1024)}KB)`);
    if (value.mimeType) parts.push(`[${value.mimeType}]`);
    return parts.join(" ");
  }
  
  // User fields
  if (value.displayName) return value.displayName;
  
  // Select fields
  if (value.name) return value.name;
  if (value.value) return value.value;
  
  // Arrays (multi-select, components, versions)
  if (Array.isArray(value)) {
    // Checklist for Jira (Okapya) — flat array format from Jira REST API
    // Format: [{ name: "...", checked: true/false, mandatory: false, rank: 1, ... }]
    if (value.length > 0 && value[0].name !== undefined && value[0].checked !== undefined) {
      return value.map((item) => `[${item.checked ? "x" : " "}] ${item.name}`).join("\n");
    }
    return value.map(extractFieldDisplayValue).filter(v => v).join(", ");
  }
  
  // Fallback: JSON stringify complex objects
  try { return JSON.stringify(value); } catch { return "[Complex]"; }
};

/**
 * Tool registry — maps tool names to their OpenAI function definition and executor.
 */
export const TOOL_REGISTRY = {
  search_jira_issues: {
    definition: {
      type: "function",
      function: {
        name: "search_jira_issues",
        description: "Search for Jira issues using JQL (Jira Query Language). Use this to find similar issues, check for duplicates, or look up related work. Returns up to 10 issues with their key, summary, status, and the validated field's content (truncated to 500 chars).",
        parameters: {
          type: "object",
          properties: {
            jql: {
              type: "string",
              description: "A JQL query string. Must include a search restriction (project, text, summary, etc.). Examples: 'project = PROJ AND text ~ \"login error\"', 'summary ~ \"payment\" AND status != Done'",
            },
          },
          required: ["jql"],
        },
      },
    },
    execute: async ({ jql }, validatedFieldId, dependencies = {}) => {
      const { api: injectedApi = api, route: injectedRoute = route } = dependencies;
      try {
        const fields = ["summary", "status"];
        if (validatedFieldId && validatedFieldId !== "summary" && validatedFieldId !== "status") {
          fields.push(validatedFieldId);
        }
        const response = await injectedApi.asApp().requestJira(
          injectedRoute`/rest/api/3/search/jql`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              jql,
              fields,
              maxResults: MAX_JQL_RESULTS,
            }),
          },
        );
        if (!response.ok) {
          const errorText = await response.text();
          console.error("JQL search failed:", response.status, errorText.substring(0, 200));
          return JSON.stringify({
            error: `JQL search failed (${response.status}): ${errorText.substring(0, 200)}`,
            issues: [],
          });
        }
        const data = await response.json();
        const issues = (data.issues || []).map((issue) => {
          const result = {
            key: issue.key,
            summary: issue.fields?.summary || "(no summary)",
            status: issue.fields?.status?.name || "Unknown",
          };
          if (validatedFieldId && validatedFieldId !== "summary" && validatedFieldId !== "status" && issue.fields?.[validatedFieldId] != null) {
            const raw = extractFieldDisplayValue(issue.fields[validatedFieldId]);
            if (raw) {
              result[validatedFieldId] = raw.substring(0, 500);
            }
          }
          return result;
        });
        return JSON.stringify({ total: issues.length, issues });
      } catch (error) {
        console.error("JQL search error:", error);
        return JSON.stringify({ error: `JQL search error: ${error.message}`, issues: [] });
      }
    },
  },
  get_issue_details: {
    definition: {
      type: "function",
      function: {
        name: "get_issue_details",
        description: "Get full details for a specific Jira issue. Use this to inspect field content, comments, or other metadata in depth after finding an issue via search.",
        parameters: {
          type: "object",
          properties: {
            issueKey: {
              type: "string",
              description: "The unique Jira issue key (e.g., 'PROJ-123').",
            },
          },
          required: ["issueKey"],
        },
      },
    },
    execute: async ({ issueKey }, dependencies = {}) => {
      const { api: injectedApi = api, route: injectedRoute = route } = dependencies;
      try {
        const response = await injectedApi.asApp().requestJira(
          injectedRoute`/rest/api/3/issue/${issueKey}?expand=renderedFields`,
          {
            method: "GET",
          },
        );
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Issue detail fetch failed:", response.status, errorText);
          return JSON.stringify({ error: `Failed to fetch issue ${issueKey}: ${response.status}` });
        }
        const data = await response.json();
        const result = {
          key: data.key,
          summary: data.fields?.summary,
          status: data.fields?.status?.name,
          description: data.fields?.description ? (data.fields.description.content ? "Description content is complex (ADF)" : data.fields.description) : "No description",
          reporter: data.fields?.reporter?.displayName,
          assignee: data.fields?.assignee?.displayName,
          priority: data.fields?.priority?.name,
          labels: data.fields?.labels,
          components: data.fields?.components?.map(c => c.name),
        };
        return JSON.stringify(result);
      } catch (error) {
        console.error("Issue detail fetch error:", error);
        return JSON.stringify({ error: `Error fetching issue ${issueKey}: ${error.message}` });
      }
    },
  },
  get_user_info: {
    definition: {
      type: "function",
      function: {
        name: "get_user_info",
        description: "Get details about a Jira user. Use this to verify permissions, roles, or user-specific information.",
        parameters: {
          type: "object",
          properties: {
            accountId: {
              type: "string",
              description: "The unique Jira accountId of a user.",
            },
          },
          required: ["accountId"],
        },
      },
    },
    execute: async ({ accountId }, dependencies = {}) => {
      const { api: injectedApi = api, route: injectedRoute = route } = dependencies;
      try {
        const response = await injectedApi.asApp().requestJira(
          injectedRoute`/rest/api/3/user?accountId=${accountId}`,
          {
            method: "GET",
          },
        );
        if (!response.ok) {
          const errorText = await response.text();
          console.error("User fetch failed:", response.status, errorText);
          return JSON.stringify({ error: `Failed to fetch user ${accountId}: ${response.status}` });
        }
        const data = await response.json();
        return JSON.stringify({
          accountId: data.accountId,
          displayName: data.displayName,
          emailAddress: data.emailAddress,
          active: data.active,
        });
      } catch (error) {
        console.error("User fetch error:", error);
        return JSON.stringify({ error: `Error fetching user ${accountId}: ${error.message}` });
      }
    },
  },
  get_project_details: {
    definition: {
      type: "function",
      function: {
        name: "get_project_details",
        description: "Get details about a Jira project. Use this to verify project-specific settings, lead, or description.",
        parameters: {
          type: "object",
          properties: {
            projectKey: {
              type: "string",
              description: "The unique Jira project key (e.g., 'PROJ').",
            },
          },
          required: ["projectKey"],
        },
      },
    },
    execute: async ({ projectKey }, dependencies = {}) => {
      const { api: injectedApi = api, route: injectedRoute = route } = dependencies;
      try {
        const response = await injectedApi.asApp().requestJira(
          injectedRoute`/rest/api/3/project/${projectKey}`,
        );
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Project fetch failed:", response.status, errorText);
          return JSON.stringify({ error: `Failed to fetch project ${projectKey}: ${response.status}` });
        }
        const data = await response.json();
        const result = {
          key: data.key,
          name: data.name,
          lead: data.lead?.displayName,
          projectTypeKey: data.projectTypeKey,
          description: data.description,
        };
        return JSON.stringify(result);
      } catch (error) {
        console.error("Project fetch failed:", error.message);
        return JSON.stringify({ error: "Failed to fetch project details" });
      }
    },
  },
};

/**
 * Call OpenAI API to validate text against a prompt (Simple version, no tools)
 */
export const callOpenAI = async (fieldValue, validationPrompt, attachmentParts = []) => {
  const apiKey = await getOpenAIKey();
  const model = await getOpenAIModel();

  if (!apiKey) {
    console.error("OpenAI API key not configured");
    return {
      isValid: false,
      reason: "AI validation not configured. Please set OPENAI_API_KEY environment variable.",
    };
  }

  const hasAttachments = attachmentParts && attachmentParts.length > 0;

  const systemPrompt = hasAttachments
    ? `You are a validation assistant. Your job is to validate content (text, documents, images, and attachments) against specific criteria.
You must respond with ONLY a JSON object in this exact format:
{"isValid": true, "reason": "Brief explanation"}
or
{"isValid": false, "reason": "Brief explanation of why validation failed"}

When validating attachments, analyze the actual content of each file or image provided.
Do not include any other text, markdown, or explanation outside the JSON object.`
    : `You are a validation assistant. Your job is to validate text content against specific criteria.
You must respond with ONLY a JSON object in this exact format:
{"isValid": true, "reason": "Brief explanation"}
or
{"isValid": false, "reason": "Brief explanation of why validation failed"}

Do not include any other text, markdown, or explanation outside the JSON object.`;

  let userContent;
  if (hasAttachments) {
    const textPart = {
      type: "text",
      text: `Validate the following content against the given criteria.\n\nVALIDATION CRITERIA:\n${validationPrompt}\n\n${fieldValue ? `ADDITIONAL TEXT CONTEXT:\n${fieldValue}\n\n` : ""}The attached files/images are the primary content to validate.\n\nRespond with JSON only when you have your final answer.`,
    };
    userContent = [textPart, ...attachmentParts];
  } else {
    userContent = `Validate the following text against the given criteria.\n\nVALIDATION CRITERIA:\n${validationPrompt}\n\nTEXT TO VALIDATE:\n${fieldValue || "(empty)"}\n\nRespond with JSON only when you have your final answer.`;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return { isValid: false, reason: `AI service error: ${response.status}` };
    }

    const data = await response.json();
    const message = data.choices[0]?.message;

    if (!message) {
      return { isValid: false, reason: "Empty response from AI service" };
    }

    const content = message.content?.trim();
    if (content) {
      try {
        const result = JSON.parse(content);
        return {
          isValid: result.isValid === true,
          reason: result.reason || "No reason provided",
        };
      } catch (e) {
        return { isValid: false, reason: content };
      }
    }

    return { isValid: false, reason: "No content in AI response" };
  } catch (error) {
    console.error("Error in callOpenAI:", error);
    return { isValid: false, reason: `Error: ${error.message}` };
  }
};

/**
 * Call OpenAI API with tools (Agentic version)
 */
export const callOpenAIWithTools = async (
  fieldValue,
  validationPrompt,
  attachmentParts,
  issueSummary,
  projectKey,
  fieldId,
  deadline,
  dependencies = {}
) => {
  const {
    fetch: injectedFetch = fetch,
  } = dependencies;

  const model = dependencies.model || await getOpenAIModel();
  const apiKey = dependencies.apiKey || await getOpenAIKey();

  if (!apiKey) {
    console.error("OpenAI API key not configured");
    return {
      isValid: false,
      reason: "AI validation not configured. Please set OPENAI_API_KEY environment variable.",
    };
  }

  const hasAttachments = attachmentParts && attachmentParts.length > 0;

  const systemPrompt = hasAttachments
    ? `You are a validation assistant. Your job is to validate content (text, documents, images, and attachments) against specific criteria.
You must respond with ONLY a JSON object in this exact format:
{"isValid": true, "reason": "Brief explanation"}
or
{"isValid": false, "reason": "Brief explanation of why validation failed"}

When validating attachments, analyze the actual content of each file or image provided.
Do not include any other text, markdown, or explanation outside the JSON object.`
    : `You are a validation assistant. Your job is to validate text content against specific criteria.
You must respond with ONLY a JSON object in this exact format:
{"isValid": true, "reason": "Brief explanation"}
or
{"isValid": false, "reason": "Brief explanation of why validation failed"}

Do not include any other text, markdown, or explanation outside the JSON object.`;

  // Build user message content — multimodal when attachments are present
  let userContent;
  if (hasAttachments) {
    const textPart = {
      type: "text",
      text: `Validate the following content against the given criteria.\n\nVALIDATION CRITERIA:\n${validationPrompt}\n\n${fieldValue ? `ADDITIONAL TEXT CONTEXT:\n${fieldValue}\n\n` : ""}The attached files/images are the primary content to validate.\n\nRespond with JSON only when you have your final answer.`,
    };
    userContent = [textPart, ...attachmentParts];
  } else {
    userContent = `Validate the following text against the given criteria.\n\nVALIDATION CRITERIA:\n${validationPrompt}\n\nTEXT TO VALIDATE:\n${fieldValue || "(empty)"}\n\nRespond with JSON only when you have your final answer.`;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  // Observability: track tool usage across the loop
  const toolMeta = {
    toolsUsed: false,
    toolRounds: 0,
    queries: [],
    totalResults: 0,
  };

  // Agentic loop: up to MAX_TOOL_ROUNDS tool-call iterations + 1 final answer iteration
  const currentDeadline = deadline || (Date.now() + AGENTIC_TIMEOUT_MS);

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // Timeout check
    if (Date.now() >= currentDeadline) {
      console.log(`Agentic validation timed out at round ${round}`);
      return {
        isValid: true,
        reason: "Validation timed out while gathering context. Transition allowed.",
        toolMeta,
      };
    }

    try {
      const requestBody = {
        model,
        messages,
        max_completion_tokens: 1000,
      };

      // Offer tools only if we haven't exhausted tool-call rounds
      if (round < MAX_TOOL_ROUNDS) {
        requestBody.tools = Object.values(TOOL_REGISTRY).map(tool => ({
          type: "function",
          function: tool.definition
        }));
        requestBody.tool_choice = "auto";
      }
      
      // This is where we actually call the API
      const response = await injectedFetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI API error:", response.status, errorText);
        return {
          isValid: false,
          reason: `AI service error: ${response.status}`,
          toolMeta,
        };
      }

      const data = await response.json();
      const message = data.choices[0]?.message;

      if (!message) {
        return {
          isValid: false,
          reason: "Empty response from AI service",
          toolMeta,
        };
      }

      // Handle tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        toolMeta.toolsUsed = true;
        toolMeta.toolRounds++;
        
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          console.log(`Agentic Tool Call: ${toolName}`, toolArgs);
          
          const tool = TOOL_REGISTRY[toolName];
          if (!tool) {
            console.error(`Unknown tool: ${toolName}`);
            continue;
          }

          // Inject validatedFieldId into tool execution if needed
          const result = await tool.execute({ ...toolArgs, validatedFieldId: fieldId }, fieldId, dependencies);
          
          messages.push({
            role: "assistant",
            content: message.content || "",
            tool_calls: [toolCall],
          });
          
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });

          toolMeta.queries.push({ name: toolName, args: toolArgs, result });
          toolMeta.totalResults++;
        }
        // Continue loop for next round of reasoning
        continue;
      }

      // No tool calls, handle final answer
      const content = message.content?.trim();
      if (content) {
        try {
          const result = JSON.parse(content);
          return {
            isValid: result.isValid === true,
            reason: result.reason || "No reason provided",
            toolMeta,
          };
        } catch (e) {
          // If it's not JSON, it might be a plain text response
          return {
            isValid: false,
            reason: content,
            toolMeta,
          };
        }
      }

      return {
        isValid: false,
        reason: "No content in AI response",
        toolMeta,
      };
    } catch (error) {
      console.error("Error in agentic loop:", error);
      return {
        isValid: false,
        reason: `Agentic error: ${error.message}`,
        toolMeta,
      };
    }
  }
};
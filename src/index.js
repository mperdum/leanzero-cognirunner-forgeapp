/*
 * CogniRunner - AI-powered workflow validation for Jira
 * Copyright (C) 2025 LeanZero
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import Resolver from "@forge/resolver";
import api, { route, storage } from '@forge/api';
import promptsModule from "./integration/prompts/index.js";

// Import validator module
import { 
  callOpenAI, 
  callOpenAIWithTools,
  getOpenAIKey,
  getOpenAIModel,
  promptRequiresTools,
  TOOL_TRIGGER_PATTERN,
  extractFieldDisplayValue,
  downloadAttachment,
  buildAttachmentContentParts,
  FILE_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_ATTACHMENT_SIZE,
  MAX_TOTAL_ATTACHMENT_SIZE
} from "./core/validator/index.js";

// Import post function modules
import { executeSemanticPostFunction, getFieldValue } from "./core/post-function/semantic.js";
import { executeStaticCodeSandbox } from "./core/post-function/static.js";

// Import JIRA API helpers
import {
  formatField,
  sortFields,
  getFallbackFields,
  FIELDS_UNAVAILABLE_ON_CREATE,
  fetchProjectsForWorkflow,
  fetchWorkflowTransitions,
} from "./integration/jira-api/index.js";

// Import config module
import { storeLog, LOGS_STORAGE_KEY, CONFIG_REGISTRY_KEY } from "./core/config/registry.js";
import { MAX_LOGS } from "./core/config/logger.js";

// App ID for rule identification in Jira workflows
const APP_ID = "36415848-6868-4697-9554-3c3ad87b8da9";

// Backward compatibility aliases for prompts
export const JIRA_PROMPTS = promptsModule.JIRA_PROMPTS;
export const issues = promptsModule.issues;
export const projects = promptsModule.projects;
export const users = promptsModule.users;
export const groups = promptsModule.groups;
export const workflows = promptsModule.workflows;
export const fieldConfigs = promptsModule.fieldConfigs;
export const screens = promptsModule.screens;
export const customFields = promptsModule.customFields;
export const statusesResolutions = promptsModule.statusesResolutions;
export const issueTypes = promptsModule.issueTypes;
export const security = promptsModule.security;
export const notifications = promptsModule.notifications;
export const permissions = promptsModule.permissions;
export const automation = promptsModule.automation;
export const attachmentsVersions = promptsModule.attachmentsVersions;

export const calculateSimilarity = promptsModule.calculateSimilarity;
export const searchPrompts = promptsModule.searchPrompts;
export const buildJqlFromIntent = promptsModule.buildJqlFromIntent;

// Backward compatibility functions
const matchPrompt = (userQuery, prompts = JIRA_PROMPTS) => {
  return getMatchResult(userQuery, prompts);
};

const getMatchResult = (userQuery, prompts) => {
  if (!userQuery || typeof userQuery !== 'string') return [];
  
  const queryLower = userQuery.toLowerCase().trim();
  const results = [];
  
  for (const [key, prompt] of Object.entries(prompts)) {
    let maxKeywordScore = 0;
    let matchedKeywords = [];
    
    for (const keyword of prompt.keywords || []) {
      const score = calculateSimilarity(queryLower, keyword);
      if (score > maxKeywordScore) {
        maxKeywordScore = score;
        if (score >= 0.5) matchedKeywords.push(keyword);
      }
      
      if (queryLower.includes(keyword)) {
        maxKeywordScore = Math.max(maxKeywordScore, 0.8 + (keyword.length / queryLower.length));
      }
    }
    
    let endpointBonus = 0;
    const endpointPath = prompt.endpoint.replace('{id}', '').replace('{fieldId}', '').replace('{tabId}', '');
    if (queryLower.includes(endpointPath.replace('/rest/api/3/', ''))) {
      endpointBonus = 0.2;
    }
    
    const finalScore = Math.min(1.0, maxKeywordScore + endpointBonus);
    
    if (finalScore >= 0.4) {
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
  
  return results.sort((a, b) => b.score - a.score);
};

const getPromptById = (promptId, prompts = JIRA_PROMPTS) => {
  return prompts[promptId] || null;
};

const getAllCategories = (prompts = JIRA_PROMPTS) => {
  return [...new Set(Object.values(prompts).map(p => p.category))];
};

const getPromptsByCategory = (category, prompts = JIRA_PROMPTS) => {
  return Object.values(prompts).filter(p => p.category === category);
};

const storePrompts = async (key = 'jira_prompts') => {
  try {
    await storage.set(key, JIRA_PROMPTS);
    console.log(`Stored ${Object.keys(JIRA_PROMPTS).length} prompts in KVS`);
  } catch (error) {
    console.error('Failed to store prompts:', error);
  }
};

const loadPrompts = async (key = 'jira_prompts') => {
  try {
    const stored = await storage.get(key);
    if (stored) {
      console.log(`Loaded ${Object.keys(stored).length} prompts from KVS`);
      return stored;
    }
    
    await storePrompts(key);
    return JIRA_PROMPTS;
  } catch (error) {
    console.error('Failed to load prompts, using defaults:', error);
    return JIRA_PROMPTS;
  }
};

/**
 * Post Function Internal Executor
 */
const executePostFunctionInternal = async ({ issueKey, config, dryRun = false, context = {}, changelog, transition, workflow }) => {
  console.log(`executePostFunctionInternal: issueKey=${issueKey}, type=${config?.type}, dryRun=${dryRun}`);

  try {
    if (context?.license && context.license.isActive === false) {
      console.log("License inactive — skipping post function execution");
      return { success: true, skipped: true, reason: "License inactive" };
    }

    let postFunctionConfig = config;
    if (!config.code && !config.conditionPrompt && config.id) {
      const configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
      const loadedConfig = configs.find((c) => c.id === config.id);
      if (!loadedConfig) {
        return { success: false, error: "Post function configuration not found" };
      }
      postFunctionConfig = loadedConfig;
    }

    const { type, code, conditionPrompt, actionPrompt, actionFieldId } = postFunctionConfig;
    const fieldId = postFunctionConfig.fieldId || actionFieldId;
    const issueContext = { key: issueKey, modifiedFields: postFunctionConfig.modifiedFields || null };

    if (type === "postfunction-semantic") {
      return await executeSemanticPostFunction({ 
        issueContext, 
        conditionPrompt, 
        actionPrompt, 
        fieldId,
        actionFieldId, 
        dryRun,
        changelog,
        transition,
        workflow
      });
    }

    if (type === "postfunction-static") {
      return await executeStaticCodeSandbox({ issueContext, code, dryRun, simulationMode: !dryRun, changelog, transition, workflow });
    }

    return { success: false, error: `Unknown post function type: ${type}` };
  } catch (error) {
    console.error("executePostFunctionInternal error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Post Function Execution Handler
 */
export const executePostFunction = async (args) => {
  console.log("AI Post Function called:", JSON.stringify(args, null, 2));

  const { issue, configuration, changelog, transition, workflow } = args;
  const license = args?.context?.license;

  if (license && license.isActive === false) {
    console.log("License inactive — skipping");
    return { result: true };
  }

  const result = await executePostFunctionInternal({
    issueKey: issue.key,
    config: configuration || {},
    dryRun: configuration?.dryRun === true,
    context: args.context,
    changelog,
    transition,
    workflow,
  });

  if (!result.success) {
    console.error("Post function failed:", result.error);
    return { result: true, message: `Failed: ${result.error}` };
  }

  if (result.skipped) {
    console.log(`Post function skipped: ${result.reason}`);
    return { result: true };
  }

  if (result.dryRun) {
    console.log(`Dry run completed: ${JSON.stringify(result.changes)}`);
    return { result: true, message: `Dry run: ${JSON.stringify(result.changes)}` };
  }

  console.log(`Post function completed: ${JSON.stringify(result.changes)}`);
  return { result: true };
};

/**
 * Workflow Validator / Condition function
 */
export const validate = async (args) => {
  console.log("AI Validator called with args:", JSON.stringify(args, null, 2));

  const { issue, configuration, modifiedFields } = args;
  const license = args?.context?.license;

  if (license && license.isActive === false) {
    console.log("License inactive — skipping AI validation (fail open)");
    return { result: true };
  }

  try {
    const configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const matchingConfig = configs.find((c) =>
      c.fieldId === (configuration?.fieldId || process.env.VALIDATE_FIELD_ID || "description")
      && c.disabled === true
    );
    if (matchingConfig) {
      console.log(`Rule "${matchingConfig.id}" is disabled in KVS — skipping AI validation`);
      return { result: true };
    }
  } catch (e) {
    console.log("Could not check disabled status, proceeding with validation:", e);
  }

  const fieldId = configuration?.fieldId || process.env.VALIDATE_FIELD_ID || "description";
  const validationPrompt = configuration?.prompt || process.env.VALIDATION_PROMPT || "The text must be clear, professional, and contain sufficient detail. Reject if it is empty, too vague, or contains inappropriate content.";

  const enableTools = configuration?.enableTools;
  const useTools = enableTools === true || (enableTools !== false && promptRequiresTools(validationPrompt));

  let projectKey = null;
  if (issue.key) {
    const dashIndex = issue.key.indexOf("-");
    if (dashIndex > 0) projectKey = issue.key.substring(0, dashIndex);
  } else if (modifiedFields?.project?.key) {
    projectKey = modifiedFields.project.key;
  }

  const deadline = useTools ? Date.now() + 22000 : 0;
  const issueContext = useTools
    ? (issue.key ? `Issue: ${issue.key}` : "New issue (being created)")
    : "";

  console.log(`Validating field "${fieldId}" with prompt: ${validationPrompt.substring(0, 50)}... (tools: ${useTools ? "enabled" : "disabled"})`);

  if (fieldId === "attachment" && !issue.key) {
    console.log("Attachment validation skipped on CREATE — field not available until issue exists");
    return { result: true };
  }

  let validationResult;
  let logFieldValue = "";
  
  if (fieldId === "attachment" && issue.key) {
    let attachments = [];
    try {
      const issueResponse = await api.asApp().requestJira(route`/rest/api/3/issue/${issue.key}?fields=attachment`);
      if (issueResponse.ok) {
        const issueData = await issueResponse.json();
        attachments = issueData.fields?.attachment || [];
      }
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }

    if (attachments.length === 0) {
      logFieldValue = "(no attachments)";
      validationResult = useTools
        ? await callOpenAIWithTools("(no attachments)", validationPrompt, undefined, issueContext, projectKey, fieldId, deadline)
        : await callOpenAI("(no attachments)", validationPrompt);
    } else {
      const summary = attachments.map((a) => `${a.filename} (${Math.round((a.size || 0) / 1024)}KB, ${a.mimeType})`).join("; ");
      logFieldValue = summary;
      console.log(`Attachments: ${summary}`);

      // Filter to processable attachments within total size budget
      let totalBudget = MAX_TOTAL_ATTACHMENT_SIZE;
      const toDownload = [];
      for (const att of attachments) {
        const size = att.size || 0;
        if (size > MAX_ATTACHMENT_SIZE) continue;
        const mime = (att.mimeType || "").toLowerCase();
        if (!FILE_MIME_TYPES.has(mime) && !IMAGE_MIME_TYPES.has(mime)) continue;
        if (size > totalBudget) {
          console.log(`Attachment "${att.filename}" (${Math.round(size / 1024)}KB) exceeds remaining budget, skipping`);
          continue;
        }
        totalBudget -= size;
        toDownload.push(att);
      }

      // Download attachment contents in parallel
      const downloads = await Promise.all(toDownload.map(downloadAttachment));
      const downloadedAttachments = downloads.filter((d) => d !== null);

      console.log(`Successfully downloaded ${downloadedAttachments.length} of ${toDownload.length} attachments`);

      // Build OpenAI message content parts from downloaded files
      const attachmentParts = buildAttachmentContentParts(downloadedAttachments);
      console.log(`Built ${attachmentParts.length} attachment content parts for OpenAI`);

      validationResult = useTools
        ? await callOpenAIWithTools("", validationPrompt, attachmentParts, issueContext, projectKey, fieldId, deadline)
        : await callOpenAI("", validationPrompt, attachmentParts);
    }
  } else {
    const fieldValue = await getFieldValue(issue.key, fieldId, modifiedFields);
    logFieldValue = fieldValue || "";
    validationResult = useTools
      ? await callOpenAIWithTools(fieldValue, validationPrompt, undefined, issueContext, projectKey, fieldId, deadline)
      : await callOpenAI(fieldValue, validationPrompt);
  }

  console.log("Validation result:", validationResult);

  const logEntry = {
    issueKey: issue.key || "(new issue)",
    fieldId,
    fieldValue: String(logFieldValue || "").substring(0, 200),
    prompt: validationPrompt.substring(0, 100),
    isValid: validationResult.isValid,
    reason: validationResult.reason,
  };
  
  if (validationResult.toolMeta) {
    logEntry.toolMeta = {
      toolsUsed: validationResult.toolMeta.toolsUsed,
      toolRounds: validationResult.toolMeta.toolRounds,
      queries: validationResult.toolMeta.queries.map((q) => q.substring(0, 150)),
      totalResults: validationResult.toolMeta.totalResults,
    };
  }
  
  await storeLog(logEntry);

  if (validationResult.isValid) {
    return { result: true };
  } else {
    return { result: false, errorMessage: `AI Validation failed: ${validationResult.reason}` };
  }
};

// === Resolver definitions (business logic only) ===

resolver.define("getJiraPrompts", async () => {
  try {
    const prompts = await loadPrompts();
    return { success: true, prompts };
  } catch (error) {
    console.error("Failed to get JIRA prompts:", error);
    return { success: false, error: error.message, prompts: {} };
  }
});

resolver.define("searchJiraPrompts", async ({ payload }) => {
  try {
    const { query, category } = payload || {};
    const allPrompts = await loadPrompts();
    
    let results = searchPrompts(query, allPrompts);
    
    if (category && category !== 'all') {
      results = results.filter(p => p.category === category);
    }
    
    return { success: true, results };
  } catch (error) {
    console.error("Failed to search JIRA prompts:", error);
    return { success: false, error: error.message, results: [] };
  }
});

resolver.define("getJiraPromptById", async ({ payload }) => {
  try {
    const { promptId } = payload || {};
    const allPrompts = await loadPrompts();
    const prompt = getPromptById(promptId, allPrompts);
    
    return { success: !!prompt, prompt };
  } catch (error) {
    console.error("Failed to get JIRA prompt by ID:", error);
    return { success: false, error: error.message, prompt: null };
  }
});

resolver.define("getJiraCategories", async () => {
  try {
    const allPrompts = await loadPrompts();
    const categories = getAllCategories(allPrompts);
    
    return { success: true, categories };
  } catch (error) {
    console.error("Failed to get JIRA prompt categories:", error);
    return { success: false, error: error.message, categories: [] };
  }
});

resolver.define("checkLicense", ({ context }) => {
  if (!context?.license) {
    return { isActive: null };
  }
  return { isActive: context.license.isActive === true };
});

resolver.define("getLogs", async () => {
  try {
    const logs = (await storage.get(LOGS_STORAGE_KEY)) || [];
    return { success: true, logs };
  } catch (error) {
    console.error("Failed to get logs:", error);
    return { success: false, error: error.message, logs: [] };
  }
});

resolver.define("clearLogs", async () => {
  try {
    await storage.set(LOGS_STORAGE_KEY, []);
    return { success: true };
  } catch (error) {
    console.error("Failed to clear logs:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("registerConfig", async ({ payload }) => {
  try {
    const { id, type, fieldId, prompt, workflow } = payload;
    if (!id || !fieldId) {
      return { success: false, error: "Missing required fields" };
    }

    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const now = new Date().toISOString();

    const wf = workflow || {};
    const workflowData = {};
    if (wf.workflowId) workflowData.workflowId = wf.workflowId;
    if (wf.workflowName) workflowData.workflowName = wf.workflowName;
    if (wf.projectId) workflowData.projectId = wf.projectId;
    if (wf.transitionId) workflowData.transitionId = wf.transitionId;
    if (wf.transitionFromName) workflowData.transitionFromName = wf.transitionFromName;
    if (wf.transitionToName) workflowData.transitionToName = wf.transitionToName;
    if (wf.siteUrl) workflowData.siteUrl = wf.siteUrl;

    let existingIndex = configs.findIndex((c) => c.id === id);
    if (existingIndex < 0 && workflowData.workflowName && workflowData.transitionId) {
      existingIndex = configs.findIndex((c) =>
        c.workflow?.workflowName === workflowData.workflowName
        && String(c.workflow?.transitionId) === String(workflowData.transitionId)
      );
    }

    if (existingIndex >= 0) {
      configs[existingIndex] = {
        ...configs[existingIndex],
        id,
        type: type || configs[existingIndex].type,
        fieldId,
        prompt: (prompt || "").substring(0, 200),
        workflow: Object.keys(workflowData).length > 0
          ? workflowData
          : configs[existingIndex].workflow,
        updatedAt: now,
      };
    } else {
      configs.push({
        id,
        type: type || "validator",
        fieldId,
        prompt: (prompt || "").substring(0, 200),
        workflow: Object.keys(workflowData).length > 0 ? workflowData : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true };
  } catch (error) {
    console.error("Failed to register config:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("removeConfig", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    configs = configs.filter((c) => c.id !== id);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true };
  } catch (error) {
    console.error("Failed to remove config:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("disableRule", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const config = configs.find((c) => c.id === id);
    if (!config) {
      return { success: false, error: "Config not found in registry" };
    }
    configs = configs.map((c) => c.id === id ? { ...c, disabled: true, updatedAt: new Date().toISOString() } : c);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true, disabled: true };
  } catch (error) {
    console.error("Failed to disable rule:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("enableRule", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const config = configs.find((c) => c.id === id);
    if (!config) {
      return { success: false, error: "Config not found in registry" };
    }
    configs = configs.map((c) => c.id === id ? { ...c, disabled: false, updatedAt: new Date().toISOString() } : c);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true, disabled: false };
  } catch (error) {
    console.error("Failed to enable rule:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("registerPostFunction", async ({ payload }) => {
  try {
    const { id, type, fieldId, conditionPrompt, actionPrompt, code, workflow } = payload;
    if (!id || !type) {
      return { success: false, error: "Missing required fields" };
    }

    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const now = new Date().toISOString();

    const wf = workflow || {};
    const workflowData = {};
    if (wf.workflowId) workflowData.workflowId = wf.workflowId;
    if (wf.workflowName) workflowData.workflowName = wf.workflowName;
    if (wf.projectId) workflowData.projectId = wf.projectId;
    if (wf.transitionId) workflowData.transitionId = wf.transitionId;
    if (wf.transitionFromName) workflowData.transitionFromName = wf.transitionFromName;
    if (wf.transitionToName) workflowData.transitionToName = wf.transitionToName;
    if (wf.siteUrl) workflowData.siteUrl = wf.siteUrl;

    let existingIndex = configs.findIndex((c) => c.id === id);
    if (existingIndex < 0 && workflowData.workflowName && workflowData.transitionId) {
      existingIndex = configs.findIndex((c) =>
        c.workflow?.workflowName === workflowData.workflowName
        && String(c.workflow?.transitionId) === String(workflowData.transitionId)
      );
    }

    if (existingIndex >= 0) {
      configs[existingIndex] = {
        ...configs[existingIndex],
        id,
        type: type || configs[existingIndex].type,
        fieldId,
        conditionPrompt: (conditionPrompt || "").substring(0, 500),
        actionPrompt: (actionPrompt || "").substring(0, 500),
        code: (code || "").substring(0, 10000),
        workflow: Object.keys(workflowData).length > 0 ? workflowData : configs[existingIndex].workflow,
        updatedAt: now,
      };
    } else {
      configs.push({
        id,
        type: type || "postfunction-semantic",
        fieldId,
        conditionPrompt: (conditionPrompt || "").substring(0, 500),
        actionPrompt: (actionPrompt || "").substring(0, 500),
        code: (code || "").substring(0, 10000),
        workflow: Object.keys(workflowData).length > 0 ? workflowData : undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true };
  } catch (error) {
    console.error("Failed to register post function:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("removePostFunction", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    configs = configs.filter((c) => c.id !== id);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true };
  } catch (error) {
    console.error("Failed to remove post function:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("disablePostFunction", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const config = configs.find((c) => c.id === id);
    if (!config) {
      return { success: false, error: "Config not found in registry" };
    }
    configs = configs.map((c) => c.id === id ? { ...c, disabled: true, updatedAt: new Date().toISOString() } : c);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true, disabled: true };
  } catch (error) {
    console.error("Failed to disable post function:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("enablePostFunction", async ({ payload }) => {
  try {
    const { id } = payload;
    let configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const config = configs.find((c) => c.id === id);
    if (!config) {
      return { success: false, error: "Config not found in registry" };
    }
    configs = configs.map((c) => c.id === id ? { ...c, disabled: false, updatedAt: new Date().toISOString() } : c);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true, disabled: false };
  } catch (error) {
    console.error("Failed to enable post function:", error);
    return { success: false, error: error.message };
  }
});

resolver.define("getPostFunctionStatus", async ({ payload }) => {
  try {
    const { id } = payload;
    const configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    const config = configs.find((c) => c.id === id);
    if (config) {
      return { found: true, disabled: config.disabled === true, registryId: config.id };
    }
    return { found: false, disabled: false, registryId: null };
  } catch (error) {
    console.error("Failed to get post function status:", error);
    return { found: false, disabled: false, registryId: null };
  }
});

resolver.define("getConfigs", async () => {
  try {
    const configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];
    if (configs.length === 0) {
      return { success: true, configs: [], removedCount: 0 };
    }

    const workflowCache = new Map();
    const surviving = [];
    const removed = [];
    let hadApiError = false;

    for (const config of configs) {
      const wf = config.workflow || {};
      console.log(`getConfigs orphan check: id="${config.id}", workflowName="${wf.workflowName}", transitionId="${wf.transitionId}"`);

      if (!wf.workflowName || !wf.transitionId) {
        surviving.push(config);
        continue;
      }

      let result = workflowCache.get(wf.workflowName);
      if (!result) {
        result = await fetchWorkflowTransitions(wf.workflowName);
        workflowCache.set(wf.workflowName, result);
      }

      if (result.error || !result.transitionRules) {
        hadApiError = true;
        surviving.push(config);
        continue;
      }

      const transitionData = result.transitionRules.get(String(wf.transitionId));
      if (!transitionData) {
        removed.push(config);
      } else {
        const ruleList = config.type === "condition"
          ? transitionData.conditions
          : transitionData.validators;
        const hasOurRule = ruleList.some((r) =>
          r.parameters?.key && r.parameters.key.includes(APP_ID)
        );
        if (hasOurRule) {
          surviving.push(config);
        } else {
          removed.push(config);
        }
      }
    }

    if (removed.length > 0) {
      await storage.set(CONFIG_REGISTRY_KEY, surviving);
    }

    return { success: true, configs: surviving, removedCount: removed.length };
  } catch (error) {
    console.error("Failed to get configs:", error);
    return { success: false, error: error.message, configs: [] };
  }
});

resolver.define("getRuleStatus", async ({ payload }) => {
  try {
    const { id, fieldId, prompt } = payload;
    const configs = (await storage.get(CONFIG_REGISTRY_KEY)) || [];

    if (id) {
      const config = configs.find((c) => c.id === id);
      if (config) {
        return { found: true, disabled: config.disabled === true, registryId: config.id };
      }
    }

    if (fieldId && prompt) {
      const config = configs.find((c) => c.fieldId === fieldId && c.prompt === prompt);
      if (config) {
        return { found: true, disabled: config.disabled === true, registryId: config.id };
      }
    }

    return { found: false, disabled: false, registryId: null };
  } catch (error) {
    console.error("Failed to get rule status:", error);
    return { found: false, disabled: false, registryId: null };
  }
});

resolver.define("getScreenFields", async ({ payload }) => {
  const { projectId: directProjectId, workflowId, transitionId } = payload;
  const isCreateTransition = String(transitionId) === "1";

  let projectId = directProjectId;
  if (!projectId && workflowId) {
    const projectIds = await fetchProjectsForWorkflow(workflowId);
    if (projectIds && projectIds.length > 0) {
      projectId = projectIds[0];
    }
  }

  if (!projectId) {
    return await getFallbackFields(isCreateTransition);
  }

  try {
    // Use JIRA API helpers
    const itsScheme = await fetchWorkflowTransitions(""); // Simplified for now
    
    // This would be implemented with the actual screen resolution logic
    return await getFallbackFields(isCreateTransition);
  } catch (error) {
    console.log("Screen-based field resolution failed:", error.message);
    return await getFallbackFields(isCreateTransition);
  }
});

resolver.define("getFields", async () => {
  try {
    const response = await api.asApp().requestJira(route`/rest/api/3/field`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch fields: ${response.status}`,
        fields: [],
      };
    }

    const allFields = await response.json();
    const fields = allFields.map(formatField);

    return { success: true, fields: sortFields(fields) };
  } catch (error) {
    console.error("Failed to get fields:", error);
    return { success: false, error: error.message, fields: [] };
  }
});

// Export the handler with all resolver definitions
export const handler = resolver.getDefinitions();
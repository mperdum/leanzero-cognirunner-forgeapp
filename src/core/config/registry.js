/*
 * Config Registry Module - Handles config storage and management in KVS
 * Improves duplicate handling with smarter merge strategies and conflict resolution
 */

import { LOGS_STORAGE_KEY, storeLog } from './logger.js';

// Re-export logger utilities for external access
export { LOGS_STORAGE_KEY, storeLog };

// Configuration
export const CONFIG_REGISTRY_KEY = "config_registry";

/**
 * Get all configs from storage
 */
export const getConfigs = async () => {
  try {
    return (await storage.get(CONFIG_REGISTRY_KEY)) || [];
  } catch (error) {
    console.error("Failed to get configs:", error);
    return [];
  }
};

/**
 * Resolve duplicate configs based on priority rules
 * - Higher ID wins (newer config)
 * - More complete workflow context wins
 */
export const resolveDuplicateConfigs = (configs) => {
  const byId = new Map();
  
  for (const config of configs) {
    if (!config.id) continue;
    
    const existing = byId.get(config.id);
    if (!existing) {
      byId.set(config.id, config);
    } else {
      // Priority scoring: more fields = higher priority
      const existingScore = Object.keys(existing).length + (existing.workflow ? 5 : 0);
      const newScore = Object.keys(config).length + (config.workflow ? 5 : 0);
      
      if (newScore > existingScore) {
        byId.set(config.id, config);
        console.log(`Resolved duplicate for ${config.id}: keeping newer/more complete config`);
      } else {
        console.log(`Resolved duplicate for ${config.id}: keeping existing config`);
      }
    }
  }
  
  return Array.from(byId.values());
};

/**
 * Register a validator/condition config in the registry
 * Called from config-ui when a rule is saved
 * 
 * Duplicate handling:
 * - If same ID exists: merge/update with priority to new config
 * - If same workflow+field combination exists: merge or replace based on type
 */
export const registerConfig = async ({ id, type, fieldId, prompt, workflow }) => {
  try {
    if (!id || !fieldId) {
      return { success: false, error: "Missing required fields" };
    }

    let configs = await getConfigs();
    const now = new Date().toISOString();

    // Build workflow context object (only store non-empty values)
    const wf = workflow || {};
    const workflowData = {};
    if (wf.workflowId) workflowData.workflowId = wf.workflowId;
    if (wf.workflowName) workflowData.workflowName = wf.workflowName;
    if (wf.projectId) workflowData.projectId = wf.projectId;
    if (wf.transitionId) workflowData.transitionId = wf.transitionId;
    if (wf.transitionFromName) workflowData.transitionFromName = wf.transitionFromName;
    if (wf.transitionToName) workflowData.transitionToName = wf.transitionToName;
    if (wf.siteUrl) workflowData.siteUrl = wf.siteUrl;

    // Match by id first; fall back to workflow context
    let existingIndex = configs.findIndex((c) => c.id === id);
    
    // Fallback match by workflow context if no ID match
    if (existingIndex < 0 && workflowData.workflowName && workflowData.transitionId) {
      existingIndex = configs.findIndex((c) =>
        c.workflow?.workflowName === workflowData.workflowName
        && String(c.workflow?.transitionId) === String(workflowData.transitionId)
        // Match by fieldId as well to avoid false positives
        && (!fieldId || !c.fieldId || c.fieldId === fieldId)
      );
    }
    
    const existingConfig = existingIndex >= 0 ? configs[existingIndex] : null;
    
    if (existingConfig) {
      // Determine conflict resolution strategy
      const isSameType = existingConfig.type === type;
      
      configs[existingIndex] = {
        ...configs[existingIndex],
        id,
        type: type || configs[existingIndex].type,
        fieldId,
        prompt: (prompt || "").substring(0, 200),
        workflow: Object.keys(workflowData).length > 0
          ? { ...configs[existingIndex].workflow, ...workflowData }
          : configs[existingIndex].workflow,
        updatedAt: now,
      };
      
      console.log(`Updated existing config ${id} (${isSameType ? 'same type' : 'type mismatch'}): ${configs[existingIndex].prompt.substring(0, 60)}...`);
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
};

/**
 * Remove a config from the registry
 */
export const removeConfig = async ({ id }) => {
  try {
    let configs = await getConfigs();
    configs = configs.filter((c) => c.id !== id);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true };
  } catch (error) {
    console.error("Failed to remove config:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Disable a workflow rule via KVS flag
 */
export const disableRule = async ({ id }) => {
  try {
    let configs = await getConfigs();
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
};

/**
 * Re-enable a previously disabled workflow rule
 */
export const enableRule = async ({ id }) => {
  try {
    let configs = await getConfigs();
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
};

/**
 * Register a post function config in the registry
 * 
 * Duplicate handling:
 * - Same ID: merge/update with priority to new config
 * - Same workflow+field combination: merge or replace based on type
 */
export const registerPostFunction = async ({ id, type, fieldId, conditionPrompt, actionPrompt, code, workflow }) => {
  try {
    if (!id || !type) {
      return { success: false, error: "Missing required fields" };
    }

    let configs = await getConfigs();
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
    
    // Fallback match by workflow context if no ID match
    if (existingIndex < 0 && workflowData.workflowName && workflowData.transitionId) {
      existingIndex = configs.findIndex((c) =>
        c.workflow?.workflowName === workflowData.workflowName
        && String(c.workflow?.transitionId) === String(workflowData.transitionId)
        && (!fieldId || !c.fieldId || c.fieldId === fieldId)
      );
    }
    
    const existingConfig = existingIndex >= 0 ? configs[existingIndex] : null;
    
    if (existingConfig) {
      // Determine conflict resolution strategy
      const isSameType = existingConfig.type === type;
      
      configs[existingIndex] = {
        ...configs[existingIndex],
        id,
        type: type || configs[existingIndex].type,
        fieldId,
        conditionPrompt: (conditionPrompt || "").substring(0, 500),
        actionPrompt: (actionPrompt || "").substring(0, 500),
        code: (code || "").substring(0, 10000),
        workflow: Object.keys(workflowData).length > 0
          ? { ...configs[existingIndex].workflow, ...workflowData }
          : configs[existingIndex].workflow,
        updatedAt: now,
      };
      
      console.log(`Updated existing post function ${id} (${isSameType ? 'same type' : 'type mismatch'}): condition="${conditionPrompt?.substring(0, 50)}..."`);
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
};

/**
 * Remove a post function config from the registry
 */
export const removePostFunction = async ({ id }) => {
  try {
    let configs = await getConfigs();
    configs = configs.filter((c) => c.id !== id);
    await storage.set(CONFIG_REGISTRY_KEY, configs);
    return { success: true };
  } catch (error) {
    console.error("Failed to remove post function:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Disable a post function rule via KVS flag
 */
export const disablePostFunction = async ({ id }) => {
  try {
    let configs = await getConfigs();
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
};

/**
 * Re-enable a post function rule via KVS flag
 */
export const enablePostFunction = async ({ id }) => {
  try {
    let configs = await getConfigs();
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
};

/**
 * Get the disabled status of a post function
 */
export const getPostFunctionStatus = async ({ id }) => {
  try {
    const configs = await getConfigs();
    const config = configs.find((c) => c.id === id);
    if (config) {
      return { found: true, disabled: config.disabled === true, registryId: config.id };
    }
    return { found: false, disabled: false, registryId: null };
  } catch (error) {
    console.error("Failed to get post function status:", error);
    return { found: false, disabled: false, registryId: null };
  }
};

/**
 * Get the disabled status of a rule from KVS
 */
export const getRuleStatus = async ({ id, fieldId, prompt }) => {
  try {
    const configs = await getConfigs();

    // Strategy 1: match by rule ID
    if (id) {
      const config = configs.find((c) => c.id === id);
      if (config) {
        return { found: true, disabled: config.disabled === true, registryId: config.id };
      }
    }

    // Strategy 2: match by fieldId + prompt content
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
};
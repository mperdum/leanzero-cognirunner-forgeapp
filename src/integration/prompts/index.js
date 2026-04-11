/*
 * JIRA Prompts Module - Main entry point for JIRA prompt functionality
 */

import { storage } from '@forge/kvs';

// Import all category modules
import { issues } from './categories/issues.js';
import { projects } from './categories/projects.js';
import { users } from './categories/users.js';
import { groups } from './categories/groups.js';
import { workflows } from './categories/workflows.js';
import { fieldConfigs } from './categories/field-configs.js';
import { screens } from './categories/screens.js';
import { customFields } from './categories/custom-fields.js';
import { statusesResolutions } from './categories/statuses-resolutions.js';
import { issueTypes } from './categories/issue-types.js';
import { security } from './categories/security.js';
import { notifications } from './categories/notifications.js';
import { permissions } from './categories/permissions.js';
import { automation } from './categories/automation.js';
import { attachmentsVersions } from './categories/attachments-versions.js';

// Export them for other modules to use
export {
  issues,
  projects,
  users,
  groups,
  workflows,
  fieldConfigs,
  screens,
  customFields,
  statusesResolutions,
  issueTypes,
  security,
  notifications,
  permissions,
  automation,
  attachmentsVersions
};

// Import helper functions
import {
  calculateSimilarity,
  searchPrompts,
  buildJqlFromIntent
} from './helpers.js';

// Re-export helper functions
export {
  calculateSimilarity,
  searchPrompts,
  buildJqlFromIntent
};

// Combined JIRA_PROMPTS object for backward compatibility
export const JIRA_PROMPTS = {
  ...issues,
  ...projects,
  ...users,
  ...groups,
  ...workflows,
  ...fieldConfigs,
  ...screens,
  ...customFields,
  ...statusesResolutions,
  ...issueTypes,
  ...security,
  ...notifications,
  ...permissions,
  ...automation,
  ...attachmentsVersions
};

// Export default with all functions for backward compatibility
export default {
  JIRA_PROMPTS,
  // Category exports
  issues,
  projects,
  users,
  groups,
  workflows,
  fieldConfigs,
  screens,
  customFields,
  statusesResolutions,
  issueTypes,
  security,
  notifications,
  permissions,
  automation,
  attachmentsVersions,
  // Helper functions
  calculateSimilarity,
  searchPrompts,
  buildJqlFromIntent,
  
  // Convenience methods for backward compatibility
  matchPrompt: (userQuery, prompts = JIRA_PROMPTS) => {
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
  },
  
  getPromptById: (promptId, prompts = JIRA_PROMPTS) => {
    return prompts[promptId] || null;
  },
  
  getAllCategories: (prompts = JIRA_PROMPTS) => {
    return [...new Set(Object.values(prompts).map(p => p.category))];
  },
  
  getPromptsByCategory: (category, prompts = JIRA_PROMPTS) => {
    return Object.values(prompts).filter(p => p.category === category);
  },
  
  storePrompts: async (key = 'jira_prompts') => {
    try {
      await storage.set(key, JIRA_PROMPTS);
      console.log(`Stored ${Object.keys(JIRA_PROMPTS).length} prompts in KVS`);
    } catch (error) {
      console.error('Failed to store prompts:', error);
    }
  },
  
  loadPrompts: async (key = 'jira_prompts') => {
    try {
      const stored = await storage.get(key);
      if (stored) {
        console.log(`Loaded ${Object.keys(stored).length} prompts from KVS`);
        return stored;
      }
      
      await storage.set(key, JIRA_PROMPTS);
      return JIRA_PROMPTS;
    } catch (error) {
      console.error('Failed to load prompts, using defaults:', error);
      return JIRA_PROMPTS;
    }
  }
};
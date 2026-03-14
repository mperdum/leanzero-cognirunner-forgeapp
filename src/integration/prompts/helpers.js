/*
 * JIRA Prompt Helper Functions - Utility functions for JIRA prompts
 */

/**
 * Calculate similarity score between two strings using Jaro-Winkler-like approach
 */
export const calculateSimilarity = (a, b) => {
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
 * Search for prompts by keyword across all categories
 */
export const searchPrompts = (searchQuery, prompts = {}) => {
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
 */
export const buildJqlFromIntent = (userQuery) => {
  if (!userQuery || typeof userQuery !== 'string') return null;
  
  const queryLower = userQuery.toLowerCase().trim();
  
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
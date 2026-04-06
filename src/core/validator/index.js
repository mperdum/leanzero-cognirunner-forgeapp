/*
 * Validator Module - Main entry point for validation functionality
 */

// Export everything from openai-client.js
export * from './openai-client.js';

// Also export some constants directly here (to avoid duplicate re-exports)
export { MAX_TOOL_ROUNDS, AGENTIC_TIMEOUT_MS, MAX_JQL_RESULTS } from './openai-client.js';

// Export everything from attachments.js, but explicitly exclude isTestEnv to avoid conflict with openai-client.js
export { 
  MAX_ATTACHMENT_SIZE, 
  MAX_TOTAL_ATTACHMENT_SIZE, 
  FILE_MIME_TYPES, 
  IMAGE_MIME_TYPES, 
  downloadAttachment, 
  buildAttachmentContentParts, 
  processAttachments 
} from './attachments.js';

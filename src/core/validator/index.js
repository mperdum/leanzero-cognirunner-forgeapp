/*
 * Validator Module - Main entry point for validation functionality
 */

// Export all validators from openai-client.js
export { 
  getOpenAIKey, 
  getOpenAIModel, 
  promptRequiresTools,
  TOOL_TRIGGER_PATTERN,
  TOOL_REGISTRY,
  extractFieldDisplayValue,
  callOpenAI, 
  callOpenAIWithTools,
  downloadAttachment,
  buildAttachmentContentParts
} from './openai-client.js';

// Export attachment processing constants and functions
export const FILE_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

// Attachment size limits
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB per file
export const MAX_TOTAL_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB total

/**
 * Download attachment content from JIRA API
 */
const downloadAttachment = async (attachment) => {
  try {
    if (!attachment.id) {
      console.log("Attachment missing id, skipping");
      return null;
    }

    // Skip attachments that are too large
    if (attachment.size && attachment.size > MAX_ATTACHMENT_SIZE) {
      console.log(`Attachment "${attachment.filename}" too large (${Math.round(attachment.size / 1024 / 1024)}MB), skipping`);
      return null;
    }

    const mimeType = (attachment.mimeType || "").toLowerCase();

    // Only download file types that OpenAI can process
    if (!FILE_MIME_TYPES.has(mimeType) && !IMAGE_MIME_TYPES.has(mimeType)) {
      console.log(`Attachment "${attachment.filename}" has unsupported type "${mimeType}", skipping content download`);
      return null;
    }

    console.log(`Downloading attachment "${attachment.filename}" (${attachment.id}, ${mimeType})`);

    const response = await api.asApp().requestJira(
      route`/rest/api/3/attachment/content/${attachment.id}`,
    );

    if (!response.ok) {
      console.error(`Failed to download attachment ${attachment.id}:`, response.status);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      base64,
      mimeType,
      filename: attachment.filename || `attachment_${attachment.id}`,
    };
  } catch (error) {
    console.error(`Error downloading attachment "${attachment.filename}":`, error);
    return null;
  }
};

/**
 * Build OpenAI message content parts from downloaded attachments.
 * Images use the image_url content type; documents use the file content type.
 */
const buildAttachmentContentParts = (downloadedAttachments) => {
  const parts = [];

  for (const att of downloadedAttachments) {
    if (!att) continue;

    if (IMAGE_MIME_TYPES.has(att.mimeType)) {
      // Vision API: image_url with base64 data URI
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${att.mimeType};base64,${att.base64}`,
          detail: "auto",
        },
      });
    } else if (FILE_MIME_TYPES.has(att.mimeType)) {
      // File content type for PDFs, DOCX, XLSX, etc.
      parts.push({
        type: "file",
        file: {
          filename: att.filename,
          file_data: `data:${att.mimeType};base64,${att.base64}`,
        },
      });
    }
  }

  return parts;
};

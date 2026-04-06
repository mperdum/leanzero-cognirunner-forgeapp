/*
 * Attachments Module - Handles JIRA attachment operations for validation
 */

import api, { route } from '@forge/api';

// For testing purposes
export const isTestEnv = process.env.NODE_ENV === 'test';

// Configuration
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_TOTAL_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * MIME types that OpenAI can process natively via the file content type
 */
export const FILE_MIME_TYPES = new Set([
  // PDFs
  "application/pdf",
  // Word documents
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  // Spreadsheets
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/tab-separated-values",
  // Plain text
  "text/plain",
  // Presentations
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);

/**
 * MIME types that OpenAI can process via the vision/image_url content type
 */
export const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/**
 * Download a Jira attachment's binary content and return as base64.
 * Returns { base64, mimeType, filename } or null on failure.
 */
export const downloadAttachment = async (attachment, dependencies = {}) => {
  const {
    api: apiDep = api,
    route: routeDep = route,
  } = dependencies;

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

    const response = await apiDep.asApp().requestJira(
      routeDep`/rest/api/3/attachment/content/${attachment.id}`,
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
 * Images use the image_url content type; text-based documents use the text content type;
 * other documents (PDF, DOCX, etc.) are handled as text if possible or skipped if not supported.
 * 
 * NOTE: OpenAI Chat Completions API does not support a "file" type in the messages array.
 * For text-based files (CSV, TXT, etc.), we use type: "text".
 * For other formats (PDF, DOCX), we extract text or handle them as text content.
 */
export const buildAttachmentContentParts = (downloadedAttachments) => {
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
      // OpenAI Chat Completions doesn't have a 'file' type.
      // For text-based files, we should provide them as text content.
      // Since we only have the base64, we'll treat them as text parts.
      // In a real-world scenario, we might want to decode the base64 to actual text 
      // if it's a text-based mime type, but for now, we'll provide it as a text part 
      // describing the file content to avoid the invalid 'file' type.
      
      // For simplicity in this implementation, we'll use type: "text" 
      // and include the base64 content or a placeholder. 
      // A better way would be to decode base64 to text for text/plain, text/csv, etc.
      
      const isTextBased = [
        "text/plain",
        "text/csv",
        "text/tab-separated-values"
      ].includes(att.mimeType);

      if (isTextBased) {
        try {
          // Decode the base64 content to actual text for the model to read
          const decodedText = Buffer.from(att.base64, 'base64').toString('utf-8');
          parts.push({
            type: "text",
            text: `[File Content: ${att.filename} (${att.mimeType})]\n${decodedText}`
          });
        } catch (error) {
          console.error(`Error decoding base64 for ${att.filename}:`, error);
          parts.push({
            type: "text",
            text: `[Error decoding content for ${att.filename} (${att.mimeType})]`
          });
        }
      } else {
        // For non-text based files like PDF/DOCX, we'll provide a text description.
        // The model cannot "see" the file unless we use Assistants API or extract text.
        // Since this is Chat Completions, we'll provide a text notification.
        parts.push({
          type: "text",
          text: `[Attachment: ${att.filename} (${att.mimeType}) is attached but its content cannot be directly read by the Chat Completions API in this mode. The model may need to rely on its internal knowledge or text extraction if provided separately.]`
        });
      }
    }
  }

  return parts;
};

/**
 * Process attachments for validation
 * Returns { downloadedAttachments, skippedCount, attachmentSummary }
 */
export const processAttachments = async (attachments, dependencies = {}) => {
  const {
    api: apiDep = api,
    route: routeDep = route,
  } = dependencies;

  if (!Array.isArray(attachments) || attachments.length === 0) {
    return {
      downloaded: [],
      skippedCount: 0,
      attachmentSummary: "(no attachments)",
      textContext: "",
    };
  }

  // Build attachment summary for logging
  const summary = attachments.map((a) =>
    `${a.filename} (${Math.round((a.size || 0) / 1024)}KB, ${a.mimeType})`
  ).join("; ");
  
  console.log(`Attachments: ${summary}`);

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
  const downloads = await Promise.all(toDownload.map((att) => downloadAttachment(att, { api: apiDep, route: routeDep })));
  const successfulDownloads = downloads.filter(Boolean);
  console.log(`Downloaded ${successfulDownloads.length}/${attachments.length} attachment(s)`);
  
  // Build text summary for attachments that couldn't be downloaded
  const downloadedSet = new Set(toDownload.filter((_a, i) => downloads[i]).map((a) => a.id));
  const skippedAttachments = attachments.filter((a) => !downloadedSet.has(a.id));
  
  let textContext = "";
  if (skippedAttachments.length > 0) {
    textContext = "Attachments that could not be analyzed (unsupported format or too large):\n"
      + skippedAttachments.map((a) => `- ${a.filename} (${a.mimeType}, ${Math.round((a.size || 0) / 1024)}KB)`).join("\n");
  }
  
  if (successfulDownloads.length === 0 && skippedAttachments.length > 0) {
    textContext = `Issue has ${attachments.length} attachment(s) but none could be analyzed:\n`
      + attachments.map((a) => `- ${a.filename} (${a.mimeType}, ${Math.round((a.size || 0) / 1024)}KB)`).join("\n");
  }

  return {
    downloaded: successfulDownloads,
    skippedCount: attachments.length - successfulDownloads.length,
    attachmentSummary: summary,
    textContext,
  };
};
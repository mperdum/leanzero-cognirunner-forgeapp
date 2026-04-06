/*
 * Logger Module - Handles logging storage for validation results
 */

// Configuration
import { kvs } from '@forge/kvs';
const MAX_LOGS = 50;
export const LOGS_STORAGE_KEY = "validation_logs";

/**
 * Store a validation log entry
 */
export const storeLog = async (logEntry) => {
  try {
    const result = await kvs.get({ key: LOGS_STORAGE_KEY });
    let logs = result?.value || [];

    // Add new log at the beginning
    logs.unshift({
      ...logEntry,
      timestamp: new Date().toISOString(),
      id: Date.now().toString(),
    });

    // Keep only the most recent logs
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(0, MAX_LOGS);
    }

    await kvs.set({ key: LOGS_STORAGE_KEY, value: logs });
  } catch (error) {
    console.error("Failed to store log:", error);
  }
};

/**
 * Load validation logs from storage
 */
export const loadLogs = async () => {
  try {
    const result = await kvs.get({ key: LOGS_STORAGE_KEY });
    return result?.value || [];
  } catch (error) {
    console.error("Failed to load logs:", error);
    return [];
  }
};

/**
 * Clear all validation logs
 */
export const clearLogs = async () => {
  try {
    await kvs.set({ key: LOGS_STORAGE_KEY, value: [] });
    return { success: true };
  } catch (error) {
    console.error("Failed to clear logs:", error);
    return { success: false, error: error.message };
  }
};

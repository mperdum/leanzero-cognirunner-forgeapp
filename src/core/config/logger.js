/*
 * Logger Module - Handles logging storage for validation results
 */

// Configuration
const MAX_LOGS = 50;
export const LOGS_STORAGE_KEY = "validation_logs";

/**
 * Store a validation log entry
 */
export const storeLog = async (logEntry) => {
  try {
    let logs = (await storage.get(LOGS_STORAGE_KEY)) || [];

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

    await storage.set(LOGS_STORAGE_KEY, logs);
  } catch (error) {
    console.error("Failed to store log:", error);
  }
};

/**
 * Load validation logs from storage
 */
export const loadLogs = async () => {
  try {
    return (await storage.get(LOGS_STORAGE_KEY)) || [];
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
    await storage.set(LOGS_STORAGE_KEY, []);
    return { success: true };
  } catch (error) {
    console.error("Failed to clear logs:", error);
    return { success: false, error: error.message };
  }
};
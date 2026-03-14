/*
 * Config Module - Main entry point for configuration functionality
 */

export { 
  storeLog, 
  loadLogs,
  clearLogs 
} from './logger.js';

export {
  getConfigs,
  registerConfig,
  removeConfig,
  disableRule,
  enableRule,
  registerPostFunction,
  removePostFunction,
  disablePostFunction,
  enablePostFunction,
  getPostFunctionStatus,
  getRuleStatus
} from './registry.js';
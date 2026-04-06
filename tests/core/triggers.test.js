import { validate, executePostFunction } from '../../src/index.js';
import api from '@forge/api';
import { kvs } from '@forge/kvs';

// Mock @forge/api
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: jest.fn().mockReturnValue({
      requestJira: jest.fn()
    }),
  },
  route: (strings, ...values) => 
    strings.reduce((acc, str, i) => acc + str + (values[i] || ''), ''),
}));

// Mock @forge/kvs
jest.mock('@forge/kvs', () => ({
  kvs: {
    get: jest.fn(),
    set: jest.fn()
  }
}));

// Mock the validator core functions to avoid real OpenAI calls
jest.mock('../../src/core/validator/index.js', () => ({
  ...jest.requireActual('../../src/core/validator/index.js'),
  callOpenAI: jest.fn(),
  callOpenAIWithTools: jest.fn(),
  promptRequiresTools: jest.fn().mockReturnValue(false),
  getFieldValue: jest.fn(),
}));

// Mock the post-function core functions
jest.mock('../../src/core/post-function/index.js', () => ({
  executeSemanticPostFunction: jest.fn(),
  executeStaticCodeSandbox: jest.fn(),
  getFieldValue: jest.fn(),
}));

import { callOpenAI, callOpenAIWithTools } from '../../src/core/validator/index.js';
import { executeSemanticPostFunction, executeStaticCodeSandbox, getFieldValue } from '../../src/core/post-function/index.js';

describe('Forge Trigger Simulations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validate (Workflow Validator/Condition)', () => {
    it('should return success when validation passes', async () => {
      const args = {
        issue: { key: 'PROJ-1' },
        configuration: { fieldId: 'description', prompt: 'Test prompt' },
        context: { license: { isActive: true } }
      };

      callOpenAI.mockResolvedValueOnce({ isValid: true, reason: 'Looks good' });
      getFieldValue.mockResolvedValueOnce('This is a valid description.');

      const result = await validate(args);

      expect(result).toEqual({ result: true });
      expect(callOpenAI).toHaveBeenCalledWith('This is a valid description.', 'Test prompt');
    });

    it('should return failure when validation fails', async () => {
      const args = {
        issue: { key: 'PROJ-1' },
        configuration: { fieldId: 'description', prompt: 'Test prompt' },
        context: { license: { isActive: true } }
      };

      callOpenAI.mockResolvedValueOnce({ isValid: false, reason: 'Too vague' });
      getFieldValue.mockResolvedValueOnce('Too vague');

      const result = await validate(args);

      expect(result).toEqual({ result: false, errorMessage: 'AI Validation failed: Too vague' });
    });

    it('should fail open when license is inactive', async () => {
      const args = {
        issue: { key: 'PROJ-1' },
        configuration: { fieldId: 'description' },
        context: { license: { isActive: false } }
      };

      const result = await validate(args);

      expect(result).toEqual({ result: true });
      expect(callOpenAI).not.toHaveBeenCalled();
    });
  });

  describe('executePostFunction (Workflow Post Function)', () => {
    it('should execute semantic post function successfully', async () => {
      const args = {
        issue: { key: 'PROJ-1' },
        configuration: { 
          type: 'postfunction-semantic', 
          conditionPrompt: 'Should I run?',
          actionPrompt: 'Do this'
        },
        context: { license: { isActive: true } }
      };

      executeSemanticPostFunction.mockResolvedValueOnce({ success: true, changes: [] });

      const result = await executePostFunction(args);

      expect(result).toEqual({ result: true });
      expect(executeSemanticPostFunction).toHaveBeenCalled();
    });

    it('should execute static post function successfully', async () => {
      const args = {
        issue: { key: 'PROJ-1' },
        configuration: { 
          type: 'postfunction-static', 
          code: 'api.log("hello")'
        },
        context: { license: { isActive: true } }
      };

      executeStaticCodeSandbox.mockResolvedValueOnce({ success: true, logs: ['hello'], dryRun: false });

      const result = await executePostFunction(args);

      expect(result).toEqual({ result: true });
      expect(executeStaticCodeSandbox).toHaveBeenCalled();
    });

    it('should fail open when license is inactive', async () => {
      const args = {
        issue: { key: 'PROJ-1' },
        configuration: { type: 'postfunction-semantic' },
        context: { license: { isActive: false } }
      };

      const result = await executePostFunction(args);

      expect(result).toEqual({ result: true });
      expect(executeSemanticPostFunction).not.toHaveBeenCalled();
    });
  });
});
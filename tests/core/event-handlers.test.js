import { executePostFunction, validate } from '../../src/index';
import { kvs } from '@forge/kvs';
import { callOpenAI, callOpenAIWithTools } from '../../src/core/validator/index.js';

// Mock Forge modules
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: jest.fn().mockReturnValue({
      requestJira: jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    }),
  },
  route: (strings, ...values) => strings.reduce((acc, str, i) => acc + str + (values[i] || ''), ''),
}));

jest.mock('@forge/kvs', () => ({
  kvs: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

// Mock validator core functions
jest.mock('../../src/core/validator/index.js', () => ({
  ...jest.requireActual('../../src/core/validator/index.js'),
  callOpenAI: jest.fn(),
  callOpenAIWithTools: jest.fn(),
  promptRequiresTools: jest.fn(),
}));

// Mock post-function implementations
jest.mock('../../src/core/post-function/index.js', () => ({
  executeSemanticPostFunction: jest.fn().mockResolvedValue({ success: true }),
  executeStaticCodeSandbox: jest.fn().mockResolvedValue({ success: true }),
  getFieldValue: jest.fn(),
}));

// Import the mocked versions for our assertions
import { executeSemanticPostFunction, executeStaticCodeSandbox } from '../../src/core/post-function/index.js';

describe('Event Handlers (Post-Function & Validator)', () => {
  const mockIssue = { key: 'PROJ-123', fields: { summary: 'Test Issue' } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executePostFunction', () => {
    it('should skip execution if license is inactive', async () => {
      const args = {
        issue: mockIssue,
        context: { license: { isActive: false } },
      };

      const result = await executePostFunction(args);

      expect(result).toEqual({ result: true });
    });

    it('should skip execution if configuration is not found in KVS', async () => {
      kvs.get.mockResolvedValueOnce({ value: [] });
      
      const args = {
        issue: mockIssue,
        configuration: { id: 'non-existent-id' },
      };
      
      const result = await executePostFunction(args);
      
      expect(result).toEqual({ result: true, message: 'Failed: Post function configuration not found' });
    });

    it('should route to semantic post function when type is postfunction-semantic', async () => {
      kvs.get.mockResolvedValueOnce({ 
        value: [{ id: 'rule-1', type: 'postfunction-semantic', fieldId: 'summary' }] 
      });

      const args = {
        issue: mockIssue,
        configuration: { id: 'rule-1' },
      };
      
      await executePostFunction(args);
      
      expect(executeSemanticPostFunction).toHaveBeenCalledWith(expect.objectContaining({
        issueContext: { key: 'PROJ-123', modifiedFields: null },
        fieldId: 'summary',
      }));
    });

    it('should route to static sandbox when type is postfunction-static', async () => {
      kvs.get.mockResolvedValueOnce({ 
        value: [{ id: 'rule-2', type: 'postfunction-static', code: 'console.log(1)' }] 
      });

      const args = {
        issue: mockIssue,
        configuration: { id: 'rule-2' },
      };
      
      await executePostFunction(args);
      
      expect(executeStaticCodeSandbox).toHaveBeenCalledWith(expect.objectContaining({
        code: 'console.log(1)',
      }));
    });
  });

  describe('validate', () => {
    it('should fail open (return true) if license is inactive', async () => {
      const args = {
        issue: mockIssue,
        context: { license: { isActive: false } },
      };
      
      const result = await validate(args);
      
      expect(result).toEqual({ result: true });
    });

    it('should skip validation if the rule is explicitly disabled in KVS', async () => {
      kvs.get.mockResolvedValueOnce({ 
        value: [{ id: 'rule-3', fieldId: 'description', disabled: true }] 
      });

      const args = {
        issue: mockIssue,
        configuration: { fieldId: 'description' },
      };
      
      const result = await validate(args);
      
      expect(result).toEqual({ result: true });
    });

    it('should perform successful validation using AI', async () => {
      kvs.get.mockResolvedValueOnce({ value: [] });
      callOpenAI.mockResolvedValueOnce({ isValid: true, reason: 'Looks good' });

      const args = {
        issue: mockIssue,
        configuration: { fieldId: 'description', prompt: 'Validating...' },
      };
      
      const result = await validate(args);
      
      expect(result).toEqual({ result: true });
      expect(callOpenAI).toHaveBeenCalled();
    });

    it('should return validation failure if AI rejects the content', async () => {
      kvs.get.mockResolvedValueOnce({ value: [] });
      callOpenAI.mockResolvedValueOnce({ isValid: false, reason: 'Inappropriate content' });

      const args = {
        issue: mockIssue,
        configuration: { fieldId: 'description', prompt: 'Validating...' },
      };
      
      const result = await validate(args);
      
      expect(result).toEqual({ result: false, errorMessage: 'AI Validation failed: Inappropriate content' });
    });
  });
});
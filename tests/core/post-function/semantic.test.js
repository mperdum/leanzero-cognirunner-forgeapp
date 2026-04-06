import { executeSemanticPostFunction, getFieldValue } from '../../../src/core/post-function/semantic.js';

describe('semantic post-function module', () => {
  const issueContext = {
    key: 'PROJ-123',
    summary: 'Test Issue Summary',
    projectKey: 'PROJ',
    modifiedFields: {
      'customfield_101': 'some value'
    }
  };

  const mockRequestJira = jest.fn();
  const mockAsApp = jest.fn(() => ({
    requestJira: mockRequestJira
  }));

  const dependencies = {
    api: {
      asApp: mockAsApp
    },
    route: jest.fn((path) => path),
    callOpenAIWithTools: jest.fn(),
    getFieldValue: jest.fn(),
    extractFieldDisplayValue: jest.fn((v) => v)
  };

  describe('executeSemanticPostFunction', () => {
    it('should return skipped if agent decides to SKIP', async () => {
      dependencies.getFieldValue.mockResolvedValue('some value');
      dependencies.callOpenAIWithTools.mockResolvedValue({
        isValid: true,
        reason: JSON.stringify({
          decision: 'SKIP',
          value: null,
          reason: 'Condition not met'
        })
      });

      const result = await executeSemanticPostFunction(
        {
          issueContext,
          combinedPrompt: 'is it urgent?',
          fieldId: 'customfield_101',
          actionFieldId: 'customfield_102',
          dryRun: false
        },
        dependencies
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Condition not met');
    });

    it('should return dryRun result if decision is UPDATE and dryRun is true', async () => {
      dependencies.getFieldValue.mockResolvedValue('some value');
      dependencies.callOpenAIWithTools.mockResolvedValue({
        isValid: true,
        reason: JSON.stringify({
          decision: 'UPDATE',
          value: 'new value',
          reason: 'Condition met'
        })
      });

      const result = await executeSemanticPostFunction(
        {
          issueContext,
          combinedPrompt: 'is it urgent?',
          fieldId: 'customfield_101',
          actionFieldId: 'customfield_102',
          dryRun: true
        },
        dependencies
      );

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.changes).toEqual([{ field: 'customfield_102', newValue: 'new value' }]);
    });

    it('should perform actual update if decision is UPDATE and dryRun is false', async () => {
      dependencies.getFieldValue.mockResolvedValue('some value');
      dependencies.callOpenAIWithTools.mockResolvedValue({
        isValid: true,
        reason: JSON.stringify({
          decision: 'UPDATE',
          value: 'new value',
          reason: 'Condition met'
        })
      });

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      };
      mockRequestJira.mockResolvedValue(mockResponse);

      const result = await executeSemanticPostFunction(
        {
          issueContext,
          combinedPrompt: 'is it urgent?',
          fieldId: 'customfield_101',
          actionFieldId: 'customfield_102',
          dryRun: false
        },
        dependencies
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
      expect(result.changes).toEqual([{ field: 'customfield_102', newValue: 'new value' }]);
      expect(mockRequestJira).toHaveBeenCalled();
    });

    it('should fail open if AI decision JSON parsing fails (malformed JSON)', async () => {
      dependencies.getFieldValue.mockResolvedValue('some value');
      dependencies.callOpenAIWithTools.mockResolvedValue({
        isValid: true,
        reason: '{ "decision": "UPDATE", "value": "broken' // Missing closing brace
      });

      const result = await executeSemanticPostFunction(
        {
          issueContext,
          combinedPrompt: 'is it urgent?',
          fieldId: 'customfield_101',
          actionFieldId: 'customfield_102',
          dryRun: false
        },
        dependencies
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('should fail open if AI returns an unexpected decision (e.g. MAYBE)', async () => {
      dependencies.getFieldValue.mockResolvedValue('some value');
      dependencies.callOpenAIWithTools.mockResolvedValue({
        isValid: true,
        reason: JSON.stringify({
          decision: 'MAYBE',
          value: null,
          reason: 'I am not sure'
        })
      });

      const result = await executeSemanticPostFunction(
        {
          issueContext,
          combinedPrompt: 'is it urgent?',
          fieldId: 'customfield_101',
          actionFieldId: 'customfield_102',
          dryRun: false
        },
        dependencies
      );

      // It should treat unknown decisions as SKIP to be safe
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('should handle AI timeout by failing open', async () => {
      dependencies.getFieldValue.mockResolvedValue('some value');
      dependencies.callOpenAIWithTools.mockResolvedValue({
        isValid: false,
        reason: 'The request timed out'
      });

      const result = await executeSemanticPostFunction(
        {
          issueContext,
          combinedPrompt: 'is it urgent?',
          fieldId: 'customfield_101',
          actionFieldId: 'customfield_102',
          dryRun: false
        },
        dependencies
      );

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('should error if decision is UPDATE but value is missing', async () => {
      dependencies.getFieldValue.mockResolvedValue('some value');
      dependencies.callOpenAIWithTools.mockResolvedValue({
        isValid: true,
        reason: JSON.stringify({
          decision: 'UPDATE',
          value: null, // Missing value
          reason: 'Condition met'
        })
      });

      const result = await executeSemanticPostFunction(
        {
          issueContext,
          combinedPrompt: 'is it urgent?',
          fieldId: 'customfield_101',
          actionFieldId: 'customfield_102',
          dryRun: false
        },
        dependencies
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent decided to UPDATE but provided no value');
    });

    it('should ensure the prompt sent to AI contains all required context', async () => {
      dependencies.getFieldValue.mockResolvedValue('current-value');
      dependencies.callOpenAIWithTools.mockResolvedValue({
        isValid: true,
        reason: JSON.stringify({ decision: 'SKIP', value: null, reason: 'ok' })
      });

      const myCombinedPrompt = 'is it urgent?';
      const myFieldId = 'customfield_101';
      const myActionId = 'customfield_102';

      await executeSemanticPostFunction(
        {
          issueContext,
          combinedPrompt: myCombinedPrompt,
          fieldId: myFieldId,
          actionFieldId: myActionId,
          dryRun: false
        },
        dependencies
      );

      // Verify the prompt construction logic
      const promptArgument = dependencies.callOpenAIWithTools.mock.calls[0][1];
      expect(promptArgument).toContain(myCombinedPrompt);
      expect(promptArgument).toContain(myFieldId);
      expect(promptArgument).toContain(myActionId);
      expect(promptArgument).toContain('current-value');
    });

    it('should return failure if update fails', async () => {
      dependencies.getFieldValue.mockResolvedValue('some value');
      dependencies.callOpenAIWithTools.mockResolvedValue({
        isValid: true,
        reason: JSON.stringify({
          decision: 'UPDATE',
          value: 'new value',
          reason: 'Condition met'
        })
      });

      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad Request'),
      };
      mockRequestJira.mockResolvedValue(mockResponse);

      const result = await executeSemanticPostFunction(
        {
          issueContext,
          combinedPrompt: 'is it urgent?',
          fieldId: 'customfield_101',
          actionFieldId: 'customfield_102',
          dryRun: false
        },
        dependencies
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to update issue: 400');
    });

    it('should ensure the JIRA API payload is correctly structured', async () => {
      dependencies.getFieldValue.mockResolvedValue('some value');
      dependencies.callOpenAIWithTools.mockResolvedValue({
        isValid: true,
        reason: JSON.stringify({
          decision: 'UPDATE',
          value: 'important update',
          reason: 'Condition met'
        })
      });

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      };
      mockRequestJira.mockResolvedValue(mockResponse);

      await executeSemanticPostFunction(
        {
          issueContext,
          combinedPrompt: 'is it urgent?',
          fieldId: 'customfield_101',
          actionFieldId: 'customfield_102',
          dryRun: false
        },
        dependencies
      );

      // Verify the exact structure of the PUT body required by Jira API
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining('/rest/api/3/issue/PROJ-123'),
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ 
            fields: { 
              customfield_102: 'important update' 
            } 
          })
        })
      );
    });
  });

  describe('getFieldValue', () => {
    it('should return value from modifiedFields if present', async () => {
      const result = await getFieldValue('PROJ-123', 'customfield_101', { 'customfield_101': 'modified value' }, dependencies);
      expect(result).toBe('modified value');
    });

    it('should fetch from API if not in modifiedFields', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          fields: { 'customfield_101': 'api value' },
          renderedFields: { 'customfield_101': 'api value' }
        })
      };
      mockRequestJira.mockResolvedValue(mockResponse);

      const result = await getFieldValue('PROJ-123', 'customfield_101', {}, dependencies);
      expect(result).toBe('api value');
      expect(mockRequestJira).toHaveBeenCalled();
    });

    it('should return null if API call fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500
      };
      dependencies.api.asApp().requestJira.mockResolvedValue(mockResponse);

      const result = await getFieldValue('PROJ-123', 'customfield_101', {}, dependencies);
      expect(result).toBeNull();
    });
  });
});
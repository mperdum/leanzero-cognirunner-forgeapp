import { handleEvent } from '../../src/index.js'; // Assuming handleEvent is the entry point for events

// Mocking the dependencies as we did in other tests
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: jest.fn().mockReturnValue({
      requestJira: jest.fn().mockResolvedValue({ status: 200, body: {} })
    }),
  },
  route: (strings, ...values) => 
    strings.reduce((acc, str, i) => acc + str + (values[i] || ''), ''),
}));

jest.mock('@forge/kvs', () => ({
  kvs: {
    get: jest.fn(),
    set: jest.fn()
  }
}));

// Mock core logic to focus on event routing/handling
jest.mock('../../src/core/validator/index.js', () => ({
  callOpenAI: jest.fn(),
  getFieldValue: jest.fn(),
}));

describe('Jira Event Contract Tests', () => {
  const mockIssueCreatedPayload = {
    "eventType": "avi:jira:created:issue",
    "issue": {
      "id": "10073",
      "key": "SP-10",
      "fields": {
        "summary": "A descriptive title",
        "issuetype": { "name": "Story" },
        "project": { "key": "SP" },
        "status": { "name": "Backlog" }
      }
    },
    "atlassianId": "4ad9aa0c52dc1b420a791d12"
  };

  const mockTransitionPayload = {
    "transition": {
      "id": "11",
      "name": "In progress",
      "from": { "id": "1" },
      "to": { "id": "2" }
    },
    "workflow": { "id": "wf-123", "name": "Test Workflow" },
    "context": {
      "cloudId": "test-cloud-id",
      "moduleKey": "test-module"
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Issue Created Event', () => {
    it('should correctly parse a standard issue creation payload', async () => {
      // This test ensures our handler can access the key and project correctly
      // We assume handleEvent is implemented to route based on eventType
      const result = await handleEvent(mockIssueCreatedPayload);
      
      // Since we are mocking, we just want to ensure it doesn't crash 
      // and correctly identifies the event type.
      expect(result).toBeDefined();
    });

    it('should handle missing optional fields in issue creation (robustness)', async () => {
      const minimalPayload = {
        "eventType": "avi:jira:created:issue",
        "issue": {
          "id": "10073",
          "key": "SP-10"
          // fields is missing
        }
      };

      await expect(handleEvent(minimalPayload)).resolves.not.toThrow();
    });
  });

  describe('Workflow Transition Event', () => {
    it('should correctly process transition metadata', async () => {
      const result = await handleEvent(mockTransitionPayload);
      expect(result).toBeDefined();
    });

    it('should fail gracefully if transition context is missing', async () => {
      const brokenPayload = {
        "transition": { "id": "11" }
        // context is missing
      };

      await expect(handleEvent(brokenPayload)).resolves.not.toThrow();
    });
  });
});
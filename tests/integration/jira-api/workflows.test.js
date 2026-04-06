import { fetchProjectsForWorkflow, fetchWorkflowTransitions } from '../../../src/integration/jira-api/workflows';
import api, { route } from '@forge/api';

// Mock @forge/api
const mockRequestJira = jest.fn();

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: jest.fn(),
  },
  route: (strings, ...values) => 
    strings.reduce((acc, str, i) => acc + str + (values[i] || ''), ''),
}));

describe('Jira API Workflows Integration', () => {
  let mockDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    
    api.asApp.mockReturnValue({
      requestJira: mockRequestJira
    });

    mockDependencies = {
      api: api,
      route: route,
    };
  });

  describe('fetchProjectsForWorkflow', () => {
    it('should return project IDs and handle pagination', async () => {
      const workflowId = 'wf-123';
      
      // First page
      mockRequestJira.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: {
            values: [{ id: 'proj-1' }, { id: 'proj-2' }],
            nextPageToken: 'token-abc'
          }
        }),
      });

      // Second page
      mockRequestJira.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: {
            values: [{ id: 'proj-3' }]
          }
        }),
      });

      const result = await fetchProjectsForWorkflow(workflowId, mockDependencies);

      expect(result).toEqual(['proj-1', 'proj-2', 'proj-3']);
      expect(mockRequestJira).toHaveBeenCalledTimes(2);
      expect(mockRequestJira).toHaveBeenNthCalledWith(1, 
        expect.stringContaining(`/rest/api/3/workflow/${workflowId}/projectUsages?maxResults=200`),
        expect.anything()
      );
      expect(mockRequestJira).toHaveBeenNthCalledWith(2, 
        expect.stringContaining(`/rest/api/3/workflow/${workflowId}/projectUsages?maxResults=200&nextPageToken=token-abc`),
        expect.anything()
      );
    });

    it('should return null if the API request fails', async () => {
      mockRequestJira.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const result = await fetchProjectsForWorkflow('wf-123', mockDependencies);

      expect(result).toBeNull();
    });
  });

  describe('fetchWorkflowTransitions', () => {
    it('should return transition rules for the matching workflow', async () => {
      const workflowName = 'Agile Workflow';
      
      mockRequestJira.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          values: [
            {
              name: 'Agile Workflow',
              transitions: [
                { id: '1', validators: [{ type: 'regex' }], conditions: [{ type: 'user' }] },
                { id: '2', validators: [], conditions: { conditions: [{ type: 'status' }] } }
              ]
            },
            {
              name: 'Other Workflow',
              transitions: [{ id: '3' }]
            }
          ]
        }),
      });

      const { transitionRules, error } = await fetchWorkflowTransitions(workflowName, mockDependencies);

      expect(error).toBeNull();
      expect(transitionRules.size).toBe(2);
      expect(transitionRules.get('1')).toEqual({
        validators: [{ type: 'regex' }],
        conditions: [{ type: 'user' }]
      });
      expect(transitionRules.get('2')).toEqual({
        validators: [],
        conditions: [{ type: 'status' }]
      });
    });

    it('should return empty map if no workflows match the name', async () => {
      mockRequestJira.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          values: [{ name: 'Different Workflow', transitions: [{ id: '4' }] }]
        }),
      });

      const { transitionRules, error } = await fetchWorkflowTransitions('Agile Workflow', mockDependencies);

      expect(error).toBeNull();
      expect(transitionRules.size).toBe(0);
    });

    it('should return error if the API request fails', async () => {
      mockRequestJira.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden'
      });

      const { transitionRules, error } = await fetchWorkflowTransitions('Agile Workflow', mockDependencies);

      expect(transitionRules).toBeNull();
      expect(error).toContain('Jira API returned 403');
    });
  });
});
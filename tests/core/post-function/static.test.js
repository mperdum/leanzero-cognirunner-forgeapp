import { executeStaticPostFunction, executeStaticCodeSandbox } from '../../../src/core/post-function/static';
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

describe('Static Post Function Module', () => {
  const mockIssueContext = { key: 'PROJ-123' };
  
  // We'll set up the dependency injection to use the mocked api.asApp
  let mockDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup asApp to return the object with requestJira
    api.asApp.mockReturnValue({
      requestJira: mockRequestJira
    });

    mockDependencies = {
      api: api,
      route: route,
    };
  });

  describe('executeStaticPostFunction', () => {
    it('should return success when dryRun is true', async () => {
      const code = 'api.log("hello")';
      
      const result = await executeStaticPostFunction({
        issueContext: mockIssueContext,
        code,
        dryRun: true,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
    });

    it('should return success when dryRun is false', async () => {
      const code = 'api.log("hello")';
      
      const result = await executeStaticPostFunction({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(false);
    });
  });

  describe('executeStaticCodeSandbox', () => {
    it('should execute simple code and log to apiSurface', async () => {
      const code = 'api.log("test log"); api.log("second log");';
      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('test log');
      expect(result.logs).toContain('second log');
    });

    it('should successfully call getIssue via apiSurface', async () => {
      const code = 'const issue = await api.getIssue("PROJ-123"); api.log(issue.key);';
      mockRequestJira.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'PROJ-123', fields: {} }),
      });

      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('PROJ-123');
      expect(mockRequestJira).toHaveBeenCalledWith(expect.stringContaining('/rest/api/3/issue/PROJ-123'));
    });

    it('should successfully call updateIssue via apiSurface', async () => {
      const code = 'await api.updateIssue("PROJ-123", { summary: "new summary" });';
      mockRequestJira.mockResolvedValueOnce({
        ok: true,
      });

      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('Updated: PROJ-123');
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining('/rest/api/3/issue/PROJ-123'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ fields: { summary: 'new summary' } })
        })
      );
    });

    it('should perform a dry-run for updateIssue without calling requestJira', async () => {
      const code = 'await api.updateIssue("PROJ-123", { summary: "new summary" });';
      
      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: true,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.logs).toContain('DRY-RUN: PROJ-123 -> {"summary":"new summary"}');
      expect(mockRequestJira).not.toHaveBeenCalled();
      expect(result.changes).toEqual([{ key: 'PROJ-123', fields: { summary: 'new summary' } }]);
    });

    it('should successfully call transitionIssue via apiSurface', async () => {
      const code = 'await api.transitionIssue("PROJ-123", "10001");';
      mockRequestJira.mockResolvedValueOnce({
        ok: true,
      });

      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('Transitioned: PROJ-123 to 10001');
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining('/rest/api/3/issue/PROJ-123/transitions'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ transition: { id: '10001' } })
        })
      );
    });

    it('should handle syntax errors in the code string', async () => {
      const code = 'this is not valid javascript';
      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Syntax or runtime error');
    });

    it('should handle runtime errors within the code', async () => {
      const code = 'throw new Error("intentional error");';
      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('intentional error');
      expect(result.logs).toContain('ERROR: intentional error');
    });

    it('should handle API response failures (e.g., 404)', async () => {
      const code = 'await api.getIssue("PROJ-999");';
      mockRequestJira.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed: 404');
      expect(result.logs).toContain('ERROR: Failed: 404');
    });

    it('should handle searchJql successfully', async () => {
      const code = 'const res = await api.searchJql("project = PROJ"); api.log(res.total);';
      mockRequestJira.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 5, issues: [] }),
      });

      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('5');
      expect(mockRequestJira).toHaveBeenCalledWith(
        expect.stringContaining('/rest/api/3/search/jql'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('project = PROJ')
        })
      );
    });

    it('should handle sandbox errors gracefully when code uses unsupported syntax', async () => {
      // Using a syntax that is technically valid JS but might fail in some environments
      // Or more simply, a runtime error that occurs during async execution
      const code = 'await api.getIssue("PROJ-123"); throw new Error("Sandbox Crash");';
      mockRequestJira.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'PROJ-123', fields: {} }),
      });

      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Sandbox Crash');
      expect(result.logs).toContain('ERROR: Sandbox Crash');
    });

    it('should verify that simulationMode preserves context but prevents real API calls', async () => {
      const code = 'await api.updateIssue("PROJ-123", { summary: "simulated" });';
      
      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        simulationMode: true,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.logs).toContain('DRY-RUN: PROJ-123 -> {"summary":"simulated"}');
      expect(mockRequestJira).not.toHaveBeenCalled();
    });

    it('should handle large amounts of logs in the sandbox', async () => {
      const code = 'for(let i=0; i<10; i++) { api.log("log " + i); }';
      
      const result = await executeStaticCodeSandbox({
        issueContext: mockIssueContext,
        code,
        dryRun: false,
        dependencies: mockDependencies
      });

      expect(result.success).toBe(true);
      expect(result.logs.length).toBe(10);
      expect(result.logs[0]).toBe('log 0');
      expect(result.logs[9]).toBe('log 9');
    });
  });
});

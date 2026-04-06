import { executeStaticPostFunction, executeStaticCodeSandbox } from '../../../src/core/post-function/static.js';

describe('static post-function module', () => {
  const mockApi = {
    asApp: jest.fn().mockReturnThis(),
    requestJira: jest.fn()
  };
  
  // Mocking the route tagged template literal
  const mockRoute = jest.fn((strings, ...values) => {
    return strings.reduce((acc, str, i) => acc + str + (values[i] || ''), '');
  });

  const dependencies = {
    api: mockApi,
    route: mockRoute
  };

  const issueContext = { key: 'PROJ-123' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeStaticPostFunction', () => {
    test('should call sandbox with simulationMode: true when dryRun is true', async () => {
      const code = 'api.log("test")';
      const result = await executeStaticPostFunction({
        issueContext,
        code,
        dryRun: true,
        dependencies
      });

      expect(result.dryRun).toBe(true);
    });

    test('should call sandbox with simulationMode: false when dryRun is false', async () => {
      const code = 'api.log("test")';
      const result = await executeStaticPostFunction({
        issueContext,
        code,
        dryRun: false,
        dependencies
      });

      expect(result.dryRun).toBe(false);
    });
  });

  describe('executeStaticCodeSandbox', () => {
    test('should execute code and log messages', async () => {
      const code = 'api.log("hello world"); api.log("second log");';
      const result = await executeStaticCodeSandbox({
        issueContext,
        code,
        dryRun: false,
        dependencies
      });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('hello world');
      expect(result.logs).toContain('second log');
    });

    test('should handle syntax errors in code', async () => {
      const code = 'if (true) { // syntax error';
      const result = await executeStaticCodeSandbox({
        issueContext,
        code,
        dryRun: false,
        dependencies
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Syntax or runtime error');
    });

    test('should handle runtime errors in code', async () => {
      const code = 'throw new Error("boom");';
      const result = await executeStaticCodeSandbox({
        issueContext,
        code,
        dryRun: false,
        dependencies
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });

    test('should successfully call getIssue', async () => {
      const code = 'const issue = await api.getIssue("PROJ-123"); api.log(issue.key);';
      mockApi.requestJira.mockResolvedValue({
        ok: true,
        json: async () => ({ key: 'PROJ-123', fields: {} })
      });

      const result = await executeStaticCodeSandbox({
        issueContext,
        code,
        dryRun: false,
        dependencies
      });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('PROJ-123');
      expect(mockApi.requestJira).toHaveBeenCalled();
    });

    test('should perform dry-run for updateIssue', async () => {
      const code = 'await api.updateIssue("PROJ-123", { summary: "new" });';
      
      const result = await executeStaticCodeSandbox({
        issueContext,
        code,
        dryRun: true,
        dependencies
      });

      expect(result.success).toBe(true);
      expect(result.changes[0]).toEqual({
        key: 'PROJ-123',
        fields: { summary: 'new' }
      });
      expect(result.logs).toContain('DRY-RUN: PROJ-123 -> {"summary":"new"}');
      expect(mockApi.requestJira).not.toHaveBeenCalled();
    });

    test('should perform real updateIssue when not in dry-run', async () => {
      const code = 'await api.updateIssue("PROJ-123", { summary: "new" });';
      mockApi.requestJira.mockResolvedValue({
        ok: true
      });

      const result = await executeStaticCodeSandbox({
        issueContext,
        code,
        dryRun: false,
        dependencies
      });

      expect(result.success).toBe(true);
      expect(result.changes[0]).toEqual({
        key: 'PROJ-123',
        fields: { summary: 'new' }
      });
      expect(mockApi.requestJira).toHaveBeenCalled();
    });

    test('should successfully call searchJql', async () => {
      const code = 'const res = await api.searchJql("project = PROJ"); api.log(res.total);';
      mockApi.requestJira.mockResolvedValue({
        ok: true,
        json: async () => ({ total: 5, issues: [] })
      });

      const result = await executeStaticCodeSandbox({
        issueContext,
        code,
        dryRun: false,
        dependencies
      });

      expect(result.success).toBe(true);
      expect(result.logs).toContain('5');
    });

    test('should perform dry-run for transitionIssue', async () => {
      const code = 'await api.transitionIssue("PROJ-123", "101");';
      
      const result = await executeStaticCodeSandbox({
        issueContext,
        code,
        dryRun: true,
        dependencies
      });

      expect(result.success).toBe(true);
      expect(result.changes[0]).toEqual({
        key: 'PROJ-123',
        transitionId: '101'
      });
      expect(result.logs).toContain('DRY-RUN: Transition PROJ-123 to 101');
      expect(mockApi.requestJira).not.toHaveBeenCalled();
    });

    test('should perform real transitionIssue when not in dry-run', async () => {
      const code = 'await api.transitionIssue("PROJ-123", "101");';
      mockApi.requestJira.mockResolvedValue({
        ok: true
      });

      const result = await executeStaticCodeSandbox({
        issueContext,
        code,
        dryRun: false,
        dependencies
      });

      expect(result.success).toBe(true);
      expect(result.changes[0]).toEqual({
        key: 'PROJ-123',
        transitionId: '101'
      });
      expect(mockApi.requestJira).toHaveBeenCalled();
    });
  });
});
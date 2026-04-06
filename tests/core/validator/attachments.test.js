import { 
  downloadAttachment, 
  buildAttachmentContentParts, 
  processAttachments,
  FILE_MIME_TYPES,
  IMAGE_MIME_TYPES 
} from '../../../src/core/validator/attachments.js';

// Mocking @forge/api is tricky because it's a complex object.
// However, the functions in attachments.js allow passing dependencies.
// This is a great example of testable code!

describe('attachments module', () => {
  const mockApi = {
    asApp: jest.fn().mockReturnThis(),
    requestJira: jest.fn()
  };
  const mockRoute = (path) => `route\`${path}\``;
  const dependencies = { api: mockApi, route: mockRoute };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('downloadAttachment', () => {
    test('should return null if attachment has no id', async () => {
      const result = await downloadAttachment({ filename: 'test.pdf' }, dependencies);
      expect(result).toBeNull();
    });

    test('should return null if attachment is too large', async () => {
      const result = await downloadAttachment({ 
        id: '123', 
        size: 15 * 1024 * 1024, // 15MB
        filename: 'big.pdf' 
      }, dependencies);
      expect(result).toBeNull();
    });

    test('should return null if mime type is unsupported', async () => {
      const result = await downloadAttachment({ 
        id: '123', 
        mimeType: 'application/octet-stream',
        filename: 'unknown.bin' 
      }, dependencies);
      expect(result).toBeNull();
    });

    test('should successfully download and return base64 content', async () => {
      const data = 'hello world';
      const mockBuffer = Buffer.from(data);
      const arrayBuffer = mockBuffer.buffer.slice(
        mockBuffer.byteOffset,
        mockBuffer.byteOffset + mockBuffer.byteLength
      );
      
      mockApi.requestJira.mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer)
      });

      const attachment = { 
        id: '123', 
        size: 1024, 
        mimeType: 'text/plain', 
        filename: 'test.txt' 
      };

      const result = await downloadAttachment(attachment, dependencies);

      expect(result).toEqual({
        base64: Buffer.from(arrayBuffer).toString('base64'),
        mimeType: 'text/plain',
        filename: 'test.txt'
      });
      expect(mockApi.requestJira).toHaveBeenCalled();
    });

    test('should return null if API response is not ok', async () => {
      mockApi.requestJira.mockResolvedValue({
        ok: false,
        status: 404
      });

      const attachment = { 
        id: '123', 
        size: 1024, 
        mimeType: 'text/plain', 
        filename: 'test.txt' 
      };

      const result = await downloadAttachment(attachment, dependencies);
      expect(result).toBeNull();
    });
  });

  describe('buildAttachmentContentParts', () => {
    test('should return empty array for empty input', () => {
      expect(buildAttachmentContentParts([])).toEqual([]);
    });

    test('should handle image attachments correctly', () => {
      const attachments = [{
        mimeType: 'image/png',
        base64: 'abc',
      }];
      const result = buildAttachmentContentParts(attachments);
      expect(result[0]).toEqual({
        type: 'image_url',
        image_url: {
          url: 'data:image/png;base64,abc',
          detail: 'auto'
        }
      });
    });

    test('should handle file attachments correctly', () => {
      const attachments = [{
        mimeType: 'application/pdf',
        base64: 'abc',
        filename: 'doc.pdf'
      }];
      const result = buildAttachmentContentParts(attachments);
      expect(result[0]).toEqual({
        type: 'file',
        file: {
          filename: 'doc.pdf',
          file_data: 'data:application/pdf;base64,abc'
        }
      });
    });
  });

  describe('processAttachments', () => {
    test('should return default object for empty/null input', async () => {
      const result = await processAttachments([]);
      expect(result.downloaded).toEqual([]);
      expect(result.skippedCount).toBe(0);
      expect(result.attachmentSummary).toBe("(no attachments)");
    });

    test('should filter out unsupported or oversized attachments', async () => {
      const attachments = [
        { id: '1', filename: 'ok.pdf', size: 1024, mimeType: 'application/pdf' },
        { id: '2', filename: 'too-big.pdf', size: 30 * 1024 * 1024, mimeType: 'application/pdf' },
        { id: '3', filename: 'unsupported.exe', size: 1024, mimeType: 'application/octet-stream' },
      ];

      // Mock downloadAttachment (indirectly via dependencies)
      // Since processAttachments calls downloadAttachment, and downloadAttachment uses dependencies,
      // we should mock the internal call or ensure downloadAttachment works.
      // For simplicity in this test, we'll provide a mock for the api inside dependencies
      // and let downloadAttachment run.
      
      mockApi.requestJira.mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('data').buffer)
      });

      const result = await processAttachments(attachments, dependencies);

      expect(result.downloaded.length).toBe(1);
      expect(result.skippedCount).toBe(2);
      expect(result.attachmentSummary).toContain('ok.pdf');
      expect(result.attachmentSummary).toContain('too-big.pdf');
      expect(result.attachmentSummary).toContain('unsupported.exe');
    });

    test('should respect total budget', async () => {
      const attachments = [
        { id: '1', filename: 'file1.pdf', size: 15 * 1024 * 1024, mimeType: 'application/pdf' },
        { id: '2', filename: 'file2.pdf', size: 10 * 1024 * 1024, mimeType: 'application/pdf' }, // Total 25MB, exceeds 20MB budget
      ];

      mockApi.requestJira.mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('data').buffer)
      });

      const result = await processAttachments(attachments, dependencies);

      expect(result.downloaded.length).toBe(1); // Only file1
      expect(result.skippedCount).toBe(1);
    });

    test('should provide textContext for skipped attachments', async () => {
      const attachments = [
        { id: '1', filename: 'ok.pdf', size: 1024, mimeType: 'application/pdf' },
        { id: '2', filename: 'unsupported.exe', size: 1024, mimeType: 'application/octet-stream' },
      ];

      mockApi.requestJira.mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('data').buffer)
      });

      const result = await processAttachments(attachments, dependencies);

      expect(result.textContext).toContain('unsupported.exe');
    });
  });
});
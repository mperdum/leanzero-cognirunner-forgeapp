import { extractTextFromADF, extractFieldDisplayValue, promptRequiresTools } from '../../../src/core/validator/openai-client.js';

describe('openai-client utility functions', () => {
  describe('extractTextFromADF', () => {
    test('should return empty string for null or undefined input', () => {
      expect(extractTextFromADF(null)).toBe("");
      expect(extractTextFromADF(undefined)).toBe("");
    });

    test('should return string input as is', () => {
      expect(extractTextFromADF("hello world")).toBe("hello world");
    });

    test('should extract text from simple paragraph nodes', () => {
      const adf = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' World' }]
          }
        ]
      };
      expect(extractTextFromADF(adf)).toBe("Hello World");
    });

    test('should handle headings and newlines', () => {
      const adf = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] }
        ]
      };
      // Based on implementation: blockTypes adds \n
      expect(extractTextFromADF(adf)).toBe("Title\nBody text");
    });

    test('should extract mentions and emojis', () => {
      const adf = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'User: ' },
              { type: 'mention', attrs: { text: '@JohnDoe' } },
              { type: 'text', text: ' said ' },
              { type: 'emoji', attrs: { shortName: ':smile:' } }
            ]
          }
        ]
      };
      expect(extractTextFromADF(adf)).toBe("User: @JohnDoe said :smile:");
    });

    test('should handle hard breaks', () => {
      const adf = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Line 1' },
              { type: 'hardBreak' },
              { type: 'text', text: 'Line 2' }
            ]
          }
        ]
      };
      expect(extractTextFromADF(adf)).toBe("Line 1\nLine 2");
    });

    test('should handle deeply nested ADF structures', () => {
      const adf = {
        type: 'doc',
        content: [
          {
            type: 'block',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Deep '
                  },
                  {
                    type: 'inline',
                    content: [{ type: 'text', text: 'Nested' }]
                  }
                ]
              }
            ]
          }
        ]
      };
      // The current implementation uses recursion, so it should work
      expect(extractTextFromADF(adf)).toBe("Deep Nested");
    });

    test('should handle empty content nodes gracefully', () => {
      const adf = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Valid' }] }
        ]
      };
      expect(extractTextFromADF(adf)).toBe("Valid");
    });
  });

  describe('extractFieldDisplayValue', () => {
    test('should handle null/undefined/empty input', () => {
      expect(extractFieldDisplayValue(null)).toBe("");
      expect(extractFieldDisplayValue(undefined)).toBe("");
    });

    test('should handle primitives', () => {
      expect(extractFieldDisplayValue("text")).toBe("text");
      expect(extractFieldDisplayValue(123)).toBe("123");
      expect(extractFieldDisplayValue(true)).toBe("Yes");
      expect(extractFieldDisplayValue(false)).toBe("No");
    });

    test('should handle ADF content via extractTextFromADF', () => {
      const adf = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ADF Content' }] }]
      };
      expect(extractFieldDisplayValue(adf)).toBe("ADF Content");
    });

    test('should handle attachment objects', () => {
      const attachment = {
        filename: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf'
      };
      expect(extractFieldDisplayValue(attachment)).toBe("test.pdf (1KB) [application/pdf]");
    });

    test('should handle user objects', () => {
      const user = { displayName: 'John Doe' };
      expect(extractFieldDisplayValue(user)).toBe('John Doe');
    });

    test('should handle select/dropdown objects', () => {
      const select = { name: 'Option 1' };
      const selectVal = { value: 'Option 1' };
      expect(extractFieldDisplayValue(select)).toBe('Option 1');
      expect(extractFieldDisplayValue(selectVal)).toBe('Option 1');
    });

    test('should handle arrays (multi-select)', () => {
      const array = [{ name: 'A' }, { name: 'B' }];
      expect(extractFieldDisplayValue(array)).toBe("A, B");
    });

    test('should handle checklist format', () => {
      const checklist = [
        { name: 'Task 1', checked: true },
        { name: 'Task 2', checked: false }
      ];
      expect(extractFieldDisplayValue(checklist)).toBe("[x] Task 1\n[ ] Task 2");
    });
  });

  describe('promptRequiresTools', () => {
    test('should return true for duplicate-related terms', () => {
      expect(promptRequiresTools("Is this a duplicate issue?")).toBe(true);
      expect(promptRequiresTools("Check for existing issues")).toBe(true);
      expect(promptRequiresTools("Find related issues")).toBe(true);
    });

    test('should return false for unrelated text', () => {
      expect(promptRequiresTools("Hello world")).toBe(false);
      expect(promptRequiresTools("Just checking the status")).toBe(false);
    });

    test('should handle non-string input', () => {
      expect(promptRequiresTools(null)).toBe(false);
      expect(promptRequiresTools(undefined)).toBe(false);
    });
  });
});
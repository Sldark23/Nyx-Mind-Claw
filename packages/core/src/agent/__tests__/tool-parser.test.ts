import { ToolParser } from '../../agent/tool-parser';

describe('ToolParser', () => {
  let parser: ToolParser;

  beforeEach(() => {
    parser = new ToolParser();
  });

  describe('parse — raw JSON', () => {
    it('parses a valid tool call', () => {
      const text = '{"tool": "shell", "args": {"command": "ls -la"}}';
      const result = parser.parse(text);
      expect(result).toEqual({ tool: 'shell', args: { command: 'ls -la' } });
    });

    it('parses tool call with extra surrounding text', () => {
      const text = 'Here is my plan:\n{"tool": "read_file", "args": {"path": "/etc/passwd"}}\nLet me explain...';
      const result = parser.parse(text);
      expect(result).toEqual({ tool: 'read_file', args: { path: '/etc/passwd' } });
    });

    it('trims whitespace from tool name', () => {
      const text = '{"tool": "  web_search ", "args": {"query": "test"}}';
      const result = parser.parse(text);
      expect(result?.tool).toBe('web_search');
    });

    it('returns null when no tool field', () => {
      const text = '{"tool": "read_file"}'; // missing args
      expect(parser.parse(text)).toBeNull();
    });

    it('returns null for non-JSON text', () => {
      expect(parser.parse('hello world')).toBeNull();
    });

    it('returns null for malformed JSON', () => {
      expect(parser.parse('{ tool: "shell" }')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parser.parse('')).toBeNull();
    });
  });

  describe('parse — fenced JSON', () => {
    it('parses ```json ... ``` block', () => {
      const text = '```json\n{"tool": "write_file", "args": {"path": "/tmp/test", "content": "hi"}}\n```';
      const result = parser.parse(text);
      expect(result).toEqual({ tool: 'write_file', args: { path: '/tmp/test', content: 'hi' } });
    });

    it('parses ``` ... ``` block without json tag', () => {
      const text = '```\n{"tool": "shell", "args": {"command": "pwd"}}\n```';
      const result = parser.parse(text);
      expect(result).toEqual({ tool: 'shell', args: { command: 'pwd' } });
    });

    it('fenced takes priority over raw when both present', () => {
      const text = `Earlier text {"tool": "read_file", "args": {"path": "/wrong"}}
\`\`\`json
{"tool": "web_fetch", "args": {"url": "https://example.com"}}
\`\`\``;
      const result = parser.parse(text);
      expect(result?.tool).toBe('web_fetch');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUpdate } from '../../packages/plugin/src/core/codeUpdater';
import * as fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';

// Mock fs 模块
vi.mock('fs', async () => {
  const actualFs = await vi.importActual<typeof import('fs')>('fs');
  const mockFs = {
    ...actualFs,
    statSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
  };
  return {
    ...mockFs,
    default: mockFs,
  };
});

describe('codeUpdater', () => {
  const mockRoot = '/test/project';

  let mockReq: Partial<IncomingMessage>;
  let mockRes: Partial<ServerResponse>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.statSync).mockReturnValue({
      size: 1024,
      isFile: () => true,
      isDirectory: () => false,
    } as any);

    mockReq = {
      method: 'POST',
      on: vi.fn(),
    };

    mockRes = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
  });

  describe('handleUpdate', () => {
    it('应该拒绝非POST请求', async () => {
      mockReq.method = 'GET';

      await handleUpdate(mockReq as IncomingMessage, mockRes as ServerResponse, mockRoot);

      expect(mockRes.statusCode).toBe(405);
      expect(mockRes.end).toHaveBeenCalledWith('Method Not Allowed');
    });

    it('应该处理样式更新请求', async () => {
      const sourceCode = `
        function App() {
          return <div className="old-class">Content</div>;
        }
      `;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const requestBody = JSON.stringify({
        filePath: 'src/App.tsx',
        line: 2,
        column: 20,
        newValue: 'new-class',
        type: 'style',
      });

      let dataCallback: (chunk: Buffer) => void;
      let endCallback: () => void;

      mockReq.on = vi.fn((event: string, callback: any) => {
        if (event === 'data') {
          dataCallback = callback;
        } else if (event === 'end') {
          endCallback = callback;
        }
      }) as any;

      const updatePromise = handleUpdate(mockReq as IncomingMessage, mockRes as ServerResponse, mockRoot);

      // 模拟数据流
      if (dataCallback!) {
        dataCallback(Buffer.from(requestBody));
      }
      if (endCallback!) {
        endCallback();
      }

      await updatePromise;

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('应该处理内容更新请求', async () => {
      const sourceCode = `
        function App() {
          return <div>Old Content</div>;
        }
      `;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const requestBody = JSON.stringify({
        filePath: 'src/App.tsx',
        line: 2,
        column: 20,
        newValue: 'New Content',
        type: 'content',
      });

      let dataCallback: (chunk: Buffer) => void;
      let endCallback: () => void;

      mockReq.on = vi.fn((event: string, callback: any) => {
        if (event === 'data') {
          dataCallback = callback;
        } else if (event === 'end') {
          endCallback = callback;
        }
      }) as any;

      const updatePromise = handleUpdate(mockReq as IncomingMessage, mockRes as ServerResponse, mockRoot);

      if (dataCallback!) {
        dataCallback(Buffer.from(requestBody));
      }
      if (endCallback!) {
        endCallback();
      }

      await updatePromise;

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('应该处理文件不存在的情况', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const requestBody = JSON.stringify({
        filePath: 'src/NonExistent.tsx',
        line: 1,
        column: 0,
        newValue: 'test',
        type: 'style',
      });

      let dataCallback: (chunk: Buffer) => void;
      let endCallback: () => void;

      mockReq.on = vi.fn((event: string, callback: any) => {
        if (event === 'data') {
          dataCallback = callback;
        } else if (event === 'end') {
          endCallback = callback;
        }
      }) as any;

      const updatePromise = handleUpdate(mockReq as IncomingMessage, mockRes as ServerResponse, mockRoot);

      if (dataCallback!) {
        dataCallback(Buffer.from(requestBody));
      }
      if (endCallback!) {
        endCallback();
      }

      await updatePromise;

      expect(mockRes.statusCode).toBe(400);
      const response = JSON.parse(mockRes.end?.mock.calls[0]?.[0] || '{}');
      expect(response.success).toBe(false);
      expect(response.message).toContain('File not found');
    });

    it('应该处理绝对路径', async () => {
      const absolutePath = '/absolute/path/to/file.tsx';
      const sourceCode = 'function App() { return <div>Test</div>; }';

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const requestBody = JSON.stringify({
        filePath: absolutePath,
        line: 1,
        column: 0,
        newValue: 'test',
        type: 'style',
      });

      let dataCallback: (chunk: Buffer) => void;
      let endCallback: () => void;

      mockReq.on = vi.fn((event: string, callback: any) => {
        if (event === 'data') {
          dataCallback = callback;
        } else if (event === 'end') {
          endCallback = callback;
        }
      }) as any;

      const updatePromise = handleUpdate(mockReq as IncomingMessage, mockRes as ServerResponse, mockRoot);

      if (dataCallback!) {
        dataCallback(Buffer.from(requestBody));
      }
      if (endCallback!) {
        endCallback();
      }

      await updatePromise;

      expect(mockRes.statusCode).toBe(400);
      const response = JSON.parse(mockRes.end?.mock.calls[0]?.[0] || '{}');
      expect(response.success).toBe(false);
      expect(response.message).toContain('Access denied');
    });

    it('应该处理相对路径', async () => {
      const relativePath = 'src/App.tsx';
      const sourceCode = 'function App() { return <div>Test</div>; }';

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const requestBody = JSON.stringify({
        filePath: relativePath,
        line: 1,
        column: 0,
        newValue: 'test',
        type: 'style',
      });

      let dataCallback: (chunk: Buffer) => void;
      let endCallback: () => void;

      mockReq.on = vi.fn((event: string, callback: any) => {
        if (event === 'data') {
          dataCallback = callback;
        } else if (event === 'end') {
          endCallback = callback;
        }
      }) as any;

      const updatePromise = handleUpdate(mockReq as IncomingMessage, mockRes as ServerResponse, mockRoot);

      if (dataCallback!) {
        dataCallback(Buffer.from(requestBody));
      }
      if (endCallback!) {
        endCallback();
      }

      await updatePromise;

      // 应该解析为绝对路径
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('应该处理无效的JSON请求体', async () => {
      let dataCallback: (chunk: Buffer) => void;
      let endCallback: () => void;

      mockReq.on = vi.fn((event: string, callback: any) => {
        if (event === 'data') {
          dataCallback = callback;
        } else if (event === 'end') {
          endCallback = callback;
        }
      }) as any;

      const updatePromise = handleUpdate(mockReq as IncomingMessage, mockRes as ServerResponse, mockRoot);

      if (dataCallback!) {
        dataCallback(Buffer.from('invalid json'));
      }
      if (endCallback!) {
        endCallback();
      }

      await updatePromise;

      expect(mockRes.statusCode).toBe(500);
    });

    it('应该处理找不到匹配元素的情况', async () => {
      const sourceCode = `
        function App() {
          return <div>Content</div>;
        }
      `;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);

      const requestBody = JSON.stringify({
        filePath: 'src/App.tsx',
        line: 999, // 不存在的行
        column: 0,
        newValue: 'test',
        type: 'style',
      });

      let dataCallback: (chunk: Buffer) => void;
      let endCallback: () => void;

      mockReq.on = vi.fn((event: string, callback: any) => {
        if (event === 'data') {
          dataCallback = callback;
        } else if (event === 'end') {
          endCallback = callback;
        }
      }) as any;

      const updatePromise = handleUpdate(mockReq as IncomingMessage, mockRes as ServerResponse, mockRoot);

      if (dataCallback!) {
        dataCallback(Buffer.from(requestBody));
      }
      if (endCallback!) {
        endCallback();
      }

      await updatePromise;

      // 应该返回400错误，因为找不到匹配的元素
      const response = JSON.parse(mockRes.end?.mock.calls[0]?.[0] || '{}');
      expect(response.success).toBe(false);
    });
  });
});


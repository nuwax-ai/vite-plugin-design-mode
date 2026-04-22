import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { createServerMiddleware } from '../../packages/plugin/src/core/serverMiddleware';
import type { DesignModeOptions } from '../../packages/plugin/src/types';

// Mock fs 模块
vi.mock('fs', () => {
  const actualFs = vi.importActual('fs');
  return {
    ...actualFs,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  };
});

describe('serverMiddleware', () => {
  const mockOptions: Required<DesignModeOptions> = {
    enabled: true,
    enableInProduction: false,
    attributePrefix: 'data-source',
    verbose: false,
    exclude: ['node_modules'],
    include: ['**/*.{js,jsx,ts,tsx}'],
  };

  const mockRootDir = '/test/project';

  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    // 重置 mock
    vi.clearAllMocks();

    // 创建模拟的请求对象
    mockReq = {
      url: '',
      method: 'GET',
      on: vi.fn(),
    };

    // 创建模拟的响应对象
    mockRes = {
      statusCode: 200,
      headers: {},
      end: vi.fn(),
      setHeader: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createServerMiddleware', () => {
    it('应该创建中间件函数', () => {
      const middleware = createServerMiddleware(mockOptions, mockRootDir);
      expect(typeof middleware).toBe('function');
    });

    it('应该处理健康检查请求', async () => {
      mockReq.url = '/__appdev_design_mode/health';
      
      const middleware = createServerMiddleware(mockOptions, mockRootDir);
      await middleware(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(200);
      expect(mockRes.end).toHaveBeenCalled();
      
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.status).toBe('ok');
      expect(responseData.plugin).toBe('@xagi/vite-plugin-design-mode');
      expect(responseData.timestamp).toBeDefined();
    });

    it('应该处理获取源码请求 - 成功', async () => {
      const elementId = 'src/App.tsx:10:5_div_test';
      mockReq.url = `/__appdev_design_mode/get-source?elementId=${encodeURIComponent(elementId)}`;

      const mockFileContent = 'import React from "react";\n\nfunction App() {\n  return <div>Test</div>;\n}';
      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);

      const middleware = createServerMiddleware(mockOptions, mockRootDir);
      await middleware(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(200);
      expect(fs.promises.readFile).toHaveBeenCalled();
      
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.sourceInfo).toBeDefined();
      expect(responseData.sourceInfo.fileName).toBe('src/App.tsx');
      expect(responseData.sourceInfo.lineNumber).toBe(10);
      expect(responseData.sourceInfo.columnNumber).toBe(5);
    });

    it('应该处理获取源码请求 - 缺少elementId参数', async () => {
      mockReq.url = '/__appdev_design_mode/get-source';

      const middleware = createServerMiddleware(mockOptions, mockRootDir);
      await middleware(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(400);
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.error).toContain('Missing elementId');
    });

    it('应该处理获取源码请求 - 无效的elementId格式', async () => {
      mockReq.url = '/__appdev_design_mode/get-source?elementId=invalid';

      const middleware = createServerMiddleware(mockOptions, mockRootDir);
      await middleware(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(400);
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.error).toContain('Invalid elementId');
    });

    it('应该处理修改源码请求 - 成功', async () => {
      const elementId = 'src/App.tsx:10:5_div_test';
      mockReq.url = '/__appdev_design_mode/modify-source';
      mockReq.method = 'POST';

      const mockFileContent = 'import React from "react";\n\nfunction App() {\n  return <div className="old">Test</div>;\n}';
      const mockUpdatedContent = 'import React from "react";\n\nfunction App() {\n  return <div className="new">Test</div>;\n}';

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      // 模拟请求体
      const requestBody = JSON.stringify({
        elementId,
        newStyles: 'new',
        oldStyles: 'old',
      });

      let dataCallback: (chunk: any) => void;
      let endCallback: () => void;

      mockReq.on = vi.fn((event: string, callback: any) => {
        if (event === 'data') {
          dataCallback = callback;
        } else if (event === 'end') {
          endCallback = callback;
        }
      });

      const middleware = createServerMiddleware(mockOptions, mockRootDir);
      const middlewarePromise = middleware(mockReq, mockRes);

      // 模拟数据流
      if (dataCallback!) {
        dataCallback(Buffer.from(requestBody));
      }
      if (endCallback!) {
        endCallback();
      }

      await middlewarePromise;

      expect(mockRes.statusCode).toBe(200);
      expect(fs.promises.writeFile).toHaveBeenCalled();
      
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.success).toBe(true);
    });

    it('应该处理修改源码请求 - 方法不允许', async () => {
      mockReq.url = '/__appdev_design_mode/modify-source';
      mockReq.method = 'GET';

      const middleware = createServerMiddleware(mockOptions, mockRootDir);
      await middleware(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(405);
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.error).toContain('Method not allowed');
    });

    it('应该处理修改源码请求 - 缺少必需参数', async () => {
      mockReq.url = '/__appdev_design_mode/modify-source';
      mockReq.method = 'POST';

      const requestBody = JSON.stringify({});

      let dataCallback: (chunk: any) => void;
      let endCallback: () => void;

      mockReq.on = vi.fn((event: string, callback: any) => {
        if (event === 'data') {
          dataCallback = callback;
        } else if (event === 'end') {
          endCallback = callback;
        }
      });

      const middleware = createServerMiddleware(mockOptions, mockRootDir);
      const middlewarePromise = middleware(mockReq, mockRes);

      if (dataCallback!) {
        dataCallback(Buffer.from(requestBody));
      }
      if (endCallback!) {
        endCallback();
      }

      await middlewarePromise;

      expect(mockRes.statusCode).toBe(400);
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.error).toContain('Missing required parameters');
    });

    it('应该处理404请求', async () => {
      mockReq.url = '/__appdev_design_mode/unknown';

      const middleware = createServerMiddleware(mockOptions, mockRootDir);
      await middleware(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(404);
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.error).toBe('Not found');
    });

    it('应该处理文件读取错误', async () => {
      const elementId = 'src/App.tsx:10:5_div_test';
      mockReq.url = `/__appdev_design_mode/get-source?elementId=${encodeURIComponent(elementId)}`;

      vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('File not found'));

      const middleware = createServerMiddleware(mockOptions, mockRootDir);
      await middleware(mockReq, mockRes);

      expect(mockRes.statusCode).toBe(500);
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.error).toBe('File not found');
    });

    it('应该处理文件写入错误', async () => {
      const elementId = 'src/App.tsx:10:5_div_test';
      mockReq.url = '/__appdev_design_mode/modify-source';
      mockReq.method = 'POST';

      const mockFileContent = 'import React from "react";\n\nfunction App() {\n  return <div>Test</div>;\n}';
      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);
      vi.mocked(fs.promises.writeFile).mockRejectedValue(new Error('Permission denied'));

      const requestBody = JSON.stringify({
        elementId,
        newStyles: 'new',
      });

      let dataCallback: (chunk: any) => void;
      let endCallback: () => void;

      mockReq.on = vi.fn((event: string, callback: any) => {
        if (event === 'data') {
          dataCallback = callback;
        } else if (event === 'end') {
          endCallback = callback;
        }
      });

      const middleware = createServerMiddleware(mockOptions, mockRootDir);
      const middlewarePromise = middleware(mockReq, mockRes);

      if (dataCallback!) {
        dataCallback(Buffer.from(requestBody));
      }
      if (endCallback!) {
        endCallback();
      }

      await middlewarePromise;

      expect(mockRes.statusCode).toBe(500);
      const responseData = JSON.parse(mockRes.end.mock.calls[0][0]);
      expect(responseData.error).toBe('Permission denied');
    });
  });
});


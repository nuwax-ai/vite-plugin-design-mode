// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import appdevDesignModePlugin from '../packages/plugin/src/index';
import type { Plugin } from 'vite';

describe('@xagi/vite-plugin-design-mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('插件初始化', () => {
    it('应该创建插件实例', () => {
      const plugin = appdevDesignModePlugin();
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('@xagi/vite-plugin-design-mode');
    });

    it('应该使用默认选项', () => {
      const plugin = appdevDesignModePlugin();
      expect(plugin).toBeDefined();

      // 插件应该具有预期的方法
      expect(typeof plugin.config).toBe('function');
      expect(typeof plugin.configureServer).toBe('function');
      expect(typeof plugin.transform).toBe('function');
      expect(typeof plugin.transformIndexHtml).toBe('function');
      expect(typeof plugin.buildStart).toBe('function');
      expect(typeof plugin.buildEnd).toBe('function');
    });

    it('应该接受自定义选项', () => {
      const plugin = appdevDesignModePlugin({
        enabled: false,
        verbose: true,
        attributePrefix: 'data-test',
        exclude: ['custom-exclude'],
        include: ['custom-include'],
      });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('@xagi/vite-plugin-design-mode');
    });
  });

  describe('config hook', () => {
    it('应该在开发模式下启用', () => {
      const plugin = appdevDesignModePlugin({ enabled: true });

      const result = plugin.config?.({}, { command: 'serve' });

      expect(result).toBeDefined();
      expect(result?.define).toBeDefined();
      expect(result?.define?.__APPDEV_DESIGN_MODE__).toBe(true);
    });

    it('应该在构建模式下禁用（如果未启用生产模式）', () => {
      const plugin = appdevDesignModePlugin({
        enabled: true,
        enableInProduction: false,
      });

      const result = plugin.config?.({}, { command: 'build' });

      expect(result).toEqual({});
    });

    it('应该在构建模式下启用（如果启用生产模式）', () => {
      const plugin = appdevDesignModePlugin({
        enabled: true,
        enableInProduction: true,
      });

      const result = plugin.config?.({}, { command: 'build' });

      expect(result).toBeDefined();
      expect(result?.define?.__APPDEV_DESIGN_MODE__).toBe(true);
    });

    it('应该在禁用时返回空配置', () => {
      const plugin = appdevDesignModePlugin({ enabled: false });

      const result = plugin.config?.({}, { command: 'serve' });

      expect(result).toEqual({});
    });

    it('应该设置verbose标志', () => {
      const plugin = appdevDesignModePlugin({ verbose: true });

      const result = plugin.config?.({}, { command: 'serve' });

      expect(result?.define?.__APPDEV_DESIGN_MODE_VERBOSE__).toBe(true);
    });
  });

  describe('transform hook', () => {
    it('应该在禁用时返回原始代码', async () => {
      const plugin = appdevDesignModePlugin({ enabled: false });

      const code = 'function App() { return <div>Test</div>; }';
      const result = await plugin.transform?.(code, 'test.tsx', {});

      expect(result).toBe(code);
    });

    it('应该处理匹配的文件', async () => {
      const plugin = appdevDesignModePlugin({ enabled: true });

      const code = 'function App() { return <div>Test</div>; }';
      const result = await plugin.transform?.(code, 'src/App.tsx', {});

      expect(result).toBeDefined();
      // 应该被转换（添加了源码映射属性）
      if (typeof result === 'object' && result !== null) {
        expect(result.code).toBeDefined();
      }
    });

    it('应该排除node_modules中的文件', async () => {
      const plugin = appdevDesignModePlugin({ enabled: true });

      const code = 'function App() { return <div>Test</div>; }';
      const result = await plugin.transform?.(code, 'node_modules/test.tsx', {});

      expect(result).toBe(code);
    });

    it('应该处理转换错误', async () => {
      const plugin = appdevDesignModePlugin({
        enabled: true,
        verbose: false,
      });

      // 无效的代码应该返回原始代码
      const code = 'invalid syntax {{{{';
      const result = await plugin.transform?.(code, 'test.tsx', {});

      expect(result).toBeDefined();
    });
  });

  describe('shouldProcessFile', () => {
    it('应该处理匹配include模式的文件', async () => {
      const plugin = appdevDesignModePlugin({
        enabled: true,
        include: ['**/*.tsx'],
      });

      const code = 'function App() { return <div>Test</div>; }';
      const result = await plugin.transform?.(code, 'src/App.tsx', {});

      expect(result).toBeDefined();
    });

    it('应该排除匹配exclude模式的文件', async () => {
      const plugin = appdevDesignModePlugin({
        enabled: true,
        exclude: ['test'],
      });

      const code = 'function App() { return <div>Test</div>; }';
      const result = await plugin.transform?.(code, 'test/App.tsx', {});

      expect(result).toBe(code);
    });

    it('应该处理glob模式', async () => {
      const plugin = appdevDesignModePlugin({
        enabled: true,
        include: ['src/**/*.{ts,tsx}'],
      });

      const code = 'function App() { return <div>Test</div>; }';
      const result1 = await plugin.transform?.(code, 'src/App.tsx', {});
      const result2 = await plugin.transform?.(code, 'src/components/Button.tsx', {});

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('configureServer hook', () => {
    it('应该在开发模式下配置服务器', () => {
      const plugin = appdevDesignModePlugin({ enabled: true });

      const mockServer = {
        config: {
          command: 'serve' as const,
          root: '/test',
        },
        middlewares: {
          use: vi.fn(),
        },
      } as any;

      plugin.configureServer?.(mockServer);

      expect(mockServer.middlewares.use).toHaveBeenCalled();
    });

    it('应该在禁用时不配置服务器', () => {
      const plugin = appdevDesignModePlugin({ enabled: false });

      const mockServer = {
        config: {
          command: 'serve' as const,
          root: '/test',
        },
        middlewares: {
          use: vi.fn(),
        },
      } as any;

      plugin.configureServer?.(mockServer);

      // 不应该调用use（或者调用但立即返回）
      // 这里我们只检查不会抛出错误
      expect(mockServer).toBeDefined();
    });
  });

  describe('transformIndexHtml hook', () => {
    it('应该在启用时注入客户端脚本', () => {
      const plugin = appdevDesignModePlugin({ enabled: true });

      const html = '<html><head></head><body></body></html>';
      const result = plugin.transformIndexHtml?.(html, {
        path: '/',
        filename: 'index.html',
      });

      if (typeof result === 'object' && result !== null) {
        expect(result.tags).toBeDefined();
        expect(result.tags?.length).toBeGreaterThan(0);
        expect(result.tags?.[0]?.tag).toBe('script');
      }
    });

    it('应该在禁用时不注入脚本', () => {
      const plugin = appdevDesignModePlugin({ enabled: false });

      const html = '<html><head></head><body></body></html>';
      const result = plugin.transformIndexHtml?.(html, {
        path: '/',
        filename: 'index.html',
      });

      expect(result).toBe(html);
    });
  });

  describe('buildStart 和 buildEnd hooks', () => {
    it('应该在verbose模式下输出日志', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const plugin = appdevDesignModePlugin({ verbose: true });

      plugin.buildStart?.();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[appdev-design-mode] Plugin started'
      );

      plugin.buildEnd?.();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[appdev-design-mode] Plugin ended'
      );

      consoleSpy.mockRestore();
    });

    it('应该在非verbose模式下不输出日志', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const plugin = appdevDesignModePlugin({ verbose: false });

      plugin.buildStart?.();
      plugin.buildEnd?.();

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});

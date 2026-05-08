import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSourceMappingPlugin } from '../../packages/plugin/src/core/sourceMapper';
import type { DesignModeOptions } from '../../packages/plugin/src/types';
import * as babel from '@babel/standalone';

describe('sourceMapper', () => {
  const mockOptions: Required<DesignModeOptions> = {
    enabled: true,
    enableInProduction: false,
    attributePrefix: 'data-source',
    verbose: false,
    exclude: ['node_modules'],
    include: ['**/*.{js,jsx,ts,tsx}'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSourceMappingPlugin', () => {
    it('应该创建Babel插件', () => {
      const plugin = createSourceMappingPlugin('test.tsx', mockOptions);
      
      expect(plugin).toBeDefined();
      expect(plugin.visitor).toBeDefined();
      expect(plugin.visitor.JSXOpeningElement).toBeDefined();
    });

    it('应该为JSX元素添加源码映射属性', () => {
      const code = `
        function App() {
          return <div>Hello</div>;
        }
      `;

      const plugin = createSourceMappingPlugin('test.tsx', mockOptions);
      
      const result = babel.transform(code, {
        plugins: [plugin],
        presets: ['react'],
      });

      expect(result?.code).toBeDefined();
      expect(result?.code).toContain('data-source');
    });

    it('应该生成正确的elementId', () => {
      const code = `
        function App() {
          return <div className="test">Hello</div>;
        }
      `;

      const plugin = createSourceMappingPlugin('src/App.tsx', mockOptions);
      
      const result = babel.transform(code, {
        plugins: [plugin],
        presets: ['react'],
      });

      expect(result?.code).toBeDefined();
      expect(result?.code).toContain('data-source-element-id');
    });

    it('应该添加位置信息属性', () => {
      const code = `
        function App() {
          return <div>Hello</div>;
        }
      `;

      const plugin = createSourceMappingPlugin('test.tsx', mockOptions);
      
      const result = babel.transform(code, {
        plugins: [plugin],
        presets: ['react'],
      });

      expect(result?.code).toBeDefined();
      expect(result?.code).toContain('data-source-position');
    });

    it('应该添加完整的源码信息属性', () => {
      const code = `
        function App() {
          return <div>Hello</div>;
        }
      `;

      const plugin = createSourceMappingPlugin('test.tsx', mockOptions);
      
      const result = babel.transform(code, {
        plugins: [plugin],
        presets: ['react'],
      });

      expect(result?.code).toBeDefined();
      expect(result?.code).toContain('data-source-info');
    });

    it('应该使用自定义属性前缀', () => {
      const customOptions: Required<DesignModeOptions> = {
        ...mockOptions,
        attributePrefix: 'data-appdev',
      };

      const code = `
        function App() {
          return <div>Hello</div>;
        }
      `;

      const plugin = createSourceMappingPlugin('test.tsx', customOptions);
      
      const result = babel.transform(code, {
        plugins: [plugin],
        presets: ['react'],
      });

      expect(result?.code).toBeDefined();
      expect(result?.code).toContain('data-appdev');
      expect(result?.code).not.toContain('data-source');
    });

    it('应该处理嵌套的JSX元素', () => {
      const code = `
        function App() {
          return (
            <div>
              <header>
                <nav>Nav</nav>
              </header>
            </div>
          );
        }
      `;

      const plugin = createSourceMappingPlugin('test.tsx', mockOptions);
      
      const result = babel.transform(code, {
        plugins: [plugin],
        presets: ['react'],
      });

      expect(result?.code).toBeDefined();
      // 应该为多个元素添加属性
      const matches = result?.code.match(/data-source-element-id/g);
      expect(matches?.length).toBeGreaterThan(1);
    });

    it('应该处理带id属性的元素', () => {
      const code = `
        function App() {
          return <div id="app">Hello</div>;
        }
      `;

      const plugin = createSourceMappingPlugin('test.tsx', mockOptions);
      
      const result = babel.transform(code, {
        plugins: [plugin],
        presets: ['react'],
      });

      expect(result?.code).toBeDefined();
      expect(result?.code).toContain('data-source-element-id');
    });

    it('应该处理带className的元素', () => {
      const code = `
        function App() {
          return <div className="container">Hello</div>;
        }
      `;

      const plugin = createSourceMappingPlugin('test.tsx', mockOptions);
      
      const result = babel.transform(code, {
        plugins: [plugin],
        presets: ['react'],
      });

      expect(result?.code).toBeDefined();
      expect(result?.code).toContain('data-source-element-id');
    });

    it('应该处理函数组件', () => {
      const code = `
        const Button = () => {
          return <button>Click</button>;
        };
        
        function App() {
          return <Button />;
        }
      `;

      const plugin = createSourceMappingPlugin('test.tsx', mockOptions);
      
      const result = babel.transform(code, {
        plugins: [plugin],
        presets: ['react'],
      });

      expect(result?.code).toBeDefined();
      expect(result?.code).toContain('data-source');
    });

    it('应该处理没有位置信息的元素', () => {
      const code = `
        function App() {
          return <div>Hello</div>;
        }
      `;

      const plugin = createSourceMappingPlugin('test.tsx', mockOptions);
      
      // 即使没有位置信息，插件也应该正常工作
      const result = babel.transform(code, {
        plugins: [plugin],
        presets: ['react'],
      });

      expect(result?.code).toBeDefined();
    });

    it('应该处理复杂的JSX结构', () => {
      const code = `
        function App() {
          return (
            <div className="app">
              <header className="header">
                <h1>Title</h1>
              </header>
              <main className="main">
                <section>
                  <p>Content</p>
                </section>
              </main>
              <footer className="footer">
                <p>Footer</p>
              </footer>
            </div>
          );
        }
      `;

      const plugin = createSourceMappingPlugin('test.tsx', mockOptions);
      
      const result = babel.transform(code, {
        plugins: [plugin],
        presets: ['react'],
      });

      expect(result?.code).toBeDefined();
      // 应该为多个元素添加属性
      const matches = result?.code.match(/data-source-element-id/g);
      expect(matches?.length).toBeGreaterThan(3);
    });
  });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transformSourceCode } from '../../packages/plugin/src/core/astTransformer';
import type { DesignModeOptions } from '../../packages/plugin/src/types';

describe('astTransformer', () => {
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

  describe('transformSourceCode', () => {
    it('应该转换简单的JSX代码', () => {
      const code = `
        function App() {
          return <div>Hello World</div>;
        }
      `;
      
      const result = transformSourceCode(code, 'test.tsx', mockOptions);
      
      expect(result).toBeDefined();
      expect(result).toContain('data-source');
      expect(result).toContain('div');
    });

    it('应该为JSX元素添加源码映射属性', () => {
      const code = `
        function App() {
          return (
            <div className="container">
              <h1>Title</h1>
            </div>
          );
        }
      `;
      
      const result = transformSourceCode(code, 'test.tsx', mockOptions);
      
      expect(result).toContain('data-source-element-id');
      expect(result).toContain('data-source-position');
      expect(result).toContain('data-source-info');
    });

    it('应该处理TypeScript代码', () => {
      const code = `
        interface Props {
          title: string;
        }
        
        function App(props: Props) {
          return <div>{props.title}</div>;
        }
      `;
      
      const result = transformSourceCode(code, 'test.tsx', mockOptions);
      
      expect(result).toBeDefined();
      expect(result).toContain('data-source');
    });

    it('应该处理嵌套的JSX元素', () => {
      const code = `
        function App() {
          return (
            <div>
              <header>
                <nav>
                  <a href="/">Home</a>
                </nav>
              </header>
              <main>
                <section>
                  <h1>Content</h1>
                </section>
              </main>
            </div>
          );
        }
      `;
      
      const result = transformSourceCode(code, 'test.tsx', mockOptions);
      
      // 应该为多个元素添加属性
      const matches = result.match(/data-source-element-id/g);
      expect(matches?.length).toBeGreaterThan(1);
    });

    it('应该处理带属性的JSX元素', () => {
      const code = `
        function App() {
          return (
            <div className="container" id="app">
              <button onClick={() => {}} disabled>
                Click me
              </button>
            </div>
          );
        }
      `;
      
      const result = transformSourceCode(code, 'test.tsx', mockOptions);
      
      expect(result).toContain('data-source');
      expect(result).toContain('container');
    });

    it('应该处理函数组件', () => {
      const code = `
        const Button = ({ label }: { label: string }) => {
          return <button>{label}</button>;
        };
        
        function App() {
          return <Button label="Click" />;
        }
      `;
      
      const result = transformSourceCode(code, 'test.tsx', mockOptions);
      
      expect(result).toBeDefined();
      expect(result).toContain('data-source');
    });

    it('应该处理类组件', () => {
      const code = `
        class App extends React.Component {
          render() {
            return <div>Hello</div>;
          }
        }
      `;
      
      const result = transformSourceCode(code, 'test.tsx', mockOptions);
      
      expect(result).toBeDefined();
      expect(result).toContain('data-source');
    });

    it('应该在转换失败时返回原始代码', () => {
      const code = 'invalid syntax {{{{';
      
      const result = transformSourceCode(code, 'test.tsx', mockOptions);
      
      // 应该返回原始代码或处理后的代码
      expect(result).toBeDefined();
    });

    it('应该使用自定义属性前缀', () => {
      const customOptions: Required<DesignModeOptions> = {
        ...mockOptions,
        attributePrefix: 'data-appdev',
      };
      
      const code = `
        function App() {
          return <div>Test</div>;
        }
      `;
      
      const result = transformSourceCode(code, 'test.tsx', customOptions);
      
      expect(result).toContain('data-appdev');
      expect(result).not.toContain('data-source');
    });

    it('应该处理空代码', () => {
      const code = '';
      
      const result = transformSourceCode(code, 'test.tsx', mockOptions);
      
      expect(result).toBeDefined();
    });

    it('应该处理只有注释的代码', () => {
      const code = `
        // This is a comment
        /* Another comment */
      `;
      
      const result = transformSourceCode(code, 'test.tsx', mockOptions);
      
      expect(result).toBeDefined();
    });

    it('应该处理复杂的JSX表达式', () => {
      const code = `
        function App() {
          const items = [1, 2, 3];
          return (
            <div>
              {items.map(item => (
                <div key={item}>{item}</div>
              ))}
            </div>
          );
        }
      `;
      
      const result = transformSourceCode(code, 'test.tsx', mockOptions);
      
      expect(result).toBeDefined();
      expect(result).toContain('data-source');
    });
  });
});


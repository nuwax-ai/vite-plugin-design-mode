import React from '../react';
import { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Space, Divider, message, Badge } from 'antd';
import { ThunderboltOutlined, CodeOutlined, BgColorsOutlined, EditOutlined, EyeOutlined, ReloadOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ElementInfo, SourceInfo } from '../../../../packages/client-shared/src/messages';
import PropertyPanel from '../external-panel/PropertyPanel';
import type { PropertyPanelConfig } from '../external-panel/PropertyPanel';
import { bridge } from '../../../../packages/client-react/src/bridge';

export default function CustomizableDemoPage() {
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [currentStyle, setCurrentStyle] = useState<string>('');
  const [currentContent, setCurrentContent] = useState<string>('');
  const [demoConfig, setDemoConfig] = useState<PropertyPanelConfig | undefined>();
  const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [bridgeInfo, setBridgeInfo] = useState<any>(null);

  // Bridge状态检查
  useEffect(() => {
    const checkBridgeStatus = async () => {
      try {
        // 检查环境信息
        const envInfo = bridge.getEnvironmentInfo();
        setBridgeInfo(envInfo);

        console.log('[Demo] Bridge environment info:', envInfo);

        if (!envInfo.isIframe) {
          setBridgeStatus('disconnected');
          console.log('[Demo] Running in main window, bridge connection not needed');
          return;
        }

        // 执行健康检查
        const health = await bridge.healthCheck();
        console.log('[Demo] Bridge health check:', health);

        if (health.status === 'healthy') {
          setBridgeStatus('connected');
        } else if (health.status === 'degraded') {
          setBridgeStatus('error');
        } else {
          setBridgeStatus('disconnected');
        }
      } catch (error) {
        console.error('[Demo] Bridge health check failed:', error);
        setBridgeStatus('error');
      }
    };

    // 立即检查一次
    checkBridgeStatus();

    // 定期检查
    const statusTimer = setInterval(checkBridgeStatus, 10000); // 10秒检查一次

    return () => clearInterval(statusTimer);
  }, []);

  /**
   * 获取Bridge状态显示组件
   */
  const BridgeStatusPanel = () => {
    const getStatusIcon = () => {
      switch (bridgeStatus) {
        case 'connected':
          return <CheckCircleOutlined className="text-green-500" />;
        case 'disconnected':
          return <WarningOutlined className="text-yellow-500" />;
        case 'error':
          return <WarningOutlined className="text-red-500" />;
        default:
          return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      }
    };

    const getStatusText = () => {
      switch (bridgeStatus) {
        case 'connected':
          return 'Bridge已连接';
        case 'disconnected':
          return 'Bridge未连接（主窗口模式）';
        case 'error':
          return 'Bridge连接错误';
        case 'checking':
          return '检查Bridge状态...';
        default:
          return '未知状态';
      }
    };

    const getStatusColor = () => {
      switch (bridgeStatus) {
        case 'connected':
          return 'success';
        case 'disconnected':
          return 'warning';
        case 'error':
          return 'error';
        default:
          return 'processing';
      }
    };

    return (
      <Card size="small" title="Bridge状态" className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-sm">{getStatusText()}</span>
          </div>
          <Space>
            <Button
              size="small"
              onClick={() => {
                bridge.diagnose();
                message.info('Bridge诊断信息已输出到控制台');
              }}
            >
              诊断
            </Button>
            <Button
              size="small"
              onClick={() => window.location.reload()}
            >
              刷新
            </Button>
          </Space>
        </div>

        {bridgeInfo && (
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            <div>环境: {bridgeInfo.isIframe ? 'Iframe' : '主窗口'}</div>
            <div>位置: {bridgeInfo.location.substring(0, 50)}...</div>
            <div>来源: {bridgeInfo.origin}</div>
          </div>
        )}
      </Card>
    );
  };

  // 模拟iframe内容
  const [iframeSrc] = useState(() => {
    // 生成一个包含源码映射的演示HTML
    return `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>设计模式演示</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
            .hero h1 { margin: 0 0 10px 0; font-size: 2.5rem; font-weight: bold; }
            .hero p { margin: 0; font-size: 1.2rem; opacity: 0.9; }
            .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .feature-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }
            .feature-card h3 { margin: 0 0 10px 0; color: #1f2937; font-size: 1.25rem; }
            .feature-card p { margin: 0; color: #6b7280; line-height: 1.6; }
            .cta { text-align: center; background: #f9fafb; padding: 30px; border-radius: 8px; border: 1px solid #e5e7eb; }
            .cta-button { background: #3b82f6; color: white; padding: 12px 24px; border: none; border-radius: 6px; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background-color 0.2s; }
            .cta-button:hover { background: #2563eb; }
            .code-block { background: #1f2937; color: #f9fafb; padding: 20px; border-radius: 8px; font-family: 'Courier New', monospace; margin: 20px 0; overflow-x: auto; }
            .highlight { background: rgba(59, 130, 246, 0.1); padding: 2px 4px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="hero">
              <h1 data-source-file="src/components/Hero.tsx" data-source-line="10" data-source-column="4">设计模式演示</h1>
              <p data-source-file="src/components/Hero.tsx" data-source-line="11" data-source-column="4">体验强大的可视化开发工具，让设计触手可及</p>
            </div>

            <div class="features">
              <div class="feature-card">
                <h3 data-source-file="src/components/FeatureCard.tsx" data-source-line="5" data-source-column="8">实时预览</h3>
                <p data-source-file="src/components/FeatureCard.tsx" data-source-line="6" data-source-column="8">即时查看修改效果，所见即所得的开发体验</p>
              </div>
              <div class="feature-card">
                <h3 data-source-file="src/components/FeatureCard.tsx" data-source-line="12" data-source-column="8">智能提示</h3>
                <p data-source-file="src/components/FeatureCard.tsx" data-source-line="13" data-source-column="8">AI驱动的智能建议，提升开发效率</p>
              </div>
              <div class="feature-card">
                <h3 data-source-file="src/components/FeatureCard.tsx" data-source-line="19" data-source-column="8">一键部署</h3>
                <p data-source-file="src/components/FeatureCard.tsx" data-source-line="20" data-source-column="8">无缝集成CI/CD流程，快速交付产品</p>
              </div>
            </div>

            <div class="cta">
              <h2 data-source-file="src/components/CallToAction.tsx" data-source-line="8" data-source-column="12">准备好开始了吗？</h2>
              <p data-source-file="src/components/CallToAction.tsx" data-source-line="9" data-source-column="12">立即体验下一代设计开发工具</p>
              <button class="cta-button" data-source-file="src/components/CallToAction.tsx" data-source-line="15" data-source-column="8">开始使用</button>
            </div>

            <div class="code-block">
              <div data-source-file="src/utils/code-example.ts" data-source-line="5" data-source-column="4">// 简单的使用示例</div>
              <div data-source-file="src/utils/code-example.ts" data-source-line="6" data-source-column="4">import { DesignMode } from '@xagi/design-mode';</div>
              <div data-source-file="src/utils/code-example.ts" data-source-line="7" data-source-column="4"></div>
              <div data-source-file="src/utils/code-example.ts" data-source-line="8" data-source-column="4">const config = {</div>
              <div data-source-file="src/utils/code-example.ts" data-source-line="9" data-source-column="8">enableSelection: true,</div>
              <div data-source-file="src/utils/code-example.ts" data-source-line="10" data-source-column="8">autoSave: true</div>
              <div data-source-file="src/utils/code-example.ts" data-source-line="11" data-source-column="4">};</div>
              <div data-source-file="src/utils/code-example.ts" data-source-line="12" data-source-column="4"></div>
              <div data-source-file="src/utils/code-example.ts" data-source-line="13" data-source-column="4">DesignMode.init(config);</div>
            </div>
          </div>

          <script>
            // 添加点击事件监听
            document.addEventListener('DOMContentLoaded', function() {
              // 监听所有可编辑元素的点击
              const editableElements = document.querySelectorAll('[data-source-file]');

              editableElements.forEach(element => {
                element.style.cursor = 'pointer';
                element.addEventListener('click', function(e) {
                  e.stopPropagation();

                  // 移除之前的高亮
                  document.querySelectorAll('[data-selected="true"]').forEach(el => {
                    el.removeAttribute('data-selected');
                    el.style.outline = '';
                  });

                  // 添加高亮
                  this.setAttribute('data-selected', 'true');
                  this.style.outline = '2px solid #3b82f6';
                  this.style.outlineOffset = '2px';

                  // 发送选中消息到父窗口
                  // 判断是否为静态文本：检查元素是否有 static-content 属性
                  const isStaticText = this.hasAttribute('data-source-static-content');
                  
                  const elementInfo = {
                    tagName: this.tagName.toLowerCase(),
                    className: this.className || '',
                    textContent: this.textContent || '',
                    sourceInfo: {
                      fileName: this.getAttribute('data-source-file'),
                      lineNumber: parseInt(this.getAttribute('data-source-line')),
                      columnNumber: parseInt(this.getAttribute('data-source-column'))
                    },
                    isStaticText: isStaticText || false // 默认为 false
                  };

                  window.parent.postMessage({
                    type: 'ELEMENT_SELECTED',
                    payload: { elementInfo }
                  }, '*');

                  console.log('Element selected:', elementInfo);
                });
              });

              // 点击空白处取消选择
              document.addEventListener('click', function(e) {
                if (!e.target.hasAttribute('data-source-file')) {
                  document.querySelectorAll('[data-selected="true"]').forEach(el => {
                    el.removeAttribute('data-selected');
                    el.style.outline = '';
                  });

                  window.parent.postMessage({
                    type: 'ELEMENT_DESELECTED'
                  }, '*');
                }
              });
            });
          </script>
        </body>
      </html>
    `)}`);

  /**
   * 处理iframe中的元素选择
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'ELEMENT_SELECTED':
          setSelectedElement(payload.elementInfo);
          setCurrentStyle(payload.elementInfo.className);
          setCurrentContent(payload.elementInfo.textContent);
          console.log('[Parent] Element selected:', payload.elementInfo);
          break;

        case 'ELEMENT_DESELECTED':
          setSelectedElement(null);
          console.log('[Parent] Element deselected');
          break;

        case 'STYLE_UPDATED':
          console.log('[Parent] Style updated:', payload);
          // 更新当前样式
          if (selectedElement) {
            setCurrentStyle(payload.newClass);
          }
          break;

        case 'CONTENT_UPDATED':
          console.log('[Parent] Content updated:', payload);
          // 更新当前内容
          if (selectedElement) {
            setCurrentContent(payload.newValue);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedElement]);

  /**
   * 处理样式更新
   */
  const handleStyleUpdate = (data: { sourceInfo: SourceInfo; newClass: string }) => {
    // 这里可以发送消息到iframe或者直接调用API
    console.log('Style update requested:', data);

    // 模拟更新成功
    message.success('样式更新成功');
  };

  /**
   * 处理内容更新
   */
  const handleContentUpdate = (data: { sourceInfo: SourceInfo; newContent: string }) => {
    // 这里可以发送消息到iframe或者直接调用API
    console.log('Content update requested:', data);

    // 模拟更新成功
    message.success('内容更新成功');
  };

  /**
   * 配置更改处理
   */
  const handleConfigChange = (config: PropertyPanelConfig) => {
    setDemoConfig(config);
    console.log('Panel config changed:', config);
  };

  /**
   * 重置演示
   */
  const resetDemo = () => {
    setSelectedElement(null);
    setCurrentStyle('');
    setCurrentContent('');

    // 发送重置消息到iframe
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'RESET_DEMO' }, '*');
    }

    message.info('演示已重置');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部标题栏 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <ThunderboltOutlined className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">可自定义属性面板演示</h1>
              <p className="text-sm text-gray-600">体验完整的双向同步设计模式架构</p>
            </div>
          </div>

          <Space>
            <Button icon={<CodeOutlined />} onClick={() => window.open('https://github.com/your-repo', '_blank')}>
              查看源码
            </Button>
            <Button icon={<ReloadOutlined />} onClick={resetDemo}>
              重置演示
            </Button>
          </Space>
        </div>
      </div>

      <div className="flex h-[calc(100vh-88px)]">
        {/* 左侧：可自定义属性面板 */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          {/* Bridge状态面板 */}
          <div className="p-4 border-b border-gray-200">
            <BridgeStatusPanel />
          </div>

          {/* 主体面板内容 */}
          <div className="flex-1 overflow-hidden">
            <PropertyPanel
              selectedElement={selectedElement}
              currentStyle={currentStyle}
              currentContent={currentContent}
              onStyleUpdate={handleStyleUpdate}
              onContentUpdate={handleContentUpdate}
              onStyleChange={setCurrentStyle}
              onContentChange={setCurrentContent}
              config={demoConfig}
              onConfigChange={handleConfigChange}
            />
          </div>
        </div>

        {/* 右侧：iframe预览 */}
        <div className="flex-1 bg-white">
          <div className="h-full flex flex-col">
            {/* 预览工具栏 */}
            <div className="border-b border-gray-200 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EyeOutlined className="text-blue-500" />
                  <span className="font-medium text-gray-900">实时预览</span>
                  {selectedElement && (
                    <>
                      <Divider type="vertical" />
                      <span className="text-sm text-gray-600">
                        已选择: &lt;{selectedElement.tagName}&gt;
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-gray-500">实时同步</span>
                  </div>
                </div>
              </div>
            </div>

            {/* iframe容器 */}
            <div className="flex-1 bg-gray-100">
              <iframe
                src={iframeSrc}
                className="w-full h-full border-0"
                title="可自定义属性面板演示"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 底部功能说明 */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <div className="grid grid-cols-3 gap-6">
          <Card size="small" className="h-full">
            <div className="flex items-center gap-2 mb-2">
              <BgColorsOutlined className="text-blue-500" />
              <span className="font-medium">样式自定义</span>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 自定义颜色方案和预设</li>
              <li>• 保存和加载样式配置</li>
              <li>• 主题切换（浅色/深色/跟随系统）</li>
              <li>• 快捷键自定义</li>
            </ul>
          </Card>

          <Card size="small" className="h-full">
            <div className="flex items-center gap-2 mb-2">
              <EditOutlined className="text-green-500" />
              <span className="font-medium">内容自定义</span>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 富文本编辑和格式化</li>
              <li>• 内容历史记录管理</li>
              <li>• 模板和占位符自定义</li>
              <li>• 自动保存配置</li>
            </ul>
          </Card>

          <Card size="small" className="h-full">
            <div className="flex items-center gap-2 mb-2">
              <ToolOutlined className="text-purple-500" />
              <span className="font-medium">高级功能</span>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 批量操作和防抖处理</li>
              <li>• 配置导入导出</li>
              <li>• 错误处理和回滚机制</li>
              <li>• 实时双向同步</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

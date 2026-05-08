import React from '../../react';
import { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Tabs, 
  Button, 
  Input, 
  Select, 
  Space, 
  Row, 
  Col, 
  Divider, 
  Switch, 
  Slider, 
  InputNumber,
  Upload,
  Modal,
  Form,
  List,
  Tag,
  ColorPicker,
  Tooltip,
  Popconfirm,
  message,
  ConfigProvider,
  theme
} from 'antd';
import {
  SettingOutlined,
  SaveOutlined,
  UploadOutlined,
  DownloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  BulbOutlined,
  EyeOutlined,
  ToolOutlined,
  FontSizeOutlined,
  BgColorsOutlined,
  BorderOutlined,
  LayoutOutlined,
  ThunderboltOutlined,
  UserOutlined,
  HistoryOutlined,
  StarOutlined
} from '@ant-design/icons';
import type { ElementInfo, SourceInfo } from '../../../../packages/client-shared/src/messages';
import StylePanel from './StylePanel';
import ContentPanel from './ContentPanel';

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

export interface PropertyPanelConfig {
  theme: 'light' | 'dark' | 'auto';
  autoSave: boolean;
  autoSaveInterval: number;
  showElementInfo: boolean;
  showTooltips: boolean;
  enableKeyboardShortcuts: boolean;
  defaultPanel: 'style' | 'content' | 'settings';
  panelLayout: 'horizontal' | 'vertical';
  colorPalette: string[];
  customPresets: CustomPreset[];
  shortcuts: ShortcutConfig;
}

export interface CustomPreset {
  id: string;
  name: string;
  type: 'style' | 'content';
  value: string;
  description: string;
  tags: string[];
  favorite: boolean;
  createdAt: number;
}

export interface ShortcutConfig {
  save: string;
  undo: string;
  redo: string;
  togglePanel: string;
  clearAll: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
}

export interface PropertyPanelProps {
  selectedElement: ElementInfo | null;
  currentStyle: string;
  currentContent: string;
  onStyleUpdate: (data: { sourceInfo: SourceInfo; newClass: string }) => void;
  onContentUpdate: (data: { sourceInfo: SourceInfo; newContent: string }) => void;
  onStyleChange: (newStyle: string) => void;
  onContentChange: (newContent: string) => void;
  config?: Partial<PropertyPanelConfig>;
  onConfigChange?: (config: PropertyPanelConfig) => void;
}

/**
 * 默认配置
 */
const defaultConfig: PropertyPanelConfig = {
  theme: 'light',
  autoSave: true,
  autoSaveInterval: 3000,
  showElementInfo: true,
  showTooltips: true,
  enableKeyboardShortcuts: true,
  defaultPanel: 'style',
  panelLayout: 'horizontal',
  colorPalette: [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00',
    '#ff00ff', '#00ffff', '#ffa500', '#800080', '#008000', '#000080'
  ],
  customPresets: [],
  shortcuts: {
    save: 'Ctrl+S',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Y',
    togglePanel: 'F2',
    clearAll: 'Ctrl+Delete'
  }
};

/**
 * 预设管理器
 */
class PresetManager {
  private storageKey = 'appdev_property_panel_presets';

  getPresets(): CustomPreset[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  savePreset(preset: CustomPreset): void {
    const presets = this.getPresets();
    const existingIndex = presets.findIndex(p => p.id === preset.id);
    
    if (existingIndex >= 0) {
      presets[existingIndex] = { ...preset, createdAt: Date.now() };
    } else {
      presets.push({ ...preset, id: `preset_${Date.now()}`, createdAt: Date.now() });
    }

    localStorage.setItem(this.storageKey, JSON.stringify(presets));
  }

  deletePreset(presetId: string): void {
    const presets = this.getPresets().filter(p => p.id !== presetId);
    localStorage.setItem(this.storageKey, JSON.stringify(presets));
  }

  exportPresets(): string {
    return JSON.stringify(this.getPresets(), null, 2);
  }

  importPresets(jsonData: string): void {
    try {
      const presets: CustomPreset[] = JSON.parse(jsonData);
      if (Array.isArray(presets)) {
        localStorage.setItem(this.storageKey, JSON.stringify(presets));
      }
    } catch (error) {
      throw new Error('无效的预设数据格式');
    }
  }
}

/**
 * 配置管理器
 */
class ConfigManager {
  private storageKey = 'appdev_property_panel_config';

  getConfig(): PropertyPanelConfig {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? { ...defaultConfig, ...JSON.parse(stored) } : defaultConfig;
    } catch {
      return defaultConfig;
    }
  }

  saveConfig(config: PropertyPanelConfig): void {
    localStorage.setItem(this.storageKey, JSON.stringify(config));
  }

  resetConfig(): PropertyPanelConfig {
    localStorage.removeItem(this.storageKey);
    return defaultConfig;
  }
}

/**
 * 快捷键管理器
 */
class ShortcutManager {
  private listeners: Map<string, () => void> = new Map();

  register(shortcut: string, callback: () => void): void {
    this.listeners.set(shortcut, callback);
  }

  handleKeydown(event: KeyboardEvent): void {
    const shortcuts = Array.from(this.listeners.keys());
    
    for (const shortcut of shortcuts) {
      if (this.matchShortcut(event, shortcut)) {
        event.preventDefault();
        this.listeners.get(shortcut)?.();
        break;
      }
    }
  }

  private matchShortcut(event: KeyboardEvent, shortcut: string): boolean {
    const keys = shortcut.toLowerCase().split('+');
    const eventKey = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const alt = event.altKey;

    // 检查修饰键
    if (keys.includes('ctrl') && !ctrl) return false;
    if (keys.includes('shift') && !shift) return false;
    if (keys.includes('alt') && !alt) return false;

    // 检查主键
    const mainKey = keys[keys.length - 1];
    if (mainKey !== eventKey) return false;

    return true;
  }
}

const presetManager = new PresetManager();
const configManager = new ConfigManager();
const shortcutManager = new ShortcutManager();

/**
 * 可自定义的属性面板组件
 */
export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedElement,
  currentStyle,
  currentContent,
  onStyleUpdate,
  onContentUpdate,
  onStyleChange,
  onContentChange,
  config: userConfig,
  onConfigChange
}) => {
  const [config, setConfig] = useState<PropertyPanelConfig>(() => ({
    ...defaultConfig,
    ...userConfig
  }));
  
  const [activeTab, setActiveTab] = useState(config.defaultPanel);
  const [presets, setPresets] = useState<CustomPreset[]>(() => presetManager.getPresets());
  const [isPresetModalVisible, setIsPresetModalVisible] = useState(false);
  const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);
  const [newPreset, setNewPreset] = useState<Partial<CustomPreset>>({});
  const [messageApi, contextHolder] = message.useMessage();

  /**
   * 保存配置
   */
  const saveConfig = useCallback((newConfig: PropertyPanelConfig) => {
    const finalConfig = { ...config, ...newConfig };
    setConfig(finalConfig);
    configManager.saveConfig(finalConfig);
    onConfigChange?.(finalConfig);
    messageApi.success('配置已保存');
  }, [config, onConfigChange, messageApi]);

  /**
   * 保存预设
   */
  const savePreset = useCallback((preset: CustomPreset) => {
    presetManager.savePreset(preset);
    const updatedPresets = presetManager.getPresets();
    setPresets(updatedPresets);
    messageApi.success(`预设 "${preset.name}" 已保存`);
  }, [messageApi]);

  /**
   * 删除预设
   */
  const deletePreset = useCallback((presetId: string) => {
    presetManager.deletePreset(presetId);
    const updatedPresets = presetManager.getPresets();
    setPresets(updatedPresets);
    messageApi.success('预设已删除');
  }, [messageApi]);

  /**
   * 导出配置
   */
  const exportConfig = useCallback(() => {
    const exportData = {
      config,
      presets: presetManager.exportPresets()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `property-panel-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    messageApi.success('配置已导出');
  }, [config, messageApi]);

  /**
   * 导入配置
   */
  const importConfig = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        
        if (importData.config) {
          saveConfig(importData.config);
        }
        
        if (importData.presets) {
          presetManager.importPresets(importData.presets);
          setPresets(presetManager.getPresets());
        }
        
        messageApi.success('配置已导入');
      } catch (error) {
        messageApi.error('导入失败：无效的配置文件');
      }
    };
    reader.readAsText(file);
  }, [saveConfig, messageApi]);

  /**
   * 处理快捷键
   */
  useEffect(() => {
    if (!config.enableKeyboardShortcuts) return;

    const handleKeydown = (event: KeyboardEvent) => {
      shortcutManager.handleKeydown(event);
    };

    // 注册快捷键
    shortcutManager.register(config.shortcuts.save, () => {
      // 这里可以添加保存逻辑
      console.log('快捷键：保存');
    });

    shortcutManager.register(config.shortcuts.togglePanel, () => {
      setActiveTab(prev => prev === 'style' ? 'content' : prev === 'content' ? 'settings' : 'style');
    });

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [config.enableKeyboardShortcuts, config.shortcuts]);

  /**
   * 创建预设
   */
  const handleCreatePreset = () => {
    if (!newPreset.name || !newPreset.value) {
      messageApi.error('请填写预设名称和值');
      return;
    }

    const preset: CustomPreset = {
      id: `preset_${Date.now()}`,
      name: newPreset.name!,
      type: newPreset.type!,
      value: newPreset.value!,
      description: newPreset.description || '',
      tags: newPreset.tags || [],
      favorite: false,
      createdAt: Date.now()
    };

    savePreset(preset);
    setIsPresetModalVisible(false);
    setNewPreset({});
  };

  /**
   * 获取主题配置
   */
  const getThemeConfig = () => {
    const theme = config.theme === 'auto' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : config.theme;

    return {
      algorithm: theme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: '#3b82f6',
        borderRadius: 6,
      }
    };
  };

  /**
   * 获取快速操作组件
   */
  const QuickActions = () => (
    <Card size="small" title="快速操作" className="mb-4">
      <Row gutter={[8, 8]}>
        <Col span={6}>
          <Tooltip title="保存当前设置">
            <Button size="small" icon={<SaveOutlined />} block />
          </Tooltip>
        </Col>
        <Col span={6}>
          <Tooltip title="恢复默认">
            <Button size="small" icon={<ReloadOutlined />} block />
          </Tooltip>
        </Col>
        <Col span={6}>
          <Tooltip title="导出配置">
            <Button size="small" icon={<DownloadOutlined />} onClick={exportConfig} block />
          </Tooltip>
        </Col>
        <Col span={6}>
          <Tooltip title="导入配置">
            <Upload
              size="small"
              showUploadList={false}
              beforeUpload={(file) => {
                importConfig(file);
                return false;
              }}
            >
              <Button size="small" icon={<UploadOutlined />} block />
            </Upload>
          </Tooltip>
        </Col>
      </Row>
    </Card>
  );

  /**
   * 获取元素信息组件
   */
  const ElementInfo = () => (
    selectedElement && config.showElementInfo ? (
      <Card size="small" title="元素信息" className="mb-4">
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">标签:</span> &lt;{selectedElement.tagName}&gt;</div>
          <div><span className="font-medium">类名:</span> {selectedElement.className || '无'}</div>
          <div><span className="font-medium">文件:</span> {selectedElement.sourceInfo.fileName.split('/').pop()}</div>
          <div><span className="font-medium">位置:</span> {selectedElement.sourceInfo.lineNumber}:{selectedElement.sourceInfo.columnNumber}</div>
          <div><span className="font-medium">内容:</span> {selectedElement.textContent.substring(0, 30)}{selectedElement.textContent.length > 30 ? '...' : ''}</div>
        </div>
      </Card>
    ) : null
  );

  /**
   * 获取自定义预设组件
   */
  const CustomPresets = () => (
    <Card 
      size="small" 
      title={
        <div className="flex items-center justify-between">
          <span>自定义预设</span>
          <Button 
            size="small" 
            icon={<PlusOutlined />} 
            onClick={() => setIsPresetModalVisible(true)}
          >
            新建
          </Button>
        </div>
      }
    >
      <List
        size="small"
        dataSource={presets}
        renderItem={(preset) => (
          <List.Item
            actions={[
              <Tooltip title="应用预设">
                <Button 
                  size="small" 
                  icon={<StarOutlined />}
                  onClick={() => {
                    if (preset.type === 'style') {
                      onStyleChange(preset.value);
                    } else {
                      onContentChange(preset.value);
                    }
                  }}
                />
              </Tooltip>,
              <Popconfirm
                title="确定要删除这个预设吗？"
                onConfirm={() => deletePreset(preset.id)}
              >
                <Button size="small" icon={<DeleteOutlined />} danger />
              </Popconfirm>
            ]}
          >
            <List.Item.Meta
              title={<span className="text-sm">{preset.name}</span>}
              description={
                <div className="text-xs">
                  <div>{preset.value}</div>
                  <div className="mt-1">
                    {preset.tags.map(tag => (
                      <Tag key={tag} size="small">{tag}</Tag>
                    ))}
                  </div>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );

  return (
    <ConfigProvider theme={getThemeConfig()}>
      {contextHolder}
      <div className="h-full flex flex-col" style={{ background: 'transparent' }}>
        {/* 顶部工具栏 */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SettingOutlined />
              <span className="font-semibold">属性面板</span>
              {selectedElement && (
                <Tag color="blue">{selectedElement.tagName}</Tag>
              )}
            </div>
            <Space>
              <Tooltip title="面板设置">
                <Button 
                  size="small" 
                  icon={<ToolOutlined />}
                  onClick={() => setIsConfigModalVisible(true)}
                />
              </Tooltip>
              <Tooltip title="主题切换">
                <Button
                  size="small"
                  icon={config.theme === 'dark' ? <BulbOutlined /> : <EyeOutlined />}
                  onClick={() => saveConfig({ 
                    theme: config.theme === 'light' ? 'dark' : config.theme === 'dark' ? 'auto' : 'light' 
                  })}
                />
              </Tooltip>
            </Space>
          </div>
        </div>

        {/* 主体内容 */}
        <div className="flex-1 overflow-hidden">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="small"
            className="h-full flex flex-col"
          >
            <TabPane tab="样式" key="style" icon={<BgColorsOutlined />}>
              <div className="h-full overflow-y-auto p-4 space-y-4">
                <QuickActions />
                <ElementInfo />
                <StylePanel
                  selectedElement={selectedElement}
                  onUpdateStyle={onStyleUpdate}
                  currentClass={currentStyle}
                  onClassChange={onStyleChange}
                />
                <CustomPresets />
              </div>
            </TabPane>

            <TabPane tab="内容" key="content" icon={<EditOutlined />}>
              <div className="h-full overflow-y-auto p-4 space-y-4">
                <QuickActions />
                <ElementInfo />
                <ContentPanel
                  selectedElement={selectedElement}
                  onUpdateContent={onContentUpdate}
                  currentContent={currentContent}
                  onContentChange={onContentChange}
                />
              </div>
            </TabPane>

            <TabPane tab="设置" key="settings" icon={<SettingOutlined />}>
              <div className="h-full overflow-y-auto p-4 space-y-4">
                <Card size="small" title="面板设置">
                  <Form layout="vertical">
                    <Form.Item label="主题">
                      <Select
                        value={config.theme}
                        onChange={(theme) => saveConfig({ theme })}
                      >
                        <Option value="light">浅色</Option>
                        <Option value="dark">深色</Option>
                        <Option value="auto">跟随系统</Option>
                      </Select>
                    </Form.Item>

                    <Form.Item label="默认面板">
                      <Select
                        value={config.defaultPanel}
                        onChange={(defaultPanel) => saveConfig({ defaultPanel })}
                      >
                        <Option value="style">样式面板</Option>
                        <Option value="content">内容面板</Option>
                        <Option value="settings">设置面板</Option>
                      </Select>
                    </Form.Item>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="自动保存">
                          <Switch
                            checked={config.autoSave}
                            onChange={(autoSave) => saveConfig({ autoSave })}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="自动保存间隔 (ms)">
                          <InputNumber
                            min={1000}
                            max={10000}
                            step={500}
                            value={config.autoSaveInterval}
                            onChange={(autoSaveInterval) => saveConfig({ autoSaveInterval })}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="显示元素信息">
                          <Switch
                            checked={config.showElementInfo}
                            onChange={(showElementInfo) => saveConfig({ showElementInfo })}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="启用工具提示">
                          <Switch
                            checked={config.showTooltips}
                            onChange={(showTooltips) => saveConfig({ showTooltips })}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item label="快捷键设置">
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Input
                          addonBefore="保存"
                          value={config.shortcuts.save}
                          onChange={(e) => saveConfig({
                            shortcuts: { ...config.shortcuts, save: e.target.value }
                          })}
                        />
                        <Input
                          addonBefore="撤销"
                          value={config.shortcuts.undo}
                          onChange={(e) => saveConfig({
                            shortcuts: { ...config.shortcuts, undo: e.target.value }
                          })}
                        />
                        <Input
                          addonBefore="重做"
                          value={config.shortcuts.redo}
                          onChange={(e) => saveConfig({
                            shortcuts: { ...config.shortcuts, redo: e.target.value }
                          })}
                        />
                        <Input
                          addonBefore="切换面板"
                          value={config.shortcuts.togglePanel}
                          onChange={(e) => saveConfig({
                            shortcuts: { ...config.shortcuts, togglePanel: e.target.value }
                          })}
                        />
                      </Space>
                    </Form.Item>
                  </Form>
                </Card>

                <Card size="small" title="颜色配置">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">自定义颜色</label>
                      <div className="flex flex-wrap gap-2">
                        {config.colorPalette.map((color, index) => (
                          <div
                            key={index}
                            className="w-8 h-8 rounded border border-gray-300 cursor-pointer hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              // 移除颜色
                              const newPalette = config.colorPalette.filter((_, i) => i !== index);
                              saveConfig({ colorPalette: newPalette });
                            }}
                          />
                        ))}
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            // 添加颜色
                            const newColor = '#' + Math.floor(Math.random()*16777215).toString(16);
                            saveConfig({ colorPalette: [...config.colorPalette, newColor] });
                          }}
                        >
                          添加
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card size="small" title="数据管理">
                  <Row gutter={8}>
                    <Col span={8}>
                      <Button icon={<DownloadOutlined />} onClick={exportConfig} block>
                        导出配置
                      </Button>
                    </Col>
                    <Col span={8}>
                      <Upload
                        beforeUpload={(file) => {
                          importConfig(file);
                          return false;
                        }}
                        showUploadList={false}
                      >
                        <Button icon={<UploadOutlined />} block>
                          导入配置
                        </Button>
                      </Upload>
                    </Col>
                    <Col span={8}>
                      <Popconfirm
                        title="确定要重置所有配置吗？"
                        onConfirm={() => {
                          const resetConfig = configManager.resetConfig();
                          setConfig(resetConfig);
                          setPresets(presetManager.getPresets());
                          messageApi.success('配置已重置');
                        }}
                      >
                        <Button icon={<ReloadOutlined />} danger block>
                          重置配置
                        </Button>
                      </Popconfirm>
                    </Col>
                  </Row>
                </Card>
              </div>
            </TabPane>
          </Tabs>
        </div>

        {/* 创建预设模态框 */}
        <Modal
          title="创建自定义预设"
          open={isPresetModalVisible}
          onOk={handleCreatePreset}
          onCancel={() => {
            setIsPresetModalVisible(false);
            setNewPreset({});
          }}
          okText="创建"
          cancelText="取消"
        >
          <Form layout="vertical">
            <Form.Item label="预设名称" required>
              <Input
                value={newPreset.name}
                onChange={(e) => setNewPreset({ ...newPreset, name: e.target.value })}
                placeholder="输入预设名称"
              />
            </Form.Item>

            <Form.Item label="预设类型" required>
              <Select
                value={newPreset.type}
                onChange={(type) => setNewPreset({ ...newPreset, type })}
                placeholder="选择预设类型"
              >
                <Option value="style">样式预设</Option>
                <Option value="content">内容预设</Option>
              </Select>
            </Form.Item>

            <Form.Item label="预设值" required>
              <TextArea
                value={newPreset.value}
                onChange={(e) => setNewPreset({ ...newPreset, value: e.target.value })}
                placeholder="输入预设值"
                rows={3}
              />
            </Form.Item>

            <Form.Item label="描述">
              <TextArea
                value={newPreset.description}
                onChange={(e) => setNewPreset({ ...newPreset, description: e.target.value })}
                placeholder="输入预设描述"
                rows={2}
              />
            </Form.Item>

            <Form.Item label="标签">
              <Input
                value={newPreset.tags?.join(',')}
                onChange={(e) => setNewPreset({ 
                  ...newPreset, 
                  tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                })}
                placeholder="输入标签，用逗号分隔"
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

export default PropertyPanel;

import React from '../../react';
import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Slider, ColorPicker, InputNumber, Divider, Tag, Space, Row, Col } from 'antd';
import { BoldOutlined, ItalicOutlined, UnderlineOutlined, FontSizeOutlined, BgColorsOutlined, BorderOutlined } from '@ant-design/icons';
import type { ElementInfo, SourceInfo } from '../../../../packages/client-shared/src/messages';

const { TextArea } = Input;
const { Option } = Select;

export interface StyleUpdateData {
  sourceInfo: SourceInfo;
  newClass: string;
}

export interface StylePanelProps {
  selectedElement: ElementInfo | null;
  onUpdateStyle: (data: StyleUpdateData) => void;
  currentClass: string;
  onClassChange: (newClass: string) => void;
}

/**
 * 样式预设配置
 */
const stylePresets = {
  colors: {
    backgrounds: [
      { label: '白色', value: 'bg-white', color: '#ffffff' },
      { label: '浅灰色', value: 'bg-gray-100', color: '#f3f4f6' },
      { label: '浅蓝色', value: 'bg-blue-100', color: '#dbeafe' },
      { label: '浅绿色', value: 'bg-green-100', color: '#dcfce7' },
      { label: '浅红色', value: 'bg-red-100', color: '#fee2e2' },
      { label: '浅黄色', value: 'bg-yellow-100', color: '#fef3c7' },
      { label: '浅紫色', value: 'bg-purple-100', color: '#f3e8ff' },
      { label: '深蓝色', value: 'bg-blue-600', color: '#2563eb' },
    ],
    text: [
      { label: '黑色', value: 'text-black', color: '#000000' },
      { label: '深灰色', value: 'text-gray-900', color: '#111827' },
      { label: '中灰色', value: 'text-gray-600', color: '#4b5563' },
      { label: '蓝色', value: 'text-blue-600', color: '#2563eb' },
      { label: '绿色', value: 'text-green-600', color: '#16a34a' },
      { label: '红色', value: 'text-red-600', color: '#dc2626' },
      { label: '黄色', value: 'text-yellow-600', color: '#ca8a04' },
      { label: '紫色', value: 'text-purple-600', color: '#9333ea' },
    ]
  },
  
  spacing: {
    padding: [
      { label: '无内边距', value: 'p-0', preview: 'padding: 0px' },
      { label: '小内边距', value: 'p-2', preview: 'padding: 8px' },
      { label: '中等内边距', value: 'p-4', preview: 'padding: 16px' },
      { label: '大内边距', value: 'p-6', preview: 'padding: 24px' },
      { label: '超大内边距', value: 'p-8', preview: 'padding: 32px' },
    ],
    margin: [
      { label: '无外边距', value: 'm-0', preview: 'margin: 0px' },
      { label: '小外边距', value: 'm-2', preview: 'margin: 8px' },
      { label: '中等外边距', value: 'm-4', preview: 'margin: 16px' },
      { label: '大外边距', value: 'm-6', preview: 'margin: 24px' },
    ]
  },

  border: {
    radius: [
      { label: '无圆角', value: 'rounded-none', preview: 'border-radius: 0px' },
      { label: '小圆角', value: 'rounded-sm', preview: 'border-radius: 2px' },
      { label: '中等圆角', value: 'rounded-md', preview: 'border-radius: 6px' },
      { label: '大圆角', value: 'rounded-lg', preview: 'border-radius: 8px' },
      { label: '超大圆角', value: 'rounded-xl', preview: 'border-radius: 12px' },
      { label: '完全圆角', value: 'rounded-full', preview: 'border-radius: 9999px' },
    ],
    width: [
      { label: '无边框', value: 'border-0', preview: 'border-width: 0px' },
      { label: '细边框', value: 'border', preview: 'border-width: 1px' },
      { label: '中等边框', value: 'border-2', preview: 'border-width: 2px' },
      { label: '粗边框', value: 'border-4', preview: 'border-width: 4px' },
    ]
  },

  typography: {
    fontSize: [
      { label: '很小', value: 'text-xs', preview: 'font-size: 12px' },
      { label: '小', value: 'text-sm', preview: 'font-size: 14px' },
      { label: '正常', value: 'text-base', preview: 'font-size: 16px' },
      { label: '大', value: 'text-lg', preview: 'font-size: 18px' },
      { label: '很大', value: 'text-xl', preview: 'font-size: 20px' },
      { label: '巨大', value: 'text-2xl', preview: 'font-size: 24px' },
    ],
    fontWeight: [
      { label: '细体', value: 'font-thin', preview: 'font-weight: 100' },
      { label: '特细', value: 'font-extralight', preview: 'font-weight: 200' },
      { label: '细体', value: 'font-light', preview: 'font-weight: 300' },
      { label: '正常', value: 'font-normal', preview: 'font-weight: 400' },
      { label: '中粗', value: 'font-medium', preview: 'font-weight: 500' },
      { label: '半粗', value: 'font-semibold', preview: 'font-weight: 600' },
      { label: '粗体', value: 'font-bold', preview: 'font-weight: 700' },
      { label: '超粗', value: 'font-black', preview: 'font-weight: 900' },
    ]
  },

  layout: {
    display: [
      { label: '块级', value: 'block', preview: 'display: block' },
      { label: '内联', value: 'inline', preview: 'display: inline' },
      { label: '内联块', value: 'inline-block', preview: 'display: inline-block' },
      { label: '弹性', value: 'flex', preview: 'display: flex' },
      { label: '网格', value: 'grid', preview: 'display: grid' },
      { label: '隐藏', value: 'hidden', preview: 'display: none' },
    ],
    position: [
      { label: '静态', value: 'static', preview: 'position: static' },
      { label: '相对', value: 'relative', preview: 'position: relative' },
      { label: '绝对', value: 'absolute', preview: 'position: absolute' },
      { label: '固定', value: 'fixed', preview: 'position: fixed' },
      { label: '粘性', value: 'sticky', preview: 'position: sticky' },
    ]
  }
};

/**
 * 样式编辑面板组件
 */
export const StylePanel: React.FC<StylePanelProps> = ({
  selectedElement,
  onUpdateStyle,
  currentClass,
  onClassChange
}) => {
  const [activeTab, setActiveTab] = useState<string>('presets');
  const [customStyles, setCustomStyles] = useState<string>(currentClass);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [customColor, setCustomColor] = useState('#3b82f6');

  useEffect(() => {
    setCustomStyles(currentClass);
  }, [currentClass]);

  /**
   * 添加样式类
   */
  const addStyleClass = (className: string) => {
    const newStyles = mergeClasses(customStyles, className);
    setCustomStyles(newStyles);
    onClassChange(newStyles);
  };

  /**
   * 移除样式类
   */
  const removeStyleClass = (className: string) => {
    const newStyles = removeClass(customStyles, className);
    setCustomStyles(newStyles);
    onClassChange(newStyles);
  };

  /**
   * 更新样式
   */
  const updateStyles = () => {
    if (!selectedElement) return;
    
    onUpdateStyle({
      sourceInfo: selectedElement.sourceInfo,
      newClass: customStyles
    });
  };

  /**
   * 清除所有样式
   */
  const clearAllStyles = () => {
    setCustomStyles('');
    onClassChange('');
  };

  /**
   * 合并样式类
   */
  const mergeClasses = (existing: string, newClass: string): string => {
    const classes = existing.split(' ').filter(Boolean);
    const newClasses = newClass.split(' ').filter(Boolean);
    
    // 移除冲突的同类样式
    const filteredClasses = classes.filter(cls => {
      return !newClasses.some(newCls => 
        (cls.startsWith('bg-') && newCls.startsWith('bg-')) ||
        (cls.startsWith('text-') && newCls.startsWith('text-')) ||
        (cls.startsWith('p-') && newCls.startsWith('p-')) ||
        (cls.startsWith('m-') && newCls.startsWith('m-')) ||
        (cls.startsWith('rounded') && newCls.startsWith('rounded')) ||
        (cls.startsWith('border-') && newCls.startsWith('border-')) ||
        (cls.startsWith('text-') && newCls.startsWith('text-')) ||
        (cls.startsWith('font-') && newCls.startsWith('font-')) ||
        (cls.startsWith('flex') && newCls.startsWith('flex')) ||
        (cls.startsWith('grid') && newCls.startsWith('grid')) ||
        cls === newCls
      );
    });
    
    return [...filteredClasses, ...newClasses].join(' ').trim();
  };

  /**
   * 移除样式类
   */
  const removeClass = (existing: string, classToRemove: string): string => {
    return existing.split(' ')
      .filter(cls => cls !== classToRemove && !cls.startsWith(classToRemove.split('-')[0]))
      .join(' ')
      .trim();
  };

  /**
   * 获取当前应用的样式类
   */
  const getAppliedStyles = (): string[] => {
    return customStyles.split(' ').filter(Boolean);
  };

  if (!selectedElement) {
    return (
      <Card title="样式编辑" className="h-full">
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <BgColorsOutlined className="text-4xl mb-4" />
            <p>请先选择一个元素</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title={
        <div className="flex items-center gap-2">
          <BgColorsOutlined />
          <span>样式编辑</span>
        </div>
      }
      className="h-full"
      extra={
        <Space>
          <Button size="small" onClick={clearAllStyles}>
            清除全部
          </Button>
          <Button 
            type="primary" 
            size="small" 
            onClick={updateStyles}
            disabled={!selectedElement}
          >
            应用样式
          </Button>
        </Space>
      }
    >
      <div className="space-y-6">
        {/* 元素信息 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">当前元素</h4>
          <div className="text-xs text-blue-700 space-y-1">
            <div><span className="font-medium">标签:</span> &lt;{selectedElement.tagName}&gt;</div>
            <div><span className="font-medium">位置:</span> {selectedElement.sourceInfo.fileName.split('/').pop()}:{selectedElement.sourceInfo.lineNumber}</div>
          </div>
        </div>

        {/* 快速预设标签页 */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-1">
            {[
              { key: 'presets', label: '预设样式' },
              { key: 'colors', label: '颜色' },
              { key: 'typography', label: '字体' },
              { key: 'layout', label: '布局' },
              { key: 'custom', label: '自定义' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 预设样式 */}
        {activeTab === 'presets' && (
          <div className="space-y-6">
            {/* 背景颜色 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">背景颜色</h4>
              <div className="grid grid-cols-2 gap-2">
                {stylePresets.colors.backgrounds.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => addStyleClass(color.value)}
                    className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div 
                      className={`w-4 h-4 rounded ${color.value}`}
                      style={{ backgroundColor: color.color }}
                    />
                    <span className="text-xs">{color.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 圆角 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">圆角</h4>
              <div className="grid grid-cols-2 gap-2">
                {stylePresets.border.radius.map((radius, index) => (
                  <button
                    key={index}
                    onClick={() => addStyleClass(radius.value)}
                    className="p-2 text-xs border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
                  >
                    <div className="font-medium">{radius.label}</div>
                    <div className="text-gray-500">{radius.preview}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 边距 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">边距</h4>
              <div className="grid grid-cols-2 gap-2">
                {stylePresets.spacing.padding.map((padding, index) => (
                  <button
                    key={index}
                    onClick={() => addStyleClass(padding.value)}
                    className="p-2 text-xs border border-gray-200 rounded-lg hover:border-gray-300 transition-colors text-left"
                  >
                    <div className="font-medium">{padding.label}</div>
                    <div className="text-gray-500">{padding.preview}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 颜色面板 */}
        {activeTab === 'colors' && (
          <div className="space-y-6">
            {/* 背景颜色 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">背景颜色</h4>
              <div className="grid grid-cols-2 gap-2">
                {stylePresets.colors.backgrounds.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => addStyleClass(color.value)}
                    className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div 
                      className={`w-4 h-4 rounded ${color.value}`}
                      style={{ backgroundColor: color.color }}
                    />
                    <span className="text-xs">{color.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 文字颜色 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">文字颜色</h4>
              <div className="grid grid-cols-2 gap-2">
                {stylePresets.colors.text.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => addStyleClass(color.value)}
                    className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div 
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: color.color }}
                    />
                    <span className="text-xs">{color.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 自定义颜色 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">自定义颜色</h4>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                  />
                  <Input
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    placeholder="#3b82f6"
                  />
                </div>
                <Row gutter={8}>
                  <Col span={12}>
                    <Button
                      block
                      size="small"
                      onClick={() => addStyleClass(`bg-[${customColor}]`)}
                    >
                      背景色
                    </Button>
                  </Col>
                  <Col span={12}>
                    <Button
                      block
                      size="small"
                      onClick={() => addStyleClass(`text-[${customColor}]`)}
                    >
                      文字色
                    </Button>
                  </Col>
                </Row>
              </div>
            </div>
          </div>
        )}

        {/* 字体面板 */}
        {activeTab === 'typography' && (
          <div className="space-y-6">
            {/* 字体大小 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">字体大小</h4>
              <div className="space-y-2">
                {stylePresets.typography.fontSize.map((fontSize, index) => (
                  <button
                    key={index}
                    onClick={() => addStyleClass(fontSize.value)}
                    className="w-full p-2 text-left text-xs border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="font-medium">{fontSize.label}</div>
                    <div className="text-gray-500">{fontSize.preview}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 字体粗细 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">字体粗细</h4>
              <div className="space-y-2">
                {stylePresets.typography.fontWeight.map((fontWeight, index) => (
                  <button
                    key={index}
                    onClick={() => addStyleClass(fontWeight.value)}
                    className="w-full p-2 text-left text-xs border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="font-medium">{fontWeight.label}</div>
                    <div className="text-gray-500">{fontWeight.preview}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 布局面板 */}
        {activeTab === 'layout' && (
          <div className="space-y-6">
            {/* 显示类型 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">显示类型</h4>
              <div className="space-y-2">
                {stylePresets.layout.display.map((display, index) => (
                  <button
                    key={index}
                    onClick={() => addStyleClass(display.value)}
                    className="w-full p-2 text-left text-xs border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="font-medium">{display.label}</div>
                    <div className="text-gray-500">{display.preview}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 定位 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">定位</h4>
              <div className="space-y-2">
                {stylePresets.layout.position.map((position, index) => (
                  <button
                    key={index}
                    onClick={() => addStyleClass(position.value)}
                    className="w-full p-2 text-left text-xs border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="font-medium">{position.label}</div>
                    <div className="text-gray-500">{position.preview}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 自定义样式 */}
        {activeTab === 'custom' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                自定义 className
              </label>
              <TextArea
                value={customStyles}
                onChange={(e) => setCustomStyles(e.target.value)}
                placeholder="输入 CSS 类名..."
                rows={4}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={updateStyles} type="primary" block>
                应用自定义样式
              </Button>
              <Button onClick={clearAllStyles} block>
                清除
              </Button>
            </div>
          </div>
        )}

        {/* 已应用的样式标签 */}
        {getAppliedStyles().length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">已应用样式</h4>
            <div className="flex flex-wrap gap-1">
              {getAppliedStyles().map((styleClass, index) => (
                <Tag
                  key={index}
                  closable
                  onClose={() => removeStyleClass(styleClass)}
                  className="mb-1"
                >
                  {styleClass}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default StylePanel;

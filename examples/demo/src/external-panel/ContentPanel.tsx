import React from '../../react';
import { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Space, Row, Col, Divider, Tooltip, Badge } from 'antd';
import {
  FontSizeOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  EditOutlined,
  HistoryOutlined,
  ClearOutlined,
  SaveOutlined,
  UndoOutlined,
  EyeOutlined
} from '@ant-design/icons';
import type { ElementInfo, SourceInfo } from '../../../../packages/client-shared/src/messages';

const { TextArea } = Input;
const { Option } = Select;

export interface ContentUpdateData {
  sourceInfo: SourceInfo;
  newContent: string;
}

export interface ContentPanelProps {
  selectedElement: ElementInfo | null;
  onUpdateContent: (data: ContentUpdateData) => void;
  currentContent: string;
  onContentChange: (newContent: string) => void;
}

/**
 * 内容编辑工具配置
 */
const contentTools = {
  // 文本格式化
  formatting: [
    { label: '加粗', value: '**', icon: <BoldOutlined />, description: '添加加粗格式' },
    { label: '斜体', value: '*', icon: <ItalicOutlined />, description: '添加斜体格式' },
    { label: '下划线', value: '__', icon: <UnderlineOutlined />, description: '添加下划线' }
  ],

  // 对齐方式
  alignment: [
    { label: '左对齐', value: 'text-left', icon: <AlignLeftOutlined /> },
    { label: '居中对齐', value: 'text-center', icon: <AlignCenterOutlined /> },
    { label: '右对齐', value: 'text-right', icon: <AlignRightOutlined /> }
  ],

  // 文本样式预设
  textStyles: [
    { label: '标题 1', value: 'text-4xl font-bold', preview: '大标题' },
    { label: '标题 2', value: 'text-3xl font-semibold', preview: '中标题' },
    { label: '标题 3', value: 'text-2xl font-medium', preview: '小标题' },
    { label: '正文', value: 'text-base', preview: '普通文本' },
    { label: '小字', value: 'text-sm text-gray-600', preview: '小字体' },
    { label: '说明文字', value: 'text-xs text-gray-500', preview: '说明文字' }
  ],

  // 常用的占位符文本
  placeholders: [
    '请输入内容...',
    '点击编辑文本',
    '请输入标题',
    '请输入描述',
    '请输入按钮文本',
    '请输入链接文本'
  ]
};

/**
 * 内容历史记录
 */
interface ContentHistory {
  id: string;
  content: string;
  timestamp: number;
  description: string;
}

/**
 * 内容编辑面板组件
 */
export const ContentPanel: React.FC<ContentPanelProps> = ({
  selectedElement,
  onUpdateContent,
  currentContent,
  onContentChange
}) => {
  const [activeTab, setActiveTab] = useState<string>('edit');
  const [editingContent, setEditingContent] = useState<string>(currentContent);
  const [originalContent, setOriginalContent] = useState<string>(currentContent);
  const [contentHistory, setContentHistory] = useState<ContentHistory[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [autoSave, setAutoSave] = useState<boolean>(true);
  const [wordCount, setWordCount] = useState<number>(0);
  const [characterCount, setCharacterCount] = useState<number>(0);

  useEffect(() => {
    setEditingContent(currentContent);
    setOriginalContent(currentContent);
    updateCounts(currentContent);
  }, [currentContent]);

  /**
   * 更新字符和单词计数
   */
  const updateCounts = (content: string) => {
    setCharacterCount(content.length);
    const words = content.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  };

  /**
   * 处理内容变化
   */
  const handleContentChange = (newContent: string) => {
    setEditingContent(newContent);
    onContentChange(newContent);
    updateCounts(newContent);

    // 自动保存历史记录
    if (autoSave && newContent !== originalContent) {
      addToHistory(newContent, '自动保存');
    }
  };

  /**
   * 添加到历史记录
   */
  const addToHistory = (content: string, description: string) => {
    const historyItem: ContentHistory = {
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      timestamp: Date.now(),
      description
    };

    setContentHistory(prev => [historyItem, ...prev.slice(0, 9)]); // 保留最新10条记录
  };

  /**
   * 恢复到历史记录
   */
  const restoreFromHistory = (historyItem: ContentHistory) => {
    setEditingContent(historyItem.content);
    onContentChange(historyItem.content);
    updateCounts(historyItem.content);
    addToHistory(historyItem.content, '恢复历史记录');
  };

  /**
   * 清除内容
   */
  const clearContent = () => {
    setEditingContent('');
    onContentChange('');
    updateCounts('');
    addToHistory('', '清除内容');
  };

  /**
   * 恢复原始内容
   */
  const restoreOriginal = () => {
    setEditingContent(originalContent);
    onContentChange(originalContent);
    updateCounts(originalContent);
  };

  /**
   * 应用内容更新
   */
  const applyChanges = () => {
    if (!selectedElement) return;

    onUpdateContent({
      sourceInfo: selectedElement.sourceInfo,
      newContent: editingContent
    });

    setOriginalContent(editingContent);
    addToHistory(editingContent, '应用更改');
  };

  /**
   * 插入格式化文本
   */
  const insertFormatting = (format: string) => {
    const textarea = document.querySelector('textarea[data-content-editor]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editingContent.substring(start, end);

    let newContent = editingContent;
    let newSelectedText = selectedText;

    // 根据格式化类型插入
    switch (format) {
      case '**':
        newSelectedText = `**${selectedText}**`;
        break;
      case '*':
        newSelectedText = `*${selectedText}*`;
        break;
      case '__':
        newSelectedText = `__${selectedText}__`;
        break;
    }

    newContent =
      editingContent.substring(0, start) +
      newSelectedText +
      editingContent.substring(end);

    handleContentChange(newContent);

    // 重新设置光标位置
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + (format === '**' || format === '__' ? 2 : 1),
        start + (format === '**' || format === '__' ? 2 : 1) + selectedText.length
      );
    }, 0);
  };

  /**
   * 插入占位符
   */
  const insertPlaceholder = (placeholder: string) => {
    const newContent = editingContent + placeholder;
    handleContentChange(newContent);
  };

  /**
   * 应用文本样式
   */
  const applyTextStyle = (style: string) => {
    // 这里可以应用内联样式或类名
    console.log('Applying text style:', style);
  };

  /**
   * 获取文本统计信息
   */
  const getTextStats = () => {
    const lines = editingContent.split('\n');
    const paragraphs = editingContent.split('\n\n').filter(p => p.trim().length > 0);

    return {
      lines: lines.length,
      paragraphs: paragraphs.length,
      words: wordCount,
      characters: characterCount,
      charactersNoSpaces: editingContent.replace(/\s/g, '').length
    };
  };

  if (!selectedElement) {
    return (
      <Card title="内容编辑" className="h-full">
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <EditOutlined className="text-4xl mb-4" />
            <p>请先选择一个元素</p>
          </div>
        </div>
      </Card>
    );
  }

  // Check if element is editable (has static text)
  if (selectedElement.isStaticText === false) {
    return (
      <Card title="内容编辑" className="h-full">
        <div className="flex items-center justify-center h-64 text-orange-500">
          <div className="text-center">
            <EditOutlined className="text-4xl mb-4" />
            <p className="font-semibold mb-2">该元素不可编辑</p>
            <p className="text-sm text-gray-600">只有纯静态文本可以编辑</p>
            <p className="text-xs text-gray-500 mt-1">（不包含变量或表达式）</p>
          </div>
        </div>
      </Card>
    );
  }

  const stats = getTextStats();

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <EditOutlined />
          <span>内容编辑</span>
          <Badge count={contentHistory.length} showZero />
        </div>
      }
      className="h-full"
      extra={
        <Space>
          <Tooltip title="预览模式">
            <Button
              size="small"
              icon={isPreviewMode ? <EditOutlined /> : <EyeOutlined />}
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              type={isPreviewMode ? 'primary' : 'default'}
            >
              {isPreviewMode ? '编辑' : '预览'}
            </Button>
          </Tooltip>
          <Button size="small" onClick={clearContent} icon={<ClearOutlined />}>
            清除
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={applyChanges}
            disabled={!selectedElement || editingContent === originalContent}
            icon={<SaveOutlined />}
          >
            保存更改
          </Button>
        </Space>
      }
    >
      <div className="space-y-6">
        {/* 元素信息 */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-green-900 mb-2">当前元素</h4>
          <div className="text-xs text-green-700 space-y-1">
            <div><span className="font-medium">标签:</span> &lt;{selectedElement.tagName}&gt;</div>
            <div><span className="font-medium">当前位置:</span> {selectedElement.sourceInfo.fileName.split('/').pop()}:{selectedElement.sourceInfo.lineNumber}</div>
            <div><span className="font-medium">原内容:</span> {originalContent.substring(0, 50)}{originalContent.length > 50 ? '...' : ''}</div>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-1">
            {[
              { key: 'edit', label: '编辑内容' },
              { key: 'format', label: '格式化' },
              { key: 'style', label: '文本样式' },
              { key: 'history', label: '历史记录' },
              { key: 'stats', label: '统计信息' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 编辑内容 */}
        {activeTab === 'edit' && (
          <div className="space-y-4">
            {isPreviewMode ? (
              // 预览模式
              <div className="border border-gray-200 rounded-lg p-4 min-h-32 bg-white">
                <div dangerouslySetInnerHTML={{ __html: editingContent.replace(/\n/g, '<br>') }} />
              </div>
            ) : (
              // 编辑模式
              <div>
                <TextArea
                  data-content-editor
                  value={editingContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="输入或编辑文本内容..."
                  rows={8}
                  className="font-mono text-sm"
                />

                {/* 快速工具栏 */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  <Space size="small">
                    <Tooltip title="撤销">
                      <Button
                        size="small"
                        icon={<UndoOutlined />}
                        disabled={contentHistory.length === 0}
                        onClick={() => contentHistory.length > 0 && restoreFromHistory(contentHistory[0])}
                      />
                    </Tooltip>
                    <Divider type="vertical" />
                    {contentTools.formatting.map((format, index) => (
                      <Tooltip key={index} title={format.description}>
                        <Button
                          size="small"
                          icon={format.icon}
                          onClick={() => insertFormatting(format.value)}
                        />
                      </Tooltip>
                    ))}
                  </Space>

                  <span className="text-xs text-gray-500">
                    {wordCount} 词 | {characterCount} 字符
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 格式化工具 */}
        {activeTab === 'format' && (
          <div className="space-y-6">
            {/* 快速格式化 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">快速格式化</h4>
              <div className="grid grid-cols-3 gap-2">
                {contentTools.formatting.map((format, index) => (
                  <Button
                    key={index}
                    icon={format.icon}
                    onClick={() => insertFormatting(format.value)}
                    className="flex flex-col items-center p-3 h-auto"
                  >
                    <span className="text-xs">{format.label}</span>
                    <span className="text-xs text-gray-500 mt-1">{format.description}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 占位符 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">常用占位符</h4>
              <div className="space-y-2">
                {contentTools.placeholders.map((placeholder, index) => (
                  <Button
                    key={index}
                    size="small"
                    onClick={() => insertPlaceholder(placeholder)}
                    className="w-full text-left justify-start"
                  >
                    {placeholder}
                  </Button>
                ))}
              </div>
            </div>

            {/* 对齐方式 */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">对齐方式</h4>
              <div className="grid grid-cols-3 gap-2">
                {contentTools.alignment.map((align, index) => (
                  <Button
                    key={index}
                    icon={align.icon}
                    onClick={() => applyTextStyle(align.value)}
                    className="flex items-center justify-center"
                  >
                    {align.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 文本样式 */}
        {activeTab === 'style' && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">文本样式预设</h4>
            <div className="space-y-2">
              {contentTools.textStyles.map((style, index) => (
                <button
                  key={index}
                  onClick={() => applyTextStyle(style.value)}
                  className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{style.label}</span>
                    <span className="text-xs text-gray-500">{style.value}</span>
                  </div>
                  <div className={`mt-1 ${style.value}`}>
                    {style.preview}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 历史记录 */}
        {activeTab === 'history' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900">编辑历史</h4>
              <Button
                size="small"
                icon={<HistoryOutlined />}
                onClick={() => setContentHistory([])}
              >
                清除历史
              </Button>
            </div>

            {contentHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <HistoryOutlined className="text-2xl mb-2" />
                <p>暂无历史记录</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {contentHistory.map((item, index) => (
                  <div
                    key={item.id}
                    className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer"
                    onClick={() => restoreFromHistory(item)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-900">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-xs text-gray-500">{item.description}</span>
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {item.content.substring(0, 60)}{item.content.length > 60 ? '...' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 统计信息 */}
        {activeTab === 'stats' && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4">文本统计</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.words}</div>
                <div className="text-sm text-gray-600">词数</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.characters}</div>
                <div className="text-sm text-gray-600">字符数（含空格）</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.charactersNoSpaces}</div>
                <div className="text-sm text-gray-600">字符数（不含空格）</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.lines}</div>
                <div className="text-sm text-gray-600">行数</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.paragraphs}</div>
                <div className="text-sm text-gray-600">段落数</div>
              </div>
            </div>

            {/* 阅读时间估算 */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-900">
                <span className="font-medium">预估阅读时间:</span> 约 {Math.ceil(stats.words / 200)} 分钟
              </div>
            </div>
          </div>
        )}

        {/* 自动保存设置 */}
        <div className="pt-4 border-t border-gray-200">
          <Row align="middle" gutter={16}>
            <Col span={12}>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="rounded"
                />
                自动保存历史
              </label>
            </Col>
            <Col span={12}>
              <Button
                size="small"
                onClick={restoreOriginal}
                disabled={editingContent === originalContent}
                block
              >
                恢复原始内容
              </Button>
            </Col>
          </Row>
        </div>
      </div>
    </Card>
  );
};

export default ContentPanel;

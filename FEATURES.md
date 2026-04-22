# Vite Design Mode 插件 - 功能文档

本文档列出了 `@xagi/vite-plugin-design-mode` 当前支持的功能，作为维护、测试和开发的参考。

## 1. 核心功能 (Core Functionality)

### 1.0 框架支持与识别 (Framework Support & Detection)
- **动态双栈支持**: 支持 `react-vite` 与 `vue3-vite` 两种项目形态。
- **自动识别**: `framework: 'auto'` 会根据项目依赖自动选择 React 或 Vue 3 处理链路。
- **显式模式**: 可通过 `framework: 'react' | 'vue'` 强制指定处理模式。
- **Vue 2 保护**: 检测到 `vue@2` 或 `@vitejs/plugin-vue2` 时，插件会快速失败并提示升级到 Vue 3，避免部分可用的隐性问题。

### 1.1 元素选择 (Element Selection)
- **点击选择**: 点击 iframe 中的元素即可选中。
- **高亮显示**: 选中的元素会显示蓝色实线边框 (`outline: 2px solid #007acc`)。
- **悬停效果**: 鼠标悬停在元素上时显示虚线边框 (`outline: 1px dashed #007acc`)。
- **面包屑导航**: 显示选中元素的 DOM 层级路径。

### 1.2 组件识别 (Component Identification)
- **基本信息**: 显示标签名 (`tagName`)、类名 (`className`) 和文本内容。
- **源码映射**: 识别源文件路径 (`fileName`)、行号 (`lineNumber`) 和列号 (`columnNumber`)。
- **组件名称**: 识别 React 组件名称（例如 `Button`, `CardTitle`）。
- **组件定义**: 显示组件的导入路径（例如 `@/components/ui/button`），以区分组件的使用位置和定义位置。
- **父级组件**: 识别 React 树中的父级组件。

## 2. 编辑能力 (Editing Capabilities)

### 2.1 静态内容编辑 (Static Content Editing)
- **双击编辑**: 双击静态文本元素即可进入 `contentEditable` 模式。
- **仅限纯文本**: 只有包含**纯静态文本**（无变量、表达式或子元素）的元素才能编辑。这是通过 `data-xagi-static-content` 属性强制执行的。
- **实时预览**: 修改内容会立即反映在浏览器中。
- **源码同步**: 失去焦点（保存）时，更改会发送到服务器并写入源文件。

### 2.2 样式 (Class) 编辑 (Style Editing)
- **Class 修改**: 支持添加、删除或修改 Tailwind CSS 类名。
- **实时更新**: 类名更改会立即应用到 DOM。
- **源码同步**: 更改会持久化保存到源代码中。

### 2.3 列表项同步 (List Item Synchronization)
- **智能分组**: 编辑列表项（例如在 `.map()` 循环中）时，插件会使用生成的 `element-id` 识别所有相关项。
- **同步更新**:
    - **内容**: 编辑一个列表项的静态文本会更新预览中的*所有*实例（以保持一致性）。
    - **样式**: 修改一个列表项的 Class 会将新样式应用到*所有*实例。

## 3. 技术实现 (Technical Implementation)

### 3.1 优化的数据属性 (Optimized Data Attributes)
为了减少 DOM 体积，插件采用了紧凑的属性策略：
- **`data-xagi-info`**: 单个 JSON 属性，包含所有元数据（`fileName`, `line`, `column`, `componentName`, `importPath`, `elementId`）。
- **`data-xagi-element-id`**: 简短且唯一的元素标识符（格式：`file:line:col_tag`）。
- **`data-xagi-static-content`**: 布尔标志 (`"true"`)，表示元素仅包含纯静态文本。
- **`data-xagi-children-source`**: 追踪静态文本子元素的来源位置（用于透传组件）。

### 3.2 Babel 插件 (`sourceMapper.ts`)
- **AST 遍历**: 分析代码以查找 JSX 元素。
- **导入追踪**: 追踪 `ImportDeclaration` 以解析组件定义。
- **静态分析**: 确定内容是否为静态 (`isStaticContent`)。
- **属性注入**: 在构建/服务过程中注入 `data-xagi-*` 属性。

### 3.2.1 Vue SFC 转换链路 (`vueSfcTransformer.ts`)
- **模板解析**: 使用 `@vue/compiler-sfc` 与 `@vue/compiler-dom` 解析 `.vue` 模板 AST。
- **安全注入**: 在模板节点中注入源码映射属性，供运行时选择与编辑能力使用。
- **安全回写**: 对 `class` 与静态文本进行 AST 级更新，复杂动态表达式场景保护性拒绝。

### 3.3 客户端逻辑 (Client-Side Logic)
- **`SelectionManager`**: 处理点击/悬停事件，并解析 `data-xagi-info` 以提取 `ElementInfo`。
- **`EditManager`**: 管理 `contentEditable` 状态，处理保存，并执行列表项同步。
- **`DesignModeContext`**: 管理全局状态以及与父窗口（如果在 iframe 中）的通信。
- **`DesignModeBridge`**: 处理 iframe 与父级编辑器/IDE 之间的消息传递。

## 4. 通信协议 (Communication Protocol)

### 4.1 Iframe <-> Parent 消息
- **`ELEMENT_SELECTED`**: 选中元素时发送。Payload 包含 `ElementInfo`。
- **`UPDATE_STYLE`**: 从父级发送以更新 Class。
- **`UPDATE_CONTENT`**: 从父级发送以更新文本内容。
- **`CONTENT_UPDATED`**: 内容在本地编辑后，从 iframe 发送到父级。
- **`STYLE_UPDATED`**: 样式更新后，从 iframe 发送到父级。

## 5. 服务器中间件 (Server Middleware)
- **`/__appdev_design_mode/update`**: 处理源代码更新的 API 端点。
- **`codeUpdater.ts`**: 基于行/列信息安全修改源文件的逻辑（使用 `magic-string` 等）。

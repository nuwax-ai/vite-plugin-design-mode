# Vite Plugin Design Mode

一个为 AppDev 启用设计模式功能的 Vite 插件，为 React 和 Vue 3 项目提供源码映射与可视化编辑能力（不支持 Vue 2）。

## 特性

- **源码映射**: 在编译时自动向DOM元素注入源码位置信息（使用紧凑的 `data-xagi-info` JSON 属性）
- **可视化编辑**: 提供直观的设计模式UI，支持实时样式编辑
- **双击编辑**: 双击静态文本元素即可进入编辑模式，实时预览并自动保存到源码
- **静态内容检测**: 智能识别纯静态文本（无变量、表达式或子元素），只有静态内容才能直接编辑
- **列表项同步**: 编辑列表项时自动同步所有相关实例（内容或样式）
- **组件识别**: 识别组件名称、导入路径，区分组件使用位置和定义位置
- **Vue SFC 支持**: 支持 `.vue` 文件模板注入和 AST 安全回写（class/text）
- **实时修改**: 支持实时编辑样式和内容，并自动持久化到源码文件
- **Tailwind CSS集成**: 内置Tailwind CSS预设，提供快速样式编辑
- **桥接通信**: 提供消息桥接机制，支持与外部工具和设计系统集成（支持 iframe 模式）
- **开发服务器集成**: 无缝集成Vite开发服务器，支持热重载
- **零配置**: 开箱即用，无需复杂配置即可开始使用

## 框架支持矩阵

- React + Vite：支持（自动识别或 `framework: 'react'`）
- Vue 3 + Vite：支持（自动识别或 `framework: 'vue'`）
- Vue 2 + Vite：不支持（启动时会直接报错，避免出现部分可用的隐性问题）

## Installation

### 一键安装（推荐）

使用 CLI 工具一键配置插件：

```bash
npx @xagi/vite-plugin-design-mode install
# 或
pnpm dlx @xagi/vite-plugin-design-mode install
```

这个命令会：
- 在 `package.json` 的 `devDependencies` 中添加插件依赖
- 自动在 `vite.config.ts/js/mjs` 中添加插件配置
- 使用默认配置，无需手动传参

CLI 适用前提：
- 项目需为 Vite 项目（`package.json` 中存在 `vite`）
- 项目需使用 React 或 Vue 3（`package.json` 中存在 `react`，或 `vue@3.x`）

**注意：** CLI 只会在配置文件中添加配置，不会执行包管理器安装命令。配置完成后，请手动运行包管理器安装命令来安装依赖：

```bash
pnpm install
# 或
npm install
# 或
yarn install
```

### 一键卸载

使用 CLI 工具一键卸载插件并清理配置：

```bash
npx @xagi/vite-plugin-design-mode uninstall
# 或
pnpm dlx @xagi/vite-plugin-design-mode uninstall
```

这个命令会：
- 从 `package.json` 中移除插件依赖
- 从 `vite.config.ts/js/mjs` 中移除 import 和插件配置
- 自动清理所有相关配置

**注意：** CLI 只会在配置文件中移除配置，不会执行包管理器卸载命令。配置清理完成后，请手动运行包管理器卸载命令来移除依赖：

```bash
pnpm remove @xagi/vite-plugin-design-mode
# 或
npm uninstall @xagi/vite-plugin-design-mode
# 或
yarn remove @xagi/vite-plugin-design-mode
```

### 手动安装

如果需要手动安装：

```bash
npm install @xagi/vite-plugin-design-mode --save-dev
# or
yarn add @xagi/vite-plugin-design-mode --dev
# or
pnpm add @xagi/vite-plugin-design-mode -D
```

### 预发布 / XAGI 集成（推荐）

`1.1.x` 预发布会频繁发 **`1.1.0-beta.N`**，registry 上历史 beta 会自然变多。**模板、宿主应用、内部文档请不要写死某个 `beta.N`**，否则每发一版就要改依赖。

集成时请**统一跟 `next` dist-tag**（始终对应当前灰度线）：

```bash
pnpm add @xagi/vite-plugin-design-mode@next -D
# 若直接依赖 client 包（少见），同样使用 @next：
# pnpm add @xagi/design-mode-client-vue@next -D
```

`package.json` 里可写 **`"^1.1.0-0"`**（接受 `1.1.0` 线下任意预发版本）并定期 `pnpm update`；或在文档与 CI 中约定：**安装/升级一律执行 `pnpm add @xagi/vite-plugin-design-mode@next -D`**，由 lockfile 固定实际解析版本。

稳定正式版发布后仍从 **`latest`** 安装即可（与上面预发布通道互不干扰）。

## 版本发布与 Tag 策略

为避免预发布版本影响生产用户，仓库采用以下 npm dist-tag 规则：

- `latest`：仅用于稳定正式版（如 `1.0.37`、`1.1.0`）
- `next`：**集成方应使用的预发布通道**；标签指向当前推荐的 `1.1.0-beta.*`（或其它预发 semver），版本号会递增，**请勿在对外文档中要求用户锁定某一枚 `beta.N`**
- `beta`：可选的额外 dist-tag（历史或兼容）；新集成优先跟 `next`

### 多包发布 SOP（推荐）

发布采用统一版本策略，以下 4 个包必须同版本：

- `@xagi/design-mode-shared`
- `@xagi/design-mode-client-react`
- `@xagi/design-mode-client-vue`
- `@xagi/vite-plugin-design-mode`

```bash
# 1) 切换 npm 官方源（强烈建议每次发布前显式执行）
nrm use npm

# 2) 如需升级版本，一次性同步全部包版本和内部依赖（版本号按需替换）
pnpm run release:version:sync -- 1.1.0-beta.12

# 3) 一键发布 next（预检 -> 构建 -> 按依赖顺序发布 -> 发布后校验）
pnpm run release:next

# 4) 一键发布 beta（与 next 同流程，但写入 beta tag）
pnpm run release:beta

# 5) 发布前演练（不真正 publish）
pnpm run release:next:dry-run
pnpm run release:beta:dry-run
```

其中 `release:next` / `release:beta` 都会自动执行以下步骤：

1. `release:preflight`：校验 registry、版本一致性、禁止 `workspace:*` 泄露到发布包
2. `release:build`：构建所有包
3. `release:publish:*`：按依赖顺序发布（`shared -> react/vue并发 -> plugin`）
4. `release:verify:*`：校验对应 dist-tag（`next` 或 `beta`）及目标版本可见性；`verify:next` 对 registry 传播做了**有限次重试**（可用环境变量 `VERIFY_NEXT_MAX_TRIES`、`VERIFY_NEXT_SLEEP_SECS` 调整）

### 常见问题与修复

- 报错 `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`  
  原因：发布包中包含 `workspace:*` 依赖。  
  处理：运行 `release:preflight` 找出问题并改成明确版本号。

- `next` tag 未指向本次版本  
  处理：

```bash
npm dist-tag add @xagi/vite-plugin-design-mode@1.1.0-beta.5 next
```

## Basic Usage

使用一键安装后，插件已自动配置，`vite.config.ts` 中会包含：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import appdevDesignMode from '@xagi/vite-plugin-design-mode';

export default defineConfig({
  plugins: [
    react(),
    appdevDesignMode()  // 使用默认配置，无需传参
  ]
});
```

**默认配置说明：**
- `enabled: true` - 启用插件
- `enableInProduction: false` - 仅在开发环境生效，生产构建时自动禁用
- `verbose: true` - 启用详细日志
- `attributePrefix: 'data-xagi'` - 源码映射属性的前缀
- `include: ['src/**/*.{ts,js,tsx,jsx,vue}']` - 处理 src 目录下的 TypeScript/JavaScript/TSX/JSX/Vue 文件
- `exclude: ['node_modules', 'dist']` - 排除指定目录
- `enableBackup: false` - 是否启用备份功能
- `enableHistory: false` - 是否启用历史记录功能
- `framework: 'auto'` - 自动识别 React / Vue 3（可显式设置 `react` 或 `vue`）

## Advanced Usage

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import appdevDesignMode from '@xagi/vite-plugin-design-mode';

export default defineConfig({
  plugins: [
    react(),
    appdevDesignMode({
      enabled: true,
      enableInProduction: false,
      attributePrefix: 'data-appdev',
      verbose: true,
      exclude: ['node_modules', '.git'],
      include: ['**/*.{js,jsx,ts,tsx}']
    })
  ]
});
```

## Vue 3 使用说明

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import appdevDesignMode from '@xagi/vite-plugin-design-mode';

export default defineConfig({
  plugins: [
    vue(),
    appdevDesignMode({
      framework: 'vue',
    }),
  ],
});
```

- `framework: 'vue'` 模式下不会注入 React 运行时 UI 脚本，这是预期行为。
- Vue 当前支持模板元素的 `class` 与静态文本回写，复杂动态表达式会被保护性拒绝。
- 如检测到 Vue 2（或 `@vitejs/plugin-vue2`），插件会在启动时抛错并提示升级到 Vue 3。

## 工作原理

1. **编译时转换**: 插件在编译时按框架选择转换链路
   - React: 使用 Babel AST 转换 JSX/TSX/JS 文件
   - Vue: 使用 `@vue/compiler-sfc` + `@vue/compiler-dom` 解析并转换 `.vue` 模板
2. **抽象语法树分析**: 基于 AST 识别可编辑元素与源码位置信息
   - React: 追踪 ImportDeclaration 以解析组件定义和导入路径，并识别 UI 组件（components/ui）
   - React: 静态分析确定内容是否为纯静态文本（`isStaticContent`）
   - Vue: 在模板 AST 中定位元素节点，进行注入并用于后续 AST 安全回写
3. **源码映射数据注入**: 将源码位置信息作为紧凑的`data-*`属性（默认前缀 `data-xagi`）注入到DOM元素
   - 主要信息存储在 `data-xagi-info` JSON 属性中（减少 DOM 体积）
   - 添加 `data-xagi-element-id` 用于唯一标识和列表项同步
   - 添加 `data-xagi-static-content` 标记可编辑的静态内容
4. **虚拟模块加载**: 通过Vite虚拟模块机制动态加载客户端代码
5. **运行时通信**: 设计模式UI通过桥接系统与外部工具通信，支持实时编辑
   - 支持 iframe 模式，通过 `postMessage` 与父窗口通信
   - 支持元素选择、样式更新、内容更新等消息类型
6. **源码持久化**: 修改的样式和内容通过API端点实时写入源码文件
   - 使用智能文本替换算法，基于行/列信息安全修改源码
   - 支持样式（className）、内容（innerText）、属性更新
7. **列表项同步**: 使用 `element-id` 识别相关列表项，编辑一个实例自动同步到所有实例
8. **批量更新**: 支持批量更新多个元素，通过防抖机制优化性能
9. **备份与历史**: 可选启用备份和历史记录功能，支持撤销操作

## API 端点

插件提供以下API端点：

### 基础端点
- `GET /__appdev_design_mode/get-source?elementId=xxx` - 获取指定元素的源码信息和文件内容（增强版，包含更多元数据）
- `POST /__appdev_design_mode/modify-source` - 修改源码文件中的样式或内容（兼容旧版本）
- `POST /__appdev_design_mode/update` - 统一更新接口，支持样式、内容、属性更新
- `GET /__appdev_design_mode/health` - 健康检查，返回插件运行状态

### 批量操作端点
- `POST /__appdev_design_mode/batch-update` - 批量更新多个元素的源码（需要 `enableHistory: true` 以保存会话）
- `GET /__appdev_design_mode/batch-update-status?batchId=xxx` - 查询批量更新会话状态（需要 `enableHistory: true`）

### 历史记录端点（需要 `enableHistory: true`）
- `GET /__appdev_design_mode/get-history` - 获取更新历史记录
- `POST /__appdev_design_mode/undo` - 撤销操作（需要 `enableBackup: true`）
- `POST /__appdev_design_mode/redo` - 重做操作（暂未实现）

### 验证端点
- `POST /__appdev_design_mode/validate-update` - 验证更新请求的有效性

## 生成属性

插件处理的元素将具有以下属性（默认前缀为 `data-xagi`，可通过 `attributePrefix` 配置项自定义）：

### 核心属性（实际注入）

- **`{prefix}-info`**: 包含完整源码映射信息的 JSON 字符串，包含以下字段：
  - `fileName`: 源码文件路径
  - `lineNumber`: 源码行号
  - `columnNumber`: 源码列号
  - `elementType`: 元素类型（标签名）
  - `componentName`: 组件名称（如果适用）
  - `functionName`: 函数名称（如果适用）
  - `elementId`: 唯一元素标识符
  - `importPath`: 组件导入路径（用于区分组件使用位置和定义位置）
  - `isUIComponent`: 是否是 UI 组件（components/ui 目录下的组件）

- **`{prefix}-element-id`**: 唯一元素标识符，格式为 `文件路径:行号:列号_标签名#ID`（如果有 id 属性）或 `文件路径:行号:列号_标签名`（如果没有 id 属性）。用于列表项同步和元素识别。

- **`{prefix}-position`**: 位置信息，格式为 `行号:列号`（简化版位置信息）

- **`{prefix}-static-content`**: 标记元素是否包含纯静态内容（值为 `'true'`），用于判断元素是否可以直接编辑。只有包含纯静态文本（无变量、表达式或子元素）的元素才会被标记。

- **`{prefix}-static-class`**: 标记 className 是否为纯静态字符串（值为 `'true'`），用于判断样式是否可以直接编辑。

- **`{prefix}-children-source`**: 子元素的源码位置信息，格式为 `文件路径:行号:列号`（用于透传组件追踪静态文本子元素的来源位置）

### 优化说明

为了减少 DOM 体积，插件采用了紧凑的属性策略：
- **所有主要信息都包含在 `{prefix}-info` 中**，不再单独注入 `{prefix}-file`、`{prefix}-line`、`{prefix}-column`、`{prefix}-component`、`{prefix}-function`、`{prefix}-import` 等属性
- 这些信息可以通过解析 `{prefix}-info` JSON 字符串获取

**注意**：这些属性使用可配置的前缀，默认值为 `data-xagi`。通过设置 `attributePrefix` 选项，可以避免与用户自定义的 `data-*` 属性冲突。例如，设置 `attributePrefix: 'data-appdev'` 后，属性名将变为 `data-appdev-info`、`data-appdev-element-id`、`data-appdev-static-content` 等。

## 浏览器集成

### 直接DOM访问

在浏览器开发者工具或外部应用中：

```javascript
// 获取元素源码信息（注意：默认前缀已改为 data-xagi）
const element = document.querySelector('.my-element');
// 从全局配置获取前缀，或使用默认值 'data-xagi'
const prefix = window.__APPDEV_DESIGN_MODE_CONFIG__?.attributePrefix || 'data-xagi';
const sourceInfo = element.getAttribute(`${prefix}-info`);
const sourceData = JSON.parse(sourceInfo);

console.log(sourceData);
// {
//   fileName: 'src/App.tsx',
//   lineNumber: 10,
//   columnNumber: 5,
//   elementType: 'div',
//   componentName: 'App',
//   functionName: 'App',
//   elementId: 'src/App.tsx:10:5_div',
//   importPath: undefined,  // 如果是组件，会显示导入路径
//   isUIComponent: false     // 是否是 UI 组件
// }

// 检查元素是否可以直接编辑（静态内容）
const isEditable = element.getAttribute(`${prefix}-static-content`) === 'true';
if (isEditable) {
  // 双击元素即可编辑
  element.addEventListener('dblclick', () => {
    element.contentEditable = 'true';
  });
}
```

### 桥接通信

使用内置桥接系统与设计模式UI交互：

```javascript
// 监听元素选择变化
window.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  if (type === 'SELECTION_CHANGED') {
    console.log('选中的元素:', payload);
    // payload 包含: tagName, id, className, innerText, source
  }
});

// 发送样式更新命令
window.parent.postMessage({
  type: 'UPDATE_STYLE',
  payload: {
    newClass: 'bg-blue-500 text-white p-4 rounded-lg'
  }
}, '*');

// 发送内容更新命令
window.parent.postMessage({
  type: 'UPDATE_CONTENT',
  payload: {
    newContent: '更新后的文本内容'
  }
}, '*');
```

## 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | boolean | `true` | 是否启用设计模式插件 |
| `enableInProduction` | boolean | `false` | 是否在生产环境启用，通常保持false |
| `attributePrefix` | string | `'data-xagi'` | 自定义源码映射属性的前缀 |
| `verbose` | boolean | `true` | 是否启用详细日志输出，便于调试 |
| `exclude` | string[] | `['node_modules', 'dist']` | 排除处理的文件模式和目录 |
| `include` | string[] | `['src/**/*.{ts,js,tsx,jsx}']` | 包含处理的文件模式，支持glob语法 |
| `enableBackup` | boolean | `false` | 是否启用备份功能，启用后会在修改源码前创建备份文件 |
| `enableHistory` | boolean | `false` | 是否启用历史记录功能，启用后会保存批量更新会话和历史记录 |

### 配置示例

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    appdevDesignMode({
      enabled: true,
      enableInProduction: false,
      attributePrefix: 'data-appdev',
      verbose: true,
      exclude: ['node_modules', '.git', 'dist'],
      include: ['src/**/*.{ts,js,tsx,jsx}', 'pages/**/*.{ts,js,tsx,jsx}'],
      enableBackup: true,  // 启用备份功能
      enableHistory: true   // 启用历史记录功能
    })
  ]
});
```

## 使用场景

### 1. 设计与开发协作
- 设计师可以直接在浏览器中调整组件样式
- 实时预览设计效果，所见即所得
- 自动生成样式代码，无需手动编写

### 2. 组件库开发
- 快速迭代组件样式和变体
- 可视化调整组件参数和样式
- 生成一致的设计语言

### 3. 原型开发
- 快速构建和调整页面布局
- 实时验证设计想法
- 加速从原型到代码的转换

### 4. 团队协作
- 统一设计系统和代码规范
- 减少设计师和开发者的沟通成本
- 提高开发效率和代码质量

## Tailwind CSS 预设

插件内置了常用的Tailwind CSS类预设：

### 背景颜色预设
- `bg-white` - 白色背景
- `bg-slate-50` - 浅灰色背景
- `bg-blue-50` - 浅蓝色背景
- `bg-blue-100` - 中浅蓝色背景
- `bg-blue-600` - 深蓝色背景
- `bg-red-50` - 浅红色背景
- `bg-green-50` - 浅绿色背景

### 文字颜色预设
- `text-slate-900` - 深灰色文字
- `text-slate-600` - 中灰色文字
- `text-blue-600` - 蓝色文字
- `text-white` - 白色文字
- `text-red-600` - 红色文字

### 间距预设
- `p-0` - 无内边距
- `p-2` - 小内边距
- `p-4` - 中等内边距
- `p-6` - 大内边距
- `p-8` - 特大内边距
- `p-12` - 超大内边距

### 圆角预设
- `rounded-none` - 无圆角
- `rounded-sm` - 小圆角
- `rounded-md` - 中等圆角
- `rounded-lg` - 大圆角
- `rounded-full` - 完全圆角

## 设计模式UI使用指南

### 启动设计模式
1. 在页面右下角找到设计模式开关
2. 点击开关启用设计模式
3. 开始选择和编辑页面元素

### 编辑元素样式
1. 点击页面中的任意元素
2. 在右侧编辑面板中选择预设样式
3. 实时预览样式效果
4. 修改会自动保存到源码文件
5. 对于列表项，修改一个实例会自动同步到所有相关实例

### 编辑元素内容
1. **双击**包含静态文本的元素（只有标记了 `data-xagi-static-content="true"` 的元素才能编辑）
2. 进入 `contentEditable` 模式，直接编辑文本
3. 失去焦点时自动保存到源码文件
4. 对于列表项，编辑一个实例会自动同步到所有相关实例

### 重置修改
- 点击“重置所有修改”按钮撤销所有更改
- 页面将重新加载并恢复原始状态
- 如果启用了备份功能（`enableBackup: true`），可以使用撤销功能恢复之前的版本
- 如果启用了历史记录功能（`enableHistory: true`），可以查看和恢复历史更新会话

## 故障排除

### 常见问题

**Q: 设计模式UI没有显示**
A: 检查插件是否正确配置，确保在开发模式下运行

**Q: 点击元素没有反应**
A: 确认已经启用设计模式，检查浏览器控制台是否有错误信息

**Q: 样式修改没有保存**
A: 检查文件权限，确保有写入权限，或者检查开发服务器状态

**Q: 源码映射不准确**
A: 检查是否正确配置了include模式，确保源文件被正确处理

### 调试技巧

1. 启用verbose模式查看详细日志
2. 检查浏览器开发者工具的网络面板，确认API请求状态
3. 查看元素是否正确生成了源码映射属性
4. 使用健康检查端点验证插件运行状态

```bash
# 检查插件状态
curl http://localhost:3000/__appdev_design_mode/health
```

## 开发指南

### 本地开发

```bash
# 克隆项目
git clone <repository-url>
cd vite-plugin-design-mode

# 安装依赖
npm install

# 运行示例
cd examples/advanced
npm install
npm run dev
```

### 自定义预设

如需自定义样式预设，可以修改客户端配置：

```typescript
// 在 DesignModeUI.tsx 中自定义预设
const CUSTOM_PRESETS = {
  bgColors: [
    { label: 'Primary', value: 'bg-blue-600' },
    { label: 'Secondary', value: 'bg-gray-600' },
    // 添加更多自定义颜色
  ]
};
```

## 贡献指南

欢迎提交Issue和Pull Request来改进这个插件！

### 开发流程
1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

### 代码规范
- 使用TypeScript
- 遵循ESLint规则
- 添加适当的测试
- 更新相关文档

## 更新日志

完整变更记录见 [`CHANGELOG.md`](./CHANGELOG.md)。

### v1.1.0-beta.5
- 修复 npm 发布产物中的 workspace 依赖协议问题，确保外部使用 pnpm/npm 安装可正常解析依赖

### v1.1.0-beta.4
- 修复插件发布后客户端运行时入口解析，优先从安装包解析 React/Vue runtime
- 增加路径安全校验，避免通过路径前缀绕过项目根目录限制
- 完成多包迁移后的测试回归修复，测试全量通过

### v1.1.0-beta.3
- 完成项目向 `packages/*` 多包结构迁移
- 保留并迁移 CLI 到 plugin 包内，发布产物包含 CLI
- 调整 examples/test 引用路径，移除根 `src` 目录实现

### v1.1.0-beta.2
- 新增 React/Vue 3 动态识别支持（`framework: 'auto'`）
- CLI 支持在 Vue 3 + Vite 项目安装
- 检测到 Vue 2（含 `@vitejs/plugin-vue2`）时快速失败并给出升级提示
- 发布策略调整：`latest` 仅稳定版，预发布使用 `beta/next`

### v1.0.36
- 更新默认属性前缀为 `data-xagi`
- 新增批量更新功能（`/batch-update` 端点）
- 新增历史记录功能（`enableHistory` 配置项）
- 新增备份功能（`enableBackup` 配置项）
- 新增撤销/重做功能（需要启用备份和历史记录）
- 增强 `/get-source` 端点，返回更多元数据
- 新增 `/validate-update` 端点用于验证更新请求
- 支持 TypeScript/JavaScript/TSX/JSX 文件处理
- 优化默认文件包含模式，支持更多文件类型
- 改进CLI工具，支持一键安装和卸载

### v1.0.0
- 初始版本发布
- 实现基本的源码映射功能
- 添加可视化设计模式UI
- 支持实时样式编辑和源码修改
- 集成Tailwind CSS预设

## License

MIT

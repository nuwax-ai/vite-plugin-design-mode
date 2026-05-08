# CLI 功能本地测试指南

本文档说明如何在本地测试 `@xagi/vite-plugin-design-mode` 的 CLI 安装和卸载功能。

## 前置准备

1. 确保项目已安装依赖：
```bash
npm install
```

2. 构建项目（编译 TypeScript 到 dist 目录）：
```bash
npm run build
```

这会编译所有源代码到 `dist/` 目录，包括 CLI 文件。

## 测试方法

### 方法 1: 使用 npm link（推荐）

这是最接近真实使用场景的测试方法。

#### 步骤 1: 在项目根目录创建链接

```bash
# 在项目根目录执行
npm link
```

这会在全局创建一个符号链接，指向当前项目。

#### 步骤 2: 在测试项目中链接插件

```bash
# 进入测试项目目录（例如 examples/demo）
cd examples/demo

# 链接插件
npm link @xagi/vite-plugin-design-mode
```

#### 步骤 3: 测试安装命令

```bash
# 在测试项目目录执行
npx @xagi/vite-plugin-design-mode install
```

#### 步骤 4: 测试卸载命令

```bash
# 在测试项目目录执行
npx @xagi/vite-plugin-design-mode uninstall
```

### 方法 2: 直接使用 node 运行编译后的文件

如果不想使用 npm link，可以直接运行编译后的 CLI 文件。

#### 步骤 1: 构建项目

```bash
npm run build
```

#### 步骤 2: 在测试项目中运行 CLI

```bash
# 进入测试项目目录
cd examples/demo

# 直接运行编译后的 CLI 文件
node ../../packages/plugin/dist/cli/index.js install
# 或
node ../../packages/plugin/dist/cli/index.js uninstall
```

### 方法 3: 使用 tsx 直接运行 TypeScript 文件（开发调试）

在开发过程中，可以使用 `tsx` 直接运行 TypeScript 文件，无需先编译。

#### 安装 tsx（如果还没有）

```bash
npm install -g tsx
# 或
npm install --save-dev tsx
```

#### 运行 CLI

```bash
# 在项目根目录
tsx packages/plugin/src/cli/index.ts install

# 或指定工作目录为测试项目
cd examples/demo
tsx ../../packages/plugin/src/cli/index.ts install
```

## 完整测试流程示例

以下是在 `examples/demo` 项目中完整测试安装和卸载的流程：

### 1. 准备测试环境

```bash
# 在项目根目录构建
npm run build

# 进入测试项目
cd examples/demo

# 备份当前的 vite.config.ts（可选）
cp vite.config.ts vite.config.ts.backup

# 备份 package.json（可选）
cp package.json package.json.backup
```

### 2. 测试安装功能

```bash
# 方法 A: 使用 npm link
npm link @xagi/vite-plugin-design-mode
npx @xagi/vite-plugin-design-mode install

# 方法 B: 直接运行编译后的文件
node ../../packages/plugin/dist/cli/index.js install

# 方法 C: 使用 tsx（开发时）
tsx ../../packages/plugin/src/cli/index.ts install
```

**验证安装结果：**

1. 检查 `package.json` 中是否添加了 `@xagi/vite-plugin-design-mode` 依赖
2. 检查 `vite.config.ts` 中是否添加了：
   - `import appdevDesignMode from '@xagi/vite-plugin-design-mode';`
   - `appdevDesignMode()` 在 plugins 数组中

### 3. 测试卸载功能

```bash
# 使用相同的方法运行卸载命令
npx @xagi/vite-plugin-design-mode uninstall
# 或
node ../../packages/plugin/dist/cli/index.js uninstall
# 或
tsx ../../packages/plugin/src/cli/index.ts uninstall
```

**验证卸载结果：**

1. 检查 `package.json` 中是否移除了 `@xagi/vite-plugin-design-mode` 依赖
2. 检查 `vite.config.ts` 中是否移除了：
   - import 语句
   - `appdevDesignMode()` 调用

### 4. 恢复测试环境（可选）

```bash
# 如果需要恢复到原始状态
cp vite.config.ts.backup vite.config.ts
cp package.json.backup package.json
```

## 测试不同场景

### 场景 1: 全新安装（插件未安装）

1. 确保测试项目的 `package.json` 中没有 `@xagi/vite-plugin-design-mode`
2. 确保 `vite.config.ts` 中没有相关配置
3. 运行 `install` 命令
4. 验证插件已安装且配置已添加

### 场景 2: 升级已安装的插件

1. 先在测试项目中安装旧版本（如果有）
2. 运行 `install` 命令
3. 验证插件已升级到最新版本

### 场景 3: 卸载已安装的插件

1. 确保插件已安装
2. 运行 `uninstall` 命令
3. 验证插件和配置都已移除

### 场景 4: 测试不同的包管理器

在不同使用不同包管理器的项目中测试：

```bash
# npm 项目
cd examples/basic
node ../../packages/plugin/dist/cli/index.js install

# pnpm 项目
cd examples/demo  # 如果有 pnpm-lock.yaml
node ../../packages/plugin/dist/cli/index.js install

# yarn 项目（如果有 yarn.lock）
node ../../packages/plugin/dist/cli/index.js install
```

## 调试技巧

### 查看详细输出

CLI 工具会输出详细的执行信息，包括：
- 检测到的包管理器
- 插件安装状态
- 执行的命令
- 配置文件修改情况

### 检查编译后的文件

确保 CLI 文件已正确编译：

```bash
# 检查 dist/cli 目录
ls -la dist/cli/

# 应该看到：
# - index.js
# - install.js
# - uninstall.js
```

### 常见问题排查

1. **命令未找到**
   - 确保已运行 `npm run build`
   - 检查 `packages/plugin/dist/cli/index.js` 是否存在
   - 如果使用 npm link，确保已正确链接

2. **权限问题**
   - 确保有写入 `package.json` 和 `vite.config.ts` 的权限

3. **配置文件格式问题**
   - CLI 会尝试处理不同的代码风格，但某些复杂格式可能需要手动调整

## 自动化测试脚本（可选）

可以创建一个测试脚本来自动化测试流程：

```bash
#!/bin/bash
# test-cli.sh

echo "构建项目..."
npm run build

echo "进入测试项目..."
cd examples/demo

echo "测试安装..."
node ../../packages/plugin/dist/cli/index.js install

echo "等待 2 秒..."
sleep 2

echo "测试卸载..."
node ../../packages/plugin/dist/cli/index.js uninstall

echo "测试完成！"
```

保存为 `test-cli.sh`，然后运行：

```bash
chmod +x test-cli.sh
./test-cli.sh
```


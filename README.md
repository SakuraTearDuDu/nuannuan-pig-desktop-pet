# 暖暖猪-桌面宠物

暖暖猪是一个基于 Electron 的桌面电子宠物。它内置自定义宠物精灵图，不依赖 Codex App，下载后即可运行。当前提供 Windows x64 便携 EXE，并支持通过 GitHub Actions 构建 macOS 未签名测试包。

![暖暖猪动画预览](media/nuannuan-pig-animation-preview.gif)

## 下载 Windows EXE

普通用户请到 GitHub Releases 下载最新版本：

- [最新版本 Releases](https://github.com/SakuraTearDuDu/nuannuan-pig-desktop-pet/releases/latest)
- 直接运行版：`NuannuanPig-DesktopPet.exe`
- 中文文件名压缩包：`NuannuanPig-DesktopPet-v1.0.0-win-x64.zip`

Windows 版程序未做代码签名，首次运行时 Windows SmartScreen 可能提示风险，这是未签名个人项目的常见提示。

说明：GitHub Release 对中文附件文件名的下载链接兼容性不好，所以直接下载的 EXE 使用英文文件名。它和本地的 `暖暖猪-桌面宠物.exe` 是同一个程序；如果希望得到中文文件名，请下载 ZIP，解压后里面就是 `暖暖猪-桌面宠物.exe`。

## macOS 测试包

macOS 版用于小范围测试。请在 GitHub Actions 的 `Build Desktop Packages` 工作流里下载 `暖暖猪-桌面宠物-macos-universal` artifact，里面包含：

- `暖暖猪-桌面宠物.dmg`
- `暖暖猪-桌面宠物.zip`

macOS 测试包未做 Apple Developer ID 签名和公证。首次打开时，如果系统提示无法验证开发者，可以右键点击 `.app` 选择“打开”，或到“系统设置 > 隐私与安全性”里允许打开。

## 第一次运行

1. 下载 `NuannuanPig-DesktopPet.exe`，或下载 ZIP 后解压出 `暖暖猪-桌面宠物.exe`。
2. 双击 EXE 运行。
3. 如果 Windows 出现“Windows 已保护你的电脑”：
   - 点击“更多信息”。
   - 点击“仍要运行”。
4. 运行后桌面上会出现暖暖猪，任务栏里不会出现普通窗口，主要通过桌面宠物本体和系统托盘控制。

程序是便携版，不需要安装，也不会要求用户手动复制 `pet.json` 或 `spritesheet.webp`。

macOS 测试版可打开 DMG 后运行或拖入 Applications；ZIP 版解压后运行 `.app` 即可。

## 基本操作

- 单击暖暖猪：挥手。
- 双击暖暖猪：跳跃。
- 按住暖暖猪拖动：移动位置，移动时会播放跑步动作。
- 右键暖暖猪：打开快捷菜单。
- 点击系统托盘图标：显示或隐藏暖暖猪。
- 右键系统托盘图标：打开完整菜单。

## 右键和托盘菜单

菜单包含：

- 显示/隐藏暖暖猪
- 始终置顶
- 缩放：`75%`、`100%`、`125%`、`150%`
- 重置位置
- 退出暖暖猪-桌面宠物

如果暖暖猪拖到屏幕边缘找不到了，可以在系统托盘菜单里选择“重置位置”。

## 设置保存

暖暖猪会自动记住：

- 上次位置
- 缩放比例
- 是否始终置顶
- 是否隐藏

Windows 版配置通常保存在：

```text
%APPDATA%\暖暖猪-桌面宠物\settings.json
```

macOS 版配置通常保存在：

```text
~/Library/Application Support/暖暖猪-桌面宠物/settings.json
```

如果想恢复默认状态，可以退出程序后删除这个 `settings.json`，再重新运行 EXE。

## 退出和卸载

退出：

1. 右键暖暖猪或托盘图标。
2. 选择“退出暖暖猪-桌面宠物”。

卸载：

- 本项目是便携版，没有安装向导。
- Windows：删除下载的 EXE 或解压出的 `暖暖猪-桌面宠物.exe` 即可。
- macOS：删除 `.app`、`.dmg` 或解压目录即可。
- 如需清除用户设置，再删除 `%APPDATA%\暖暖猪-桌面宠物\settings.json`。

## 常见问题

### 为什么 Windows 提示风险？

因为当前版本没有购买代码签名证书。源码和构建脚本都在本仓库公开，用户可以自行检查或从源码构建。

### 为什么任务栏里看不到窗口？

暖暖猪是桌面宠物，默认使用透明无边框窗口，并隐藏普通任务栏入口。请使用桌面上的暖暖猪本体或系统托盘图标控制它。

### 暖暖猪不见了怎么办？

检查系统托盘图标，点击托盘图标可以显示/隐藏。也可以右键托盘图标，选择“重置位置”。

### 能在 macOS 或 Linux 运行吗？

当前 Release 主要提供 Windows x64 便携 EXE。源码基于 Electron，仓库已配置 macOS universal 测试包构建；Linux 暂未配置打包目标。

## 开发

环境要求：

- Node.js 20 或更高版本
- npm

安装依赖：

```bash
npm install
```

启动开发版：

```bash
npm start
```

校验内置宠物资源：

```bash
npm run check:assets
```

打包 Windows 便携版：

```bash
npm run package:win
```

打包 macOS 测试版需要在 macOS 环境执行：

```bash
npm run package:mac
```

打包产物会生成到：

```text
dist/暖暖猪-桌面宠物.exe
```

导出动画预览 GIF 和 MP4：

```bash
npm run export:preview
```

预览文件会生成到：

```text
media/nuannuan-pig-animation-preview.gif
media/nuannuan-pig-animation-preview.mp4
```

## 项目结构

- `src/main.js`：Electron 主进程，负责透明窗口、托盘、拖拽、配置持久化。
- `src/renderer/`：Canvas 渲染和宠物动画控制。
- `assets/`：内置宠物配置、精灵图和托盘图标。
- `media/`：动画预览 GIF/MP4。
- `scripts/check-assets.js`：资源尺寸和配置校验。

## 许可证

本项目代码和随仓库发布的暖暖猪宠物资源使用 MIT License 开源。转载、修改或二次分发时请保留许可证声明。

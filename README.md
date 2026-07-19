# 四眼鸡桌面宠物

四眼鸡桌面宠物是一个基于 Electron 的桌面电子宠物。它内置四眼鸡精灵图和扩展动作资源，不依赖 Codex App，下载后即可运行。

![四眼鸡动作预览](media/siyanji-all-actions-preview.gif)

## 下载

普通用户请到 GitHub Releases 下载最新版本：

- [最新版本 Releases](https://github.com/SakuraTearDuDu/nuannuan-pig-desktop-pet/releases/latest)
- Windows 便携版：`Siyanji-DesktopPet-v2.0-win-x64.exe`
- macOS DMG：`Siyanji-DesktopPet-v2.0-mac-universal.dmg`
- macOS `.app` 压缩包：`Siyanji-DesktopPet-v2.0-mac-universal.zip`

Windows 版程序未做代码签名，首次运行时 Windows SmartScreen 可能提示风险，这是未签名个人项目的常见提示。macOS 测试包未做 Apple Developer ID 签名和公证，首次打开时如果系统提示无法验证开发者，可以右键点击 `.app` 选择“打开”，或到“系统设置 > 隐私与安全性”里允许打开。

## 第一次运行

Windows：

1. 下载 `Siyanji-DesktopPet-v2.0-win-x64.exe`。
2. 双击 EXE 运行。
3. 如果 Windows 出现“Windows 已保护你的电脑”，点击“更多信息”，再点击“仍要运行”。

macOS：

1. 下载 DMG 后打开并运行，或下载 ZIP 后解压出 `四眼鸡桌面宠物.app`。
2. 如果 Gatekeeper 阻止打开，右键点击 `.app` 选择“打开”。

程序是便携版，不需要安装，也不会要求用户手动复制 `pet.json`、`spritesheet.webp` 或其他宠物资源文件。

## 基本操作

- 单击四眼鸡：挥手。
- 双击四眼鸡：跳跃。
- 按住四眼鸡拖动：移动位置，移动时会播放跑步动作。
- 右键四眼鸡：打开快捷菜单。
- 点击系统托盘图标：显示或隐藏四眼鸡。
- 右键系统托盘图标：打开完整菜单。

## 动作

右键菜单里的“动作”包含 29 个动作：

- 基础动作：待机、向右跑、向左跑、挥手、跳跃、难过、等待、原地跑、专注。
- 扩展动作：睡觉、生气、伤心、读书、打游戏、学习、被戳一惊、趴下大哭、生气回头。
- 长动作：IQ博士舞蹈、骑马、高清背包和新款动作组。

无人操作时，四眼鸡会每隔一段时间随机播放适合自动展示的动作。用户拖拽或手动触发动作时，自动动作不会抢占当前状态。

## 设置保存

四眼鸡会自动记住：

- 上次位置
- 缩放比例
- 是否始终置顶
- 是否隐藏

Windows 配置通常保存在：

```text
%APPDATA%\四眼鸡桌面宠物\settings.json
```

macOS 配置通常保存在：

```text
~/Library/Application Support/四眼鸡桌面宠物/settings.json
```

如果想恢复默认状态，可以退出程序后删除这个 `settings.json`，再重新运行。

## 退出和卸载

退出：

1. 右键四眼鸡或托盘图标。
2. 选择“退出四眼鸡桌面宠物”。

卸载：

- 本项目是便携版，没有安装向导。
- Windows：删除下载的 EXE 即可。
- macOS：删除 `.app`、`.dmg` 或解压目录即可。
- 如需清除用户设置，再删除对应平台的 `settings.json`。

## 常见问题

### 为什么 Windows 或 macOS 提示风险？

因为当前版本没有购买代码签名证书或 Apple Developer ID 签名。源码和构建脚本都在本仓库公开，用户可以自行检查或从源码构建。

### 为什么任务栏里看不到窗口？

四眼鸡是桌面宠物，默认使用透明无边框窗口，并隐藏普通任务栏入口。请使用桌面上的四眼鸡本体或系统托盘图标控制它。

### 四眼鸡不见了怎么办？

检查系统托盘图标，点击托盘图标可以显示或隐藏。也可以右键托盘图标，选择“重置位置”。

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

校验发布面没有暴露图片生成工具入口、密钥引用或本地生成产物：

```bash
npm run check:release-surface
```

打包 Windows 便携版：

```bash
npm run package:win
```

打包 macOS 测试版需要在 macOS 环境执行：

```bash
npm run package:mac
```

打包 Linux DEB：

```bash
npm run package:linux
```

打包产物会生成到：

```text
dist/
```

导出动画预览 GIF 和 MP4：

```bash
npm run export:preview
```

预览文件会生成到：

```text
media/siyanji-all-actions-preview.gif
media/siyanji-all-actions-preview.mp4
```

## 项目结构

- `src/main.js`：Electron 主进程，负责透明窗口、托盘、拖拽、配置持久化和菜单。
- `src/renderer/`：Canvas 渲染和宠物动画控制。
- `assets/`：内置宠物配置、精灵图、扩展动作图集和托盘图标。
- `media/`：动画预览 GIF/MP4。
- `scripts/check-assets.js`：资源尺寸和配置校验。
- `scripts/check-release-surface.js`：发布面扫描。

## 许可证

本项目代码和随仓库发布的四眼鸡宠物资源使用 MIT License 开源。转载、修改或二次分发时请保留许可证声明。

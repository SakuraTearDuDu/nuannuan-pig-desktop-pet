# 暖暖猪-桌面宠物

暖暖猪是一个 Windows 桌面电子宠物。它基于 Electron 打包，内置自定义宠物精灵图，不依赖 Codex App，下载后双击即可运行。

## 下载

普通用户请到 GitHub Releases 下载最新版本：

- `暖暖猪-桌面宠物.exe`

当前版本仅支持 Windows x64。程序未做代码签名，首次运行时 Windows SmartScreen 可能提示风险，选择“更多信息”后可以继续运行。

## 使用

- 按住暖暖猪可以拖动位置。
- 单击会挥手。
- 双击会跳跃。
- 右键暖暖猪或点击系统托盘图标，可以显示/隐藏、切换置顶、调整缩放、重置位置或退出。

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

打包产物会生成到 `dist/暖暖猪-桌面宠物.exe`。

## 项目结构

- `src/main.js`：Electron 主进程，负责透明窗口、托盘、拖拽、配置持久化。
- `src/renderer/`：Canvas 渲染和宠物动画控制。
- `assets/`：内置宠物配置、精灵图和托盘图标。
- `scripts/check-assets.js`：资源尺寸和配置校验。

## 许可证

本项目代码和随仓库发布的暖暖猪宠物资源使用 MIT License 开源。转载、修改或二次分发时请保留许可证声明。

# v2.0

交互优化版本。

## 变更

- 新增连续三击鼠标左键触发跳跃，保留原有双击跳跃。
- 新增无鼠标互动后进入难过状态，默认 5 分钟，并支持自定义 1 到 120 分钟。
- 新增自定义缩放设置窗口，支持 50% 到 300%，按 5% 步进对齐。
- 右键菜单和托盘菜单新增常用缩放档位、常用难过时间档位，以及自定义设置入口。
- 新增 macOS universal 未签名测试包构建配置，可生成 `.dmg` 和 `.zip` 版 `.app`。
- 新增 Linux amd64/arm64 DEB 包构建和发布流程。

## 下载

请下载 Release 附件中的：

- `NuannuanPig-DesktopPet.exe`：Windows x64 直接运行版。
- `NuannuanPig-DesktopPet-v2.0-win-x64.zip`：Windows x64 压缩包，解压后得到中文文件名 `暖暖猪-桌面宠物.exe`。
- `NuannuanPig-DesktopPet-v2.0-mac-universal.dmg`：macOS universal 测试版 DMG。
- `NuannuanPig-DesktopPet-v2.0-mac-universal.zip`：macOS universal 测试版 `.app` 压缩包。
- `NuannuanPig-DesktopPet-v2.0-linux-amd64.deb`：Linux amd64 DEB 包。
- `NuannuanPig-DesktopPet-v2.0-linux-arm64.deb`：Linux arm64 DEB 包。

# v1.0.0

首个公开版本。

## 功能

- Windows x64 便携版 EXE，双击即可运行。
- 透明、无边框、始终置顶的桌面宠物窗口。
- 内置暖暖猪宠物资源，不需要安装 Codex App。
- 支持待机、跑步、挥手、跳跃、等待、失败、专注查看等动画状态。
- 支持拖拽移动、右键菜单、系统托盘菜单、缩放、重置位置和退出。
- 修复长按拖拽时窗口可能异常变大的问题。

## 下载

请下载 Release 附件中的：

- `NuannuanPig-DesktopPet.exe`：直接运行版。
- `NuannuanPig-DesktopPet-v1.0.0-win-x64.zip`：解压后得到中文文件名 `暖暖猪-桌面宠物.exe`。
- `NuannuanPig-DesktopPet-v1.0.0-mac-universal.dmg`：macOS universal 测试版 DMG。
- `NuannuanPig-DesktopPet-v1.0.0-mac-universal.zip`：macOS universal 测试版 `.app` 压缩包。
- `nuannuan-pig-animation-preview.gif`：全部动作 GIF 预览。
- `nuannuan-pig-animation-preview.mp4`：全部动作短视频预览。

## 已知说明

- 当前版本未做代码签名，Windows SmartScreen 可能提示风险。
- macOS 测试包未做 Apple Developer ID 签名和公证，首次打开可能需要右键“打开”或到隐私与安全性里允许。

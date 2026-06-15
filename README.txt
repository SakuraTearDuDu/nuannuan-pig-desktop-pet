暖暖猪-桌面宠物

下载与运行：
1. 从 GitHub Release 下载 NuannuanPig-DesktopPet.exe，或下载 NuannuanPig-DesktopPet-v2.0-win-x64.zip。
2. 如果下载 ZIP，先解压，里面是 暖暖猪-桌面宠物.exe。
3. 双击 EXE 运行，不需要安装 Codex App，也不需要复制任何宠物资源文件。
4. 如果 Windows SmartScreen 提示“Windows 已保护你的电脑”，点击“更多信息”，再点击“仍要运行”。

macOS 测试版：
1. 从 GitHub Release 下载 NuannuanPig-DesktopPet-v2.0-mac-universal.dmg，或下载 NuannuanPig-DesktopPet-v2.0-mac-universal.zip。
2. 如果下载 ZIP，先解压，里面是可点击运行的 暖暖猪-桌面宠物.app。
3. macOS 的 .app 本质上是目录包，所以 Release 里以 DMG 或 ZIP 形式分发。
4. macOS 测试包未做 Apple Developer ID 签名和公证；首次打开如果提示无法验证开发者，可以右键点击 .app 选择“打开”，或到“系统设置 > 隐私与安全性”里允许打开。

基本操作：
- 单击暖暖猪：挥手。
- 双击暖暖猪：跳跃。
- 连续三击鼠标左键：跳跃。
- 按住暖暖猪拖动：移动位置，移动时播放跑步动作。
- 右键暖暖猪：打开快捷菜单。
- 点击系统托盘图标：显示或隐藏暖暖猪。
- 右键系统托盘图标：打开完整菜单。
- 默认 5 分钟没有鼠标互动时，暖暖猪会进入难过状态；等待时间可自定义，再次移动、单击、拖动或右键互动后恢复。

菜单功能：
- 显示/隐藏暖暖猪
- 始终置顶
- 缩放：常用档位 75%、100%、125%、150%、200%
- 自定义缩放：可输入或拖动滑块设置 50% 到 300%，按 5% 步进对齐
- 难过时间：常用档位 1、3、5、10、15、30 分钟
- 自定义难过时间：可输入或拖动滑块设置 1 到 120 分钟，默认 5 分钟
- 重置位置
- 退出暖暖猪-桌面宠物

退出方式：
请右键暖暖猪或系统托盘图标，然后选择“退出暖暖猪-桌面宠物”。

卸载方式：
本程序是便携版。Windows 删除下载的 EXE 或解压出的 暖暖猪-桌面宠物.exe 即可；macOS 删除 .app、.dmg 或解压目录即可。
如果要清除位置和缩放等设置，可以删除：
%APPDATA%\暖暖猪-桌面宠物\settings.json
macOS 配置通常保存在：
~/Library/Application Support/暖暖猪-桌面宠物/settings.json

说明：
- 当前 Release 提供 Windows x64 便携版、macOS universal 未签名测试包，以及 Linux amd64/arm64 DEB 包。
- 当前版本未做代码签名，Windows SmartScreen 或 macOS Gatekeeper 可能提示风险。
- 本程序会记住上次位置、缩放比例（包括自定义缩放）、难过等待时间、置顶状态和隐藏状态。

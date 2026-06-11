暖暖猪-桌面宠物

下载与运行：
1. 从 GitHub Release 下载 NuannuanPig-DesktopPet.exe，或下载 NuannuanPig-DesktopPet-v1.0.0-win-x64.zip。
2. 如果下载 ZIP，先解压，里面是 暖暖猪-桌面宠物.exe。
3. 双击 EXE 运行，不需要安装 Codex App，也不需要复制任何宠物资源文件。
4. 如果 Windows SmartScreen 提示“Windows 已保护你的电脑”，点击“更多信息”，再点击“仍要运行”。

macOS 测试版：
1. 在 GitHub Actions 的 Build Desktop Packages 工作流下载 暖暖猪-桌面宠物-macos-universal artifact。
2. artifact 中包含 暖暖猪-桌面宠物.dmg 和 ZIP 版 .app。
3. macOS 测试包未做 Apple Developer ID 签名和公证；首次打开如果提示无法验证开发者，可以右键点击 .app 选择“打开”，或到“系统设置 > 隐私与安全性”里允许打开。

基本操作：
- 单击暖暖猪：挥手。
- 双击暖暖猪：跳跃。
- 按住暖暖猪拖动：移动位置，移动时播放跑步动作。
- 右键暖暖猪：打开快捷菜单。
- 点击系统托盘图标：显示或隐藏暖暖猪。
- 右键系统托盘图标：打开完整菜单。

菜单功能：
- 显示/隐藏暖暖猪
- 始终置顶
- 缩放：75%、100%、125%、150%
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
- 当前 Windows Release 提供 Windows x64 便携版。
- 仓库已配置 macOS universal 未签名测试包构建。
- 当前版本未做代码签名，Windows SmartScreen 或 macOS Gatekeeper 可能提示风险。
- 本程序会记住上次位置、缩放比例、置顶状态和隐藏状态。

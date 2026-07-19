四眼鸡桌面宠物

下载与运行：
1. 从 GitHub Release 下载 Siyanji-DesktopPet-v2.0-win-x64.exe。
2. 双击 EXE 运行，不需要安装 Codex App，也不需要复制任何宠物资源文件。
3. 如果 Windows SmartScreen 提示“Windows 已保护你的电脑”，点击“更多信息”，再点击“仍要运行”。

macOS 测试版：
1. 从 GitHub Release 下载 Siyanji-DesktopPet-v2.0-mac-universal.dmg，或下载 Siyanji-DesktopPet-v2.0-mac-universal.zip。
2. 如果下载 ZIP，先解压，里面是可点击运行的 四眼鸡桌面宠物.app。
3. macOS 的 .app 本质上是目录包，所以 Release 里以 DMG 或 ZIP 形式分发。
4. macOS 测试包未做 Apple Developer ID 签名和公证；首次打开如果提示无法验证开发者，可以右键点击 .app 选择“打开”，或到“系统设置 > 隐私与安全性”里允许打开。

基本操作：
- 单击四眼鸡：挥手。
- 双击四眼鸡：跳跃。
- 按住四眼鸡拖动：移动位置，移动时播放跑步动作。
- 右键四眼鸡：打开快捷菜单。
- 点击系统托盘图标：显示或隐藏四眼鸡。
- 右键系统托盘图标：打开完整菜单。

菜单功能：
- 显示/隐藏四眼鸡
- 始终置顶
- 缩放：75%、100%、125%、150%
- 重置位置
- 动作：基础 9 个、扩展 9 个、长动作 11 个，共 29 个
- 退出四眼鸡桌面宠物

退出方式：
请右键四眼鸡或系统托盘图标，然后选择“退出四眼鸡桌面宠物”。

卸载方式：
本程序是便携版。Windows 删除下载的 EXE 即可；macOS 删除 .app、.dmg 或解压目录即可。
如果要清除位置和缩放等设置，可以删除：
%APPDATA%\四眼鸡桌面宠物\settings.json
macOS 配置通常保存在：
~/Library/Application Support/四眼鸡桌面宠物/settings.json

说明：
- 当前 Release 提供 Windows x64 便携版。
- Release 提供 macOS universal 未签名测试包。
- v2.0 增加骑马、IQ博士舞蹈、高清背包和新款动作组。
- 当前版本未做代码签名，Windows SmartScreen 或 macOS Gatekeeper 可能提示风险。
- 本程序会记住上次位置、缩放比例、置顶状态和隐藏状态。
- 无人操作时，四眼鸡会自动随机播放动作。

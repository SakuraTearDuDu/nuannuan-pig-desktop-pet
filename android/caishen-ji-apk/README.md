# 财神鸡 Android 悬浮宠物 APK

这是财神鸡桌面宠物的 Android 原生版，使用已批准的 v2 像素精灵图和现有 Android 悬浮宠物交互。

实现方式：

- 原生 Android `Activity` 负责权限说明、启动/停止悬浮宠物。
- `PetOverlayService` 使用 `SYSTEM_ALERT_WINDOW` 创建系统悬浮窗。
- `PetView` 直接读取 `assets/spritesheet.webp`，按桌面版同一套 192×208 帧表播放九个标准动作。
- 手机交互已按触屏优化：单指拖拽移动、点击挥手、双击跳跃、长按播放复习动作并提示。
- 控制页支持手动触发全部动作：待机、跑步、向左跑、向右跑、挥手、跳跃、难过、等待、复习。
- 控制页支持自定义宠物大小、无互动触发难过时间、空闲自动随机动作开关，并可重置悬浮位置。

构建：

```powershell
.\build-apk.ps1
```

输出：

```text
dist\财神鸡Android悬浮宠物-v2.0.0-debug.apk
```

安装后首次启动需要授予“显示在其他应用上层/悬浮窗”权限。

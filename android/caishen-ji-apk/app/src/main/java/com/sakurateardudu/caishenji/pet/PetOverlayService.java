package com.sakurateardudu.caishenji.pet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.Toast;

import java.io.IOException;
import java.io.InputStream;

public class PetOverlayService extends Service {
    public static final String ACTION_START = "com.sakurateardudu.caishenji.pet.action.START";
    public static final String ACTION_STOP = "com.sakurateardudu.caishenji.pet.action.STOP";
    public static final String ACTION_PLAY_STATE = "com.sakurateardudu.caishenji.pet.action.PLAY_STATE";
    public static final String ACTION_UPDATE_SETTINGS = "com.sakurateardudu.caishenji.pet.action.UPDATE_SETTINGS";
    public static final String ACTION_RESET_POSITION = "com.sakurateardudu.caishenji.pet.action.RESET_POSITION";
    public static final String EXTRA_STATE = "state";
    public static final String EXTRA_TRANSIENT_MS = "transient_ms";

    private static final String CHANNEL_ID = "caishen_ji_pet";
    private static final int NOTIFICATION_ID = 1007;
    private static final int BASE_WIDTH_DP = 132;
    private static final int BASE_HEIGHT_DP = 143;
    private static boolean petVisible;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private WindowManager.LayoutParams params;
    private PetView petView;
    private int touchSlop;
    private float downRawX;
    private float downRawY;
    private int startX;
    private int startY;
    private boolean dragging;
    private boolean longPressTriggered;
    private long lastTapUpAt;
    private Runnable longPressRunnable;

    public static boolean isPetVisible() {
        return petVisible;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        startAsForegroundService();

        if (!canDrawOverlays()) {
            Toast.makeText(this, "需要开启悬浮窗权限后才能显示财神鸡", Toast.LENGTH_LONG).show();
            stopSelf();
            return;
        }

        touchSlop = ViewConfiguration.get(this).getScaledTouchSlop();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        addPetOverlay();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!canDrawOverlays()) {
            Toast.makeText(this, "需要开启悬浮窗权限后才能显示财神鸡", Toast.LENGTH_LONG).show();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (windowManager == null) {
            windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        }
        if (petView == null) {
            addPetOverlay();
        }

        handleCommand(intent);
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (petView != null) {
            petView.stop();
            try {
                windowManager.removeView(petView);
            } catch (IllegalArgumentException ignored) {
                // View already removed.
            }
            petView = null;
        }
        petVisible = false;
        super.onDestroy();
    }

    private boolean canDrawOverlays() {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this);
    }

    private void startAsForegroundService() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "财神鸡悬浮宠物",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("保持财神鸡悬浮宠物运行");
            manager.createNotificationChannel(channel);
        }

        Intent openIntent = new Intent(this, MainActivity.class);
        int pendingFlags = Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, openIntent, pendingFlags);

        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        Notification notification = builder
            .setSmallIcon(R.drawable.ic_stat_pet)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(getString(R.string.notification_text))
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build();

        startForeground(NOTIFICATION_ID, notification);
    }

    private void addPetOverlay() {
        Bitmap spritesheet = loadSpritesheet();
        petView = new PetView(this, spritesheet);
        petView.setOnTouchListener(this::handleTouch);

        int overlayType = Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        params = new WindowManager.LayoutParams(
            scaledWidth(),
            scaledHeight(),
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = dp(24);
        params.y = dp(120);

        windowManager.addView(petView, params);
        applySettings();
        petView.start();
        petVisible = true;
    }

    private void handleCommand(Intent intent) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return;
        }

        if (ACTION_RESET_POSITION.equals(action)) {
            resetPosition();
            return;
        }

        if (ACTION_UPDATE_SETTINGS.equals(action) || ACTION_START.equals(action) || action == null) {
            applySettings();
            return;
        }

        if (ACTION_PLAY_STATE.equals(action)) {
            applySettings();
            int state = intent.getIntExtra(EXTRA_STATE, PetView.STATE_IDLE);
            long transientMs = intent.getLongExtra(EXTRA_TRANSIENT_MS, 0L);
            petView.markUserInteraction();
            petView.setState(state, transientMs);
        }
    }

    private void applySettings() {
        if (petView == null || params == null) {
            return;
        }

        params.width = scaledWidth();
        params.height = scaledHeight();
        params.x = clampX(params.x);
        params.y = clampY(params.y);
        petView.setInactivityFailedDelayMs(PetSettings.getInactivityMillis(this));
        petView.setAutoActionsEnabled(PetSettings.isAutoActionsEnabled(this));
        windowManager.updateViewLayout(petView, params);
    }

    private void resetPosition() {
        if (petView == null || params == null) {
            return;
        }

        PetSettings.setScalePercent(this, PetSettings.DEFAULT_SCALE_PERCENT);
        params.width = scaledWidth();
        params.height = scaledHeight();

        DisplayMetrics metrics = getResources().getDisplayMetrics();
        params.x = clampX(Math.round((metrics.widthPixels - params.width) / 2f));
        params.y = clampY(Math.round((metrics.heightPixels - params.height) / 2f));

        windowManager.updateViewLayout(petView, params);
        petView.markUserInteraction();
        petView.setState(PetView.STATE_IDLE);
    }

    private Bitmap loadSpritesheet() {
        try (InputStream stream = getAssets().open("spritesheet.webp")) {
            Bitmap bitmap = BitmapFactory.decodeStream(stream);
            if (bitmap == null) {
                throw new IllegalStateException("spritesheet.webp decode returned null");
            }
            return bitmap;
        } catch (IOException error) {
            throw new IllegalStateException("Unable to load spritesheet.webp", error);
        }
    }

    private boolean handleTouch(View view, MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                onTouchDown(event);
                return true;
            case MotionEvent.ACTION_MOVE:
                onTouchMove(event);
                return true;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_CANCEL:
                onTouchEnd(event);
                return true;
            default:
                return true;
        }
    }

    private void onTouchDown(MotionEvent event) {
        downRawX = event.getRawX();
        downRawY = event.getRawY();
        startX = params.x;
        startY = params.y;
        dragging = false;
        longPressTriggered = false;
        petView.markUserInteraction();
        petView.setState(PetView.STATE_RUNNING);

        longPressRunnable = () -> {
            if (!dragging) {
                longPressTriggered = true;
                petView.markUserInteraction();
                petView.setState(PetView.STATE_REVIEW, 1800);
                Toast.makeText(this, "长按：复习动作", Toast.LENGTH_SHORT).show();
            }
        };
        handler.postDelayed(longPressRunnable, 560);
    }

    private void onTouchMove(MotionEvent event) {
        float totalDx = event.getRawX() - downRawX;
        float totalDy = event.getRawY() - downRawY;
        if (!dragging && Math.hypot(totalDx, totalDy) > touchSlop) {
            dragging = true;
            cancelLongPress();
        }

        if (!dragging) {
            return;
        }

        params.x = clampX(startX + Math.round(totalDx));
        params.y = clampY(startY + Math.round(totalDy));
        windowManager.updateViewLayout(petView, params);

        if (totalDx > 2) {
            petView.setState(PetView.STATE_RUNNING_RIGHT);
        } else if (totalDx < -2) {
            petView.setState(PetView.STATE_RUNNING_LEFT);
        } else {
            petView.setState(PetView.STATE_RUNNING);
        }
    }

    private void onTouchEnd(MotionEvent event) {
        cancelLongPress();
        petView.markUserInteraction();

        if (longPressTriggered) {
            return;
        }

        if (dragging) {
            petView.setState(PetView.STATE_IDLE, 600);
            dragging = false;
            return;
        }

        long now = System.currentTimeMillis();
        if (now - lastTapUpAt < 320) {
            petView.setState(PetView.STATE_JUMPING, 950);
            lastTapUpAt = 0;
        } else {
            petView.setState(PetView.STATE_WAVING, 1100);
            lastTapUpAt = now;
        }
    }

    private void cancelLongPress() {
        if (longPressRunnable != null) {
            handler.removeCallbacks(longPressRunnable);
            longPressRunnable = null;
        }
    }

    private int clampX(int value) {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int min = -params.width / 2;
        int max = metrics.widthPixels - params.width / 2;
        return Math.max(min, Math.min(max, value));
    }

    private int clampY(int value) {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int min = dp(8);
        int max = metrics.heightPixels - params.height - dp(24);
        return Math.max(min, Math.min(max, value));
    }

    private int scaledWidth() {
        return Math.round(dp(BASE_WIDTH_DP) * PetSettings.getScalePercent(this) / 100f);
    }

    private int scaledHeight() {
        return Math.round(dp(BASE_HEIGHT_DP) * PetSettings.getScalePercent(this) / 100f);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}

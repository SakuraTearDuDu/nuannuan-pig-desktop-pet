package com.sakurateardudu.caishenji.pet;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int COLOR_INK = Color.rgb(36, 28, 47);
    private static final int COLOR_TEXT = Color.rgb(80, 69, 91);
    private static final int COLOR_MUTED = Color.rgb(124, 113, 136);
    private static final int COLOR_PEACH = Color.rgb(255, 141, 114);
    private static final int COLOR_PEACH_LIGHT = Color.rgb(255, 191, 122);
    private static final int COLOR_BLUSH = Color.rgb(217, 79, 132);
    private static final int COLOR_SKY = Color.rgb(74, 168, 216);
    private static final int COLOR_MINT = Color.rgb(42, 181, 173);
    private static final int COLOR_CARD_BORDER = Color.argb(31, 43, 33, 56);

    private TextView statusView;
    private TextView scaleValueView;
    private TextView inactivityValueView;
    private Button permissionButton;
    private Button startButton;
    private SeekBar scaleSeekBar;
    private SeekBar inactivitySeekBar;
    private CheckBox autoActionsCheckBox;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(createContentView());
        loadSettingsIntoControls();
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateStatus();
    }

    private View createContentView() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(false);
        scrollView.setBackground(pageBackground());

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(18), dp(22), dp(18), dp(28));
        scrollView.addView(root, new ScrollView.LayoutParams(-1, -2));

        LinearLayout heroCard = createCard(
            new int[] { Color.rgb(255, 245, 249), Color.rgb(248, 252, 255) },
            Color.argb(51, 214, 77, 126)
        );
        root.addView(heroCard, cardParams(0));

        TextView heroKicker = createPill("Android 悬浮宠物");
        heroCard.addView(heroKicker, wrapParams());

        TextView title = new TextView(this);
        title.setText("财神鸡");
        title.setTextSize(28);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setTextColor(COLOR_INK);
        title.setGravity(Gravity.START);
        title.setIncludeFontPadding(false);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(-1, -2);
        titleParams.setMargins(0, dp(14), 0, 0);
        heroCard.addView(title, titleParams);

        TextView subtitle = new TextView(this);
        subtitle.setText("Android 手机版控制台");
        subtitle.setTextSize(17);
        subtitle.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        subtitle.setTextColor(COLOR_BLUSH);
        subtitle.setIncludeFontPadding(false);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(-1, -2);
        subtitleParams.setMargins(0, dp(7), 0, 0);
        heroCard.addView(subtitle, subtitleParams);

        TextView desc = bodyText();
        desc.setText("拖拽移动，点击挥手，双击跳跃。保留白色鸡仔、红金财神装饰和金橙裙摆，也可以在这里手动触发动作、调整大小和设置无互动难过时间。");
        desc.setTextSize(15);
        desc.setLineSpacing(dp(2), 1.0f);
        LinearLayout.LayoutParams descParams = new LinearLayout.LayoutParams(-1, -2);
        descParams.setMargins(0, dp(13), 0, dp(16));
        heroCard.addView(desc, descParams);

        statusView = bodyText();
        statusView.setGravity(Gravity.CENTER);
        statusView.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        statusView.setPadding(dp(14), dp(10), dp(14), dp(10));
        heroCard.addView(statusView, new LinearLayout.LayoutParams(-1, -2));

        permissionButton = createPrimaryButton("打开悬浮窗权限");
        permissionButton.setOnClickListener(v -> openOverlayPermissionSettings());
        heroCard.addView(permissionButton, buttonParams());

        LinearLayout serviceRow = new LinearLayout(this);
        serviceRow.setOrientation(LinearLayout.HORIZONTAL);
        serviceRow.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams serviceRowParams = new LinearLayout.LayoutParams(-1, -2);
        serviceRowParams.setMargins(0, dp(12), 0, 0);
        heroCard.addView(serviceRow, serviceRowParams);

        startButton = createPrimaryButton("启动悬浮宠物");
        startButton.setOnClickListener(v -> startPet());
        serviceRow.addView(startButton, rowButtonParams(true));

        Button stopButton = createSecondaryButton("停止");
        stopButton.setOnClickListener(v -> {
            sendServiceCommand(PetOverlayService.ACTION_STOP);
            Toast.makeText(this, "已请求停止悬浮宠物", Toast.LENGTH_SHORT).show();
            statusView.postDelayed(this::updateStatus, 700);
        });
        serviceRow.addView(stopButton, rowButtonParams(false));

        LinearLayout actionCard = createWhiteCard();
        root.addView(actionCard, cardParams(dp(16)));
        addSectionHeader(actionCard, "动作控制", "九个动作都可以手动触发，适合测试和展示。");
        addActionRow(actionCard,
            new ActionButton("待机", PetView.STATE_IDLE, 0),
            new ActionButton("跑步", PetView.STATE_RUNNING, 1600),
            new ActionButton("向右跑", PetView.STATE_RUNNING_RIGHT, 1600)
        );
        addActionRow(actionCard,
            new ActionButton("向左跑", PetView.STATE_RUNNING_LEFT, 1600),
            new ActionButton("挥手", PetView.STATE_WAVING, 1200),
            new ActionButton("跳跃", PetView.STATE_JUMPING, 1200)
        );
        addActionRow(actionCard,
            new ActionButton("难过", PetView.STATE_FAILED, 2200),
            new ActionButton("等待", PetView.STATE_WAITING, 1800),
            new ActionButton("复习", PetView.STATE_REVIEW, 1800)
        );

        LinearLayout settingsCard = createWhiteCard();
        root.addView(settingsCard, cardParams(dp(16)));
        addSectionHeader(settingsCard, "自定义设置", "调整宠物大小、空闲行为和默认位置。");

        scaleValueView = createValueLabel();
        settingsCard.addView(scaleValueView, new LinearLayout.LayoutParams(-1, -2));
        scaleSeekBar = new SeekBar(this);
        styleSeekBar(scaleSeekBar);
        scaleSeekBar.setMax(PetSettings.MAX_SCALE_PERCENT - PetSettings.MIN_SCALE_PERCENT);
        scaleSeekBar.setOnSeekBarChangeListener(new SimpleSeekBarListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                int scale = PetSettings.MIN_SCALE_PERCENT + progress;
                updateScaleLabel(scale);
                if (fromUser) {
                    PetSettings.setScalePercent(MainActivity.this, scale);
                    notifySettingsChangedIfRunning();
                }
            }
        });
        settingsCard.addView(scaleSeekBar, sliderParams());

        inactivityValueView = createValueLabel();
        LinearLayout.LayoutParams inactivityLabelParams = new LinearLayout.LayoutParams(-1, -2);
        inactivityLabelParams.setMargins(0, dp(14), 0, 0);
        settingsCard.addView(inactivityValueView, inactivityLabelParams);
        inactivitySeekBar = new SeekBar(this);
        styleSeekBar(inactivitySeekBar);
        inactivitySeekBar.setMax(PetSettings.MAX_INACTIVITY_MINUTES);
        inactivitySeekBar.setOnSeekBarChangeListener(new SimpleSeekBarListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                updateInactivityLabel(progress);
                if (fromUser) {
                    PetSettings.setInactivityMinutes(MainActivity.this, progress);
                    notifySettingsChangedIfRunning();
                }
            }
        });
        settingsCard.addView(inactivitySeekBar, sliderParams());

        autoActionsCheckBox = new CheckBox(this);
        autoActionsCheckBox.setText("空闲时自动随机播放小动作");
        autoActionsCheckBox.setTextSize(15);
        autoActionsCheckBox.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        autoActionsCheckBox.setTextColor(COLOR_INK);
        autoActionsCheckBox.setPadding(0, dp(8), 0, dp(8));
        if (Build.VERSION.SDK_INT >= 21) {
            autoActionsCheckBox.setButtonTintList(ColorStateList.valueOf(COLOR_BLUSH));
        }
        autoActionsCheckBox.setOnCheckedChangeListener((buttonView, isChecked) -> {
            PetSettings.setAutoActionsEnabled(MainActivity.this, isChecked);
            notifySettingsChangedIfRunning();
        });
        settingsCard.addView(autoActionsCheckBox, new LinearLayout.LayoutParams(-1, -2));

        Button resetPositionButton = createSecondaryButton("重置到屏幕中心并恢复100%大小");
        resetPositionButton.setOnClickListener(v -> {
            PetSettings.setScalePercent(this, PetSettings.DEFAULT_SCALE_PERCENT);
            scaleSeekBar.setProgress(PetSettings.DEFAULT_SCALE_PERCENT - PetSettings.MIN_SCALE_PERCENT);
            updateScaleLabel(PetSettings.DEFAULT_SCALE_PERCENT);
            sendServiceCommand(PetOverlayService.ACTION_RESET_POSITION);
            Toast.makeText(this, "已重置到屏幕中心并恢复 100% 大小", Toast.LENGTH_SHORT).show();
        });
        settingsCard.addView(resetPositionButton, buttonParams());

        Button resetSettingsButton = createGhostButton("恢复默认设置");
        resetSettingsButton.setOnClickListener(v -> {
            PetSettings.reset(this);
            loadSettingsIntoControls();
            notifySettingsChangedIfRunning();
            Toast.makeText(this, "已恢复默认设置", Toast.LENGTH_SHORT).show();
        });
        settingsCard.addView(resetSettingsButton, buttonParams());

        LinearLayout aodCard = createCard(
            new int[] { Color.rgb(239, 249, 255), Color.rgb(255, 245, 250) },
            Color.argb(48, 74, 168, 216)
        );
        root.addView(aodCard, cardParams(dp(16)));
        addSectionHeader(aodCard, "原生熄屏显示 / AOD", "只做系统原生支持引导，不模拟常亮屏幕。");

        TextView aodDescription = bodyText();
        aodDescription.setText("真正的熄屏显示由手机系统和厂商 ROM 控制，普通第三方 App 无法统一强制开启。开启原生 AOD 后，财神鸡能否显示在锁屏或熄屏界面上，取决于系统是否允许第三方悬浮窗覆盖该界面。本应用不会请求额外权限。");
        aodDescription.setLineSpacing(dp(2), 1.0f);
        aodCard.addView(aodDescription, new LinearLayout.LayoutParams(-1, -2));

        Button displaySettingsButton = createPrimaryButton("打开系统显示设置");
        displaySettingsButton.setOnClickListener(v -> openDisplaySettings());
        aodCard.addView(displaySettingsButton, buttonParams());

        return scrollView;
    }

    private void addSectionHeader(LinearLayout root, String titleText, String descriptionText) {
        TextView title = new TextView(this);
        title.setText(titleText);
        title.setTextSize(20);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setTextColor(COLOR_INK);
        title.setIncludeFontPadding(false);
        root.addView(title, new LinearLayout.LayoutParams(-1, -2));

        TextView description = bodyText();
        description.setText(descriptionText);
        description.setTextSize(14);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, dp(8), 0, dp(14));
        root.addView(description, params);
    }

    private void addActionRow(LinearLayout root, ActionButton... actions) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);

        for (int index = 0; index < actions.length; index++) {
            ActionButton action = actions[index];
            Button button = createActionButton(action.label);
            button.setOnClickListener(v -> playState(action.state, action.transientMs));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(48), 1);
            params.setMargins(index == 0 ? 0 : dp(5), dp(5), index == actions.length - 1 ? 0 : dp(5), dp(5));
            row.addView(button, params);
        }

        root.addView(row, new LinearLayout.LayoutParams(-1, -2));
    }

    private TextView bodyText() {
        TextView textView = new TextView(this);
        textView.setTextSize(14);
        textView.setTextColor(COLOR_TEXT);
        textView.setLineSpacing(dp(1), 1.0f);
        return textView;
    }

    private TextView createValueLabel() {
        TextView textView = bodyText();
        textView.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        textView.setTextColor(COLOR_INK);
        textView.setPadding(dp(13), dp(10), dp(13), dp(10));
        applySolidBackground(textView, Color.rgb(247, 245, 248), 15, 1, Color.argb(18, 43, 33, 56));
        return textView;
    }

    private TextView createPill(String text) {
        TextView pill = new TextView(this);
        pill.setText(text);
        pill.setTextSize(13);
        pill.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        pill.setTextColor(COLOR_BLUSH);
        pill.setPadding(dp(12), dp(6), dp(12), dp(6));
        pill.setIncludeFontPadding(false);
        applySolidBackground(pill, Color.argb(199, 255, 255, 255), 999, 1, Color.argb(31, 214, 77, 126));
        return pill;
    }

    private Button createPrimaryButton(String text) {
        Button button = baseButton(text);
        button.setTextColor(Color.WHITE);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        applyGradientButton(
            button,
            new int[] { COLOR_PEACH, COLOR_PEACH_LIGHT },
            Color.argb(56, 255, 141, 114)
        );
        return button;
    }

    private Button createSecondaryButton(String text) {
        Button button = baseButton(text);
        button.setTextColor(COLOR_INK);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        applyButtonBackground(button, Color.WHITE, 16, 1, Color.argb(46, 58, 46, 66));
        return button;
    }

    private Button createGhostButton(String text) {
        Button button = baseButton(text);
        button.setTextColor(COLOR_MUTED);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        applyButtonBackground(button, Color.rgb(249, 247, 250), 16, 1, Color.argb(24, 58, 46, 66));
        return button;
    }

    private Button createActionButton(String text) {
        Button button = baseButton(text);
        button.setTextSize(14);
        button.setTextColor(COLOR_INK);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        applyButtonBackground(button, Color.rgb(255, 248, 251), 16, 1, Color.argb(43, 217, 79, 132));
        return button;
    }

    private Button baseButton(String text) {
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setText(text);
        button.setTextSize(15);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(10), 0, dp(10), 0);
        button.setMinHeight(0);
        button.setMinimumHeight(0);
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        if (Build.VERSION.SDK_INT >= 21) {
            button.setStateListAnimator(null);
            button.setElevation(0);
        }
        return button;
    }

    private LinearLayout createWhiteCard() {
        return createCard(new int[] { Color.WHITE, Color.WHITE }, COLOR_CARD_BORDER);
    }

    private LinearLayout createCard(int[] colors, int strokeColor) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(20), dp(20), dp(20), dp(20));

        GradientDrawable background = new GradientDrawable(GradientDrawable.Orientation.TL_BR, colors);
        background.setCornerRadius(dp(28));
        background.setStroke(dp(1), strokeColor);
        card.setBackground(background);
        if (Build.VERSION.SDK_INT >= 21) {
            card.setElevation(dp(2));
        }
        return card;
    }

    private GradientDrawable pageBackground() {
        return new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] { Color.rgb(247, 251, 255), Color.rgb(255, 248, 244) }
        );
    }

    private void applyGradientButton(Button button, int[] colors, int rippleColor) {
        GradientDrawable content = new GradientDrawable(GradientDrawable.Orientation.TL_BR, colors);
        content.setCornerRadius(dp(16));
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(rippleColor), content, null));
    }

    private void applyButtonBackground(Button button, int color, int radiusDp, int strokeWidthDp, int strokeColor) {
        GradientDrawable content = roundedShape(color, radiusDp, strokeWidthDp, strokeColor);
        button.setBackground(new RippleDrawable(ColorStateList.valueOf(Color.argb(34, 217, 79, 132)), content, null));
    }

    private void applySolidBackground(View view, int color, int radiusDp, int strokeWidthDp, int strokeColor) {
        view.setBackground(roundedShape(color, radiusDp, strokeWidthDp, strokeColor));
    }

    private GradientDrawable roundedShape(int color, int radiusDp, int strokeWidthDp, int strokeColor) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setCornerRadius(dp(radiusDp));
        if (strokeWidthDp > 0) {
            shape.setStroke(dp(strokeWidthDp), strokeColor);
        }
        return shape;
    }

    private void styleSeekBar(SeekBar seekBar) {
        seekBar.setPadding(0, dp(8), 0, dp(8));
        if (Build.VERSION.SDK_INT >= 21) {
            seekBar.setProgressTintList(ColorStateList.valueOf(COLOR_BLUSH));
            seekBar.setThumbTintList(ColorStateList.valueOf(COLOR_PEACH));
            seekBar.setProgressBackgroundTintList(ColorStateList.valueOf(Color.rgb(238, 232, 241)));
        }
    }

    private LinearLayout.LayoutParams cardParams(int topMargin) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, topMargin, 0, 0);
        return params;
    }

    private LinearLayout.LayoutParams wrapParams() {
        return new LinearLayout.LayoutParams(-2, -2);
    }

    private LinearLayout.LayoutParams buttonParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, dp(52));
        params.setMargins(0, dp(12), 0, 0);
        return params;
    }

    private LinearLayout.LayoutParams rowButtonParams(boolean first) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(52), first ? 1.45f : 1f);
        params.setMargins(first ? 0 : dp(6), 0, first ? dp(6) : 0, 0);
        return params;
    }

    private LinearLayout.LayoutParams sliderParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, dp(4), 0, 0);
        return params;
    }

    private void loadSettingsIntoControls() {
        int scale = PetSettings.getScalePercent(this);
        int inactivityMinutes = PetSettings.getInactivityMinutes(this);
        scaleSeekBar.setProgress(scale - PetSettings.MIN_SCALE_PERCENT);
        inactivitySeekBar.setProgress(inactivityMinutes);
        autoActionsCheckBox.setChecked(PetSettings.isAutoActionsEnabled(this));
        updateScaleLabel(scale);
        updateInactivityLabel(inactivityMinutes);
    }

    private void updateScaleLabel(int scalePercent) {
        scaleValueView.setText(
            "宠物大小  " + scalePercent + "%   ·   可调 "
                + PetSettings.MIN_SCALE_PERCENT + "%–"
                + PetSettings.MAX_SCALE_PERCENT + "%"
        );
    }

    private void updateInactivityLabel(int minutes) {
        if (minutes <= 0) {
            inactivityValueView.setText("无互动难过时间  关闭");
        } else {
            inactivityValueView.setText("无互动难过时间  " + minutes + " 分钟");
        }
    }

    private void updateStatus() {
        boolean allowed = canDrawOverlays();
        String running = PetOverlayService.isPetVisible() ? "宠物运行中" : "宠物未运行";
        statusView.setText(allowed ? "● 悬浮窗权限已开启 · " + running : "● 需要先开启悬浮窗权限");
        statusView.setTextColor(allowed ? Color.rgb(20, 121, 113) : COLOR_BLUSH);
        applySolidBackground(
            statusView,
            allowed ? Color.rgb(236, 253, 249) : Color.rgb(255, 241, 247),
            18,
            1,
            allowed ? Color.argb(62, 42, 181, 173) : Color.argb(62, 217, 79, 132)
        );
        permissionButton.setVisibility(allowed ? View.GONE : View.VISIBLE);
        startButton.setEnabled(allowed);
        startButton.setAlpha(allowed ? 1f : 0.52f);
    }

    private boolean canDrawOverlays() {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this);
    }

    private void openOverlayPermissionSettings() {
        if (Build.VERSION.SDK_INT >= 23) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getPackageName())
            );
            startActivity(intent);
        }
    }

    private void openDisplaySettings() {
        try {
            startActivity(new Intent(Settings.ACTION_DISPLAY_SETTINGS));
        } catch (Exception ignored) {
            startActivity(new Intent(Settings.ACTION_SETTINGS));
        }
    }

    private void startPet() {
        if (!canDrawOverlays()) {
            Toast.makeText(this, "请先开启悬浮窗权限", Toast.LENGTH_SHORT).show();
            openOverlayPermissionSettings();
            return;
        }

        sendServiceCommand(PetOverlayService.ACTION_START);
        Toast.makeText(this, "财神鸡悬浮宠物已启动", Toast.LENGTH_SHORT).show();
        updateStatus();
        statusView.postDelayed(this::updateStatus, 700);
    }

    private void playState(int state, long transientMs) {
        if (!canDrawOverlays()) {
            Toast.makeText(this, "请先开启悬浮窗权限", Toast.LENGTH_SHORT).show();
            openOverlayPermissionSettings();
            return;
        }

        Intent intent = new Intent(this, PetOverlayService.class);
        intent.setAction(PetOverlayService.ACTION_PLAY_STATE);
        intent.putExtra(PetOverlayService.EXTRA_STATE, state);
        intent.putExtra(PetOverlayService.EXTRA_TRANSIENT_MS, transientMs);
        startServiceCompat(intent);
    }

    private void notifySettingsChangedIfRunning() {
        if (PetOverlayService.isPetVisible()) {
            sendServiceCommand(PetOverlayService.ACTION_UPDATE_SETTINGS);
        }
    }

    private void sendServiceCommand(String action) {
        Intent intent = new Intent(this, PetOverlayService.class);
        intent.setAction(action);
        startServiceCompat(intent);
    }

    private void startServiceCompat(Intent intent) {
        if (Build.VERSION.SDK_INT >= 26) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static final class ActionButton {
        final String label;
        final int state;
        final long transientMs;

        ActionButton(String label, int state, long transientMs) {
            this.label = label;
            this.state = state;
            this.transientMs = transientMs;
        }
    }

    private abstract static class SimpleSeekBarListener implements SeekBar.OnSeekBarChangeListener {
        @Override
        public void onStartTrackingTouch(SeekBar seekBar) {
        }

        @Override
        public void onStopTrackingTouch(SeekBar seekBar) {
        }
    }
}

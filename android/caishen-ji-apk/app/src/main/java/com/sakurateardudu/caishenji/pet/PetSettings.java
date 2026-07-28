package com.sakurateardudu.caishenji.pet;

import android.content.Context;
import android.content.SharedPreferences;

public final class PetSettings {
    public static final int MIN_SCALE_PERCENT = 10;
    public static final int MAX_SCALE_PERCENT = 200;
    public static final int DEFAULT_SCALE_PERCENT = 100;
    public static final int DEFAULT_INACTIVITY_MINUTES = 5;
    public static final int MAX_INACTIVITY_MINUTES = 30;
    public static final boolean DEFAULT_AUTO_ACTIONS_ENABLED = true;

    private static final String PREFS_NAME = "caishen_ji_pet_settings";
    private static final String KEY_SCALE_PERCENT = "scale_percent";
    private static final String KEY_INACTIVITY_MINUTES = "inactivity_minutes";
    private static final String KEY_AUTO_ACTIONS_ENABLED = "auto_actions_enabled";

    private PetSettings() {
    }

    public static int getScalePercent(Context context) {
        return clamp(
            prefs(context).getInt(KEY_SCALE_PERCENT, DEFAULT_SCALE_PERCENT),
            MIN_SCALE_PERCENT,
            MAX_SCALE_PERCENT
        );
    }

    public static void setScalePercent(Context context, int scalePercent) {
        prefs(context)
            .edit()
            .putInt(KEY_SCALE_PERCENT, clamp(scalePercent, MIN_SCALE_PERCENT, MAX_SCALE_PERCENT))
            .apply();
    }

    public static int getInactivityMinutes(Context context) {
        return clamp(
            prefs(context).getInt(KEY_INACTIVITY_MINUTES, DEFAULT_INACTIVITY_MINUTES),
            0,
            MAX_INACTIVITY_MINUTES
        );
    }

    public static long getInactivityMillis(Context context) {
        int minutes = getInactivityMinutes(context);
        return minutes <= 0 ? 0L : minutes * 60_000L;
    }

    public static void setInactivityMinutes(Context context, int minutes) {
        prefs(context)
            .edit()
            .putInt(KEY_INACTIVITY_MINUTES, clamp(minutes, 0, MAX_INACTIVITY_MINUTES))
            .apply();
    }

    public static boolean isAutoActionsEnabled(Context context) {
        return prefs(context).getBoolean(KEY_AUTO_ACTIONS_ENABLED, DEFAULT_AUTO_ACTIONS_ENABLED);
    }

    public static void setAutoActionsEnabled(Context context, boolean enabled) {
        prefs(context)
            .edit()
            .putBoolean(KEY_AUTO_ACTIONS_ENABLED, enabled)
            .apply();
    }

    public static void reset(Context context) {
        prefs(context).edit().clear().apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}

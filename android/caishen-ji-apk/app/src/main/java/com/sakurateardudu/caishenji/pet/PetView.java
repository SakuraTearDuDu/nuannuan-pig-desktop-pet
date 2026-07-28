package com.sakurateardudu.caishenji.pet;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.view.View;

import java.util.Random;

public class PetView extends View {
    public static final int STATE_IDLE = 0;
    public static final int STATE_RUNNING_RIGHT = 1;
    public static final int STATE_RUNNING_LEFT = 2;
    public static final int STATE_WAVING = 3;
    public static final int STATE_JUMPING = 4;
    public static final int STATE_FAILED = 5;
    public static final int STATE_WAITING = 6;
    public static final int STATE_RUNNING = 7;
    public static final int STATE_REVIEW = 8;

    private static final int CELL_WIDTH = 192;
    private static final int CELL_HEIGHT = 208;
    private static final int AUTO_ACTION_MIN_DELAY_MS = 25_000;
    private static final int AUTO_ACTION_MAX_DELAY_MS = 45_000;

    private static final int[] ROWS = {0, 1, 2, 3, 4, 5, 6, 7, 8};
    private static final int[] FRAMES = {6, 8, 8, 4, 5, 8, 6, 6, 6};
    private static final int[][] DURATIONS = {
        {280, 110, 110, 140, 140, 320},
        {120, 120, 120, 120, 120, 120, 120, 220},
        {120, 120, 120, 120, 120, 120, 120, 220},
        {140, 140, 140, 280},
        {140, 140, 140, 140, 280},
        {140, 140, 140, 140, 140, 140, 140, 240},
        {150, 150, 150, 150, 150, 260},
        {120, 120, 120, 120, 120, 220},
        {150, 150, 150, 150, 150, 280}
    };

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Paint paint = new Paint();
    private final Rect src = new Rect();
    private final Rect dst = new Rect();
    private final Bitmap spritesheet;
    private final Random random = new Random();
    private int currentState = STATE_IDLE;
    private int frameIndex;
    private long nextFrameAt;
    private long transientUntil;
    private long lastUserInteractionAt;
    private long inactivityFailedDelayMs = 5 * 60 * 1000L;
    private boolean autoActionsEnabled = true;
    private boolean running;

    private final Runnable frameTick = new Runnable() {
        @Override
        public void run() {
            if (!running) {
                return;
            }

            long now = System.currentTimeMillis();
            if (transientUntil > 0 && now > transientUntil) {
                setState(STATE_IDLE);
            }

            if (now >= nextFrameAt) {
                frameIndex = (frameIndex + 1) % FRAMES[currentState];
                nextFrameAt = now + DURATIONS[currentState][frameIndex];
                invalidate();
            }

            if (
                inactivityFailedDelayMs > 0
                    && now - lastUserInteractionAt > inactivityFailedDelayMs
                    && currentState == STATE_IDLE
            ) {
                setState(STATE_FAILED, 2200);
                lastUserInteractionAt = now;
            }

            handler.postDelayed(this, 16);
        }
    };

    private final Runnable autoActionTick = new Runnable() {
        @Override
        public void run() {
            if (!running) {
                return;
            }

            if (autoActionsEnabled && currentState == STATE_IDLE && transientUntil == 0) {
                int pick = random.nextInt(4);
                if (pick == 0) {
                    setState(STATE_WAVING, 1200);
                } else if (pick == 1) {
                    setState(STATE_JUMPING, 1200);
                } else if (pick == 2) {
                    setState(STATE_WAITING, 1800);
                } else {
                    setState(STATE_REVIEW, 1800);
                }
            }
            scheduleAutoAction();
        }
    };

    public PetView(Context context, Bitmap spritesheet) {
        super(context);
        this.spritesheet = spritesheet;
        paint.setAntiAlias(false);
        paint.setFilterBitmap(false);
        paint.setDither(false);
        setWillNotDraw(false);
        setBackgroundColor(0x00000000);
        lastUserInteractionAt = System.currentTimeMillis();
        nextFrameAt = lastUserInteractionAt;
    }

    public void start() {
        if (running) {
            return;
        }
        running = true;
        frameTick.run();
        if (autoActionsEnabled) {
            scheduleAutoAction();
        }
    }

    public void stop() {
        running = false;
        handler.removeCallbacksAndMessages(null);
    }

    public void markUserInteraction() {
        lastUserInteractionAt = System.currentTimeMillis();
        if (autoActionsEnabled) {
            scheduleAutoAction();
        }
    }

    public void setInactivityFailedDelayMs(long delayMs) {
        inactivityFailedDelayMs = Math.max(0L, delayMs);
        lastUserInteractionAt = System.currentTimeMillis();
    }

    public void setAutoActionsEnabled(boolean enabled) {
        autoActionsEnabled = enabled;
        handler.removeCallbacks(autoActionTick);
        if (enabled && running) {
            scheduleAutoAction();
        }
    }

    public void setState(int state) {
        setState(state, 0);
    }

    public void setState(int state, long transientMs) {
        if (state < STATE_IDLE || state > STATE_REVIEW) {
            state = STATE_IDLE;
        }

        if (currentState != state) {
            currentState = state;
            frameIndex = 0;
            nextFrameAt = System.currentTimeMillis();
            invalidate();
        }
        transientUntil = transientMs > 0 ? System.currentTimeMillis() + transientMs : 0;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        src.set(
            frameIndex * CELL_WIDTH,
            ROWS[currentState] * CELL_HEIGHT,
            (frameIndex + 1) * CELL_WIDTH,
            (ROWS[currentState] + 1) * CELL_HEIGHT
        );
        dst.set(0, 0, getWidth(), getHeight());
        canvas.drawBitmap(spritesheet, src, dst, paint);
    }

    private void scheduleAutoAction() {
        if (!autoActionsEnabled) {
            handler.removeCallbacks(autoActionTick);
            return;
        }
        handler.removeCallbacks(autoActionTick);
        int delay = AUTO_ACTION_MIN_DELAY_MS + random.nextInt(AUTO_ACTION_MAX_DELAY_MS - AUTO_ACTION_MIN_DELAY_MS + 1);
        handler.postDelayed(autoActionTick, delay);
    }
}

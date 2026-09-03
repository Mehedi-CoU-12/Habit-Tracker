package com.habitflow.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import android.widget.RemoteViews

/**
 * Large: the trailing-month heatmap.
 *
 * Drawn as a single bitmap rather than a grid of RemoteViews. Forty-two cells
 * would mean forty-two ids in a static layout and forty-two setInt calls per
 * update; one Canvas is less code, scales to any cell count, and gets the
 * accent tint for free.
 *
 * The levels themselves are computed in JS and mirrored — the widget never
 * sees a log, which is what keeps completion.ts from being ported into a
 * third language.
 */
class LargeWidgetProvider : BaseWidgetProvider() {

    override fun build(context: Context, payload: WidgetMirror.Payload?): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_large)
        val dark = payload?.dark ?: false
        val accent = payload?.accent ?: WidgetMirror.DEFAULT_ACCENT

        views.setInt(R.id.large_root, "setBackgroundResource", WidgetTheme.background(dark))
        views.setTextColor(R.id.large_title, WidgetTheme.ink(dark))
        views.setTextColor(R.id.large_subtitle, WidgetTheme.muted(dark))
        launchApp(context)?.let { views.setOnClickPendingIntent(R.id.large_root, it) }

        if (payload == null || !payload.signedIn) {
            views.setTextViewText(R.id.large_title, "HabitFlow")
            views.setTextViewText(R.id.large_subtitle, "Sign in to see your garden")
            views.setViewVisibility(R.id.large_grid, View.GONE)
            return views
        }

        views.setTextViewText(R.id.large_title, "Last 5 weeks")
        views.setTextViewText(
            R.id.large_subtitle,
            "${payload.doneToday} of ${payload.dueToday} done today",
        )
        views.setViewVisibility(R.id.large_grid, View.VISIBLE)
        views.setImageViewBitmap(
            R.id.large_grid,
            grid(payload.levels, accent, WidgetTheme.surface2(dark)),
        )
        return views
    }

    /**
     * Columns of seven, oldest on the left — the GitHub shape, which reads
     * naturally at this width where the phone's own year view does not.
     */
    private fun grid(levels: List<Int>, accent: Int, empty: Int): Bitmap {
        val rows = 7
        val cell = 26
        val gap = 5
        val cols = maxOf(1, (levels.size + rows - 1) / rows)
        val width = cols * cell + (cols - 1) * gap
        val height = rows * cell + (rows - 1) * gap

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        val radius = cell * 0.28f

        for (i in levels.indices) {
            val col = i / rows
            val row = i % rows
            val x = col * (cell + gap).toFloat()
            val y = row * (cell + gap).toFloat()
            paint.color = shade(levels[i], accent, empty)
            canvas.drawRoundRect(
                RectF(x, y, x + cell, y + cell),
                radius,
                radius,
                paint,
            )
        }
        return bitmap
    }

    /** Level 0 is the empty track; 1–4 step the accent up in opacity. */
    private fun shade(level: Int, accent: Int, empty: Int): Int =
        when (level.coerceIn(0, 4)) {
            0 -> empty
            else ->
                Color.argb(
                    (255 * (0.28f + level.coerceIn(1, 4) * 0.18f)).toInt().coerceAtMost(255),
                    Color.red(accent),
                    Color.green(accent),
                    Color.blue(accent),
                )
        }
}

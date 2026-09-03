package com.habitflow.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import android.widget.RemoteViews

/**
 * Small: one habit's ring.
 *
 * "One habit" is the first habit still unfinished today, falling back to the
 * first in the roster — the ring is most useful when it shows the thing you
 * have not done yet.
 *
 * The ring is a Canvas-drawn bitmap rather than a ProgressBar: RemoteViews
 * cannot style a circular progress bar, and a bitmap follows the accent colour
 * from the payload for free.
 */
class SmallWidgetProvider : BaseWidgetProvider() {

    override fun build(context: Context, payload: WidgetMirror.Payload?): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_small)
        val dark = payload?.dark ?: false
        val accent = payload?.accent ?: WidgetMirror.DEFAULT_ACCENT

        views.setInt(R.id.small_root, "setBackgroundResource", WidgetTheme.background(dark))
        views.setTextColor(R.id.small_title, WidgetTheme.ink(dark))
        views.setTextColor(R.id.small_detail, WidgetTheme.muted(dark))
        launchApp(context)?.let { views.setOnClickPendingIntent(R.id.small_root, it) }

        if (payload == null || !payload.signedIn) {
            views.setViewVisibility(R.id.small_ring, View.GONE)
            views.setTextViewText(R.id.small_title, "HabitFlow")
            views.setTextViewText(R.id.small_detail, "Sign in to see your habits")
            return views
        }

        val habit = payload.habits.firstOrNull { !it.done } ?: payload.habits.firstOrNull()
        if (habit == null) {
            views.setViewVisibility(R.id.small_ring, View.GONE)
            views.setTextViewText(R.id.small_title, "No habits yet")
            views.setTextViewText(R.id.small_detail, "Plant your first one")
            return views
        }

        views.setViewVisibility(R.id.small_ring, View.VISIBLE)
        views.setImageViewBitmap(
            R.id.small_ring,
            ring(habit.progress, accent, WidgetTheme.surface2(dark)),
        )
        views.setTextViewText(R.id.small_title, habit.name)
        views.setTextViewText(
            R.id.small_detail,
            when {
                habit.detail.isNotEmpty() -> habit.detail
                habit.done -> "Done today"
                habit.streak > 0 -> "${habit.streak} day streak"
                else -> "Not done yet"
            },
        )
        return views
    }

    private fun ring(progress: Float, accent: Int, track: Int): Bitmap {
        val size = 132
        val stroke = 14f
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val bounds =
            RectF(stroke / 2f, stroke / 2f, size - stroke / 2f, size - stroke / 2f)

        val paint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = stroke
                strokeCap = Paint.Cap.ROUND
            }

        paint.color = track
        canvas.drawArc(bounds, 0f, 360f, false, paint)

        // A completed habit gets a full ring; anything above zero gets at least
        // a visible cap, so "started" never reads identically to "untouched".
        val sweep = if (progress <= 0f) 0f else (progress.coerceIn(0f, 1f) * 360f).coerceAtLeast(8f)
        if (sweep > 0f) {
            paint.color = accent
            canvas.drawArc(bounds, -90f, sweep, false, paint)
        }
        return bitmap
    }
}

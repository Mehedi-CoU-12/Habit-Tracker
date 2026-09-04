package com.habitflow.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import android.widget.RemoteViews

/**
 * Medium: today's list with progress. The size people keep, so it is the one
 * built first.
 *
 * Four fixed rows rather than a ListView. A RemoteViews collection needs a
 * RemoteViewsService, a factory, and a second data path to keep in step with
 * the mirror — a lot of lifecycle for a list that is four items tall at this
 * widget size. Unfinished habits sort first, so the four rows shown are the
 * four worth looking at.
 */
class MediumWidgetProvider : BaseWidgetProvider() {

    private data class Row(val name: Int, val detail: Int, val bar: Int, val root: Int)

    private val rows =
        listOf(
            Row(R.id.row0_name, R.id.row0_detail, R.id.row0_bar, R.id.row0),
            Row(R.id.row1_name, R.id.row1_detail, R.id.row1_bar, R.id.row1),
            Row(R.id.row2_name, R.id.row2_detail, R.id.row2_bar, R.id.row2),
            Row(R.id.row3_name, R.id.row3_detail, R.id.row3_bar, R.id.row3),
        )

    override fun build(context: Context, payload: WidgetMirror.Payload?): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_medium)
        val dark = payload?.dark ?: false
        val accent = payload?.accent ?: WidgetMirror.DEFAULT_ACCENT

        views.setInt(R.id.medium_root, "setBackgroundResource", WidgetTheme.background(dark))
        views.setTextColor(R.id.medium_title, WidgetTheme.ink(dark))
        views.setTextColor(R.id.medium_count, WidgetTheme.muted(dark))
        launchApp(context)?.let { views.setOnClickPendingIntent(R.id.medium_root, it) }

        if (payload == null || !payload.signedIn) {
            views.setTextViewText(R.id.medium_title, "HabitFlow")
            views.setTextViewText(R.id.medium_count, "Sign in")
            views.setViewVisibility(R.id.medium_empty, View.VISIBLE)
            views.setTextColor(R.id.medium_empty, WidgetTheme.muted(dark))
            views.setTextViewText(R.id.medium_empty, "Sign in to see your habits")
            for (row in rows) views.setViewVisibility(row.root, View.GONE)
            return views
        }

        views.setTextViewText(R.id.medium_title, "Today")
        views.setTextViewText(
            R.id.medium_count,
            "${payload.doneToday} / ${payload.dueToday}",
        )

        // Unfinished first, so a full list still surfaces what is outstanding.
        val ordered =
            payload.habits.sortedWith(
                compareBy({ it.done }, { -it.progress })
            )

        views.setViewVisibility(
            R.id.medium_empty,
            if (ordered.isEmpty()) View.VISIBLE else View.GONE,
        )
        if (ordered.isEmpty()) {
            views.setTextColor(R.id.medium_empty, WidgetTheme.muted(dark))
            views.setTextViewText(R.id.medium_empty, "Nothing due today 🌱")
        }

        rows.forEachIndexed { i, row ->
            val habit = ordered.getOrNull(i)
            if (habit == null) {
                views.setViewVisibility(row.root, View.GONE)
                return@forEachIndexed
            }
            views.setViewVisibility(row.root, View.VISIBLE)
            views.setTextViewText(row.name, habit.name)
            views.setTextColor(
                row.name,
                if (habit.done) WidgetTheme.muted(dark) else WidgetTheme.ink(dark),
            )
            views.setTextViewText(
                row.detail,
                when {
                    habit.detail.isNotEmpty() -> habit.detail
                    habit.done -> "done"
                    else -> ""
                },
            )
            views.setTextColor(row.detail, WidgetTheme.muted(dark))
            views.setImageViewBitmap(
                row.bar,
                bar(habit.progress, accent, WidgetTheme.surface2(dark)),
            )
        }

        // More than the four rows fit: say so rather than silently truncating.
        val hidden = ordered.size - rows.size
        views.setViewVisibility(
            R.id.medium_more,
            if (hidden > 0) View.VISIBLE else View.GONE,
        )
        if (hidden > 0) {
            views.setTextColor(R.id.medium_more, WidgetTheme.muted(dark))
            views.setTextViewText(R.id.medium_more, "+$hidden more")
        }

        return views
    }

    /** A rounded track with an accent fill — one bitmap per row. */
    private fun bar(progress: Float, accent: Int, track: Int): Bitmap {
        val width = 240
        val height = 16
        val radius = height / 2f
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }

        paint.color = track
        canvas.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), radius, radius, paint)

        val filled = progress.coerceIn(0f, 1f) * width
        if (filled > 0f) {
            paint.color = accent
            // Never narrower than the cap, or a 2%-done bar draws as nothing.
            canvas.drawRoundRect(
                RectF(0f, 0f, filled.coerceAtLeast(height.toFloat()), height.toFloat()),
                radius,
                radius,
                paint,
            )
        }
        return bitmap
    }
}

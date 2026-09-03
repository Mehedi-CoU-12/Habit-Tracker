package com.habitflow.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

/** Which providers exist, for the "is anything placed" check. */
object WidgetSizes {
    private val ALL =
        listOf(
            SmallWidgetProvider::class.java,
            MediumWidgetProvider::class.java,
            LargeWidgetProvider::class.java,
        )

    fun anyPlaced(context: Context): Boolean {
        val manager = AppWidgetManager.getInstance(context) ?: return false
        return ALL.any { manager.getAppWidgetIds(ComponentName(context, it)).isNotEmpty() }
    }
}

/**
 * The palette the widgets draw with, mirroring theme/tokens.ts.
 *
 * Hard-coded rather than pulled from Android resources because the widget must
 * follow the *app's* dark-mode and accent choice, which are app preferences —
 * a user on a light phone with HabitFlow set to dark expects a dark widget.
 * The accent itself rides in the payload; only the neutrals live here.
 */
object WidgetTheme {
    /**
     * The rounded plate, as a drawable rather than a colour: RemoteViews'
     * setBackgroundColor would replace the shape and square off the corners,
     * and setBackgroundTintList is API 31+.
     */
    fun background(dark: Boolean) =
        if (dark) R.drawable.widget_bg_dark else R.drawable.widget_bg

    fun surface2(dark: Boolean) = if (dark) 0xFF30251A.toInt() else 0xFFF6EBD9.toInt()

    fun line(dark: Boolean) = if (dark) 0xFF3C2E1F.toInt() else 0xFFF0D9B0.toInt()

    fun ink(dark: Boolean) = if (dark) 0xFFF6ECDD.toInt() else 0xFF2A1F14.toInt()

    fun muted(dark: Boolean) = if (dark) 0xFF9C8B76.toInt() else 0xFF8A7A66.toInt()
}

/**
 * Shared behaviour for all three sizes. They read the same mirror payload, so
 * adding a size is layout work rather than data work — which is the point of
 * storing presentation instead of domain state.
 *
 * Everything is defensive: a widget that throws can take out the launcher's
 * whole row, so a missing payload, an empty habit list and a stale day all
 * have to render as *something*.
 */
abstract class BaseWidgetProvider : AppWidgetProvider() {

    protected abstract fun build(context: Context, payload: WidgetMirror.Payload?): RemoteViews

    override fun onUpdate(
        context: Context,
        manager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val payload = WidgetMirror.read(context)
        for (id in appWidgetIds) {
            val views =
                try {
                    build(context, payload)
                } catch (_: Throwable) {
                    fallback(context)
                }
            manager.updateAppWidget(id, views)
        }
    }

    private fun fallback(context: Context): RemoteViews =
        RemoteViews(context.packageName, R.layout.widget_small).apply {
            setTextViewText(R.id.small_title, "HabitFlow")
            setTextViewText(R.id.small_detail, "Open the app")
        }

    companion object {
        /** Tapping anywhere in a widget opens the app. */
        fun launchApp(context: Context): PendingIntent? {
            val intent =
                context.packageManager.getLaunchIntentForPackage(context.packageName)
                    ?: return null
            return PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}

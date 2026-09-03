package com.habitflow.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import org.json.JSONObject

/**
 * The native-readable copy of app state that the widgets draw from.
 *
 * A widget renders in the launcher's process with no JS runtime running, so
 * none of the app's react-query cache is reachable from here. SharedPreferences
 * is: it survives a cold start and a reboot, it is readable synchronously from
 * an AppWidgetProvider, and its format is ours rather than an implementation
 * detail of whatever AsyncStorage happens to be backed by this Expo version.
 *
 * The payload deliberately carries *presentation* (a level per day, a fraction
 * per habit) rather than domain state. Mirroring raw logs would mean porting
 * completion.ts into Kotlin — a third copy of the rules that already drifted
 * once between the two JS clients.
 */
object WidgetMirror {
    private const val PREFS = "habitflow.widget"
    private const val KEY_PAYLOAD = "payload"

    /** Payload versions this build knows how to draw. */
    private const val SUPPORTED_VERSION = 1

    fun write(context: Context, json: String?) {
        context
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .apply { if (json == null) remove(KEY_PAYLOAD) else putString(KEY_PAYLOAD, json) }
            .apply()
        notifyWidgets(context)
    }

    fun read(context: Context): Payload? {
        val raw =
            context
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_PAYLOAD, null)
                ?: return null
        return try {
            parse(JSONObject(raw))
        } catch (_: Throwable) {
            // A payload written by a newer app build, or a corrupt one. Drawing
            // the signed-out state is honest; crashing the launcher is not.
            null
        }
    }

    /** Ask every placed widget to redraw. Cheap, and safe to over-call. */
    fun notifyWidgets(context: Context) {
        val manager = AppWidgetManager.getInstance(context) ?: return
        for (provider in PROVIDERS) {
            val component = ComponentName(context, provider)
            val ids = manager.getAppWidgetIds(component)
            if (ids.isEmpty()) continue
            context.sendBroadcast(
                Intent(context, provider).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                }
            )
        }
    }

    private val PROVIDERS =
        listOf(
            SmallWidgetProvider::class.java,
            MediumWidgetProvider::class.java,
            LargeWidgetProvider::class.java,
        )

    data class Habit(
        val id: String,
        val name: String,
        /** 0..1 of today's target. */
        val progress: Float,
        val done: Boolean,
        val streak: Int,
        /** "3 / 8 cups" for a quantified habit, "" for a binary one. */
        val detail: String,
    )

    data class Payload(
        val signedIn: Boolean,
        val accent: Int,
        val dark: Boolean,
        val habits: List<Habit>,
        val doneToday: Int,
        val dueToday: Int,
        /** Trailing day levels, oldest first, 0..4. */
        val levels: List<Int>,
        /** Local calendar day the payload was computed for, "YYYY-MM-DD". */
        val day: String,
    )

    private fun parse(o: JSONObject): Payload? {
        if (o.optInt("v") != SUPPORTED_VERSION) return null

        val habits = mutableListOf<Habit>()
        val arr = o.optJSONArray("habits")
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val h = arr.optJSONObject(i) ?: continue
                habits.add(
                    Habit(
                        id = h.optString("id"),
                        name = h.optString("name"),
                        progress = h.optDouble("progress", 0.0).toFloat().coerceIn(0f, 1f),
                        done = h.optBoolean("done"),
                        streak = h.optInt("streak"),
                        detail = h.optString("detail"),
                    )
                )
            }
        }

        val levels = mutableListOf<Int>()
        val lv = o.optJSONArray("levels")
        if (lv != null) {
            for (i in 0 until lv.length()) levels.add(lv.optInt(i).coerceIn(0, 4))
        }

        return Payload(
            signedIn = o.optBoolean("signedIn"),
            accent = parseColor(o.optString("accent"), DEFAULT_ACCENT),
            dark = o.optBoolean("dark"),
            habits = habits,
            doneToday = o.optInt("doneToday"),
            dueToday = o.optInt("dueToday"),
            levels = levels,
            day = o.optString("day"),
        )
    }

    /** HabitFlow's default Coral, for a payload that never named one. */
    const val DEFAULT_ACCENT = 0xFFE87842.toInt()

    private fun parseColor(hex: String?, fallback: Int): Int =
        try {
            if (hex.isNullOrBlank()) fallback else Color.parseColor(hex)
        } catch (_: IllegalArgumentException) {
            fallback
        }
}

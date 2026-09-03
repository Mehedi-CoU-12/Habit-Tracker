package com.habitflow.widget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The JS → native half of the widget mirror. Everything it does is a single
 * SharedPreferences write plus a redraw broadcast, so it is safe to call from
 * any mutation path without worrying about cost.
 */
class HabitflowWidgetModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("HabitflowWidget")

        /**
         * Replace the mirror with `json`, then redraw every placed widget.
         * Passing null clears it, which is what sign-out and account deletion
         * do: a widget still showing a deleted account's habits is a privacy
         * bug, not a stale cache.
         */
        AsyncFunction("setMirror") { json: String? ->
            WidgetMirror.write(appContext.reactContext ?: return@AsyncFunction, json)
        }

        /** Whether the launcher currently has any HabitFlow widget placed. */
        Function("hasWidgets") {
            val context = appContext.reactContext ?: return@Function false
            WidgetSizes.anyPlaced(context)
        }
    }
}

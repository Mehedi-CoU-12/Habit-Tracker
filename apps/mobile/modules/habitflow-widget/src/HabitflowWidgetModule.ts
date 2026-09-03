import { NativeModule, requireOptionalNativeModule } from "expo";

/**
 * The native surface of the widget mirror. Android-only, and optional even
 * there: Expo Go and the web build have no native module, and `setMirror`
 * must degrade to a no-op rather than throw from inside a mutation.
 */
declare class HabitflowWidgetModule extends NativeModule {
    /** Replace the mirror payload. Null clears it (sign-out, deletion). */
    setMirror(json: string | null): Promise<void>;
    /** Whether the launcher currently has any HabitFlow widget placed. */
    hasWidgets(): boolean;
}

export default requireOptionalNativeModule<HabitflowWidgetModule>(
    "HabitflowWidget",
);

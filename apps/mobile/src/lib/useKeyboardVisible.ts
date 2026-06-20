import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Tracks whether the soft keyboard is currently shown.
 *
 * Used by the auth screens to collapse their decorative header while typing,
 * so the form fields stay above the keyboard. iOS fires the `Will` events
 * (smoother, ahead of the animation); Android only fires the `Did` events.
 */
export function useKeyboardVisible(): boolean {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
        const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
        const show = Keyboard.addListener(showEvt, () => setVisible(true));
        const hide = Keyboard.addListener(hideEvt, () => setVisible(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    return visible;
}

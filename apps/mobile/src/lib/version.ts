import Constants from "expo-constants";
import { Platform } from "react-native";

export function compareVersions(a: string, b: string): number {
    const pa = a.split(".");
    const pb = b.split(".");
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const na = parseInt(pa[i] ?? "0", 10);
        const nb = parseInt(pb[i] ?? "0", 10);
        const va = Number.isFinite(na) ? na : 0;
        const vb = Number.isFinite(nb) ? nb : 0;
        if (va !== vb) return va < vb ? -1 : 1;
    }
    return 0;
}

/** True when `current` is strictly older than `other`. */
export function isOlderThan(current: string, other: string): boolean {
    return compareVersions(current, other) < 0;
}

export function currentAppVersion(): string | null {
    const v = Constants.expoConfig?.version;
    return typeof v === "string" && v.length > 0 ? v : null;
}

/** Platform key the release endpoint is scoped by. */
export function releasePlatform(): "android" | "ios" {
    return Platform.OS === "ios" ? "ios" : "android";
}

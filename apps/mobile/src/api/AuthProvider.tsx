import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { KEYS, storage } from "../lib/storage";
import { API_URL, registerGateEvents } from "./client";
import { persister } from "./queryClient";
import { clearOutbox } from "../offline/outbox";
import { resetSync } from "../offline/sync";
import * as api from "./endpoints";

// Where the API's Google callback deep-links back into the app. Must match
// the app scheme (app.json) and the API's MOBILE_GOOGLE_REDIRECT default.
const GOOGLE_REDIRECT = "habitflow://google-auth";

type AuthState = {
    ready: boolean; // finished reading persisted token
    token: string | null;
    // Both resolve with the API's response so the auth screens can route on
    // `user.status` (new signups start PENDING).
    signIn: (email: string, password: string) => Promise<api.AuthResult>;
    register: (
        name: string,
        email: string,
        password: string,
    ) => Promise<api.AuthResult>;
    // Resolves null when the user closes the browser without signing in —
    // a non-event, not an error the screens should display.
    signInWithGoogle: () => Promise<api.AuthResult | null>;
    signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [ready, setReady] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        storage.get(KEYS.token).then((t) => {
            setToken(t);
            setReady(true);
        });
    }, []);

    const persistTokens = useCallback(
        async (accessToken: string, refreshToken: string) => {
            await storage.set(KEYS.token, accessToken);
            await storage.set(KEYS.refreshToken, refreshToken);
            setToken(accessToken);
        },
        [],
    );

    const signIn = useCallback(
        async (email: string, password: string) => {
            const res = await api.login(email, password);
            await persistTokens(res.accessToken, res.refreshToken);
            return res;
        },
        [persistTokens],
    );

    const register = useCallback(
        async (name: string, email: string, password: string) => {
            const res = await api.signup(name, email, password);
            await persistTokens(res.accessToken, res.refreshToken);
            return res;
        },
        [persistTokens],
    );

    // Same server-side OAuth flow the web app uses, in an in-app browser tab.
    // `?client=mobile` makes the API's Google callback redirect back to
    // GOOGLE_REDIRECT with a one-time code instead of the web /auth/callback;
    // the code is then exchanged for tokens over the normal API path.
    const signInWithGoogle = useCallback(async () => {
        const result = await WebBrowser.openAuthSessionAsync(
            `${API_URL}/auth/google?client=mobile`,
            GOOGLE_REDIRECT,
        );
        if (result.type !== "success") return null; // user backed out
        const code = Linking.parse(result.url).queryParams?.code;
        if (typeof code !== "string" || !code) {
            throw new Error("Google sign-in failed — please try again");
        }
        const res = await api.googleExchange(code);
        await persistTokens(res.accessToken, res.refreshToken);
        return res;
    }, [persistTokens]);

    // Drop all of THIS device's local state (tokens, write queue, caches) so
    // nothing replays or leaks into the next account signed in here. Does NOT
    // touch the server — see signOut() for the revoking variant.
    const clearLocalSession = useCallback(async () => {
        await storage.remove(KEYS.token);
        await storage.remove(KEYS.refreshToken);
        resetSync();
        await clearOutbox();
        setToken(null);
        queryClient.clear();
        await persister.removeClient();
    }, [queryClient]);

    const signOut = useCallback(async () => {
        // Explicit, user-initiated sign-out: revoke every session server-side
        // (bumps tokenVersion) before dropping the local tokens.
        const refreshToken = await storage.get(KEYS.refreshToken);
        if (refreshToken) {
            try {
                await api.logout(refreshToken);
            } catch {
                /* offline / already invalid — local clear below still signs out */
            }
        }
        await clearLocalSession();
    }, [clearLocalSession]);

    // Central auth plumbing: most screens swallow query errors silently, so
    // the api client reports 401/403 here instead of relying on per-screen
    // handling.
    const tokenRef = useRef(token);
    tokenRef.current = token;
    useEffect(() => {
        registerGateEvents({
            // Dead token (expired, or account deleted) → clear LOCAL session so
            // the AuthGate lands on /login. Deliberately does NOT call
            // api.logout: the server already rejected this token (nothing to
            // revoke), and if this were a false positive — e.g. a transient
            // refresh hiccup on reconnect — revoking would needlessly bump
            // tokenVersion and kill a still-valid session on every device.
            // Guarded on a present token so a failed login attempt doesn't fire.
            onUnauthorized: () => {
                if (tokenRef.current) void clearLocalSession();
            },
            // Account gated mid-session (e.g. admin suspends while the app
            // is open) → refetch the profile so the AuthGate reacts.
            onAccountGated: () => {
                void queryClient.invalidateQueries({ queryKey: ["me"] });
            },
        });
    }, [clearLocalSession, queryClient]);

    return (
        <Ctx.Provider
            value={{ ready, token, signIn, register, signInWithGoogle, signOut }}
        >
            {children}
        </Ctx.Provider>
    );
}

export function useAuth(): AuthState {
    const v = useContext(Ctx);
    if (!v) throw new Error("useAuth must be used within AuthProvider");
    return v;
}

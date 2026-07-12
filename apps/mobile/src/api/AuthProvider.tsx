import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KEYS, storage } from "../lib/storage";
import { registerGateEvents } from "./client";
import { persister } from "./queryClient";
import { clearOutbox } from "../offline/outbox";
import { resetSync } from "../offline/sync";
import * as api from "./endpoints";

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
        <Ctx.Provider value={{ ready, token, signIn, register, signOut }}>
            {children}
        </Ctx.Provider>
    );
}

export function useAuth(): AuthState {
    const v = useContext(Ctx);
    if (!v) throw new Error("useAuth must be used within AuthProvider");
    return v;
}

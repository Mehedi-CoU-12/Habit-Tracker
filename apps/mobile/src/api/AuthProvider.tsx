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

    const persistToken = useCallback(async (t: string) => {
        await storage.set(KEYS.token, t);
        setToken(t);
    }, []);

    const signIn = useCallback(
        async (email: string, password: string) => {
            const res = await api.login(email, password);
            await persistToken(res.accessToken);
            return res;
        },
        [persistToken],
    );

    const register = useCallback(
        async (name: string, email: string, password: string) => {
            const res = await api.signup(name, email, password);
            await persistToken(res.accessToken);
            return res;
        },
        [persistToken],
    );

    const signOut = useCallback(async () => {
        await storage.remove(KEYS.token);
        setToken(null);
        queryClient.clear();
    }, [queryClient]);

    // Central auth plumbing: most screens swallow query errors silently, so
    // the api client reports 401/403 here instead of relying on per-screen
    // handling.
    const tokenRef = useRef(token);
    tokenRef.current = token;
    useEffect(() => {
        registerGateEvents({
            // Dead token (expired, or account deleted) → sign out so the
            // AuthGate lands on /login — NOT the pending screen. Guarded on
            // a present token so a failed login attempt doesn't fire it.
            onUnauthorized: () => {
                if (tokenRef.current) void signOut();
            },
            // Account gated mid-session (e.g. admin suspends while the app
            // is open) → refetch the profile so the AuthGate reacts.
            onAccountGated: () => {
                void queryClient.invalidateQueries({ queryKey: ["me"] });
            },
        });
    }, [signOut, queryClient]);

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

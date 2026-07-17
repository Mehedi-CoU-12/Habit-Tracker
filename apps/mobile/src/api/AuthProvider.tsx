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

const GOOGLE_REDIRECT = "habitflow://google-auth";

const googleExchanges = new Map<string, Promise<api.AuthResult>>();

type AuthState = {
    ready: boolean;
    token: string | null;
    signIn: (email: string, password: string) => Promise<api.AuthResult>;
    register: (
        name: string,
        email: string,
        password: string,
    ) => Promise<api.AuthResult>;
    signInWithGoogle: () => Promise<api.AuthResult | null>;
    completeGoogleSignIn: (code: string) => Promise<api.AuthResult>;
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

    const completeGoogleSignIn = useCallback(
        (code: string) => {
            let p = googleExchanges.get(code);
            if (!p) {
                p = (async () => {
                    const res = await api.googleExchange(code);
                    await persistTokens(res.accessToken, res.refreshToken);
                    return res;
                })();

                p.catch(() => googleExchanges.delete(code));
                googleExchanges.set(code, p);
            }
            return p;
        },
        [persistTokens],
    );

    const signInWithGoogle = useCallback(async () => {
        const result = await WebBrowser.openAuthSessionAsync(
            `${API_URL}/auth/google?client=mobile`,
            GOOGLE_REDIRECT,
        );
        if (result.type !== "success") return null;
        const code = Linking.parse(result.url).queryParams?.code;
        if (typeof code !== "string" || !code) {
            throw new Error("Google sign-in failed — please try again");
        }
        return completeGoogleSignIn(code);
    }, [completeGoogleSignIn]);

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

    const tokenRef = useRef(token);
    tokenRef.current = token;
    useEffect(() => {
        registerGateEvents({
            onUnauthorized: () => {
                if (tokenRef.current) void clearLocalSession();
            },
            onAccountGated: () => {
                void queryClient.invalidateQueries({ queryKey: ["me"] });
            },
        });
    }, [clearLocalSession, queryClient]);

    return (
        <Ctx.Provider
            value={{
                ready,
                token,
                signIn,
                register,
                signInWithGoogle,
                completeGoogleSignIn,
                signOut,
            }}
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

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KEYS, storage } from "../lib/storage";
import * as api from "./endpoints";

type AuthState = {
    ready: boolean; // finished reading persisted token
    token: string | null;
    signIn: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
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
        },
        [persistToken],
    );

    const register = useCallback(
        async (name: string, email: string, password: string) => {
            const res = await api.signup(name, email, password);
            await persistToken(res.accessToken);
        },
        [persistToken],
    );

    const signOut = useCallback(async () => {
        await storage.remove(KEYS.token);
        setToken(null);
        queryClient.clear();
    }, [queryClient]);

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

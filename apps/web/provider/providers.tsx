"use client";

import {
    MutationCache,
    QueryClient,
    QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import { ThemeProvider } from "./theme";
import { Toaster, getErrorMessage, toast } from "../src/lib/toast";

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000,
                    },
                },
                // Any mutation that fails surfaces a toast by default. A
                // mutation can opt out (e.g. when it renders its own inline
                // error) with `meta: { suppressErrorToast: true }`.
                mutationCache: new MutationCache({
                    onError: (error, _vars, _ctx, mutation) => {
                        if (mutation.meta?.suppressErrorToast) return;
                        const message = getErrorMessage(error);
                        // 401s already redirect to /login in the API client;
                        // skip the toast so it doesn't flash during navigation.
                        if (message === "Unauthorized") return;
                        toast.error(message);
                    },
                }),
            }),
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>{children}</ThemeProvider>
            <Toaster />
        </QueryClientProvider>
    );
}

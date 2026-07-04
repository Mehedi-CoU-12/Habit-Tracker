import { QueryClient } from "@tanstack/react-query";

/**
 * Module-scope QueryClient (previously created inside RootLayout) so
 * non-React code — the api client's central 401/403 handling — can reach the
 * cache. RootLayout passes this same instance to QueryClientProvider.
 */
export const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
});

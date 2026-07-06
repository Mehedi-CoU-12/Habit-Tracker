import NetInfo from "@react-native-community/netinfo";
import { onlineManager, QueryClient } from "@tanstack/react-query";

// Feed React Native connectivity into React Query. React Query has no built-in
// way to detect online status on RN (its default relies on the browser's
// `navigator.onLine`), so without this it assumes it is always online and
// fires requests that immediately fail while offline. Wired up, queries
// triggered while offline stay `paused` instead of erroring, and resume
// automatically on reconnect. Registered once at module load; the inner
// listener's unsubscribe is returned so React Query can tear it down.
onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
        setOnline(!!state.isConnected);
    }),
);

/**
 * Module-scope QueryClient (previously created inside RootLayout) so
 * non-React code — the api client's central 401/403 handling — can reach the
 * cache. RootLayout passes this same instance to QueryClientProvider.
 */
export const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
});

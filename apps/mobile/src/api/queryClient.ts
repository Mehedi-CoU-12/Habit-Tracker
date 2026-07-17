import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
        setOnline(
            state.isConnected === true && state.isInternetReachable !== false,
        );
    }),
);

void NetInfo.fetch().then((state) => {
    onlineManager.setOnline(
        state.isConnected === true && state.isInternetReachable !== false,
    );
});

const WEEK = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000, gcTime: WEEK } },
});

export const persister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: "habitflow.rq-cache.v1",
    throttleTime: 1000,
});

export const persistOptions = {
    persister,
    maxAge: WEEK,
    buster: "v1",
    dehydrateOptions: {
        shouldDehydrateQuery: (q: { state: { status: string } }) =>
            q.state.status === "success",
    },
};

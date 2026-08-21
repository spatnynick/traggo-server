import * as React from 'react';
import {useApolloClient} from '@apollo/react-hooks';
import useInterval from '@rooks/use-interval';
import {Status as StatusQuery} from '../gql/status';
import {Status} from '../gql/__generated__/Status';
import {Trackers} from '../gql/__generated__/Trackers';
import * as gqlTimeSpan from '../gql/timeSpan';
import {isOffline, runningTimersDiffer, withTimeout} from './connection';

const POLL_INTERVAL_MS = 30000;
const POLL_TIMEOUT_MS = 8000;
// a gap between 1s ticks larger than this means the machine was asleep / clock jumped.
const CLOCK_JUMP_MS = 5000;

interface ConnectionState {
    online: boolean;
    serverOffsetMs: number;
    retry: () => void;
}

const ConnectionContext = React.createContext<ConnectionState>({
    online: true,
    serverOffsetMs: 0,
    retry: () => undefined,
});

export const useConnection = (): ConnectionState => React.useContext(ConnectionContext);

const versionKey = (version: Status['status']['version']): string => `${version.name}|${version.commit}|${version.buildDate}`;

export const ConnectionProvider: React.FC = ({children}) => {
    const client = useApolloClient();
    const [online, setOnline] = React.useState(true);
    const [serverOffsetMs, setServerOffsetMs] = React.useState(0);
    const onlineRef = React.useRef(true);
    const bootVersion = React.useRef<string | null>(null);
    const lastTick = React.useRef(Date.now());

    const check = React.useCallback(async () => {
        let result;
        try {
            result = await withTimeout(
                client.query<Status>({query: StatusQuery, fetchPolicy: 'network-only'}),
                POLL_TIMEOUT_MS
            );
        } catch (err) {
            // a GraphQL error (e.g. not logged in) still means the server answered.
            const nowOnline = !isOffline(err as {networkError?: unknown; timeout?: boolean});
            onlineRef.current = nowOnline;
            setOnline(nowOnline);
            return;
        }

        const status = result.data.status;
        setServerOffsetMs(new Date(status.serverTime).getTime() - Date.now());

        const version = versionKey(status.version);
        if (bootVersion.current === null) {
            bootVersion.current = version;
        } else if (bootVersion.current !== version) {
            window.location.reload();
            return;
        }

        const wasOffline = !onlineRef.current;
        onlineRef.current = true;
        setOnline(true);

        let cachedTimers: Trackers['timers'] = [];
        try {
            const cached = client.readQuery<Trackers>({query: gqlTimeSpan.Trackers});
            cachedTimers = (cached && cached.timers) || [];
        } catch (e) {
            cachedTimers = [];
        }
        if (wasOffline || runningTimersDiffer(status.runningTimers, cachedTimers || [])) {
            client.reFetchObservableQueries();
        }
    }, [client]);

    useInterval(() => check(), POLL_INTERVAL_MS, true);

    // detect sleep/wake or a large clock jump and re-check immediately.
    useInterval(
        () => {
            const now = Date.now();
            if (now - lastTick.current > POLL_INTERVAL_MS + CLOCK_JUMP_MS) {
                check();
            }
            lastTick.current = now;
        },
        1000,
        true
    );

    React.useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                check();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [check]);

    return <ConnectionContext.Provider value={{online, serverOffsetMs, retry: check}}>{children}</ConnectionContext.Provider>;
};

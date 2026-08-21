import moment from 'moment';
import * as React from 'react';
import {inUserTz} from '../timespan/timeutils';
import {useDurationFormatter} from '../timespan/durationFormat';
import useInterval from '@rooks/use-interval';
import {useConnection} from '../provider/ConnectionProvider';

export const RelativeToNow: React.FC<{from: moment.Moment}> = ({from}) => {
    const {serverOffsetMs} = useConnection();
    const [now, setNow] = React.useState(moment());

    useInterval(
        () => {
            setNow(moment().add(serverOffsetMs, 'ms'));
        },
        1000,
        true
    );
    return <RelativeTime from={from} to={now} />;
};

export const RelativeTime: React.FC<{from: moment.Moment; to: moment.Moment}> = ({from, to}) => {
    const format = useDurationFormatter();
    const seconds = inUserTz(to).unix() - inUserTz(from).unix();
    return <>{format(seconds, {unitCount: 2})}</>;
};

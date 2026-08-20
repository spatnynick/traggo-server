import moment from 'moment';
import {sumEffortSeconds} from './timespanutils';
import {TimeSpanProps} from './TimeSpan';

const span = (fromIso: string, toIso?: string): TimeSpanProps =>
    ({
        id: 1,
        range: {from: moment(fromIso), to: toIso ? moment(toIso) : undefined},
        initialTags: [],
        note: '',
    } as TimeSpanProps);

describe('sumEffortSeconds', () => {
    it('sums closed spans', () => {
        const spans = [
            span('2020-01-01T08:00:00Z', '2020-01-01T09:30:00Z'),
            span('2020-01-01T10:00:00Z', '2020-01-01T12:00:00Z'),
        ];
        expect(sumEffortSeconds(spans, moment())).toBe((90 + 120) * 60);
    });

    it('counts a running span up to now', () => {
        const now = moment('2020-01-01T09:00:00Z');
        expect(sumEffortSeconds([span('2020-01-01T08:00:00Z')], now)).toBe(60 * 60);
    });

    it('is zero for no spans', () => {
        expect(sumEffortSeconds([], moment())).toBe(0);
    });
});

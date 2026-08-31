import moment from 'moment';
import {calendarDaySummaries, calendarDaySeverity} from './calendarSummary';

const H = 60 * 60;

describe('calendarDaySummaries', () => {
    it('assigns an overnight booking completely to its start date', () => {
        const summaries = calendarDaySummaries(
            [{start: '2026-08-26T22:00:00+02:00', end: '2026-08-27T02:00:00+02:00'}],
            moment('2026-08-27T12:00:00+02:00')
        );

        expect(summaries['2026-08-26']).toEqual({effortSeconds: 4 * H, severity: 'normal'});
        expect(summaries['2026-08-27']).toBeUndefined();
    });

    it('includes a running booking through current time on its start date', () => {
        const summaries = calendarDaySummaries([{start: '2026-08-26T23:00:00+02:00'}], moment('2026-08-27T01:30:00+02:00'));

        expect(summaries['2026-08-26'].effortSeconds).toBe(2.5 * H);
    });

    it('marks totals above twelve hours as warnings and above fifteen as errors', () => {
        expect(calendarDaySeverity(12 * H)).toBe('normal');
        expect(calendarDaySeverity(12 * H + 1)).toBe('warning');
        expect(calendarDaySeverity(15 * H)).toBe('warning');
        expect(calendarDaySeverity(15 * H + 1)).toBe('error');
    });
});

import moment from 'moment';
import {sumEffortSeconds} from '../timespanutils';

export interface CalendarSummaryTimeSpan {
    start: string;
    end?: string | null;
}

export type CalendarDaySeverity = 'normal' | 'warning' | 'error';

export interface CalendarDaySummary {
    effortSeconds: number;
    severity: CalendarDaySeverity;
}

const warningSeconds = 12 * 60 * 60;
const errorSeconds = 15 * 60 * 60;

export const calendarDayKey = (date: Date | moment.Moment): string => moment(date).format('YYYY-MM-DD');

export const calendarDaySeverity = (effortSeconds: number): CalendarDaySeverity => {
    if (effortSeconds > errorSeconds) {
        return 'error';
    }
    if (effortSeconds > warningSeconds) {
        return 'warning';
    }
    return 'normal';
};

// A span belongs completely to its start date. This intentionally does not split
// an overnight span, matching how the calendar groups a booking by its start day.
export const calendarDaySummaries = (
    timeSpans: CalendarSummaryTimeSpan[],
    now: moment.Moment
): Record<string, CalendarDaySummary> => {
    const timeSpansByDay = timeSpans.reduce<Record<string, CalendarSummaryTimeSpan[]>>((result, timeSpan) => {
        const day = calendarDayKey(moment(timeSpan.start));
        result[day] = [...(result[day] || []), timeSpan];
        return result;
    }, {});

    return Object.keys(timeSpansByDay).reduce<Record<string, CalendarDaySummary>>((result, day) => {
        const effortSeconds = sumEffortSeconds(
            timeSpansByDay[day].map((timeSpan) => ({
                range: {
                    from: moment(timeSpan.start),
                    to: timeSpan.end ? moment(timeSpan.end) : undefined,
                },
            })),
            now
        );
        result[day] = {effortSeconds, severity: calendarDaySeverity(effortSeconds)};
        return result;
    }, {});
};

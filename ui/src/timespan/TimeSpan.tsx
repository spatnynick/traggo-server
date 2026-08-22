import * as React from 'react';
import {TagSelectorEntry, toInputTags} from '../tag/tagSelectorEntry';
import {TagSelector} from '../tag/TagSelector';
import moment from 'moment';
import Paper from '@material-ui/core/Paper';
import {DateTimeSelector} from '../common/DateTimeSelector';
import {Button, TextField, Typography, makeStyles, useTheme} from '@material-ui/core';
import {inUserTz} from './timeutils';
import {useMutation} from '@apollo/react-hooks';
import {StopTimer, StopTimerVariables} from '../gql/__generated__/StopTimer';
import * as gqlTimeSpan from '../gql/timeSpan';
import {UpdateTimeSpan, UpdateTimeSpanVariables} from '../gql/__generated__/UpdateTimeSpan';
import IconButton from '@material-ui/core/IconButton';
import {MoreVert} from '@material-ui/icons';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import {RemoveTimeSpan, RemoveTimeSpanVariables} from '../gql/__generated__/RemoveTimeSpan';
import {useStateAndDelegateWithDelayOnChange} from '../utils/hooks';
import {TimeSpans} from '../gql/__generated__/TimeSpans';
import {isSameDate} from '../utils/time';
import {Trackers} from '../gql/__generated__/Trackers';
import {addTimeSpanToCache, removeFromTrackersCache} from '../gql/utils';
import {StartTimer, StartTimerVariables} from '../gql/__generated__/StartTimer';
import {RelativeTime, RelativeToNow} from '../common/RelativeTime';
import {useConnection} from '../provider/ConnectionProvider';

interface Range {
    from: moment.Moment;
    to?: moment.Moment;
}

const TIME_UPDATE_DELAY = 250;

const cloneRange = (range: Range): Range => ({
    from: range.from.clone(),
    to: range.to && range.to.clone(),
});

const isValidRange = (range: Range): boolean => !range.to || range.from.isBefore(range.to);

export interface TimeSpanProps {
    id: number;
    range: Range & {oldFrom?: moment.Moment};
    initialTags: TagSelectorEntry[];
    note: string;
    dateSelectorOpen?: React.Dispatch<React.SetStateAction<boolean>>;
    rangeChange?: (r: Range) => void;
    deleted?: () => void;
    stopped?: () => void;
    continued?: () => void;
    addTagsToTracker?: (tags: TagSelectorEntry[]) => void;
    elevation?: number;
    filter?: string;
}

const useStyles = makeStyles(() => ({
    innerTimespan: {
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        textAlign: 'center',
        '@media (max-width: 750px)': {
            flexDirection: 'column',
        },
    },
    tagInput: {
        width: '100%',
        flex: '1',
        marginRight: 10,
        '@media (max-width: 750px)': {
            display: 'flex',
            width: 'calc(100% - 48px)',
            marginRight: '48px',
        },
    },
    timeSelection: {
        display: 'inline-flex',
        '@media (max-width: 750px)': {
            justifyContent: 'space-evenly',
            width: '100%',
            flexWrap: 'wrap',
        },
    },
    showMoreButton: {
        display: 'flex',
        alignItems: 'center',
        '@media (max-width: 750px)': {
            position: 'absolute',
            top: '0',
            right: '0',
        },
    },
}));

export const TimeSpan: React.FC<TimeSpanProps> = React.memo(
    ({
        range: {from, to, oldFrom},
        id,
        initialTags,
        note: initialNote,
        dateSelectorOpen = () => {},
        rangeChange = () => {},
        deleted = () => {},
        stopped = () => {},
        continued = () => {},
        elevation = 1,
        addTagsToTracker,
        filter,
    }) => {
        const styles = useStyles();
        const theme = useTheme();
        const running = !to;
        const {online} = useConnection();
        const [showNotes, toggleShowingNotes] = React.useState(initialNote !== '');
        const note = React.useRef<{value: string; handle?: number}>({value: initialNote});
        const [draftRangeState, setDraftRangeState] = React.useState<Range>(() => cloneRange({from, to}));
        const draftRange = React.useRef(draftRangeState);
        const timeUpdate = React.useRef<{range?: Range; handle?: number}>({});
        const setDraftRange = (range: Range) => {
            draftRange.current = range;
            setDraftRangeState(range);
        };

        React.useEffect(() => {
            // Never resync from the server while an edit is pending or while the draft is
            // invalid — a background refetch would otherwise silently discard what was typed.
            const pending = timeUpdate.current.handle !== undefined || Boolean(timeUpdate.current.range);
            if (!pending && isValidRange(draftRange.current)) {
                setDraftRange(cloneRange({from, to}));
            }
        }, [from, to]);
        React.useEffect(
            () => () => {
                window.clearTimeout(timeUpdate.current.handle);
            },
            []
        );

        const [selectedEntries, setSelectedEntries] = React.useState<TagSelectorEntry[]>(initialTags);
        const [openMenu, setOpenMenu] = useStateAndDelegateWithDelayOnChange<null | HTMLElement>(null, (o) =>
            dateSelectorOpen(!!o)
        );
        const [stopTimer] = useMutation<StopTimer, StopTimerVariables>(gqlTimeSpan.StopTimer, {
            update: (cache, {data}) => {
                if (!data || !data.stopTimeSpan) {
                    return;
                }
                removeFromTrackersCache(cache, data);
                addTimeSpanToCache(cache, data.stopTimeSpan, filter);
            },
        });
        const [startTimer] = useMutation<StartTimer, StartTimerVariables>(gqlTimeSpan.StartTimer, {
            refetchQueries: [{query: gqlTimeSpan.Trackers}],
        });
        const [updateTimeSpan] = useMutation<UpdateTimeSpan, UpdateTimeSpanVariables>(gqlTimeSpan.UpdateTimeSpan);
        const cancelTimeUpdate = () => {
            window.clearTimeout(timeUpdate.current.handle);
            timeUpdate.current = {};
        };
        const noteAwareUpdateTimeSpan = ({variables}: {variables: Omit<UpdateTimeSpanVariables, 'note'>}) => {
            cancelTimeUpdate();
            clearTimeout(note.current.handle);
            return updateTimeSpan({variables: {...variables, note: note.current.value}});
        };
        const scheduleTimeUpdate = (nextRange: Range) => {
            cancelTimeUpdate();
            if (!isValidRange(nextRange)) {
                return;
            }

            timeUpdate.current.range = cloneRange(nextRange);
            timeUpdate.current.handle = window.setTimeout(() => {
                const range = timeUpdate.current.range;
                timeUpdate.current = {};
                if (!range || !isValidRange(range)) {
                    return;
                }

                noteAwareUpdateTimeSpan({
                    variables: {
                        oldStart: oldFrom,
                        id,
                        start: inUserTz(range.from).format(),
                        end: range.to && inUserTz(range.to).format(),
                        tags: toInputTags(selectedEntries),
                    },
                }).then(() => rangeChange(range));
            }, TIME_UPDATE_DELAY);
        };
        const [removeTimeSpan] = useMutation<RemoveTimeSpan, RemoveTimeSpanVariables>(gqlTimeSpan.RemoveTimeSpan, {
            update: (cache, {data}) => {
                let oldData: TimeSpans | null = null;
                try {
                    oldData = cache.readQuery<TimeSpans>({query: gqlTimeSpan.TimeSpans, variables: {filter}});
                } catch (e) {}

                const oldTrackers = cache.readQuery<Trackers>({query: gqlTimeSpan.Trackers});
                if (!data || !data.removeTimeSpan) {
                    return;
                }
                const removedId = data.removeTimeSpan.id;
                if (oldTrackers) {
                    cache.writeQuery<Trackers>({
                        query: gqlTimeSpan.Trackers,
                        data: {
                            timers: (oldTrackers.timers || []).filter((tracker) => tracker.id !== removedId),
                        },
                    });
                }
                if (oldData) {
                    cache.writeQuery<TimeSpans>({
                        query: gqlTimeSpan.TimeSpans,
                        variables: {filter},
                        data: {
                            timeSpans: {
                                __typename: 'PagedTimeSpans',
                                timeSpans: oldData.timeSpans.timeSpans.filter((ts) => ts.id !== removedId),
                                cursor: oldData.timeSpans.cursor,
                            },
                        },
                    });
                }
            },
        });

        const updateNote = (newValue: string) => {
            cancelTimeUpdate();
            window.clearTimeout(note.current.handle);
            const handle = window.setTimeout(() => {
                const range = draftRange.current;
                if (!isValidRange(range)) {
                    return;
                }
                updateTimeSpan({
                    variables: {
                        oldStart: oldFrom,
                        id,
                        start: inUserTz(range.from).format(),
                        end: range.to && inUserTz(range.to).format(),
                        tags: toInputTags(selectedEntries),
                        note: newValue,
                    },
                });
            }, 200);
            note.current = {handle, value: newValue};
        };

        const currentRange = timeUpdate.current.range || draftRange.current;
        const invalidTimeRange = !isValidRange(draftRangeState);
        const wasMoved = !isSameDate(draftRangeState.from, oldFrom);
        const showDate = draftRangeState.to !== undefined && (!isSameDate(draftRangeState.from, draftRangeState.to) || wasMoved);
        return (
            <Paper
                elevation={running ? Math.max(elevation, 6) : elevation}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px',
                    margin: '10px 0',
                    opacity: wasMoved || (running && !online) ? 0.5 : 1,
                    width: '100%',
                    borderLeft: running ? `10px solid ${theme.palette.primary.main}` : undefined,
                }}>
                <div className={styles.innerTimespan}>
                    <div className={styles.tagInput}>
                        <TagSelector
                            dialogOpen={dateSelectorOpen}
                            selectedEntries={selectedEntries}
                            onSelectedEntriesChanged={(entries) => {
                                setSelectedEntries(entries);
                                if (!isValidRange(currentRange)) {
                                    return;
                                }
                                noteAwareUpdateTimeSpan({
                                    variables: {
                                        oldStart: oldFrom,
                                        id,
                                        start: inUserTz(currentRange.from).format(),
                                        end: currentRange.to && inUserTz(currentRange.to).format(),
                                        tags: toInputTags(entries),
                                    },
                                });
                            }}
                        />
                    </div>

                    <div className={styles.timeSelection}>
                        <div style={{alignItems: 'center', display: 'flex', justifyContent: 'space-evenly', flexWrap: 'wrap'}}>
                            <DateTimeSelector
                                popoverOpen={dateSelectorOpen}
                                selectedDate={draftRangeState.from}
                                error={invalidTimeRange}
                                onSelectDate={(newFrom) => {
                                    if (!newFrom.isValid()) {
                                        return;
                                    }
                                    const nextRange = {
                                        from: newFrom.clone().set({second: 0}),
                                        to: draftRange.current.to,
                                    };
                                    setDraftRange(nextRange);
                                    scheduleTimeUpdate(nextRange);
                                }}
                                showDate={showDate}
                                label="start"
                            />
                            {to !== undefined ? (
                                <DateTimeSelector
                                    popoverOpen={dateSelectorOpen}
                                    selectedDate={draftRangeState.to || to}
                                    error={invalidTimeRange}
                                    onSelectDate={(newTo) => {
                                        if (!newTo.isValid()) {
                                            return;
                                        }
                                        const nextRange = {
                                            from: draftRange.current.from,
                                            to: newTo.clone().set({second: 0}),
                                        };
                                        setDraftRange(nextRange);
                                        scheduleTimeUpdate(nextRange);
                                    }}
                                    showDate={showDate}
                                    label="end"
                                />
                            ) : (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => {
                                        stopTimer({variables: {id, end: inUserTz(moment()).format()}}).then(stopped);
                                    }}>
                                    Stop
                                </Button>
                            )}
                        </div>
                        {invalidTimeRange ? (
                            <Typography color="error" variant="caption">
                                Start must be before End
                            </Typography>
                        ) : null}

                        <div style={{alignItems: 'center', display: 'flex'}}>
                            <Typography
                                variant="subtitle1"
                                style={{
                                    minWidth: '70px',
                                    color: running ? theme.palette.primary.main : undefined,
                                    fontWeight: running ? 'bold' : undefined,
                                }}
                                title="The amount of time between from and to">
                                {to ? <RelativeTime from={from} to={to} /> : <RelativeToNow from={from} />}
                            </Typography>
                        </div>
                    </div>

                    <IconButton
                        className={styles.showMoreButton}
                        onClick={(e: React.MouseEvent<HTMLElement>) => setOpenMenu(e.currentTarget)}>
                        <MoreVert />
                    </IconButton>

                    <Menu aria-haspopup="true" anchorEl={openMenu} open={openMenu !== null} onClose={() => setOpenMenu(null)}>
                        {to ? (
                            <MenuItem
                                onClick={() => {
                                    setOpenMenu(null);
                                    startTimer({
                                        variables: {
                                            start: inUserTz(moment()).format(),
                                            tags: toInputTags(selectedEntries),
                                            note: note.current.value,
                                        },
                                    }).then(() => continued());
                                }}>
                                Continue
                            </MenuItem>
                        ) : null}
                        {addTagsToTracker ? (
                            <MenuItem
                                onClick={() => {
                                    setOpenMenu(null);
                                    addTagsToTracker(selectedEntries);
                                }}>
                                Copy tags
                            </MenuItem>
                        ) : null}
                        <MenuItem
                            onClick={() => {
                                setOpenMenu(null);
                                toggleShowingNotes(!showNotes);
                            }}>
                            Show Notes
                        </MenuItem>
                        <MenuItem
                            onClick={() => {
                                setOpenMenu(null);
                                removeTimeSpan({variables: {id}}).then(() => deleted());
                            }}>
                            Delete
                        </MenuItem>
                    </Menu>
                </div>
                {showNotes ? (
                    <div>
                        <TextField
                            label="Note"
                            fullWidth
                            multiline
                            defaultValue={initialNote}
                            onChange={(e) => updateNote(e.target.value)}
                        />
                    </div>
                ) : null}
            </Paper>
        );
    }
);

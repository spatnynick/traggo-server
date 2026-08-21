import * as React from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import {Paper, TextField} from '@material-ui/core';
import {SetSettings as SetSettingsGQL, Settings as SettingsGQL, useSettings} from '../gql/settings';
import {useMutation} from '@apollo/react-hooks';
import {SetSettings, SetSettingsVariables} from '../gql/__generated__/SetSettings';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import FormHelperText from '@material-ui/core/FormHelperText';
import Select from '@material-ui/core/NativeSelect/NativeSelect';
import {DateLocale, Theme, WeekDay, DateTimeInputStyle, DurationFormat} from '../gql/__generated__/globalTypes';
import {useSnackbar} from 'notistack';
import {handleError} from '../utils/errors';

const durationFormatLabels: Record<DurationFormat, string> = {
    [DurationFormat.DaysHours]: 'Days + hours (9d 9h)',
    [DurationFormat.HHMM]: 'Hours:minutes (225:00)',
    [DurationFormat.DecimalHours]: 'Decimal hours (225.00h)',
    [DurationFormat.GoStyle]: 'Go style (225h0m)',
    [DurationFormat.CustomStrftime]: 'Custom (strftime-like)…',
    [DurationFormat.CustomGo]: 'Custom (Go-style)…',
};

const isCustomDurationFormat = (format: DurationFormat): boolean =>
    format === DurationFormat.CustomStrftime || format === DurationFormat.CustomGo;

const durationCustomHelp: Record<string, string> = {
    [DurationFormat.CustomStrftime]:
        'Tokens: %d days, %H total hours, %h hours-of-day, %m total minutes, %M minutes-of-hour, %s total seconds, %S seconds-of-minute, %% literal. e.g. %H:%M',
    [DurationFormat.CustomGo]: 'Unit letters to show, largest first: d h m s. e.g. "dhm" → 9d9h0m, "hm" → 225h0m',
};

const useStyles = makeStyles((theme) => ({
    root: {
        ...theme.mixins.gutters(),
        paddingTop: theme.spacing(1),
        paddingBottom: theme.spacing(3),
        maxWidth: 500,
        margin: '0 auto',
    },
}));

export const SettingsPage: React.FC = () => {
    const classes = useStyles();
    const {done, ...settings} = useSettings();
    const {enqueueSnackbar} = useSnackbar();
    const [customFormat, setCustomFormat] = React.useState(settings.durationCustomFormat);
    React.useEffect(() => {
        setCustomFormat(settings.durationCustomFormat);
    }, [settings.durationCustomFormat]);
    const [setSettings] = useMutation<SetSettings, SetSettingsVariables>(SetSettingsGQL, {
        refetchQueries: [{query: SettingsGQL}],
    });
    return (
        <Paper elevation={1} className={classes.root}>
            <FormControl margin={'normal'} fullWidth>
                <InputLabel>Date Locale</InputLabel>
                <Select
                    fullWidth
                    value={settings.dateLocale}
                    onChange={(e) => {
                        setSettings({
                            variables: {
                                settings: {
                                    ...settings,
                                    dateLocale: e.target.value as DateLocale,
                                },
                            },
                        })
                            .then(() => {
                                enqueueSnackbar('date locale changed', {
                                    variant: 'success',
                                });
                                enqueueSnackbar('a reload of the page is required for the new date locale to fully function', {
                                    variant: 'info',
                                    preventDuplicate: true,
                                    persist: true,
                                });
                            })
                            .catch(handleError('set date locale', enqueueSnackbar));
                    }}>
                    {Object.values(DateLocale).map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </Select>
            </FormControl>
            <FormControl margin={'normal'} fullWidth>
                <InputLabel>Theme</InputLabel>
                <Select
                    fullWidth
                    value={settings.theme}
                    onChange={(e) => {
                        setSettings({variables: {settings: {...settings, theme: e.target.value as Theme}}})
                            .then(() =>
                                enqueueSnackbar('theme changed', {
                                    variant: 'success',
                                })
                            )
                            .catch(handleError('set theme', enqueueSnackbar));
                    }}>
                    {Object.values(Theme).map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </Select>
            </FormControl>
            <FormControl margin={'normal'} fullWidth>
                <InputLabel>First day of the week</InputLabel>
                <Select
                    fullWidth
                    value={settings.firstDayOfTheWeek}
                    onChange={(e) => {
                        setSettings({
                            variables: {
                                settings: {
                                    ...settings,
                                    firstDayOfTheWeek: e.target.value as WeekDay,
                                },
                            },
                        })
                            .then(() =>
                                enqueueSnackbar('first day of the week changed', {
                                    variant: 'success',
                                })
                            )
                            .catch(handleError('set first day of the week', enqueueSnackbar));
                    }}>
                    {[
                        WeekDay.Sunday,
                        WeekDay.Monday,
                        WeekDay.Tuesday,
                        WeekDay.Wednesday,
                        WeekDay.Thursday,
                        WeekDay.Friday,
                        WeekDay.Saturday,
                    ].map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </Select>
            </FormControl>
            <FormControl margin={'normal'} fullWidth>
                <InputLabel>Datetime input style</InputLabel>
                <Select
                    fullWidth
                    value={settings.dateTimeInputStyle}
                    onChange={(e) => {
                        setSettings({
                            variables: {
                                settings: {
                                    ...settings,
                                    dateTimeInputStyle: e.target.value as DateTimeInputStyle,
                                },
                            },
                        })
                            .then(() =>
                                enqueueSnackbar('datetime input style changed', {
                                    variant: 'success',
                                })
                            )
                            .catch(handleError('set datetime input style', enqueueSnackbar));
                    }}>
                    {[DateTimeInputStyle.Fancy, DateTimeInputStyle.Native].map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </Select>
            </FormControl>
            <FormControl margin={'normal'} fullWidth>
                <InputLabel>Duration format</InputLabel>
                <Select
                    fullWidth
                    value={settings.durationFormat}
                    onChange={(e) => {
                        setSettings({
                            variables: {
                                settings: {
                                    ...settings,
                                    durationFormat: e.target.value as DurationFormat,
                                },
                            },
                        })
                            .then(() =>
                                enqueueSnackbar('duration format changed', {
                                    variant: 'success',
                                })
                            )
                            .catch(handleError('set duration format', enqueueSnackbar));
                    }}>
                    {Object.values(DurationFormat).map((type) => (
                        <option key={type} value={type}>
                            {durationFormatLabels[type]}
                        </option>
                    ))}
                </Select>
            </FormControl>
            {isCustomDurationFormat(settings.durationFormat) && (
                <FormControl margin={'normal'} fullWidth>
                    <TextField
                        label="Custom duration pattern"
                        value={customFormat}
                        onChange={(e) => setCustomFormat(e.target.value)}
                        onBlur={() => {
                            if (customFormat === settings.durationCustomFormat) {
                                return;
                            }
                            setSettings({
                                variables: {
                                    settings: {
                                        ...settings,
                                        durationCustomFormat: customFormat,
                                    },
                                },
                            })
                                .then(() =>
                                    enqueueSnackbar('duration pattern changed', {
                                        variant: 'success',
                                    })
                                )
                                .catch(handleError('set duration pattern', enqueueSnackbar));
                        }}
                    />
                    <FormHelperText>{durationCustomHelp[settings.durationFormat]}</FormHelperText>
                </FormControl>
            )}
        </Paper>
    );
};

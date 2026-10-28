import * as React from 'react';
import moment from 'moment';
import Paper from '@material-ui/core/Paper';
import {makeStyles} from '@material-ui/core/styles';
import {useApolloClient, useMutation, useQuery} from '@apollo/react-hooks';
import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import Checkbox from '@material-ui/core/Checkbox';
import CircularProgress from '@material-ui/core/CircularProgress';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import IconButton from '@material-ui/core/IconButton';
import Link from '@material-ui/core/Link';
import LogIcon from '@material-ui/icons/Subject';
import ReplayIcon from '@material-ui/icons/Replay';
import DeleteFolderIcon from '@material-ui/icons/DeleteForever';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import {useSnackbar} from 'notistack';
import * as gqlExportMapping from '../gql/exportMapping';
import {RunExport, RunExportVariables} from '../gql/__generated__/RunExport';
import {ExportRuns} from '../gql/__generated__/ExportRuns';
import {ExportRunFields, ExportRunFields_files} from '../gql/__generated__/ExportRunFields';
import {ExportRunFile, ExportRunFileVariables} from '../gql/__generated__/ExportRunFile';
import {DeleteExportRunFolder, DeleteExportRunFolderVariables} from '../gql/__generated__/DeleteExportRunFolder';
import {ExportIfExists, ExportMode, InputExportRun} from '../gql/__generated__/globalTypes';
import {ConfirmDialog} from '../common/ConfirmDialog';
import {CenteredSpinner} from '../common/CenteredSpinner';
import {handleError} from '../utils/errors';

const useStyles = makeStyles((theme) => ({
    root: {
        ...theme.mixins.gutters(),
        paddingTop: theme.spacing(3),
        paddingBottom: theme.spacing(3),
        maxWidth: 1200,
        margin: '0 auto',
        overflowX: 'auto',
    },
    form: {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        '& > *': {marginRight: theme.spacing(4), marginBottom: theme.spacing(2)},
    },
    log: {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'monospace',
        fontSize: 12,
        maxHeight: 400,
        overflowY: 'auto',
        padding: theme.spacing(1),
        background: theme.palette.action.hover,
        margin: 0,
    },
}));

type RangeType = 'month' | 'range';

const rangeLabel = (run: ExportRunFields) =>
    run.month ? `${run.month.slice(0, 4)}-${run.month.slice(4)}` : `${run.from} – ${run.to}`;

export const ExportPage = () => {
    const classes = useStyles();
    const {enqueueSnackbar} = useSnackbar();
    const apolloClient = useApolloClient();
    const [rangeType, setRangeType] = React.useState<RangeType>('month');
    const [month, setMonth] = React.useState(moment().format('YYYY-MM'));
    const [from, setFrom] = React.useState(
        moment()
            .startOf('month')
            .format('YYYY-MM-DD')
    );
    const [to, setTo] = React.useState(moment().format('YYYY-MM-DD'));
    const [mode, setMode] = React.useState<ExportMode>(ExportMode.OVERVIEW);
    const [dryRun, setDryRun] = React.useState(true);
    const [running, setRunning] = React.useState(false);
    const [shownLog, setShownLog] = React.useState<number | null>(null);
    // set when the output folder exists: the run to repeat with a counter suffix, and the folder
    const [existing, setExisting] = React.useState<{run: InputExportRun; folder: string} | null>(null);
    const [deleteFolder, setDeleteFolder] = React.useState<ExportRunFields | null>(null);
    const runs = useQuery<ExportRuns>(gqlExportMapping.ExportRuns);
    const [runExport] = useMutation<RunExport, RunExportVariables>(gqlExportMapping.RunExport, {
        refetchQueries: [{query: gqlExportMapping.ExportRuns}],
        awaitRefetchQueries: true,
    });
    const [deleteRunFolder] = useMutation<DeleteExportRunFolder, DeleteExportRunFolderVariables>(
        gqlExportMapping.DeleteExportRunFolder,
        {refetchQueries: [{query: gqlExportMapping.ExportRuns}]}
    );

    const download = (run: ExportRunFields, file: ExportRunFields_files) =>
        apolloClient
            .query<ExportRunFile, ExportRunFileVariables>({
                query: gqlExportMapping.ExportRunFile,
                variables: {runId: run.id, path: file.path},
                fetchPolicy: 'no-cache',
            })
            .then((result) => {
                const bytes = Uint8Array.from(atob(result.data.exportRunFile), (c) => c.charCodeAt(0));
                const url = URL.createObjectURL(new Blob([bytes]));
                const link = document.createElement('a');
                link.href = url;
                link.download = file.name;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            })
            .catch(handleError('Download', enqueueSnackbar));

    const start = (input: InputExportRun) => {
        setRunning(true);
        runExport({variables: {run: input}})
            .then((result) => {
                const runResult = result.data && result.data.runExport;
                if (runResult && runResult.existingFolder) {
                    setExisting({run: input, folder: runResult.existingFolder});
                    return;
                }
                const run = runResult && runResult.run;
                if (!run) {
                    return;
                }
                setShownLog(run.id);
                if (run.exitCode !== 0) {
                    enqueueSnackbar(`export failed (exit code ${run.exitCode}), see log`, {variant: 'error'});
                    return;
                }
                enqueueSnackbar(run.dryRun ? 'check finished, nothing written' : 'export finished', {variant: 'success'});
                if (run.mode === ExportMode.OVERVIEW && run.files.length) {
                    download(run, run.files[0]);
                }
            })
            .catch(handleError('Export', enqueueSnackbar))
            .finally(() => setRunning(false));
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const range = rangeType === 'month' ? {month: month.replace('-', '')} : {from, to};
        start({...range, mode, dryRun, ifExists: ExportIfExists.FAIL});
    };

    const onDeleteFolder = () => {
        if (!deleteFolder) {
            return;
        }
        return deleteRunFolder({variables: {runId: deleteFolder.id}})
            .then(() => enqueueSnackbar('folder deleted', {variant: 'success'}))
            .catch(handleError('Delete Folder', enqueueSnackbar));
    };

    const runAgain = (run: ExportRunFields) => {
        if (run.month) {
            setRangeType('month');
            setMonth(`${run.month.slice(0, 4)}-${run.month.slice(4)}`);
        } else {
            setRangeType('range');
            setFrom(run.from);
            setTo(run.to);
        }
        setMode(run.mode);
        setDryRun(run.dryRun);
        window.scrollTo({top: 0, behavior: 'smooth'});
    };

    const history = (runs.data && runs.data.exportRuns) || [];

    return (
        <Paper elevation={1} square={true} className={classes.root}>
            <form onSubmit={submit} className={classes.form}>
                <div>
                    <FormLabel>Time range</FormLabel>
                    <RadioGroup row value={rangeType} onChange={(e) => setRangeType(e.target.value as RangeType)}>
                        <FormControlLabel value="month" control={<Radio color="primary" />} label="Month" />
                        <FormControlLabel value="range" control={<Radio color="primary" />} label="Date range" />
                    </RadioGroup>
                    {rangeType === 'month' ? (
                        <TextField
                            id="export-month"
                            type="month"
                            label="Month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            InputLabelProps={{shrink: true}}
                        />
                    ) : (
                        <>
                            <TextField
                                id="export-from"
                                type="date"
                                label="From"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                InputLabelProps={{shrink: true}}
                                style={{marginRight: 16}}
                            />
                            <TextField
                                id="export-to"
                                type="date"
                                label="To (inclusive)"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                InputLabelProps={{shrink: true}}
                            />
                        </>
                    )}
                </div>
                <div>
                    <FormLabel>Output</FormLabel>
                    <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as ExportMode)}>
                        <FormControlLabel
                            value={ExportMode.OVERVIEW}
                            control={<Radio color="primary" />}
                            label="Overview only (downloads the spreadsheet)"
                        />
                        <FormControlLabel
                            value={ExportMode.FULL}
                            control={<Radio color="primary" />}
                            label="Full (overview + booking scripts)"
                        />
                    </RadioGroup>
                    <FormControlLabel
                        control={<Checkbox checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} color="primary" />}
                        label="Check only (dry run, writes nothing)"
                    />
                </div>
                <div style={{alignSelf: 'center'}}>
                    <Button type="submit" variant="contained" color="primary" disabled={running}>
                        {running ? <CircularProgress size={22} /> : 'Run export'}
                    </Button>
                </div>
            </form>

            <Typography variant="h6">History</Typography>
            {runs.loading ? (
                <CenteredSpinner />
            ) : history.length === 0 ? (
                <Typography color="textSecondary">No exports yet.</Typography>
            ) : (
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Started</TableCell>
                            <TableCell>Time range</TableCell>
                            <TableCell>Output</TableCell>
                            <TableCell>Result</TableCell>
                            <TableCell>Files</TableCell>
                            <TableCell style={{width: 140}} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {history.map((run) => (
                            <React.Fragment key={run.id}>
                                <TableRow>
                                    <TableCell style={{whiteSpace: 'nowrap'}}>
                                        {moment(run.startedAt).format('YYYY-MM-DD HH:mm')}
                                    </TableCell>
                                    <TableCell style={{whiteSpace: 'nowrap'}}>{rangeLabel(run)}</TableCell>
                                    <TableCell>
                                        {run.mode === ExportMode.OVERVIEW ? 'overview' : 'full'}
                                        {run.dryRun ? ', check only' : ''}
                                    </TableCell>
                                    <TableCell style={{whiteSpace: 'nowrap'}}>
                                        <Typography variant="body2" style={{color: run.exitCode === 0 ? undefined : '#f44336'}}>
                                            {run.exitCode === 0 ? 'OK' : `failed (${run.exitCode})`} ·{' '}
                                            {(run.durationMs / 1000).toFixed(1)} s
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {run.folder && !run.folderExists ? (
                                            <Typography variant="body2" color="textSecondary" title={run.folder}>
                                                folder deleted
                                            </Typography>
                                        ) : null}
                                        {(run.folderExists ? run.files : []).map((file) => (
                                            <Link
                                                key={file.path}
                                                component="button"
                                                type="button"
                                                title={file.path}
                                                onClick={() => download(run, file)}>
                                                {file.path
                                                    .split('/')
                                                    .slice(-2)
                                                    .join('/')}
                                            </Link>
                                        ))}
                                    </TableCell>
                                    <TableCell align="right" style={{whiteSpace: 'nowrap'}}>
                                        <IconButton
                                            title="Log"
                                            size="small"
                                            onClick={() => setShownLog(shownLog === run.id ? null : run.id)}>
                                            <LogIcon />
                                        </IconButton>
                                        <IconButton title="Use these settings again" size="small" onClick={() => runAgain(run)}>
                                            <ReplayIcon />
                                        </IconButton>
                                        {run.folderExists ? (
                                            <IconButton title="Delete folder" size="small" onClick={() => setDeleteFolder(run)}>
                                                <DeleteFolderIcon />
                                            </IconButton>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                                {shownLog === run.id ? (
                                    <TableRow>
                                        <TableCell colSpan={6}>
                                            <pre className={classes.log}>{run.log}</pre>
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            )}
            {existing ? (
                <Dialog open={true} onClose={() => setExisting(null)}>
                    <DialogTitle>Folder already exists</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            <b>{existing.folder}</b> already exists. Nothing was written. Cancel, or export into a new folder with
                            a counter (<b>{existing.folder.split('/').pop()}-2</b>, -3, ...)?
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setExisting(null)} color="primary">
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            onClick={() => {
                                const input = existing.run;
                                setExisting(null);
                                start({...input, ifExists: ExportIfExists.COUNTER});
                            }}>
                            New folder with counter
                        </Button>
                    </DialogActions>
                </Dialog>
            ) : null}
            {deleteFolder ? (
                <ConfirmDialog title="Delete folder" fClose={() => setDeleteFolder(null)} fOnSubmit={onDeleteFolder}>
                    Delete <b>{deleteFolder.folder}</b> with everything in it? This cannot be undone.
                </ConfirmDialog>
            ) : null}
        </Paper>
    );
};

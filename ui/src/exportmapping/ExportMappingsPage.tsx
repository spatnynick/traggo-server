import * as React from 'react';
import Paper from '@material-ui/core/Paper';
import {makeStyles} from '@material-ui/core/styles';
import {useMutation, useQuery} from '@apollo/react-hooks';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import CopyIcon from '@material-ui/icons/FileCopy';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import {useSnackbar} from 'notistack';
import * as gqlExportMapping from '../gql/exportMapping';
import * as gqlTags from '../gql/tags';
import {ExportMappings, ExportMappings_exportMappings} from '../gql/__generated__/ExportMappings';
import {RemoveExportMapping, RemoveExportMappingVariables} from '../gql/__generated__/RemoveExportMapping';
import {Tags} from '../gql/__generated__/Tags';
import {CenteredSpinner} from '../common/CenteredSpinner';
import {ConfirmDialog} from '../common/ConfirmDialog';
import {TagChip} from '../common/TagChip';
import {handleError} from '../utils/errors';
import {ExportMappingDialog} from './ExportMappingDialog';

const useStyles = makeStyles((theme) => ({
    root: {
        ...theme.mixins.gutters(),
        paddingTop: theme.spacing(3),
        paddingBottom: theme.spacing(3),
        maxWidth: 1200,
        margin: '0 auto',
        overflowX: 'auto',
    },
}));

export const ExportMappingsPage = () => {
    const classes = useStyles();
    const {enqueueSnackbar} = useSnackbar();
    const {data, loading} = useQuery<ExportMappings>(gqlExportMapping.ExportMappings);
    const tagsResult = useQuery<Tags>(gqlTags.Tags);
    const [removeMapping] = useMutation<RemoveExportMapping, RemoveExportMappingVariables>(gqlExportMapping.RemoveExportMapping, {
        refetchQueries: [{query: gqlExportMapping.ExportMappings}],
    });
    // undefined = closed, null = create, mapping = edit (or create from a copy when duplicate is set)
    const [editing, setEditing] = React.useState<ExportMappings_exportMappings | null | undefined>(undefined);
    const [duplicate, setDuplicate] = React.useState(false);
    const open = (mapping: ExportMappings_exportMappings | null, asDuplicate: boolean) => {
        setDuplicate(asDuplicate);
        setEditing(mapping);
    };
    const [removeConfirm, setRemoveConfirm] = React.useState<ExportMappings_exportMappings | null>(null);

    if (loading || !data || !data.exportMappings) {
        return <CenteredSpinner />;
    }

    const colorOf = (key: string) => {
        const definition = ((tagsResult.data && tagsResult.data.tags) || []).find((tag) => tag.key === key);
        return definition ? definition.color : 'gray';
    };

    const onClickDelete = () => {
        if (!removeConfirm) {
            return;
        }
        return removeMapping({variables: {id: removeConfirm.id}})
            .then(() => enqueueSnackbar('export mapping deleted', {variant: 'success'}))
            .catch(handleError('Delete Export Mapping', enqueueSnackbar));
    };

    const rows = data.exportMappings.map((mapping) => (
        <TableRow key={mapping.id}>
            <TableCell style={{minWidth: 220}}>
                {mapping.tags.map((tag) => (
                    <TagChip key={tag.key} label={`${tag.key}:${tag.value}`} color={colorOf(tag.key)} />
                ))}
            </TableCell>
            <TableCell>{mapping.client}</TableCell>
            <TableCell style={{minWidth: 140}}>{mapping.project}</TableCell>
            <TableCell>{mapping.autoBooking ? 'automatic' : 'by hand'}</TableCell>
            <TableCell>
                {[mapping.noteReference ? 'note reference' : '', mapping.mergeDaily ? 'merge daily' : '']
                    .filter((option) => option)
                    .join(', ')}
            </TableCell>
            <TableCell>{mapping.subtotalGroup}</TableCell>
            <TableCell align="right" style={{whiteSpace: 'nowrap'}}>
                <IconButton onClick={() => open(mapping, false)} title="Edit">
                    <EditIcon />
                </IconButton>
                <IconButton onClick={() => open(mapping, true)} title="Duplicate">
                    <CopyIcon />
                </IconButton>
                <IconButton onClick={() => setRemoveConfirm(mapping)} title="Delete">
                    <DeleteIcon />
                </IconButton>
            </TableCell>
        </TableRow>
    ));

    return (
        <Paper elevation={1} square={true} className={classes.root}>
            <Typography variant="body2" color="textSecondary" style={{marginBottom: 10}}>
                Export mappings are read by external export scripts: an entry whose tags match a mapping is exported with its
                client and project.
            </Typography>
            <Button
                color={'primary'}
                variant={'outlined'}
                size="small"
                onClick={() => open(null, false)}
                fullWidth
                style={{marginBottom: 10}}>
                Create Export Mapping
            </Button>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Tags</TableCell>
                        <TableCell>Client</TableCell>
                        <TableCell>Project</TableCell>
                        <TableCell>Booking</TableCell>
                        <TableCell>Options</TableCell>
                        <TableCell>Subtotal group</TableCell>
                        <TableCell style={{width: 170}} />
                    </TableRow>
                </TableHead>
                <TableBody>{rows}</TableBody>
            </Table>
            {editing !== undefined ? (
                <ExportMappingDialog
                    mapping={editing}
                    duplicate={duplicate}
                    mappings={data.exportMappings}
                    close={() => setEditing(undefined)}
                />
            ) : null}
            {removeConfirm ? (
                <ConfirmDialog
                    title={`Delete Export Mapping ${removeConfirm.project}`}
                    fClose={() => setRemoveConfirm(null)}
                    fOnSubmit={onClickDelete}>
                    Entries with these tags can no longer be exported until they are mapped again.
                </ConfirmDialog>
            ) : null}
        </Paper>
    );
};

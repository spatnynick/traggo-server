import * as React from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import {useMutation, useQuery} from '@apollo/react-hooks';
import {useSnackbar} from 'notistack';
import * as gqlExportMapping from '../gql/exportMapping';
import * as gqlTags from '../gql/tags';
import {Tags} from '../gql/__generated__/Tags';
import {ExportMappings_exportMappings} from '../gql/__generated__/ExportMappings';
import {CreateExportMapping, CreateExportMappingVariables} from '../gql/__generated__/CreateExportMapping';
import {UpdateExportMapping, UpdateExportMappingVariables} from '../gql/__generated__/UpdateExportMapping';
import {InputExportMapping} from '../gql/__generated__/globalTypes';
import {FormTagSelector} from '../tag/FormTagSelector';
import {TagSelectorEntry, toInputTags, toTagSelectorEntry} from '../tag/tagSelectorEntry';
import {handleError} from '../utils/errors';
import {SuggestTextField} from '../common/SuggestTextField';

interface ExportMappingDialogProps {
    mapping: ExportMappings_exportMappings | null;
    // create a new mapping prefilled from mapping
    duplicate?: boolean;
    // existing mappings, used for suggestions while typing
    mappings: ExportMappings_exportMappings[];
    close: () => void;
}

const emptyMapping: InputExportMapping = {
    tags: [],
    client: '',
    project: '',
    autoBooking: true,
    noteReference: false,
    mergeDaily: false,
    subtotalGroup: '',
};

export const ExportMappingDialog: React.FC<ExportMappingDialogProps> = ({mapping, duplicate = false, mappings, close}) => {
    const editing = mapping && !duplicate ? mapping : null;
    const {enqueueSnackbar} = useSnackbar();
    const tagsResult = useQuery<Tags>(gqlTags.Tags);
    const [value, setValue] = React.useState<InputExportMapping>(() =>
        mapping
            ? {
                  tags: mapping.tags.map(({key, value: tagValue}) => ({key, value: tagValue})),
                  client: mapping.client,
                  project: mapping.project,
                  autoBooking: mapping.autoBooking,
                  noteReference: mapping.noteReference,
                  mergeDaily: mapping.mergeDaily,
                  subtotalGroup: mapping.subtotalGroup,
              }
            : emptyMapping
    );
    const refetch = {refetchQueries: [{query: gqlExportMapping.ExportMappings}]};
    const [createMapping] = useMutation<CreateExportMapping, CreateExportMappingVariables>(
        gqlExportMapping.CreateExportMapping,
        refetch
    );
    const [updateMapping] = useMutation<UpdateExportMapping, UpdateExportMappingVariables>(
        gqlExportMapping.UpdateExportMapping,
        refetch
    );

    const definitions = (tagsResult.data && tagsResult.data.tags) || [];
    const selectedEntries: TagSelectorEntry[] = toTagSelectorEntry(definitions, value.tags);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const action: Promise<unknown> = editing
            ? updateMapping({variables: {id: editing.id, mapping: value}})
            : createMapping({variables: {mapping: value}});
        action
            .then(() => {
                enqueueSnackbar(editing ? 'export mapping edited' : 'export mapping created', {variant: 'success'});
                close();
            })
            .catch(handleError(editing ? 'Edit Export Mapping' : 'Create Export Mapping', enqueueSnackbar));
    };

    const text = (field: 'client' | 'project' | 'subtotalGroup', label: string, helperText: string) => (
        <SuggestTextField
            id={`export-mapping-${field}`}
            suggestions={mappings.map((other) => other[field]).filter((suggestion) => suggestion)}
            margin="dense"
            label={label}
            helperText={helperText}
            fullWidth
            value={value[field]}
            onChange={(changed) => setValue({...value, [field]: changed})}
        />
    );
    const check = (field: 'autoBooking' | 'noteReference' | 'mergeDaily', label: string) => (
        <FormControlLabel
            control={
                <Checkbox
                    checked={value[field]}
                    onChange={(e) => setValue({...value, [field]: e.target.checked})}
                    color="primary"
                />
            }
            label={label}
        />
    );

    return (
        <Dialog open={true} onClose={close} fullWidth>
            <form onSubmit={submit} noValidate autoComplete="off">
                <DialogTitle>
                    {editing ? 'Edit Export Mapping' : duplicate ? 'Duplicate Export Mapping' : 'Create Export Mapping'}
                </DialogTitle>
                <DialogContent>
                    <FormTagSelector
                        label="Tags (entries with exactly these tags)"
                        required
                        selectedEntries={selectedEntries}
                        onSelectedEntriesChanged={(entries) => setValue({...value, tags: toInputTags(entries)})}
                        createTags={false}
                    />
                    {text('client', 'Client', 'Client name written by the export')}
                    {text('project', 'Project', 'Project / booking name written by the export')}
                    {text('subtotalGroup', 'Subtotal group', 'Optional: projects with the same group get a common subtotal')}
                    <div>{check('autoBooking', 'Booked automatically (otherwise: book by hand)')}</div>
                    <div>{check('noteReference', 'Note starts with a reference ("<reference>: <description>")')}</div>
                    <div>{check('mergeDaily', 'Merge all entries of a day into one (keeps the latest note)')}</div>
                </DialogContent>
                <DialogActions>
                    <Button onClick={close} color="primary">
                        Cancel
                    </Button>
                    <Button type="submit" color="primary">
                        {editing ? 'Save' : 'Create'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

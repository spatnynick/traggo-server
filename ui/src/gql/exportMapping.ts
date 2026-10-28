import {gql} from 'apollo-boost';

export const ExportMappings = gql`
    query ExportMappings {
        exportMappings {
            id
            tags {
                key
                value
            }
            client
            project
            autoBooking
            noteReference
            mergeDaily
            subtotalGroup
        }
    }
`;

export const CreateExportMapping = gql`
    mutation CreateExportMapping($mapping: InputExportMapping!) {
        createExportMapping(mapping: $mapping) {
            id
        }
    }
`;

export const UpdateExportMapping = gql`
    mutation UpdateExportMapping($id: Int!, $mapping: InputExportMapping!) {
        updateExportMapping(id: $id, mapping: $mapping) {
            id
        }
    }
`;

export const RemoveExportMapping = gql`
    mutation RemoveExportMapping($id: Int!) {
        removeExportMapping(id: $id) {
            id
        }
    }
`;

export const ExportRunAvailable = gql`
    query ExportRunAvailable {
        exportRunAvailable
    }
`;

const ExportRunFields = gql`
    fragment ExportRunFields on ExportRun {
        id
        startedAt
        durationMs
        month
        from
        to
        mode
        dryRun
        exitCode
        log
        files {
            name
            path
        }
        folder
        folderExists
    }
`;

export const RunExport = gql`
    mutation RunExport($run: InputExportRun!) {
        runExport(run: $run) {
            run {
                ...ExportRunFields
            }
            existingFolder
        }
    }
    ${ExportRunFields}
`;

export const ExportRuns = gql`
    query ExportRuns {
        exportRuns {
            ...ExportRunFields
        }
    }
    ${ExportRunFields}
`;

export const ExportRunFile = gql`
    query ExportRunFile($runId: Int!, $path: String!) {
        exportRunFile(runId: $runId, path: $path)
    }
`;

export const DeleteExportRunFolder = gql`
    mutation DeleteExportRunFolder($runId: Int!) {
        deleteExportRunFolder(runId: $runId) {
            id
        }
    }
`;

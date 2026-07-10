import {gql} from 'apollo-boost';

export const Status = gql`
    query Status {
        status {
            serverTime
            version {
                name
                commit
                buildDate
            }
            runningTimers {
                id
                start
            }
        }
    }
`;

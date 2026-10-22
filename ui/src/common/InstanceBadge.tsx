import * as React from 'react';
import Typography from '@material-ui/core/Typography';

// A binary built without release ldflags reports the version "develop" (e.g. `go run`).
// Everything else is a stamped release build, i.e. the productive instance.
export const isDevInstance = (versionName: string): boolean => versionName === 'develop';

const titlePrefix = '[DEV] ';

export const InstanceBadge: React.FC<{versionName: string}> = ({versionName}) => {
    const dev = isDevInstance(versionName);

    React.useEffect(() => {
        if (dev && !document.title.startsWith(titlePrefix)) {
            document.title = titlePrefix + document.title;
        }
    }, [dev]);

    return (
        <Typography
            variant="caption"
            align="center"
            component="div"
            data-testid="instance-badge"
            style={
                dev
                    ? {color: '#fff', background: '#d32f2f', fontWeight: 'bold', letterSpacing: 2, padding: '0 8px'}
                    : {opacity: 0.6, letterSpacing: 2}
            }>
            {dev ? 'DEV' : 'PROD'}
        </Typography>
    );
};

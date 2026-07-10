import * as React from 'react';
import Button from '@material-ui/core/Button';
import WarningIcon from '@material-ui/icons/Warning';
import {useConnection} from '../provider/ConnectionProvider';

export const ConnectionBanner: React.FC = () => {
    const {online, retry} = useConnection();
    if (online) {
        return null;
    }
    return (
        <div
            data-testid="connection-banner"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: '#d35400',
                color: '#fff',
                padding: '10px 16px',
                marginBottom: 16,
                borderRadius: 4,
            }}>
            <WarningIcon fontSize="small" />
            <span style={{flex: 1}}>Connection to server lost — the displayed status may be out of date.</span>
            <Button size="small" variant="outlined" style={{color: '#fff', borderColor: '#fff'}} onClick={() => retry()}>
                Retry
            </Button>
        </div>
    );
};

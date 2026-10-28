import * as React from 'react';
import TextField, {StandardTextFieldProps} from '@material-ui/core/TextField';
import Paper from '@material-ui/core/Paper';
import MenuItem from '@material-ui/core/MenuItem';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';

type SuggestTextFieldProps = Omit<StandardTextFieldProps, 'value' | 'onChange'> & {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
};

const MAX_SUGGESTIONS = 10;

/** A text field that suggests matching values while typing (arrow keys + enter, or click). */
export const SuggestTextField: React.FC<SuggestTextFieldProps> = ({value, onChange, suggestions, ...props}) => {
    const [open, setOpen] = React.useState(false);
    const [highlighted, setHighlighted] = React.useState(0);
    const query = value.trim().toLowerCase();
    const matches = Array.from(new Set(suggestions))
        .filter((suggestion) => suggestion !== value && suggestion.toLowerCase().includes(query))
        .sort(
            (a, b) =>
                Number(!a.toLowerCase().startsWith(query)) - Number(!b.toLowerCase().startsWith(query)) || a.localeCompare(b)
        )
        .slice(0, MAX_SUGGESTIONS);
    const showList = open && matches.length > 0;

    const select = (suggestion: string) => {
        onChange(suggestion);
        setOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!showList) {
            if (e.key === 'ArrowDown') {
                setOpen(true);
                setHighlighted(0);
            }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((highlighted + 1) % matches.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((highlighted - 1 + matches.length) % matches.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            select(matches[Math.min(highlighted, matches.length - 1)]);
        } else if (e.key === 'Escape') {
            // close only the list, not the surrounding dialog
            e.stopPropagation();
            setOpen(false);
        }
    };

    return (
        <ClickAwayListener onClickAway={() => setOpen(false)}>
            <div style={{position: 'relative'}}>
                <TextField
                    {...props}
                    value={value}
                    autoComplete="off"
                    onFocus={() => setOpen(true)}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setOpen(true);
                        setHighlighted(0);
                    }}
                    onKeyDown={onKeyDown}
                />
                {showList ? (
                    <Paper style={{position: 'absolute', zIndex: 2, left: 0, right: 0, top: 48}} elevation={4}>
                        {matches.map((suggestion, index) => (
                            <MenuItem
                                key={suggestion}
                                dense
                                selected={index === highlighted}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => select(suggestion)}>
                                {suggestion}
                            </MenuItem>
                        ))}
                    </Paper>
                ) : null}
            </div>
        </ClickAwayListener>
    );
};

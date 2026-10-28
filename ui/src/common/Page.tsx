import * as React from 'react';
import AppBar from '@material-ui/core/AppBar';
import CssBaseline from '@material-ui/core/CssBaseline';
import Divider from '@material-ui/core/Divider';
import Drawer from '@material-ui/core/Drawer';
import Hidden from '@material-ui/core/Hidden';
import IconButton from '@material-ui/core/IconButton';
import UsersIcon from '@material-ui/icons/SupervisorAccount';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import DashboardIcon from '@material-ui/icons/Dashboard';
import MenuIcon from '@material-ui/icons/Menu';
import SettingsIcon from '@material-ui/icons/Settings';
import DevicesIcon from '@material-ui/icons/DevicesOther';
import LabelIcon from '@material-ui/icons/Label';
import ExportIcon from '@material-ui/icons/ImportExport';
import RunExportIcon from '@material-ui/icons/GetApp';
import * as gqlExportMapping from '../gql/exportMapping';
import {ExportRunAvailable} from '../gql/__generated__/ExportRunAvailable';
import DashboardManageIcon from '@material-ui/icons/ListAlt';
import TimeLineIcon from '@material-ui/icons/Timeline';
import CalendarIcon from '@material-ui/icons/CalendarToday';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip from '@material-ui/core/Tooltip';
import CollapseIcon from '@material-ui/icons/ChevronLeft';
import ExpandIcon from '@material-ui/icons/ChevronRight';
import Typography from '@material-ui/core/Typography';
import {ListSubheader, Menu} from '@material-ui/core';
import HrefLink from '@material-ui/core/Link';
import * as gqlUser from '../gql/user';
import * as gqlVersion from '../gql/version';
import {InstanceBadge} from './InstanceBadge';
import Button from '@material-ui/core/Button';
import AccountCircle from '@material-ui/icons/AccountCircle';
import {Link} from 'react-router-dom';
import MenuItem from '@material-ui/core/MenuItem';
import {useMutation, useQuery} from '@apollo/react-hooks';
import {Logout} from '../gql/__generated__/Logout';
import {Version} from '../gql/__generated__/Version';
import {CurrentUser} from '../gql/__generated__/CurrentUser';
import * as gqlDashboard from '../gql/dashboard';
import {Dashboards} from '../gql/__generated__/Dashboards';
import makeStyles from '@material-ui/core/styles/makeStyles';
import {Route, RouteChildrenProps, Switch} from 'react-router';
import {ConnectionBanner} from './ConnectionBanner';

const drawerWidth = 240;
const collapsedDrawerWidth = 57;
const collapsedStorageKey = 'traggo.drawerCollapsed';

const useStyles = makeStyles((theme) => ({
    root: {
        display: 'flex',
        height: '100%',
    },
    drawer: {
        [theme.breakpoints.up('md')]: {
            width: drawerWidth,
            flexShrink: 0,
        },
    },
    drawerCollapsed: {
        [theme.breakpoints.up('md')]: {
            width: collapsedDrawerWidth,
        },
    },
    appBar: {
        marginLeft: drawerWidth,
        [theme.breakpoints.up('md')]: {
            width: `calc(100% - ${drawerWidth}px)`,
        },
    },
    appBarCollapsed: {
        [theme.breakpoints.up('md')]: {
            width: `calc(100% - ${collapsedDrawerWidth}px)`,
        },
    },
    menuButton: {
        marginRight: 20,
        [theme.breakpoints.up('md')]: {
            display: 'none',
        },
    },
    toolbar: {
        ...theme.mixins.toolbar,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
    },
    drawerPaper: {
        width: drawerWidth,
        overflowX: 'hidden',
        transition: theme.transitions.create('width'),
    },
    drawerPaperCollapsed: {
        width: collapsedDrawerWidth,
    },
    content: {
        flexGrow: 1,
        minWidth: 0,
        paddingTop: theme.spacing(2),
        paddingBottom: theme.spacing(2),
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
    },
    grow: {
        flexGrow: 1,
    },
    sectionDesktop: {
        display: 'none',
        [theme.breakpoints.up('xs')]: {
            display: 'flex',
        },
    },
    sectionMobile: {
        display: 'flex',
        [theme.breakpoints.up('xs')]: {
            display: 'none',
        },
    },
}));

// tslint:disable-next-line:no-any
const routerLink = (to: string): any => {
    return React.forwardRef<HTMLAnchorElement>((props, ref) => <Link innerRef={ref} to={to} {...props} />);
};

interface NavItemProps {
    to: string;
    icon: React.ReactElement;
    label: string;
    collapsed: boolean;
}

// A menu entry; when the menu is collapsed only the icon is shown and the label is a tooltip.
const NavItem: React.FC<NavItemProps> = ({to, icon, label, collapsed}) => {
    const item = (
        <ListItem button component={routerLink(to)}>
            <ListItemIcon>{icon}</ListItemIcon>
            {collapsed ? null : <ListItemText primary={label} />}
        </ListItem>
    );
    return collapsed ? (
        <Tooltip title={label} placement="right">
            {item}
        </Tooltip>
    ) : (
        item
    );
};

const readCollapsed = () => {
    try {
        return localStorage.getItem(collapsedStorageKey) === 'true';
    } catch (e) {
        return false;
    }
};

export const Page: React.FC = ({children}) => {
    const classes = useStyles();
    const {data} = useQuery<CurrentUser>(gqlUser.CurrentUser);

    const [mobileOpen, setMobileOpen] = React.useState(false);
    const [collapsed, setCollapsedState] = React.useState(readCollapsed);
    const setCollapsed = (value: boolean) => {
        setCollapsedState(value);
        try {
            localStorage.setItem(collapsedStorageKey, String(value));
        } catch (e) {
            // the menu state is only a convenience
        }
    };
    const [userMenuOpen, setUserMenuOpen] = React.useState<null | HTMLElement>(null);
    const [logout] = useMutation<Logout>(gqlUser.Logout, {refetchQueries: [{query: gqlUser.CurrentUser}]});
    const {data: {version = gqlVersion.VersionDefault.version} = gqlVersion.VersionDefault} = useQuery<Version>(
        gqlVersion.Version
    );
    const dashboardsQuery = useQuery<Dashboards>(gqlDashboard.Dashboards);
    const exportAvailableQuery = useQuery<ExportRunAvailable>(gqlExportMapping.ExportRunAvailable);
    const exportAvailable = !!(exportAvailableQuery.data && exportAvailableQuery.data.exportRunAvailable);
    const dashboards = (dashboardsQuery.data && dashboardsQuery.data.dashboards) || [];

    const username = (data && data.user && data.user.name) || 'unknown';
    const admin = data && data.user && data.user.admin;

    // folded: only icons (desktop only; the mobile menu is always unfolded)
    const renderDrawer = (folded: boolean, canFold: boolean) => {
        const section = (title: string) => (folded ? undefined : <ListSubheader>{title}</ListSubheader>);
        return (
            <div>
                <div className={classes.toolbar}>
                    {folded ? (
                        <Tooltip title={`traggo ${version.name}@${version.commit.slice(0, 8)}`} placement="right">
                            <div>
                                <InstanceBadge versionName={version.name} />
                            </div>
                        </Tooltip>
                    ) : (
                        <>
                            <HrefLink href="https://github.com/traggo" underline="none" target="_blank">
                                <Typography variant="h5" align="center" color="textPrimary">
                                    traggo
                                </Typography>
                            </HrefLink>
                            <HrefLink href="https://github.com/traggo/server/releases" underline="none" target="_blank">
                                <Typography variant="subtitle2" align="center" color="textPrimary">
                                    {version.name}@{version.commit.slice(0, 8)}
                                </Typography>
                            </HrefLink>
                            <InstanceBadge versionName={version.name} />
                        </>
                    )}
                </div>
                <Divider />
                <List subheader={section('Dashboards')} dense={true}>
                    {dashboards.map(({id, name}) => (
                        <NavItem
                            key={id}
                            to={`/dashboard/${id}/${encodeURIComponent(name)}`}
                            icon={<DashboardIcon />}
                            label={name}
                            collapsed={folded}
                        />
                    ))}
                    {dashboards.length === 0 && !folded ? (
                        <ListItem button dense={true} disabled={true}>
                            <ListItemText primary={'no dashboards added'} />
                        </ListItem>
                    ) : null}
                    <NavItem to="/dashboards" icon={<DashboardManageIcon />} label="Manage" collapsed={folded} />
                </List>
                <Divider />
                <List subheader={section('Timesheet')} dense={true}>
                    <NavItem to="/timesheet/list" icon={<TimeLineIcon />} label="List" collapsed={folded} />
                    <NavItem to="/timesheet/calendar" icon={<CalendarIcon />} label="Calendar" collapsed={folded} />
                    {exportAvailable ? (
                        <NavItem to="/timesheet/export" icon={<RunExportIcon />} label="Export" collapsed={folded} />
                    ) : null}
                </List>
                <Divider />
                <List subheader={section('User')} dense={true}>
                    <NavItem to="/user/tags" icon={<LabelIcon />} label="Tags" collapsed={folded} />
                    <NavItem to="/user/export-mappings" icon={<ExportIcon />} label="Export mappings" collapsed={folded} />
                    <NavItem to="/user/devices" icon={<DevicesIcon />} label="Devices" collapsed={folded} />
                    <NavItem to="/user/settings" icon={<SettingsIcon />} label="Settings" collapsed={folded} />
                </List>
                {admin ? (
                    <>
                        <Divider />
                        <List subheader={section('Admin')} dense={true}>
                            <NavItem to="/admin/users" icon={<UsersIcon />} label="Users" collapsed={folded} />
                        </List>
                    </>
                ) : null}
                <Divider />
                {canFold ? (
                    <List dense={true}>
                        <Tooltip title={folded ? 'Expand menu' : ''} placement="right">
                            <ListItem button onClick={() => setCollapsed(!folded)} data-testid="toggle-menu">
                                <ListItemIcon>{folded ? <ExpandIcon /> : <CollapseIcon />}</ListItemIcon>
                                {folded ? null : <ListItemText primary="Collapse menu" />}
                            </ListItem>
                        </Tooltip>
                    </List>
                ) : null}
            </div>
        );
    };

    return (
        <div className={classes.root}>
            <CssBaseline />
            <AppBar position="fixed" className={`${classes.appBar} ${collapsed ? classes.appBarCollapsed : ''}`}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="Open drawer"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className={classes.menuButton}>
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" color="inherit" noWrap>
                        <Switch>
                            <Route exact path="/timesheet/list">
                                Timesheet / List
                            </Route>
                            <Route exact path="/timesheet/calendar">
                                Timesheet / Calendar
                            </Route>
                            <Route exact path="/user/settings">
                                User / Settings
                            </Route>
                            <Route exact path="/user/devices">
                                User / Devices
                            </Route>
                            <Route exact path="/user/tags">
                                User / Tags
                            </Route>
                            <Route exact path="/timesheet/export">
                                Timesheet / Export
                            </Route>
                            <Route exact path="/user/export-mappings">
                                User / Export mappings
                            </Route>
                            <Route exact path="/admin/users">
                                Admin / Users
                            </Route>
                            <Route exact path="/dashboards">
                                Dashboards / Manage
                            </Route>
                            <Route exact path="/dashboard/:id/:name">
                                {(props: RouteChildrenProps<{id: string}>) => {
                                    const db = dashboards.find(
                                        (dashboard) => dashboard.id === parseInt(props.match!.params.id, 10)
                                    );
                                    return 'Dashboards / ' + (db ? db.name : '...');
                                }}
                            </Route>
                        </Switch>
                    </Typography>
                    <div className={classes.grow} />
                    <div className={classes.sectionDesktop}>
                        <Button color="inherit" onClick={(e) => setUserMenuOpen(e.currentTarget)}>
                            <AccountCircle />
                            &nbsp;{username}
                        </Button>
                        <Menu
                            anchorEl={userMenuOpen}
                            anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                            transformOrigin={{vertical: 'top', horizontal: 'right'}}
                            open={!!userMenuOpen}
                            onClose={() => setUserMenuOpen(null)}>
                            <MenuItem onClick={() => setUserMenuOpen(null)} component={routerLink('/user/settings')}>
                                Settings
                            </MenuItem>
                            <MenuItem
                                onClick={() => {
                                    setUserMenuOpen(null);
                                    logout();
                                }}>
                                Logout
                            </MenuItem>
                        </Menu>
                    </div>
                </Toolbar>
            </AppBar>
            <nav className={`${classes.drawer} ${collapsed ? classes.drawerCollapsed : ''}`}>
                <Hidden mdUp implementation="js">
                    <Drawer
                        variant="temporary"
                        open={mobileOpen}
                        onClose={() => setMobileOpen(false)}
                        classes={{
                            paper: classes.drawerPaper,
                        }}>
                        {renderDrawer(false, false)}
                    </Drawer>
                </Hidden>
                <Hidden smDown implementation="js">
                    <Drawer
                        classes={{
                            paper: `${classes.drawerPaper} ${collapsed ? classes.drawerPaperCollapsed : ''}`,
                        }}
                        variant="permanent"
                        open>
                        {renderDrawer(collapsed, true)}
                    </Drawer>
                </Hidden>
            </nav>
            <main className={classes.content}>
                <div className={classes.toolbar} />
                <ConnectionBanner />
                {children}
            </main>
        </div>
    );
};

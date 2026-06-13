import { useCallback, useEffect, useState } from "react";

import {
    CheckCircle as CheckCircleIcon,
    Delete as DeleteIcon,
    Laptop as LaptopIcon,
    Link as LinkIcon,
    Person as PersonIcon,
    PhoneAndroid as PhoneAndroidIcon,
    Security as SecurityIcon,
    Warning as WarningIcon,
} from "@mui/icons-material";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Paper,
    Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { useAutheliaState } from "@hooks/State";
import { ActiveSession, getActiveSessions, revokeActiveSession } from "@services/ActiveSessions";
import { AuthenticationLevel } from "@services/State";

const parseUserAgent = (ua: string) => {
    const uaLower = ua.toLowerCase();
    let browser = "Unknown Browser";
    let os = "Unknown OS";

    if (uaLower.includes("windows")) {
        os = "Windows";
    } else if (uaLower.includes("macintosh") || uaLower.includes("mac os x")) {
        os = "macOS";
    } else if (uaLower.includes("iphone") || uaLower.includes("ipad")) {
        os = "iOS";
    } else if (uaLower.includes("android")) {
        os = "Android";
    } else if (uaLower.includes("linux")) {
        os = "Linux";
    }

    if (uaLower.includes("chrome") || uaLower.includes("crios")) {
        browser = "Chrome";
    } else if (uaLower.includes("firefox") || uaLower.includes("fxios")) {
        browser = "Firefox";
    } else if (uaLower.includes("safari") && !uaLower.includes("chrome")) {
        browser = "Safari";
    } else if (uaLower.includes("edge") || uaLower.includes("edg")) {
        browser = "Edge";
    }

    return { browser, os };
};

const SettingsView = function () {
    const { t: translate } = useTranslation("settings");
    const [state, fetchState, loading, fetchStateError] = useAutheliaState();
    const [sessions, setSessions] = useState<ActiveSession[]>([]);
    const [sessionsError, setSessionsError] = useState<Error | null>(null);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    const fetchSessions = useCallback(async () => {
        setSessionsLoading(true);
        try {
            const data = await getActiveSessions();
            setSessions(data);
            setSessionsError(null);
        } catch (err: any) {
            setSessionsError(err);
        } finally {
            setSessionsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchState();
        fetchSessions();
    }, [fetchState, fetchSessions]);

    const handleRevoke = async (id: string) => {
        try {
            await revokeActiveSession(id);
            await fetchSessions();
        } catch (err) {
            console.error("Failed to revoke session", err);
        }
    };

    if (loading) {
        return (
            <Paper variant={"outlined"}>
                <Box sx={{ alignItems: "center", display: "flex", justifyContent: "center", p: 6 }}>
                    <CircularProgress />
                </Box>
            </Paper>
        );
    }

    if (fetchStateError) {
        return (
            <Paper variant={"outlined"}>
                <Box sx={{ p: 3, textAlign: "center" }}>
                    <Typography color="error" variant="h6">
                        {translate("Failed to load session details")}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" mt={1}>
                        {fetchStateError.message}
                    </Typography>
                </Box>
            </Paper>
        );
    }

    if (!state) {
        return (
            <Paper variant={"outlined"}>
                <Box sx={{ p: 3, textAlign: "center" }}>
                    <Typography>{translate("No active session found")}</Typography>
                </Box>
            </Paper>
        );
    }

    const authLevelString =
        state.authentication_level === AuthenticationLevel.TwoFactor
            ? translate("Two-Factor (2FA)")
            : state.authentication_level === AuthenticationLevel.OneFactor
              ? translate("Single-Factor (1FA)")
              : translate("Unauthenticated");

    return (
        <Paper variant={"outlined"}>
            <Box sx={{ p: 4 }}>
                <Typography variant={"h4"} textAlign={"center"} mb={2}>
                    {translate("Sitzungsdetails")}
                </Typography>
                <Typography variant={"body1"} textAlign={"center"} color="textSecondary" mb={4}>
                    {translate(
                        "Willkommen zurück, {{username}}! Hier sind die Details Ihrer aktuellen Authelia-Sitzung.",
                        { username: state.username },
                    )}
                </Typography>

                <Divider sx={{ my: 3 }} />

                <Grid container spacing={3}>
                    <Grid size={{ md: 6, xs: 12 }}>
                        <List>
                            <ListItem>
                                <ListItemIcon>
                                    <PersonIcon color="primary" />
                                </ListItemIcon>
                                <ListItemText primary={translate("Benutzername")} secondary={state.username} />
                            </ListItem>
                            <ListItem>
                                <ListItemIcon>
                                    <SecurityIcon color="primary" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={translate("Sicherheitsstufe")}
                                    secondary={
                                        <Box display="flex" alignItems="center" mt={0.5}>
                                            <Typography variant="body2" sx={{ mr: 1 }}>
                                                {authLevelString}
                                            </Typography>
                                            {state.authentication_level === AuthenticationLevel.TwoFactor ? (
                                                <Chip
                                                    size="small"
                                                    label={translate("Gesichert")}
                                                    color="success"
                                                    icon={<CheckCircleIcon />}
                                                />
                                            ) : (
                                                <Chip
                                                    size="small"
                                                    label={translate("1FA Aktiv")}
                                                    color="warning"
                                                    icon={<WarningIcon />}
                                                />
                                            )}
                                        </Box>
                                    }
                                />
                            </ListItem>
                        </List>
                    </Grid>

                    <Grid size={{ md: 6, xs: 12 }}>
                        <List>
                            <ListItem>
                                <ListItemIcon>
                                    <LinkIcon color="primary" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={translate("Standardweiterleitung")}
                                    secondary={state.default_redirection_url || translate("Keine konfiguriert")}
                                />
                            </ListItem>
                        </List>
                    </Grid>
                </Grid>

                <Divider sx={{ my: 4 }} />

                <Typography variant={"h5"} mb={3}>
                    {translate("Aktive Sitzungen ({{count}})", { count: sessions.length })}
                </Typography>

                {sessionsLoading && sessions.length === 0 ? (
                    <Box display="flex" justifyContent="center" py={3}>
                        <CircularProgress size={24} />
                    </Box>
                ) : sessionsError ? (
                    <Typography color="error" variant="body2">
                        {translate("Fehler beim Laden der aktiven Sitzungen")}
                    </Typography>
                ) : (
                    <List>
                        {sessions.map((session) => {
                            const { browser, os } = parseUserAgent(session.user_agent);
                            const isMobile = os === "Android" || os === "iOS";
                            const formattedDate = new Date(session.last_activity).toLocaleString();

                            return (
                                <ListItem
                                    key={session.id}
                                    secondaryAction={
                                        session.current ? (
                                            <Chip
                                                size="small"
                                                label={translate("Diese Sitzung")}
                                                color="success"
                                                variant="outlined"
                                            />
                                        ) : (
                                            <Button
                                                size="small"
                                                color="error"
                                                startIcon={<DeleteIcon />}
                                                onClick={() => handleRevoke(session.id)}
                                            >
                                                {translate("Beenden")}
                                            </Button>
                                        )
                                    }
                                >
                                    <ListItemIcon>
                                        {isMobile ? <PhoneAndroidIcon color="action" /> : <LaptopIcon color="action" />}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={`${browser} on ${os}`}
                                        secondary={`${session.ip_address} • Letzte Aktivität: ${formattedDate}`}
                                    />
                                </ListItem>
                            );
                        })}
                    </List>
                )}
            </Box>
        </Paper>
    );
};

export default SettingsView;

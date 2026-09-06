import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    AlertTriangle,
    CheckCircle2,
    Laptop,
    Link as LinkIcon,
    ShieldCheck,
    Smartphone,
    Trash2,
    User,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@components/UI/Alert";
import { Button } from "@components/UI/Button";
import { Card, CardContent } from "@components/UI/Card";
import { Separator } from "@components/UI/Separator";
import { Spinner } from "@components/UI/Spinner";
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
            <Card>
                <CardContent className="flex items-center justify-center p-6 min-h-[200px]">
                    <Spinner size={32} />
                </CardContent>
            </Card>
        );
    }

    if (fetchStateError) {
        return (
            <Card>
                <CardContent className="p-6">
                    <Alert variant="destructive">
                        <AlertTitle>{translate("Failed to load session details")}</AlertTitle>
                        <AlertDescription>{fetchStateError.message}</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (!state) {
        return (
            <Card>
                <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">{translate("No active session found")}</p>
                </CardContent>
            </Card>
        );
    }

    const authLevelString =
        state.authentication_level === AuthenticationLevel.TwoFactor
            ? translate("Two-Factor (2FA)")
            : state.authentication_level === AuthenticationLevel.OneFactor
              ? translate("Single-Factor (1FA)")
              : translate("Unauthenticated");

    return (
        <Card>
            <CardContent className="p-6 space-y-6">
                <div className="text-center space-y-2">
                    <h4 className="text-2xl font-semibold tracking-tight">{translate("Sitzungsdetails")}</h4>
                    <p className="text-sm text-muted-foreground">
                        {translate(
                            "Willkommen zurück, {{username}}! Hier sind die Details Ihrer aktuellen Authelia-Sitzung.",
                            { username: state.username },
                        )}
                    </p>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                        <User className="size-5 text-primary mt-0.5" />
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">{translate("Benutzername")}</p>
                            <p className="text-sm font-semibold">{state.username}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                        <ShieldCheck className="size-5 text-primary mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">{translate("Sicherheitsstufe")}</p>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{authLevelString}</span>
                                {state.authentication_level === AuthenticationLevel.TwoFactor ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                        <CheckCircle2 className="size-3" />
                                        {translate("Gesichert")}
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                                        <AlertTriangle className="size-3" />
                                        {translate("1FA Aktiv")}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 md:col-span-2">
                        <LinkIcon className="size-5 text-primary mt-0.5" />
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">{translate("Standardweiterleitung")}</p>
                            <p className="text-sm font-medium">{state.default_redirection_url || translate("Keine konfiguriert")}</p>
                        </div>
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <h5 className="text-lg font-semibold tracking-tight">
                        {translate("Aktive Sitzungen ({{count}})", { count: sessions.length })}
                    </h5>

                    {sessionsLoading && sessions.length === 0 ? (
                        <div className="flex justify-center py-6">
                            <Spinner size={24} />
                        </div>
                    ) : sessionsError ? (
                        <p className="text-sm text-destructive">
                            {translate("Fehler beim Laden der aktiven Sitzungen")}
                        </p>
                    ) : (
                        <div className="divide-y rounded-lg border">
                            {sessions.map((session) => {
                                const { browser, os } = parseUserAgent(session.user_agent);
                                const isMobile = os === "Android" || os === "iOS";
                                const formattedDate = new Date(session.last_activity).toLocaleString();

                                return (
                                    <div
                                        key={session.id}
                                        className="flex items-center justify-between gap-4 p-4 hover:bg-muted/10 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
                                                {isMobile ? <Smartphone className="size-5" /> : <Laptop className="size-5" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{`${browser} on ${os}`}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {`${session.ip_address} • Letzte Aktivität: ${formattedDate}`}
                                                </p>
                                            </div>
                                        </div>

                                        <div>
                                            {session.current ? (
                                                <span className="inline-flex items-center rounded-full border border-green-600/30 bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                                                    {translate("Diese Sitzung")}
                                                </span>
                                            ) : (
                                                <Button
                                                    color="destructive"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleRevoke(session.id)}
                                                >
                                                    <Trash2 className="size-4" />
                                                    <span>{translate("Beenden")}</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default SettingsView;

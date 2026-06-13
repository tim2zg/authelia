import { DeleteWithOptionalResponse, Get } from "@services/Client";
import { getBasePath } from "@utils/BasePath";

const basePath = getBasePath();
export const ActiveSessionsPath = basePath + "/api/session/active";

export interface ActiveSession {
    created_at: string;
    current: boolean;
    id: string;
    ip_address: string;
    last_activity: string;
    user_agent: string;
}

export async function getActiveSessions(signal?: AbortSignal): Promise<ActiveSession[]> {
    return Get<ActiveSession[]>(ActiveSessionsPath, signal);
}

export async function revokeActiveSession(id: string, signal?: AbortSignal): Promise<void> {
    await DeleteWithOptionalResponse<void>(`${ActiveSessionsPath}/${id}`, undefined, signal);
}

package handlers

import (
	"time"

	"github.com/valyala/fasthttp"

	"github.com/authelia/authelia/v4/internal/middlewares"
	"github.com/authelia/authelia/v4/internal/session"
	"github.com/authelia/authelia/v4/internal/utils"
)

// ActiveSessionResponse represents an active session in the JSON API response.
type ActiveSessionResponse struct {
	ID           string    `json:"id"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	CreatedAt    time.Time `json:"created_at"`
	LastActivity time.Time `json:"last_activity"`
	Current      bool      `json:"current"`
}

// ActiveSessionsGET retrieves the list of active sessions for the currently logged in user.
func ActiveSessionsGET(ctx *middlewares.AutheliaCtx) {
	var (
		userSession session.UserSession
		err         error
	)
	if userSession, err = ctx.GetSession(); err != nil {
		ctx.Logger.WithError(err).Error("Error occurred retrieving user session")
		ctx.ReplyForbidden()
		return
	}

	if userSession.IsAnonymous() {
		ctx.ReplyForbidden()
		return
	}

	dbSessions, err := ctx.Providers.StorageProvider.LoadActiveSessionsByUsername(ctx, userSession.Username)
	if err != nil {
		ctx.Logger.WithError(err).Errorf("Error occurred retrieving active sessions from DB for user '%s'", userSession.Username)
		ctx.SetStatusCode(fasthttp.StatusInternalServerError)
		ctx.SetJSONError(messageOperationFailed)
		return
	}

	provider, err := ctx.GetSessionProvider()
	if err != nil {
		ctx.Logger.WithError(err).Error("Error occurred retrieving session provider")
		ctx.SetStatusCode(fasthttp.StatusInternalServerError)
		ctx.SetJSONError(messageOperationFailed)
		return
	}

	currentSessionID, errID := provider.GetSessionID(ctx.RequestCtx)
	var currentSessionHash string
	if errID == nil && currentSessionID != "" {
		currentSessionHash = utils.HashSHA256FromString(currentSessionID)
	}

	response := make([]ActiveSessionResponse, 0, len(dbSessions))
	for _, dbSess := range dbSessions {
		isCurrent := currentSessionHash != "" && dbSess.ID == currentSessionHash
		response = append(response, ActiveSessionResponse{
			ID:           dbSess.ID,
			IPAddress:    dbSess.IPAddress,
			UserAgent:    dbSess.UserAgent,
			CreatedAt:    dbSess.CreatedAt,
			LastActivity: dbSess.LastActivity,
			Current:      isCurrent,
		})
	}

	if err = ctx.SetJSONBody(response); err != nil {
		ctx.Logger.WithError(err).Error("Error occurred writing active sessions response")
	}
}

// ActiveSessionDELETE revokes a specific active session.
func ActiveSessionDELETE(ctx *middlewares.AutheliaCtx) {
	var (
		userSession session.UserSession
		err         error
	)
	if userSession, err = ctx.GetSession(); err != nil {
		ctx.Logger.WithError(err).Error("Error occurred retrieving user session")
		ctx.ReplyForbidden()
		return
	}

	if userSession.IsAnonymous() {
		ctx.ReplyForbidden()
		return
	}

	targetID := ctx.UserValue("id").(string)
	if targetID == "" {
		ctx.SetStatusCode(fasthttp.StatusBadRequest)
		ctx.SetJSONError(messageOperationFailed)
		return
	}

	dbSession, err := ctx.Providers.StorageProvider.LoadActiveSessionByID(ctx, targetID)
	if err != nil {
		ctx.Logger.WithError(err).Errorf("Error occurred checking active session '%s' owner", targetID)
		ctx.SetStatusCode(fasthttp.StatusInternalServerError)
		ctx.SetJSONError(messageOperationFailed)
		return
	}

	if dbSession == nil {
		ctx.ReplyOK() // Session not found, nothing to do
		return
	}

	if dbSession.Username != userSession.Username {
		ctx.Logger.Warnf("User '%s' attempted to revoke session '%s' belonging to user '%s'", userSession.Username, targetID, dbSession.Username)
		ctx.ReplyForbidden()
		return
	}

	if err = ctx.Providers.StorageProvider.DeleteActiveSessionByID(ctx, targetID); err != nil {
		ctx.Logger.WithError(err).Errorf("Error occurred deleting active session '%s' from DB", targetID)
		ctx.SetStatusCode(fasthttp.StatusInternalServerError)
		ctx.SetJSONError(messageOperationFailed)
		return
	}

	// If the user revoked their current session, we destroy the current session cookie
	provider, err := ctx.GetSessionProvider()
	if err == nil {
		currentSessionID, errID := provider.GetSessionID(ctx.RequestCtx)
		if errID == nil && currentSessionID != "" && targetID == utils.HashSHA256FromString(currentSessionID) {
			if err = provider.DestroySession(ctx.RequestCtx); err != nil {
				ctx.Logger.WithError(err).Error("Error occurred destroying current session after self-revocation")
			}
		}
	}

	ctx.ReplyOK()
}

package handlers

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/valyala/fasthttp"
	"go.uber.org/mock/gomock"

	"github.com/authelia/authelia/v4/internal/mocks"
	"github.com/authelia/authelia/v4/internal/model"
	"github.com/authelia/authelia/v4/internal/utils"
)

type HandlerActiveSessionsSuite struct {
	suite.Suite

	mock *mocks.MockAutheliaCtx
}

func (s *HandlerActiveSessionsSuite) SetupTest() {
	s.mock = mocks.NewMockAutheliaCtx(s.T())
}

func (s *HandlerActiveSessionsSuite) TearDownTest() {
	s.mock.Close()
}

func (s *HandlerActiveSessionsSuite) setAuthenticatedSession(username string) {
	userSession, err := s.mock.Ctx.GetSession()
	s.Require().NoError(err)
	userSession.Username = username
	userSession.AuthenticationMethodRefs.UsernameAndPassword = true
	s.Require().NoError(s.mock.Ctx.SaveSession(userSession))
}

func (s *HandlerActiveSessionsSuite) TestShouldForbidAnonymous() {
	ActiveSessionsGET(s.mock.Ctx)
	s.Assert().Equal(fasthttp.StatusForbidden, s.mock.Ctx.Response.StatusCode())
}

func (s *HandlerActiveSessionsSuite) TestShouldFilterRevokedExpiredAndDuplicateSessions() {
	s.setAuthenticatedSession("john")

	provider, err := s.mock.Ctx.GetSessionProvider()
	s.Assert().NoError(err)
	provider.Config.Inactivity = 5 * time.Minute
	currID, err := provider.GetSessionID(s.mock.Ctx.RequestCtx)
	s.Assert().NoError(err)
	currHash := utils.HashSHA256FromString(currID)

	now := time.Now()
	sessions := []model.ActiveSession{
		// Current active session
		{
			ID:           currHash,
			Username:     "john",
			IPAddress:    "192.168.1.50",
			UserAgent:    "Chrome on Windows",
			CreatedAt:    now.Add(-time.Hour),
			LastActivity: now,
			Revoked:      false,
		},
		// Older session from same device before restart (active recently, but duplicate device)
		{
			ID:           "old-dup-hash",
			Username:     "john",
			IPAddress:    "192.168.1.50",
			UserAgent:    "Chrome on Windows",
			CreatedAt:    now.Add(-20 * time.Minute),
			LastActivity: now.Add(-2 * time.Minute),
			Revoked:      false,
		},
		// Revoked session
		{
			ID:           "revoked-hash",
			Username:     "john",
			IPAddress:    "10.0.0.1",
			UserAgent:    "Safari on iOS",
			CreatedAt:    now.Add(-time.Hour),
			LastActivity: now.Add(-10 * time.Minute),
			Revoked:      true,
		},
		// Expired session (inactivity > 5 min, expiration > 1 hr)
		{
			ID:           "expired-hash",
			Username:     "john",
			IPAddress:    "10.0.0.2",
			UserAgent:    "Firefox on Linux",
			CreatedAt:    now.Add(-2 * time.Hour),
			LastActivity: now.Add(-30 * time.Minute),
			Revoked:      false,
		},
		// Valid other device session (active and unique)
		{
			ID:           "mobile-hash",
			Username:     "john",
			IPAddress:    "10.0.0.5",
			UserAgent:    "Safari on iPhone",
			CreatedAt:    now.Add(-10 * time.Minute),
			LastActivity: now.Add(-time.Minute),
			Revoked:      false,
		},
	}

	s.mock.StorageMock = mocks.NewMockStorage(s.mock.Ctrl)
	s.mock.Ctx.Providers.StorageProvider = s.mock.StorageMock

	s.mock.StorageMock.EXPECT().
		LoadActiveSessionByID(gomock.Any(), currHash).
		Return(&sessions[0], nil).
		AnyTimes()

	s.mock.StorageMock.EXPECT().
		LoadActiveSessionsByUsername(gomock.Any(), "john").
		Return(sessions, nil)

	s.mock.StorageMock.EXPECT().
		RevokeActiveSessionByID(gomock.Any(), "old-dup-hash").
		Return(nil)

	s.mock.StorageMock.EXPECT().
		RevokeActiveSessionByID(gomock.Any(), "expired-hash").
		Return(nil)

	ActiveSessionsGET(s.mock.Ctx)
	s.Assert().Equal(fasthttp.StatusOK, s.mock.Ctx.Response.StatusCode())

	var res struct {
		Status string                  `json:"status"`
		Data   []ActiveSessionResponse `json:"data"`
	}
	err = json.Unmarshal(s.mock.Ctx.Response.Body(), &res)
	s.Assert().NoError(err)

	// Should only have 2 sessions: current session and valid mobile session
	assert.Len(s.T(), res.Data, 2)
	assert.Equal(s.T(), currHash, res.Data[0].ID)
	assert.True(s.T(), res.Data[0].Current)
	assert.Equal(s.T(), "mobile-hash", res.Data[1].ID)
	assert.False(s.T(), res.Data[1].Current)
}

func (s *HandlerActiveSessionsSuite) TestShouldRevokeActiveSession() {
	s.setAuthenticatedSession("john")

	provider, err := s.mock.Ctx.GetSessionProvider()
	s.Assert().NoError(err)
	currID, err := provider.GetSessionID(s.mock.Ctx.RequestCtx)
	s.Assert().NoError(err)
	currHash := utils.HashSHA256FromString(currID)

	targetID := "target-session-hash"
	dbSess := &model.ActiveSession{
		ID:        targetID,
		Username:  "john",
		IPAddress: "1.2.3.4",
		UserAgent: "Test",
	}

	s.mock.Ctx.SetUserValue("id", targetID)

	s.mock.StorageMock = mocks.NewMockStorage(s.mock.Ctrl)
	s.mock.Ctx.Providers.StorageProvider = s.mock.StorageMock

	s.mock.StorageMock.EXPECT().
		LoadActiveSessionByID(gomock.Any(), currHash).
		Return(&model.ActiveSession{ID: currHash, Username: "john", Revoked: false, LastActivity: time.Now()}, nil).
		AnyTimes()

	s.mock.StorageMock.EXPECT().
		LoadActiveSessionByID(gomock.Any(), targetID).
		Return(dbSess, nil)

	s.mock.StorageMock.EXPECT().
		RevokeActiveSessionByID(gomock.Any(), targetID).
		Return(nil)

	ActiveSessionDELETE(s.mock.Ctx)
	s.Assert().Equal(fasthttp.StatusOK, s.mock.Ctx.Response.StatusCode())
}

func TestHandlerActiveSessionsSuite(t *testing.T) {
	suite.Run(t, new(HandlerActiveSessionsSuite))
}

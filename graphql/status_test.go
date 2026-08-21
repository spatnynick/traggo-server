package graphql

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/traggo/server/generated/gqlmodel"
	"github.com/traggo/server/model"
	"github.com/traggo/server/test"
	"github.com/traggo/server/test/fake"
)

func TestStatus_returnsOnlyRunningTimersOfUser(t *testing.T) {
	db := test.InMemoryDB(t)
	defer db.Close()

	user := db.User(5)
	running := user.RunningTimeSpan("2020-01-01T10:00:00Z")
	user.TimeSpan("2020-01-01T08:00:00Z", "2020-01-01T09:00:00Z") // finished, must be ignored
	db.User(6).RunningTimeSpan("2020-01-01T11:00:00Z")            // other user, must be ignored

	resolver := NewResolver(db.DB, 4, model.Version{Name: "1.2.3", BuildDate: "date", Commit: "abc"})

	before := time.Now()
	status, err := resolver.RootQuery().Status(fake.User(5))
	require.NoError(t, err)

	assert.Equal(t, &gqlmodel.Version{Name: "1.2.3", BuildDate: "date", Commit: "abc"}, status.Version)
	require.Len(t, status.RunningTimers, 1)
	assert.Equal(t, running.TimeSpan.ID, status.RunningTimers[0].ID)
	assert.False(t, time.Time(status.ServerTime).Before(before.Add(-time.Second)))
}

func TestStatus_noRunningTimers(t *testing.T) {
	db := test.InMemoryDB(t)
	defer db.Close()
	db.User(5)

	resolver := NewResolver(db.DB, 4, model.Version{Name: "1.2.3"})
	status, err := resolver.RootQuery().Status(fake.User(5))

	require.NoError(t, err)
	assert.Empty(t, status.RunningTimers)
}

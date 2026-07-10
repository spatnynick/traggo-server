package graphql

import (
	"context"
	"time"

	"github.com/traggo/server/dashboard"
	"github.com/traggo/server/setting"

	"github.com/jinzhu/copier"
	"github.com/jinzhu/gorm"
	"github.com/traggo/server/auth"
	"github.com/traggo/server/device"
	"github.com/traggo/server/generated/gqlmodel"
	"github.com/traggo/server/generated/gqlschema"
	"github.com/traggo/server/model"
	"github.com/traggo/server/statistics"
	"github.com/traggo/server/tag"
	"github.com/traggo/server/timespan"
	"github.com/traggo/server/user"
)

// NewResolver combines all resolvers to a resolver root.
func NewResolver(db *gorm.DB, passStrength int, version model.Version) gqlschema.ResolverRoot {
	return &resolver{
		ResolverForUser: user.ResolverForUser{
			DB:           db,
			PassStrength: passStrength,
		},
		ResolverForTag: tag.ResolverForTag{
			DB: db,
		},
		ResolverForDevice: device.ResolverForDevice{
			DB: db,
		},
		ResolverForTimeSpan: timespan.ResolverForTimeSpan{
			DB: db,
		},
		ResolverForStatistics: statistics.ResolverForStatistics{
			DB: db,
		},
		ResolverForSettings: setting.ResolverForSettings{
			DB: db,
		},
		ResolverForDashboard: dashboard.NewResolverForDashboard(db),
		version:              version,
	}
}

type resolver struct {
	user.ResolverForUser
	tag.ResolverForTag
	device.ResolverForDevice
	timespan.ResolverForTimeSpan
	statistics.ResolverForStatistics
	version model.Version
	setting.ResolverForSettings
	dashboard.ResolverForDashboard
}

func (r *resolver) RootMutation() gqlschema.RootMutationResolver {
	return r
}

func (r *resolver) RootQuery() gqlschema.RootQueryResolver {
	return r
}

func (r *resolver) Version(ctx context.Context) (*gqlmodel.Version, error) {
	gql := &gqlmodel.Version{}
	copier.Copy(gql, r.version)
	return gql, nil
}

// Status returns a lightweight snapshot of the current account's server-side
// state so the UI can detect a lost connection and reconcile stale timers.
func (r *resolver) Status(ctx context.Context) (*gqlmodel.Status, error) {
	user := auth.GetUser(ctx)

	var timeSpans []model.TimeSpan
	r.ResolverForTimeSpan.DB.
		Where("user_id = ?", user.ID).
		Where("end_user_time is null").
		Order("start_user_time DESC").
		Find(&timeSpans)

	running := []*gqlmodel.RunningTimer{}
	for _, span := range timeSpans {
		location := time.FixedZone("unknown", span.OffsetUTC)
		running = append(running, &gqlmodel.RunningTimer{
			ID:    span.ID,
			Start: model.Time(span.StartUTC.In(location)),
		})
	}

	version := &gqlmodel.Version{}
	copier.Copy(version, r.version)

	return &gqlmodel.Status{
		ServerTime:    model.Time(time.Now()),
		Version:       version,
		RunningTimers: running,
	}, nil
}

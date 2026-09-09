package timespan

import (
	"context"
	"errors"
	"strings"

	"github.com/jinzhu/gorm"
	"github.com/traggo/server/auth"
	"github.com/traggo/server/generated/gqlmodel"
	"github.com/traggo/server/model"
)

// TimeSpans returns all time spans for a user
func (r *ResolverForTimeSpan) TimeSpans(ctx context.Context, fromInclusive *model.Time, toInclusive *model.Time, cursor *gqlmodel.InputCursor, filter *string) (*gqlmodel.PagedTimeSpans, error) {
	user := auth.GetUser(ctx)
	cursor = normalize(cursor)

	if cursor.StartID == nil {
		var s model.TimeSpan
		if err := r.DB.Model(new(model.TimeSpan)).Select("max(id) as id").Find(&s).Error; err != nil {
			return nil, err
		}
		cursor.StartID = &s.ID
	}

	call, err := filteredTimeSpans(r.DB, user.ID, fromInclusive, toInclusive, filter)
	if err != nil {
		return nil, err
	}
	call = call.Preload("Tags").Order("start_user_time DESC").Limit(*cursor.PageSize)
	if cursor.Offset != nil && cursor.StartID != nil {
		call = call.Where("id <= ?", *cursor.StartID).Offset(*cursor.Offset)
	}

	var timeSpans []model.TimeSpan
	call.Find(&timeSpans)

	var result []*gqlmodel.TimeSpan
	for _, span := range timeSpans {
		result = append(result, timeSpanToExternal(span))
	}
	return &gqlmodel.PagedTimeSpans{
		TimeSpans: result,
		Cursor: &gqlmodel.Cursor{
			HasMore:  len(timeSpans) != 0 && *cursor.Offset%*cursor.PageSize == 0,
			Offset:   *cursor.Offset + len(timeSpans),
			StartID:  *cursor.StartID,
			PageSize: *cursor.PageSize},
	}, nil
}

// FilteredDuration returns the total tracked duration, in seconds, of every finished time span
// matching filter (same note/tag matching rules as TimeSpans), across all of the user's history.
func (r *ResolverForTimeSpan) FilteredDuration(ctx context.Context, filter *string) (float64, error) {
	user := auth.GetUser(ctx)
	call, err := filteredTimeSpans(r.DB, user.ID, nil, nil, filter)
	if err != nil {
		return 0, err
	}

	var sum struct{ Seconds float64 }
	err = call.Select(
		"COALESCE(SUM(round((julianday(end_user_time) - julianday(start_user_time)) * 86400, 0)), 0) as seconds",
	).Scan(&sum).Error
	return sum.Seconds, err
}

// filteredTimeSpans applies the user scoping, date range and note/tag filter shared by TimeSpans
// and FilteredDuration.
func filteredTimeSpans(db *gorm.DB, userID int, fromInclusive *model.Time, toInclusive *model.Time, filter *string) (*gorm.DB, error) {
	call := db.Model(&model.TimeSpan{}).Where("user_id = ?", userID).Not("end_user_time is NULL")

	if fromInclusive != nil {
		if toInclusive != nil {
			if fromInclusive.Time().After(toInclusive.Time()) {
				return nil, errors.New("fromInclusive must be before toInclusive")
			}

			call = call.Where("start_user_time <= ? AND end_user_time >= ?", toInclusive.OmitTimeZone(), fromInclusive.OmitTimeZone())
		} else {
			call = call.Where("start_user_time >= ? OR end_user_time >= ?", fromInclusive.OmitTimeZone(), fromInclusive.OmitTimeZone())
		}
	} else if toInclusive != nil {
		call = call.Where("end_user_time <= ? OR start_user_time <= ?", toInclusive.OmitTimeZone(), toInclusive.OmitTimeZone())
	}

	if filter != nil {
		// Each whitespace-separated term must match (AND); within a term, it may match the
		// note or any tag key/value (OR). So "AP2 SNC" finds a note containing both words.
		for _, term := range strings.Fields(strings.ToLower(*filter)) {
			like := "%" + term + "%"
			call = call.Where(
				"LOWER(note) LIKE ? OR EXISTS("+
					"SELECT 1 FROM time_span_tags tst WHERE tst.time_span_id = time_spans.id "+
					"AND (LOWER(tst.key) LIKE ? OR LOWER(tst.string_value) LIKE ?))",
				like, like, like)
		}
	}

	return call, nil
}

func normalize(cursor *gqlmodel.InputCursor) *gqlmodel.InputCursor {
	if cursor == nil {
		cursor = &gqlmodel.InputCursor{}
	}

	maxPageSize := 100
	if cursor.PageSize == nil || maxPageSize < *cursor.PageSize {
		cursor.PageSize = &maxPageSize
	}

	if cursor.Offset == nil {
		zero := 0
		cursor.Offset = &zero
	}

	return cursor
}

package timespan

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/traggo/server/model"
	"github.com/traggo/server/test"
	"github.com/traggo/server/test/fake"
)

func TestFilteredDuration(t *testing.T) {
	d := []struct {
		DB       []*model.TimeSpan
		Filter   *string
		Expected float64
	}{
		{
			// timeSpan1..3 are 10 minutes each, timeSpan4 is 60 minutes; runningTimeSpan (no end) excluded.
			DB:       []*model.TimeSpan{timeSpan1, timeSpan2, timeSpan3, timeSpan4, runningTimeSpan},
			Filter:   nil,
			Expected: 600 + 600 + 600 + 3600,
		},
		{
			// timeSpanNote has no "test" tag, so only timeSpan1 (10 minutes) matches.
			DB:       []*model.TimeSpan{timeSpan1, timeSpanNote},
			Filter:   s("test"),
			Expected: 600,
		},
		{
			DB:       []*model.TimeSpan{timeSpan1, timeSpanNote},
			Filter:   s("zzznomatch"),
			Expected: 0,
		},
		{
			// timeSpanOtherUser belongs to a different user and must not be counted.
			DB:       []*model.TimeSpan{timeSpan1, timeSpanOtherUser},
			Filter:   nil,
			Expected: 600,
		},
	}

	for i, testData := range d {
		t.Run(fmt.Sprintf("%d", i), func(t *testing.T) {
			db := test.InMemoryDB(t)
			db.User(5)
			db.User(2)
			defer db.Close()
			for _, entry := range testData.DB {
				db.Create(entry)
			}

			resolver := ResolverForTimeSpan{DB: db.DB}
			seconds, err := resolver.FilteredDuration(fake.User(5), testData.Filter)

			require.NoError(t, err)
			require.Equal(t, testData.Expected, seconds)
		})
	}
}

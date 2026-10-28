package exportmapping

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/traggo/server/generated/gqlmodel"
	"github.com/traggo/server/model"
	"github.com/traggo/server/tag"
	"github.com/traggo/server/test"
	"github.com/traggo/server/test/fake"
)

func input(project string, tags ...string) gqlmodel.InputExportMapping {
	inputTags := []*gqlmodel.InputTimeSpanTag{}
	for i := 0; i+1 < len(tags); i += 2 {
		inputTags = append(inputTags, &gqlmodel.InputTimeSpanTag{Key: tags[i], Value: tags[i+1]})
	}
	return gqlmodel.InputExportMapping{
		Tags:          inputTags,
		Client:        "Client",
		Project:       project,
		AutoBooking:   true,
		SubtotalGroup: "Pool",
	}
}

func setup(t *testing.T) (*test.Database, ResolverForExportMapping) {
	db := test.InMemoryDB(t)
	user := db.User(1)
	user.NewTagDefinition("c")
	user.NewTagDefinition("s")
	db.User(2).NewTagDefinition("c")
	return db, ResolverForExportMapping{DB: db.DB}
}

func TestCreateExportMapping_succeeds(t *testing.T) {
	db, resolver := setup(t)
	defer db.Close()

	mapping, err := resolver.CreateExportMapping(fake.User(1), input(" Project A ", "c", "acme", "S", "x"))
	require.Nil(t, err)
	require.Equal(t, &gqlmodel.ExportMapping{
		ID:            1,
		Tags:          []*gqlmodel.TimeSpanTag{{Key: "c", Value: "acme"}, {Key: "s", Value: "x"}},
		Client:        "Client",
		Project:       "Project A",
		AutoBooking:   true,
		SubtotalGroup: "Pool",
	}, mapping)

	mappings, err := resolver.ExportMappings(fake.User(1))
	require.Nil(t, err)
	require.Equal(t, []*gqlmodel.ExportMapping{mapping}, mappings)

	mappings, err = resolver.ExportMappings(fake.User(2))
	require.Nil(t, err)
	require.Empty(t, mappings)
}

func TestCreateExportMapping_fails_invalid(t *testing.T) {
	db, resolver := setup(t)
	defer db.Close()

	_, err := resolver.CreateExportMapping(fake.User(1), input("P"))
	require.EqualError(t, err, "at least one tag is required")
	_, err = resolver.CreateExportMapping(fake.User(1), input("", "c", "acme"))
	require.EqualError(t, err, "project must not be empty")
	_, err = resolver.CreateExportMapping(fake.User(1), input("P", "c", "acme", "c", "other"))
	require.EqualError(t, err, "tag 'c' is present multiple times")
	_, err = resolver.CreateExportMapping(fake.User(1), input("P", "c", ""))
	require.EqualError(t, err, "tag 'c' needs a value")
	_, err = resolver.CreateExportMapping(fake.User(2), input("P", "s", "x"))
	require.EqualError(t, err, "tag 's' does not exist")

	_, err = resolver.CreateExportMapping(fake.User(1), input("P", "c", "acme", "s", "x"))
	require.Nil(t, err)
	_, err = resolver.CreateExportMapping(fake.User(1), input("Q", "s", "x", "c", "acme"))
	require.EqualError(t, err, "a mapping for tags 'c:acme s:x' already exists")
}

func TestUpdateExportMapping(t *testing.T) {
	db, resolver := setup(t)
	defer db.Close()

	created, err := resolver.CreateExportMapping(fake.User(1), input("P", "c", "acme", "s", "x"))
	require.Nil(t, err)

	_, err = resolver.UpdateExportMapping(fake.User(2), created.ID, input("P", "c", "acme"))
	require.EqualError(t, err, "export mapping not found")

	// keeping its own tags is not a duplicate of itself
	changed := input("Renamed", "c", "acme")
	changed.MergeDaily = true
	changed.AutoBooking = false
	updated, err := resolver.UpdateExportMapping(fake.User(1), created.ID, changed)
	require.Nil(t, err)
	require.Equal(t, "Renamed", updated.Project)

	mappings, err := resolver.ExportMappings(fake.User(1))
	require.Nil(t, err)
	require.Equal(t, []*gqlmodel.ExportMapping{{
		ID:            created.ID,
		Tags:          []*gqlmodel.TimeSpanTag{{Key: "c", Value: "acme"}},
		Client:        "Client",
		Project:       "Renamed",
		MergeDaily:    true,
		SubtotalGroup: "Pool",
	}}, mappings)

	count := 0
	db.Model(new(model.ExportMappingTag)).Count(&count)
	require.Equal(t, 1, count)
}

func TestRemoveExportMapping(t *testing.T) {
	db, resolver := setup(t)
	defer db.Close()

	created, err := resolver.CreateExportMapping(fake.User(1), input("P", "c", "acme"))
	require.Nil(t, err)

	_, err = resolver.RemoveExportMapping(fake.User(2), created.ID)
	require.EqualError(t, err, "export mapping not found")

	removed, err := resolver.RemoveExportMapping(fake.User(1), created.ID)
	require.Nil(t, err)
	require.Equal(t, created, removed)

	mappings, err := resolver.ExportMappings(fake.User(1))
	require.Nil(t, err)
	require.Empty(t, mappings)
	count := 0
	db.Model(new(model.ExportMappingTag)).Count(&count)
	require.Equal(t, 0, count)
}

func TestTagChanges_keepMappingsConsistent(t *testing.T) {
	db, resolver := setup(t)
	defer db.Close()
	tags := tag.ResolverForTag{DB: db.DB}

	_, err := resolver.CreateExportMapping(fake.User(1), input("P", "c", "acme", "s", "x"))
	require.Nil(t, err)

	_, err = tags.RemoveTag(fake.User(1), "s")
	require.EqualError(t, err, "tag 's' is used in export mapping 'P', remove this reference before deleting the tag")

	newKey := "sub"
	_, err = tags.UpdateTag(fake.User(1), "s", &newKey, "red")
	require.Nil(t, err)

	mappings, err := resolver.ExportMappings(fake.User(1))
	require.Nil(t, err)
	require.Equal(t, []*gqlmodel.TimeSpanTag{{Key: "c", Value: "acme"}, {Key: "sub", Value: "x"}}, mappings[0].Tags)
}

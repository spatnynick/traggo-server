package exportmapping

import (
	"strings"

	"github.com/traggo/server/generated/gqlmodel"
	"github.com/traggo/server/model"
)

func toInternal(userID int, input gqlmodel.InputExportMapping) model.ExportMapping {
	tags := []model.ExportMappingTag{}
	for _, tag := range input.Tags {
		tags = append(tags, model.ExportMappingTag{
			Key:         strings.ToLower(strings.TrimSpace(tag.Key)),
			StringValue: strings.TrimSpace(tag.Value),
		})
	}
	return model.ExportMapping{
		UserID:        userID,
		Tags:          tags,
		Client:        strings.TrimSpace(input.Client),
		Project:       strings.TrimSpace(input.Project),
		AutoBooking:   input.AutoBooking,
		NoteReference: input.NoteReference,
		MergeDaily:    input.MergeDaily,
		SubtotalGroup: strings.TrimSpace(input.SubtotalGroup),
	}
}

func toExternal(mapping model.ExportMapping) *gqlmodel.ExportMapping {
	tags := []*gqlmodel.TimeSpanTag{}
	for _, tag := range mapping.Tags {
		tags = append(tags, &gqlmodel.TimeSpanTag{Key: tag.Key, Value: tag.StringValue})
	}
	return &gqlmodel.ExportMapping{
		ID:            mapping.ID,
		Tags:          tags,
		Client:        mapping.Client,
		Project:       mapping.Project,
		AutoBooking:   mapping.AutoBooking,
		NoteReference: mapping.NoteReference,
		MergeDaily:    mapping.MergeDaily,
		SubtotalGroup: mapping.SubtotalGroup,
	}
}

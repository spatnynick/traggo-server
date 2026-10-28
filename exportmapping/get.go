package exportmapping

import (
	"context"

	"github.com/traggo/server/auth"
	"github.com/traggo/server/generated/gqlmodel"
	"github.com/traggo/server/model"
)

// ExportMappings returns all export mappings of the current user.
func (r *ResolverForExportMapping) ExportMappings(ctx context.Context) ([]*gqlmodel.ExportMapping, error) {
	var mappings []model.ExportMapping
	find := r.DB.Preload("Tags").Where("user_id = ?", auth.GetUser(ctx).ID).Order("client, project, id").Find(&mappings)
	result := []*gqlmodel.ExportMapping{}
	for _, mapping := range mappings {
		result = append(result, toExternal(mapping))
	}
	return result, find.Error
}

package exportmapping

import (
	"context"

	"github.com/traggo/server/auth"
	"github.com/traggo/server/generated/gqlmodel"
)

// CreateExportMapping creates an export mapping.
func (r *ResolverForExportMapping) CreateExportMapping(ctx context.Context, input gqlmodel.InputExportMapping) (*gqlmodel.ExportMapping, error) {
	mapping := toInternal(auth.GetUser(ctx).ID, input)
	if err := validate(r.DB, mapping); err != nil {
		return nil, err
	}
	create := r.DB.Create(&mapping)
	return toExternal(mapping), create.Error
}

package exportmapping

import (
	"context"
	"errors"

	"github.com/traggo/server/auth"
	"github.com/traggo/server/generated/gqlmodel"
	"github.com/traggo/server/model"
)

// UpdateExportMapping updates an export mapping.
func (r *ResolverForExportMapping) UpdateExportMapping(ctx context.Context, id int, input gqlmodel.InputExportMapping) (*gqlmodel.ExportMapping, error) {
	userID := auth.GetUser(ctx).ID
	if r.DB.Where("user_id = ?", userID).Find(new(model.ExportMapping), id).RecordNotFound() {
		return nil, errors.New("export mapping not found")
	}

	mapping := toInternal(userID, input)
	mapping.ID = id
	if err := validate(r.DB, mapping); err != nil {
		return nil, err
	}

	tx := r.DB.Begin()
	if err := tx.Where("export_mapping_id = ?", id).Delete(new(model.ExportMappingTag)).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Save(&mapping).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	update := tx.Commit()
	return toExternal(mapping), update.Error
}

package exportmapping

import (
	"context"
	"errors"

	"github.com/traggo/server/auth"
	"github.com/traggo/server/generated/gqlmodel"
	"github.com/traggo/server/model"
)

// RemoveExportMapping removes an export mapping.
func (r *ResolverForExportMapping) RemoveExportMapping(ctx context.Context, id int) (*gqlmodel.ExportMapping, error) {
	mapping := model.ExportMapping{}
	if r.DB.Preload("Tags").Where("user_id = ?", auth.GetUser(ctx).ID).Find(&mapping, id).RecordNotFound() {
		return nil, errors.New("export mapping not found")
	}

	tx := r.DB.Begin()
	if err := tx.Where("export_mapping_id = ?", id).Delete(new(model.ExportMappingTag)).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Delete(&model.ExportMapping{}, id).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	remove := tx.Commit()
	return toExternal(mapping), remove.Error
}

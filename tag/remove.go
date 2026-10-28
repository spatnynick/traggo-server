package tag

import (
	"context"
	"fmt"

	"github.com/jinzhu/copier"
	"github.com/traggo/server/auth"
	"github.com/traggo/server/generated/gqlmodel"
	"github.com/traggo/server/model"
)

// RemoveTag removes a tag.
func (r *ResolverForTag) RemoveTag(ctx context.Context, key string) (*gqlmodel.TagDefinition, error) {
	tag := model.TagDefinition{}
	userID := auth.GetUser(ctx).ID
	if r.DB.Where(&model.TagDefinition{UserID: userID, Key: key}).Find(&tag).RecordNotFound() {
		return nil, fmt.Errorf("tag with key '%s' does not exist", key)
	}

	usedInEntries := []model.DashboardEntry{}
	if err := r.DB.
		Joins("INNER JOIN dashboards ON dashboard_entries.dashboard_id = dashboards.id").
		Where("dashboards.user_id = ?", userID).
		Where("keys LIKE ? OR keys LIKE ? OR keys LIKE ?", "%"+key, "%"+key+"%", key+"%").
		Find(&usedInEntries).Error; err != nil {
		return nil, err
	}

	if len(usedInEntries) > 0 {
		dashboard := &model.Dashboard{ID: usedInEntries[0].DashboardID}
		r.DB.Find(dashboard)
		return nil, fmt.Errorf("tag '%s' is used in dashboard '%s' entry '%s', remove this reference before deleting the tag", key, dashboard.Name, usedInEntries[0].Title)
	}

	usedInMappings := []model.ExportMapping{}
	if err := r.DB.
		Joins("INNER JOIN export_mapping_tags ON export_mapping_tags.export_mapping_id = export_mappings.id").
		Where("export_mappings.user_id = ?", userID).
		Where("export_mapping_tags.key = ?", key).
		Find(&usedInMappings).Error; err != nil {
		return nil, err
	}

	if len(usedInMappings) > 0 {
		return nil, fmt.Errorf("tag '%s' is used in export mapping '%s', remove this reference before deleting the tag", key, usedInMappings[0].Project)
	}

	tx := r.DB.Begin()
	if err := tx.Where(model.TagDefinition{Key: key, UserID: userID}).
		Delete(new(model.TagDefinition)).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	timeSpansIdsOfUser := tx.Model(new(model.TimeSpan)).
		Select("id").
		Where(&model.TimeSpan{UserID: userID}).
		SubQuery()

	if err := tx.
		Where("time_span_id in ?", timeSpansIdsOfUser).
		Where(&model.TimeSpanTag{Key: key}).
		Delete(new(model.TimeSpanTag)).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	remove := tx.Commit()
	gqlTag := &gqlmodel.TagDefinition{}
	copier.Copy(gqlTag, &tag)
	return gqlTag, remove.Error
}

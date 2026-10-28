package exportmapping

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/jinzhu/gorm"
	"github.com/traggo/server/model"
)

// tagSignature returns the tags as a sorted "key:value" list, so two mappings
// with the same tags in a different order are recognized as equal.
func tagSignature(tags []model.ExportMappingTag) string {
	parts := []string{}
	for _, tag := range tags {
		parts = append(parts, tag.Key+":"+tag.StringValue)
	}
	sort.Strings(parts)
	return strings.Join(parts, " ")
}

func validate(db *gorm.DB, mapping model.ExportMapping) error {
	if len(mapping.Tags) == 0 {
		return errors.New("at least one tag is required")
	}
	if mapping.Project == "" {
		return errors.New("project must not be empty")
	}

	keys := make(map[string]struct{})
	for _, tag := range mapping.Tags {
		if _, ok := keys[tag.Key]; ok {
			return fmt.Errorf("tag '%s' is present multiple times", tag.Key)
		}
		if tag.StringValue == "" {
			return fmt.Errorf("tag '%s' needs a value", tag.Key)
		}
		if db.Where("key = ?", tag.Key).Where("user_id = ?", mapping.UserID).Find(new(model.TagDefinition)).RecordNotFound() {
			return fmt.Errorf("tag '%s' does not exist", tag.Key)
		}
		keys[tag.Key] = struct{}{}
	}

	existing := []model.ExportMapping{}
	if err := db.Preload("Tags").Where("user_id = ?", mapping.UserID).Where("id != ?", mapping.ID).Find(&existing).Error; err != nil {
		return err
	}
	signature := tagSignature(mapping.Tags)
	for _, other := range existing {
		if tagSignature(other.Tags) == signature {
			return fmt.Errorf("a mapping for tags '%s' already exists", signature)
		}
	}
	return nil
}

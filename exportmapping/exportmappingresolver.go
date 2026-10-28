package exportmapping

import (
	"sync"

	"github.com/jinzhu/gorm"
)

// ResolverForExportMapping resolves export mapping specific things.
type ResolverForExportMapping struct {
	DB *gorm.DB
	// Export configures the export command that can be run from the UI.
	Export ExportConfig
	// running guards against concurrent runs of the export command.
	running *sync.Mutex
}

// ExportConfig describes the external export command.
type ExportConfig struct {
	// Command is the executable to run; empty disables running exports.
	Command string
	// Database is passed to the command (TRAGGO_EXPORT_DB) when it is a sqlite file.
	Database string
}

// NewResolverForExportMapping creates a new resolver.
func NewResolverForExportMapping(db *gorm.DB, export ExportConfig) ResolverForExportMapping {
	return ResolverForExportMapping{DB: db, Export: export, running: &sync.Mutex{}}
}

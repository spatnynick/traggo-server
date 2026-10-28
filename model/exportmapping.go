package model

import "time"

// ExportMapping maps a combination of tags to the values an external export
// script writes, e.g. a client/project name in a spreadsheet or booking system.
type ExportMapping struct {
	ID            int `gorm:"primary_key;unique_index;AUTO_INCREMENT"`
	UserID        int `gorm:"type:int REFERENCES users(id) ON DELETE CASCADE"`
	Tags          []ExportMappingTag
	Client        string
	Project       string
	AutoBooking   bool
	NoteReference bool
	MergeDaily    bool
	SubtotalGroup string
}

// ExportMappingTag is a tag an entry must have to match an export mapping.
type ExportMappingTag struct {
	ExportMappingID int `gorm:"type:int REFERENCES export_mappings(id) ON DELETE CASCADE"`
	Key             string
	StringValue     string
}

// ExportRun is one run of the external export command, kept as history.
type ExportRun struct {
	ID         int `gorm:"primary_key;unique_index;AUTO_INCREMENT"`
	UserID     int `gorm:"type:int REFERENCES users(id) ON DELETE CASCADE"`
	StartedAt  time.Time
	DurationMs int
	Month      string
	From       string
	To         string
	Mode       string
	DryRun     bool
	ExitCode   int
	Log        string
	// Files are the paths the command reported, one per line.
	Files string
}

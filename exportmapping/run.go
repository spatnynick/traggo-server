package exportmapping

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/traggo/server/auth"
	"github.com/traggo/server/generated/gqlmodel"
	"github.com/traggo/server/model"
)

const (
	exportTimeout      = 5 * time.Minute
	exportFilePrefix   = "TRAGGO-EXPORT-FILE:"
	exportExistsPrefix = "TRAGGO-EXPORT-EXISTS:"
	maxExportFileSize  = 20 << 20
	maxExportLogSize   = 256 << 10
	keptExportRuns     = 100
)

var (
	monthPattern = regexp.MustCompile(`^\d{6}$`)
	dayPattern   = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	timeNow      = time.Now
)

// ExportRunAvailable returns whether an export command is configured.
func (r *ResolverForExportMapping) ExportRunAvailable(ctx context.Context) (bool, error) {
	return r.Export.Command != "", nil
}

// RunExport runs the configured export command and stores the run in the history.
// When the command reports that its output folder exists, nothing is stored and the
// folder is returned so the user can decide.
func (r *ResolverForExportMapping) RunExport(ctx context.Context, input gqlmodel.InputExportRun) (*gqlmodel.ExportRunResult, error) {
	if r.Export.Command == "" {
		return nil, errors.New("no export command configured (TRAGGO_EXPORT_COMMAND)")
	}
	run := model.ExportRun{
		UserID: auth.GetUser(ctx).ID,
		Mode:   strings.ToLower(input.Mode.String()),
		DryRun: input.DryRun,
	}
	if input.Month != nil {
		run.Month = *input.Month
	}
	if input.From != nil {
		run.From = *input.From
	}
	if input.To != nil {
		run.To = *input.To
	}
	args, err := exportArgs(run)
	if err != nil {
		return nil, err
	}
	ifExists := input.IfExists
	if !ifExists.IsValid() {
		ifExists = gqlmodel.ExportIfExistsFail
	}
	args = append(args, "--if-exists="+strings.ToLower(ifExists.String()))
	if !r.running.TryLock() {
		return nil, errors.New("an export is already running")
	}
	defer r.running.Unlock()

	runCtx, cancel := context.WithTimeout(ctx, exportTimeout)
	defer cancel()
	cmd := exec.CommandContext(runCtx, r.Export.Command, args...)
	cmd.Env = append(os.Environ(), "TRAGGO_EXPORT_USER="+auth.GetUser(ctx).Name)
	if r.Export.Database != "" {
		cmd.Env = append(cmd.Env, "TRAGGO_EXPORT_DB="+r.Export.Database)
	}
	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output

	run.StartedAt = timeNow()
	if err := cmd.Run(); err != nil {
		var exitErr *exec.ExitError
		if !errors.As(err, &exitErr) {
			return nil, fmt.Errorf("cannot run export command: %s", err)
		}
		run.ExitCode = exitErr.ExitCode()
	}
	run.DurationMs = int(timeNow().Sub(run.StartedAt) / time.Millisecond)
	if runCtx.Err() == context.DeadlineExceeded {
		output.WriteString(fmt.Sprintf("\nexport command did not finish within %s and was stopped\n", exportTimeout))
	}

	if existing := reportedLines(output.String(), exportExistsPrefix); len(existing) > 0 {
		return &gqlmodel.ExportRunResult{ExistingFolder: &existing[0]}, nil
	}

	run.Files = strings.Join(reportedLines(output.String(), exportFilePrefix), "\n")
	run.Log = output.String()
	if len(run.Log) > maxExportLogSize {
		run.Log = "...\n" + run.Log[len(run.Log)-maxExportLogSize:]
	}
	if err := r.DB.Create(&run).Error; err != nil {
		return nil, err
	}
	r.pruneExportRuns(run.UserID)
	return &gqlmodel.ExportRunResult{Run: toExternalRun(run)}, nil
}

// DeleteExportRunFolder deletes the output folder of one of the user's export runs.
func (r *ResolverForExportMapping) DeleteExportRunFolder(ctx context.Context, runID int) (*gqlmodel.ExportRun, error) {
	run := model.ExportRun{}
	if r.DB.Where("user_id = ?", auth.GetUser(ctx).ID).Find(&run, runID).RecordNotFound() {
		return nil, errors.New("export run not found")
	}
	folder := runFolder(run)
	if folder == "" {
		return nil, errors.New("this export run has no output folder")
	}
	// the folder comes from the files the command reported; refuse anything that is
	// not an absolute, real directory well below the filesystem root
	if !filepath.IsAbs(folder) || len(strings.Split(strings.Trim(folder, "/"), "/")) < 3 {
		return nil, fmt.Errorf("refusing to delete %s", folder)
	}
	info, err := os.Lstat(folder)
	if err != nil {
		return nil, fmt.Errorf("folder %s does not exist anymore", folder)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("refusing to delete %s: not a directory", folder)
	}
	if err := os.RemoveAll(folder); err != nil {
		return nil, err
	}
	return toExternalRun(run), nil
}

// ExportRuns returns the export history of the current user, newest first.
func (r *ResolverForExportMapping) ExportRuns(ctx context.Context) ([]*gqlmodel.ExportRun, error) {
	var runs []model.ExportRun
	find := r.DB.Where("user_id = ?", auth.GetUser(ctx).ID).Order("started_at DESC, id DESC").Find(&runs)
	result := []*gqlmodel.ExportRun{}
	for _, run := range runs {
		result = append(result, toExternalRun(run))
	}
	return result, find.Error
}

// ExportRunFile returns the content of a file reported by one of the user's export runs.
func (r *ResolverForExportMapping) ExportRunFile(ctx context.Context, runID int, path string) (string, error) {
	run := model.ExportRun{}
	if r.DB.Where("user_id = ?", auth.GetUser(ctx).ID).Find(&run, runID).RecordNotFound() {
		return "", errors.New("export run not found")
	}
	reported := false
	for _, file := range splitFiles(run.Files) {
		reported = reported || file == path
	}
	if !reported {
		return "", errors.New("file was not reported by this export run")
	}
	info, err := os.Stat(path)
	if err != nil || !info.Mode().IsRegular() {
		return "", fmt.Errorf("file %s does not exist anymore", path)
	}
	if info.Size() > maxExportFileSize {
		return "", fmt.Errorf("file %s is too large", path)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(content), nil
}

func (r *ResolverForExportMapping) pruneExportRuns(userID int) {
	keep := r.DB.Model(new(model.ExportRun)).Select("id").Where("user_id = ?", userID).
		Order("started_at DESC, id DESC").Limit(keptExportRuns).SubQuery()
	r.DB.Where("user_id = ?", userID).Where("id NOT IN ?", keep).Delete(new(model.ExportRun))
}

func exportArgs(run model.ExportRun) ([]string, error) {
	args := []string{}
	switch {
	case run.Month != "":
		if !monthPattern.MatchString(run.Month) {
			return nil, errors.New("month must be YYYYMM")
		}
		args = append(args, run.Month)
	case run.From != "" && run.To != "":
		if !dayPattern.MatchString(run.From) || !dayPattern.MatchString(run.To) {
			return nil, errors.New("from and to must be YYYY-MM-DD")
		}
		args = append(args, run.From, run.To)
	case run.From != "" || run.To != "":
		return nil, errors.New("from and to must be given together")
	}
	args = append(args, "--mode", run.Mode)
	if run.DryRun {
		args = append(args, "--dry-run")
	}
	return args, nil
}

func reportedLines(output string, prefix string) []string {
	lines := []string{}
	scanner := bufio.NewScanner(strings.NewReader(output))
	scanner.Buffer(make([]byte, 64*1024), len(output)+1)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, prefix) {
			lines = append(lines, strings.TrimSpace(strings.TrimPrefix(line, prefix)))
		}
	}
	return lines
}

// runFolder is the folder of the first file a run reported.
func runFolder(run model.ExportRun) string {
	files := splitFiles(run.Files)
	if len(files) == 0 {
		return ""
	}
	return filepath.Dir(files[0])
}

func splitFiles(files string) []string {
	if files == "" {
		return []string{}
	}
	return strings.Split(files, "\n")
}

func toExternalRun(run model.ExportRun) *gqlmodel.ExportRun {
	folder := runFolder(run)
	folderExists := false
	if folder != "" {
		info, err := os.Lstat(folder)
		folderExists = err == nil && info.IsDir()
	}
	files := []*gqlmodel.ExportFile{}
	for _, path := range splitFiles(run.Files) {
		files = append(files, &gqlmodel.ExportFile{Name: filepath.Base(path), Path: path})
	}
	return &gqlmodel.ExportRun{
		ID:           run.ID,
		StartedAt:    model.Time(run.StartedAt),
		DurationMs:   run.DurationMs,
		Month:        run.Month,
		From:         run.From,
		To:           run.To,
		Mode:         gqlmodel.ExportMode(strings.ToUpper(run.Mode)),
		DryRun:       run.DryRun,
		ExitCode:     run.ExitCode,
		Log:          run.Log,
		Files:        files,
		Folder:       folder,
		FolderExists: folderExists,
	}
}

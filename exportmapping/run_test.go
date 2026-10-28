package exportmapping

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/traggo/server/generated/gqlmodel"
	"github.com/traggo/server/model"
	"github.com/traggo/server/test"
	"github.com/traggo/server/test/fake"
)

// fakeCommand writes a shell script that echoes its arguments and environment,
// writes out/result.ods (out-2 with --if-exists=counter when out exists) and reports it.
func fakeCommand(t *testing.T, exitCode string) (string, string) {
	dir := t.TempDir()
	result := filepath.Join(dir, "a", "b", "out", "result.ods")
	script := filepath.Join(dir, "export.sh")
	require.Nil(t, os.WriteFile(script, []byte(`#!/bin/sh
echo "args: $*"
echo "user: $TRAGGO_EXPORT_USER db: $TRAGGO_EXPORT_DB"
out=`+filepath.Dir(result)+`
case "$*" in
  *--if-exists=fail*) if [ -d "$out" ]; then echo "TRAGGO-EXPORT-EXISTS: $out"; exit 4; fi ;;
  *--if-exists=counter*) if [ -d "$out" ]; then out="$out-2"; fi ;;
esac
mkdir -p "$out"
printf 'ods-content' > "$out/result.ods"
echo "TRAGGO-EXPORT-FILE: $out/result.ods"
exit `+exitCode+`
`), 0o755))
	return script, result
}

func str(s string) *string {
	return &s
}

func TestRunExport_month_storesHistory(t *testing.T) {
	db := test.InMemoryDB(t)
	defer db.Close()
	db.User(1)
	db.User(2)
	timeNow = func() time.Time { return test.Time("2026-10-28T10:00:00Z") }
	defer func() { timeNow = time.Now }()
	script, result := fakeCommand(t, "0")
	resolver := NewResolverForExportMapping(db.DB, ExportConfig{Command: script, Database: "/data/traggo.db"})

	available, err := resolver.ExportRunAvailable(fake.User(1))
	require.Nil(t, err)
	require.True(t, available)

	result1, err := resolver.RunExport(fake.User(1), gqlmodel.InputExportRun{Month: str("202609"), Mode: gqlmodel.ExportModeOverview})
	require.Nil(t, err)
	run := result1.Run
	require.Equal(t, 0, run.ExitCode)
	require.Equal(t, "202609", run.Month)
	require.Equal(t, gqlmodel.ExportModeOverview, run.Mode)
	require.Contains(t, run.Log, "args: 202609 --mode overview --if-exists=fail\n")
	require.Contains(t, run.Log, "user: fake db: /data/traggo.db\n")
	require.Equal(t, []*gqlmodel.ExportFile{{Name: "result.ods", Path: result}}, run.Files)
	require.Equal(t, filepath.Dir(result), run.Folder)
	require.True(t, run.FolderExists)

	runs, err := resolver.ExportRuns(fake.User(1))
	require.Nil(t, err)
	require.Equal(t, []*gqlmodel.ExportRun{run}, runs)
	runs, err = resolver.ExportRuns(fake.User(2))
	require.Nil(t, err)
	require.Empty(t, runs)

	content, err := resolver.ExportRunFile(fake.User(1), run.ID, result)
	require.Nil(t, err)
	require.Equal(t, base64.StdEncoding.EncodeToString([]byte("ods-content")), content)

	_, err = resolver.ExportRunFile(fake.User(2), run.ID, result)
	require.EqualError(t, err, "export run not found")
	_, err = resolver.ExportRunFile(fake.User(1), run.ID, "/etc/passwd")
	require.EqualError(t, err, "file was not reported by this export run")
	require.Nil(t, os.Remove(result))
	_, err = resolver.ExportRunFile(fake.User(1), run.ID, result)
	require.EqualError(t, err, "file "+result+" does not exist anymore")
}

func TestRunExport_rangeDryRunAndExitCode(t *testing.T) {
	db := test.InMemoryDB(t)
	defer db.Close()
	db.User(1)
	script, _ := fakeCommand(t, "3")
	resolver := NewResolverForExportMapping(db.DB, ExportConfig{Command: script})

	result, err := resolver.RunExport(fake.User(1), gqlmodel.InputExportRun{
		From: str("2026-09-01"), To: str("2026-09-15"), Mode: gqlmodel.ExportModeFull, DryRun: true})
	require.Nil(t, err)
	run := result.Run
	require.Equal(t, 3, run.ExitCode)
	require.True(t, run.DryRun)
	require.Equal(t, "2026-09-01", run.From)
	require.Contains(t, run.Log, "args: 2026-09-01 2026-09-15 --mode full --dry-run --if-exists=fail\n")
	require.Contains(t, run.Log, "user: fake db: \n")
}

func TestRunExport_keepsOnlyNewestRuns(t *testing.T) {
	db := test.InMemoryDB(t)
	defer db.Close()
	db.User(1)
	for i := 0; i < keptExportRuns+5; i++ {
		db.Create(&model.ExportRun{UserID: 1, StartedAt: test.Time("2026-01-01T00:00:00Z").Add(time.Duration(i) * time.Hour), Mode: "full"})
	}
	script, _ := fakeCommand(t, "0")
	resolver := NewResolverForExportMapping(db.DB, ExportConfig{Command: script})
	result, err := resolver.RunExport(fake.User(1), gqlmodel.InputExportRun{Month: str("202609"), Mode: gqlmodel.ExportModeFull})
	require.Nil(t, err)

	runs, err := resolver.ExportRuns(fake.User(1))
	require.Nil(t, err)
	require.Len(t, runs, keptExportRuns)
	require.Equal(t, result.Run.ID, runs[0].ID)
}

func TestRunExport_fails(t *testing.T) {
	db := test.InMemoryDB(t)
	defer db.Close()
	db.User(1)

	resolver := NewResolverForExportMapping(db.DB, ExportConfig{})
	available, err := resolver.ExportRunAvailable(fake.User(1))
	require.Nil(t, err)
	require.False(t, available)
	_, err = resolver.RunExport(fake.User(1), gqlmodel.InputExportRun{Mode: gqlmodel.ExportModeFull})
	require.EqualError(t, err, "no export command configured (TRAGGO_EXPORT_COMMAND)")

	script, _ := fakeCommand(t, "0")
	resolver = NewResolverForExportMapping(db.DB, ExportConfig{Command: script})
	_, err = resolver.RunExport(fake.User(1), gqlmodel.InputExportRun{Month: str("2026-09; rm -rf /"), Mode: gqlmodel.ExportModeFull})
	require.EqualError(t, err, "month must be YYYYMM")
	_, err = resolver.RunExport(fake.User(1), gqlmodel.InputExportRun{From: str("2026-09-01"), To: str("--help"), Mode: gqlmodel.ExportModeFull})
	require.EqualError(t, err, "from and to must be YYYY-MM-DD")
	_, err = resolver.RunExport(fake.User(1), gqlmodel.InputExportRun{From: str("2026-09-01"), Mode: gqlmodel.ExportModeFull})
	require.EqualError(t, err, "from and to must be given together")

	resolver.running.Lock()
	_, err = resolver.RunExport(fake.User(1), gqlmodel.InputExportRun{Mode: gqlmodel.ExportModeFull})
	require.EqualError(t, err, "an export is already running")
	resolver.running.Unlock()

	resolver = NewResolverForExportMapping(db.DB, ExportConfig{Command: "/does/not/exist"})
	_, err = resolver.RunExport(fake.User(1), gqlmodel.InputExportRun{Mode: gqlmodel.ExportModeFull})
	require.Error(t, err)

	runs, err := resolver.ExportRuns(fake.User(1))
	require.Nil(t, err)
	require.Empty(t, runs)
}

func TestRunExport_existingFolder_askThenCounter(t *testing.T) {
	db := test.InMemoryDB(t)
	defer db.Close()
	db.User(1)
	script, result := fakeCommand(t, "0")
	resolver := NewResolverForExportMapping(db.DB, ExportConfig{Command: script})
	input := gqlmodel.InputExportRun{Month: str("202609"), Mode: gqlmodel.ExportModeOverview, IfExists: gqlmodel.ExportIfExistsFail}

	first, err := resolver.RunExport(fake.User(1), input)
	require.Nil(t, err)
	require.NotNil(t, first.Run)

	second, err := resolver.RunExport(fake.User(1), input)
	require.Nil(t, err)
	require.Nil(t, second.Run)
	require.Equal(t, filepath.Dir(result), *second.ExistingFolder)
	runs, err := resolver.ExportRuns(fake.User(1))
	require.Nil(t, err)
	require.Len(t, runs, 1)

	input.IfExists = gqlmodel.ExportIfExistsCounter
	third, err := resolver.RunExport(fake.User(1), input)
	require.Nil(t, err)
	require.Nil(t, third.ExistingFolder)
	require.Equal(t, filepath.Dir(result)+"-2", third.Run.Folder)
}

func TestDeleteExportRunFolder(t *testing.T) {
	db := test.InMemoryDB(t)
	defer db.Close()
	db.User(1)
	db.User(2)
	script, result := fakeCommand(t, "0")
	resolver := NewResolverForExportMapping(db.DB, ExportConfig{Command: script})
	created, err := resolver.RunExport(fake.User(1), gqlmodel.InputExportRun{Month: str("202609"), Mode: gqlmodel.ExportModeFull})
	require.Nil(t, err)

	_, err = resolver.DeleteExportRunFolder(fake.User(2), created.Run.ID)
	require.EqualError(t, err, "export run not found")

	deleted, err := resolver.DeleteExportRunFolder(fake.User(1), created.Run.ID)
	require.Nil(t, err)
	require.False(t, deleted.FolderExists)
	_, err = os.Stat(filepath.Dir(result))
	require.True(t, os.IsNotExist(err))
	_, err = os.Stat(filepath.Dir(filepath.Dir(result)))
	require.Nil(t, err)

	_, err = resolver.DeleteExportRunFolder(fake.User(1), created.Run.ID)
	require.EqualError(t, err, "folder "+filepath.Dir(result)+" does not exist anymore")

	dryRun := model.ExportRun{UserID: 1, Mode: "full", DryRun: true}
	db.Create(&dryRun)
	_, err = resolver.DeleteExportRunFolder(fake.User(1), dryRun.ID)
	require.EqualError(t, err, "this export run has no output folder")

	shallow := model.ExportRun{UserID: 1, Mode: "full", Files: "/tmp/result.ods"}
	db.Create(&shallow)
	_, err = resolver.DeleteExportRunFolder(fake.User(1), shallow.ID)
	require.EqualError(t, err, "refusing to delete /tmp")
}

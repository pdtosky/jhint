$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$NodePath = (Get-Command node).Source
$ScriptPath = Join-Path $ProjectRoot "tools\backup-supabase-state.mjs"
$TaskName = "JHINT Supabase Local Backup"

if (!(Test-Path -LiteralPath $ScriptPath)) {
  throw "Backup script was not found: $ScriptPath"
}

$action = New-ScheduledTaskAction `
  -Execute $NodePath `
  -Argument "`"$ScriptPath`" --retention-days=90" `
  -WorkingDirectory $ProjectRoot

$BackupTimes = @("08:00", "10:00", "12:00", "14:00", "16:00", "18:00")
$triggers = foreach ($time in $BackupTimes) {
  New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact($time, "HH:mm", $null))
}
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $triggers `
  -Settings $settings `
  -Description "Backs up JHINT Supabase app_state to this PC." `
  -Force | Out-Null

Write-Host "Registered task: $TaskName"
Write-Host "Backup folder: $(Join-Path $ProjectRoot 'backups\supabase')"
Write-Host "Schedule: 08:00, 10:00, 12:00, 14:00, 16:00, 18:00 every day"

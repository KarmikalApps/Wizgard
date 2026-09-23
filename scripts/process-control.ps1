param([ValidateSet('suspend','resume','metrics')][string]$Action,[string]$Payload)
$ErrorActionPreference='Stop'
$records=ConvertFrom-Json -InputObject ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)))
if($Action -eq 'metrics' -or $Action -eq 'suspend') {
  $table=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId)
  $ids=[Collections.Generic.HashSet[int]]::new()
  foreach($rootId in $records){[void]$ids.Add([int]$rootId)}
  do {$changed=$false;foreach($row in $table){if($ids.Contains([int]$row.ParentProcessId) -and $ids.Add([int]$row.ProcessId)){$changed=$true}}} while($changed)
  $found=@(foreach($processId in $ids){try{$p=Get-Process -Id $processId;[pscustomobject]@{pid=$processId;start=$p.StartTime.ToUniversalTime().Ticks.ToString();cpuSeconds=$p.TotalProcessorTime.TotalSeconds;rss=$p.WorkingSet64}}catch{}})
}
if($Action -eq 'metrics') {
  $gpu=$null
  try {
    $counters=@(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction Stop)
    $values=@($counters | Where-Object { $_.Name -match '^pid_(\d+)_' -and $ids.Contains([int]$Matches[1]) } | ForEach-Object {$_.UtilizationPercentage})
    if($counters.Count -gt 0){$gpu=[Math]::Min(100,($values | Measure-Object -Sum).Sum)}
  } catch {}
  [pscustomobject]@{processes=$found;gpuPercent=$gpu} | ConvertTo-Json -Depth 4 -Compress
  exit
}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WizgardProcessControl {
 [DllImport("kernel32.dll",SetLastError=true)] public static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
 [DllImport("ntdll.dll")] public static extern int NtSuspendProcess(IntPtr handle);
 [DllImport("ntdll.dll")] public static extern int NtResumeProcess(IntPtr handle);
}
'@
$targets=if($Action -eq 'suspend'){$found}else{$records}
$completed=[Collections.Generic.List[object]]::new()
try {
 foreach($item in $targets){
  try{$p=Get-Process -Id $item.pid -ErrorAction Stop}catch{continue}
  if($p.StartTime.ToUniversalTime().Ticks.ToString() -ne $item.start){continue}
  $handle=[WizgardProcessControl]::OpenProcess(0x0800,$false,[int]$item.pid)
  if($handle -eq [IntPtr]::Zero){throw "Cannot control the owned engine process."}
  try{$result=if($Action -eq 'suspend'){[WizgardProcessControl]::NtSuspendProcess($handle)}else{[WizgardProcessControl]::NtResumeProcess($handle)};if($result -ne 0){throw "Engine pause/resume failed ($result)."};$completed.Add($item)}finally{[void][WizgardProcessControl]::CloseHandle($handle)}
 }
} catch {
 if($Action -eq 'suspend'){foreach($item in $completed){$handle=[WizgardProcessControl]::OpenProcess(0x0800,$false,[int]$item.pid);if($handle -ne [IntPtr]::Zero){[void][WizgardProcessControl]::NtResumeProcess($handle);[void][WizgardProcessControl]::CloseHandle($handle)}}}
 throw
}
ConvertTo-Json -InputObject @($completed.ToArray()) -Depth 4 -Compress

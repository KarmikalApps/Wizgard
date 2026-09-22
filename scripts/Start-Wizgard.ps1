param([switch]$SkipBrowser)
$ErrorActionPreference = 'Stop'
$wizRoot = Split-Path -Parent $PSScriptRoot
$previous = $env:WIZGARD_NO_BROWSER
try {
    if ($SkipBrowser) { $env:WIZGARD_NO_BROWSER = '1' }
    & (Join-Path $wizRoot 'Run_WIN.cmd')
} finally { $env:WIZGARD_NO_BROWSER = $previous }

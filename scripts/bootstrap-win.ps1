$ErrorActionPreference = 'Stop'
$wizRoot = Split-Path -Parent $PSScriptRoot
$nodeDir = Join-Path $wizRoot 'runtime\node'
$archives = Join-Path $wizRoot 'runtime\archives'
$zipPath = Join-Path $archives 'node-v24.19.0-win-x64.zip'
$expected = '57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73'
try {
    [IO.Directory]::CreateDirectory($archives) | Out-Null
    [IO.Directory]::CreateDirectory($nodeDir) | Out-Null
    if (-not (Test-Path -LiteralPath $zipPath)) {
        Write-Host 'Downloading Node.js for Windows x64 (37 MB)...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $client = New-Object Net.WebClient
        try { $client.DownloadFile('https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip', $zipPath + '.part') }
        finally { $client.Dispose() }
        [IO.File]::Move($zipPath + '.part', $zipPath)
    }
    if ((Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLower() -ne $expected) { throw 'Node archive checksum failed. Remove runtime\archives\node-v24.19.0-win-x64.zip and run again.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        foreach ($entry in $zip.Entries) {
            $relative = ($entry.FullName -split '/', 2)[1]
            if (-not $relative) { continue }
            $target = [IO.Path]::GetFullPath((Join-Path $nodeDir $relative))
            if (-not $target.StartsWith([IO.Path]::GetFullPath($nodeDir) + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe Node archive path.' }
            if ($entry.FullName.EndsWith('/')) { [IO.Directory]::CreateDirectory($target) | Out-Null }
            else {
                [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
                [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
            }
        }
    } finally { $zip.Dispose() }
    Write-Host 'Node.js is ready.'
} catch { Write-Host ('Setup failed: ' + $_.Exception.Message); exit 1 }

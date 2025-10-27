# PowerShell script to download Phosphor web distribution files into this folder
# Run from the repository root (project folder) in PowerShell

$base = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/dist'
$files = @('phosphor.css')

md .\app\static\vendor\phosphor -Force | Out-Null

foreach ($f in $files) {
    $url = "$base/$f"
    $out = ".\app\static\vendor\phosphor\$f"
    Write-Host "Downloading $url -> $out"
    Invoke-WebRequest -Uri $url -OutFile $out
}

Write-Host "Done. Inspect phosphor.css for additional asset references and download them similarly."
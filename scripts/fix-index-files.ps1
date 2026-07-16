$root = "d:\sparta-agent\desktop"

# Check each module and list actual files
$modules = @(
    "ia-sparta-agents","ia-sparta-editor","ia-sparta-terminal",
    "ia-sparta-mcp","ia-sparta-memory","ia-sparta-permission",
    "ia-sparta-providers","ia-sparta-settings","ia-sparta-skills",
    "ia-sparta-channels","ia-sparta-shell-layout","ia-sparta-design-system",
    "ia-sparta-vault","ia-sparta-ipc-bridge","ia-sparta-chat-ipc",
    "ia-sparta-stream-events","ia-sparta-chat","ia-sparta-i18n",
    "ia-sparta-core","ia-sparta-app-shell","ia-sparta-projects"
)

foreach ($m in $modules) {
    $p = Join-Path $root $m "src"
    if (Test-Path $p) {
        Write-Host "=== $m ==="
        $files = Get-ChildItem $p -Recurse -File | Where-Object { $_.Name -ne "index.ts" }
        foreach ($f in $files) {
            $rel = $f.FullName.Substring($p.Length + 1)
            Write-Host "  $rel"
        }
        Write-Host ""
    }
}
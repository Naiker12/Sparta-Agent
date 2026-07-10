$root = "d:\sparta-agent\vendor\python-win32-x64"
$results = @()

Get-ChildItem $root -Recurse -Directory | ForEach-Object {
    $dir = $_.FullName
    $size = (Get-ChildItem $dir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    if ($size -gt 1MB) {
        $relative = $dir.Substring($root.Length + 1)
        $results += [PSCustomObject]@{
            Name = $relative
            SizeMB = [math]::Round($size/1MB, 1)
        }
    }
}

$results | Sort-Object SizeMB -Descending | Select-Object -First 30 | Format-Table Name, SizeMB -AutoSize
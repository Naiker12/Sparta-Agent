$size = (Get-ChildItem "d:\sparta-agent\vendor\python-win32-x64" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
$mb = [math]::Round($size/1MB, 1)
Write-Host "Python runtime remaining: $mb MB"
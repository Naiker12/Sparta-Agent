param(
    [Parameter(Mandatory = $true)][int]$RootProcessId,
    [ValidateRange(2, 600)][int]$Samples = 10,
    [ValidateRange(200, 10000)][int]$IntervalMs = 1000,
    [Parameter(Mandatory = $true)][string]$Scenario,
    [string]$OutputPath = 'output/performance/process-sample.json'
)
$ErrorActionPreference = 'Stop'
Get-Process -Id $RootProcessId -ErrorAction Stop | Out-Null
$logicalCores = [Environment]::ProcessorCount
$previous = @{}
$rows = [System.Collections.Generic.List[object]]::new()
for ($sample = 0; $sample -le $Samples; $sample++) {
    # Refresh descendants to include converters/backend children started mid-run.
    $inventory = @(Get-CimInstance Win32_Process)
    $selected = [System.Collections.Generic.HashSet[int]]::new()
    [void]$selected.Add($RootProcessId)
    do {
        $added = $false
        foreach ($item in $inventory) {
            if ($selected.Contains([int]$item.ParentProcessId)) {
                if ($selected.Add([int]$item.ProcessId)) { $added = $true }
            }
        }
    } while ($added)
    foreach ($processId in $selected) {
        $item = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($null -eq $item) { continue }
        $now = [Diagnostics.Stopwatch]::GetTimestamp() / [double][Diagnostics.Stopwatch]::Frequency
        $key = "$processId/$($item.StartTime.ToUniversalTime().Ticks)"
        $cpuSeconds = $item.TotalProcessorTime.TotalSeconds
        if ($previous.ContainsKey($key)) {
            $elapsed = $now - $previous[$key].time
            $cpuDelta = [Math]::Max(0, $cpuSeconds - $previous[$key].cpu)
            $rows.Add([pscustomobject]@{
                sample = $sample; processId = $processId; name = $item.ProcessName
                elapsedSeconds = $elapsed
                cpuPercentMachine = 100 * $cpuDelta / $elapsed / $logicalCores
                privateBytes = $item.PrivateMemorySize64
                workingSetBytes = $item.WorkingSet64
            })
        }
        $previous[$key] = @{ time = $now; cpu = $cpuSeconds }
    }
    if ($sample -lt $Samples) { Start-Sleep -Milliseconds $IntervalMs }
}
$report = [ordered]@{
    measuredAt = [DateTime]::UtcNow.ToString('o'); scenario = $Scenario
    rootProcessId = $RootProcessId; logicalCores = $logicalCores
    scope = 'Existing root process and current descendants; no restart, build or workload control'
    notes = @('CPU normalized to total logical processors.', 'Working sets may double-count shared pages.', 'Private bytes are committed private memory, not physical RAM.', 'New processes require two observations; exited processes are not sampled after exit.', 'Collector overhead is outside the selected process tree.')
    rows = $rows.ToArray()
}
$destination = [IO.Path]::GetFullPath($OutputPath)
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $destination -Encoding UTF8
Write-Output "Recorded $($rows.Count) process observations: $destination"

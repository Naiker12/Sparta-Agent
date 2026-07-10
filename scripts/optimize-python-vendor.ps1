# Optimiza el Python runtime embebido eliminando lo innecesario para distribución
$pythonDir = "d:\sparta-agent\vendor\python-win32-x64"

Write-Host "Optimizando Python runtime en: $pythonDir" -ForegroundColor Cyan

# Directorios a eliminar completamente
$toRemove = @(
    "Lib\idlelib",           # 1.1 MB - IDE integrado, no necesario
    "Lib\ensurepip",         # 1.8 MB - instalador de pip, no necesario en runtime
    "Lib\venv",              # 8.2 MB - creación de entornos virtuales
    "Lib\lib2to3",           # conversión Python 2->3
    "Lib\test",              # tests de Python
    "Lib\turtledemo",        # demo de turtle
    "tcl\tix8.4.3",          # 1.3 MB - extensión Tk, no necesaria
    "tcl\tk8.6\demos",       # demos de Tk
    "include",               # 1.2 MB - headers de C, no necesarios en runtime
    "Lib\site-packages\pip", # 10 MB - pip no necesario en runtime
    "Lib\__pycache__",       # 2.3 MB - bytecode cache (se regenera)
    "Lib\asyncio\__pycache__",
    "Lib\collections\__pycache__",
    "Lib\concurrent\__pycache__",
    "Lib\ctypes\__pycache__",
    "Lib\curses\__pycache__",
    "Lib\dbm\__pycache__",
    "Lib\email\__pycache__",
    "Lib\encodings\__pycache__",
    "Lib\html\__pycache__",
    "Lib\http\__pycache__",
    "Lib\importlib\__pycache__",
    "Lib\json\__pycache__",
    "Lib\logging\__pycache__",
    "Lib\multiprocessing\__pycache__",
    "Lib\re\__pycache__",
    "Lib\sqlite3\__pycache__",
    "Lib\tkinter\__pycache__",
    "Lib\tomllib\__pycache__",
    "Lib\unittest\__pycache__",
    "Lib\urllib\__pycache__",
    "Lib\wsgiref\__pycache__",
    "Lib\xml\__pycache__",
    "Lib\xmlrpc\__pycache__",
    "Lib\zipfile\__pycache__",
    "Lib\zoneinfo\__pycache__"
)

$totalSaved = 0

foreach ($relPath in $toRemove) {
    $fullPath = Join-Path $pythonDir $relPath
    if (Test-Path $fullPath) {
        $size = (Get-ChildItem $fullPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        Remove-Item -Path $fullPath -Recurse -Force -ErrorAction SilentlyContinue
        $sizeMB = [math]::Round($size/1MB, 1)
        $totalSaved += $size
        Write-Host "  Eliminado: $relPath ($sizeMB MB)" -ForegroundColor Yellow
    }
}

# Eliminar archivos .pyc sueltos en Lib
Get-ChildItem "$pythonDir\Lib" -Recurse -Filter "*.pyc" -ErrorAction SilentlyContinue | Remove-Item -Force

# Eliminar archivos .pyo
Get-ChildItem "$pythonDir\Lib" -Recurse -Filter "*.pyo" -ErrorAction SilentlyContinue | Remove-Item -Force

$totalSavedMB = [math]::Round($totalSaved/1MB, 1)
$remaining = (Get-ChildItem $pythonDir -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
$remainingMB = [math]::Round($remaining/1MB, 1)

Write-Host ""
Write-Host "Optimización completada!" -ForegroundColor Green
Write-Host "  Espacio liberado: $totalSavedMB MB" -ForegroundColor Green
Write-Host "  Tamaño restante: $remainingMB MB" -ForegroundColor Green
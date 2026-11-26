# Levanta todo IDD Music en local: base de datos del proyecto (.pgdata, puerto 5434), API y web.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\iniciar.ps1
$root = Split-Path -Parent $PSScriptRoot
$pgctl = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_ctl.exe' | Sort-Object FullName -Descending | Select-Object -First 1
& $pgctl.FullName -D "$root\.pgdata" status *> $null
if ($LASTEXITCODE -ne 0) { & $pgctl.FullName -D "$root\.pgdata" -l "$root\.pgdata\server.log" start }
Start-Process powershell -ArgumentList '-NoExit', '-Command', "npm --prefix '$root\backend' run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "npm --prefix '$root\frontend' run dev"
Start-Sleep -Seconds 4
Start-Process 'http://localhost:5173'

# Crea el usuario y la base de datos de IDD Music en el PostgreSQL local, aplica migraciones y carga datos demo.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\setup-db.ps1
# Te pedirá la contraseña del superusuario "postgres" (la que elegiste al instalar PostgreSQL).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root 'backend\.env'
$line = (Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', ''
if ($line -notmatch '^postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/(.+)$') { throw "No pude leer DATABASE_URL en $envFile" }
$dbUser = $Matches[1]; $dbPass = $Matches[2]; $dbHost = $Matches[3]; $dbPort = $Matches[4]; $dbName = $Matches[5]

$psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $psql) { throw 'No encontré psql.exe en C:\Program Files\PostgreSQL' }
Write-Host "PostgreSQL: $($psql.FullName)  ·  puerto $dbPort" -ForegroundColor Cyan
$secure = Read-Host -AsSecureString 'Contraseña del superusuario postgres'
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))

$sql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$dbUser') THEN CREATE ROLE $dbUser LOGIN PASSWORD '$dbPass';
  ELSE ALTER ROLE $dbUser LOGIN PASSWORD '$dbPass'; END IF;
END `$`$;
"@
& $psql.FullName -h $dbHost -p $dbPort -U postgres -d postgres -v ON_ERROR_STOP=1 -c $sql
if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el usuario (¿contraseña de postgres correcta?)' }
$exists = & $psql.FullName -h $dbHost -p $dbPort -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'"
if ($exists -ne '1') {
  & $psql.FullName -h $dbHost -p $dbPort -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbName OWNER $dbUser ENCODING 'UTF8' TEMPLATE template0"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base de datos' }
}
Write-Host "Base '$dbName' lista para el usuario '$dbUser'." -ForegroundColor Green

Remove-Item Env:PGPASSWORD
Push-Location (Join-Path $root 'backend')
try { npm run setup } finally { Pop-Location }

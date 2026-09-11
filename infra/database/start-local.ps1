$ErrorActionPreference = 'Stop'

$pgCtl = 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'
$dataDirectory = Join-Path $env:LOCALAPPDATA 'EstoqueInteligente\postgres-18\data'
$logPath = Join-Path $env:LOCALAPPDATA 'EstoqueInteligente\postgres-18\postgres.log'

if (-not (Test-Path -LiteralPath $pgCtl)) {
  throw 'PostgreSQL 18 não foi encontrado em C:\Program Files\PostgreSQL\18.'
}

if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'PG_VERSION'))) {
  throw 'A instância local ainda não foi inicializada.'
}

& $pgCtl -D $dataDirectory status *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host 'PostgreSQL do projeto ja esta ativo em 127.0.0.1:5433.'
  exit 0
}

$serverOptions = '-p 5433 -h 127.0.0.1'
& $pgCtl -D $dataDirectory -l $logPath -o $serverOptions -w start
if ($LASTEXITCODE -ne 0) {
  throw 'Não foi possível iniciar o PostgreSQL do projeto.'
}

Write-Host 'PostgreSQL do projeto iniciado em 127.0.0.1:5433.'

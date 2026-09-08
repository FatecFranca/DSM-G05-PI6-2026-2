$ErrorActionPreference = 'Stop'

$pgCtl = 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'
$dataDirectory = Join-Path $env:LOCALAPPDATA 'EstoqueInteligente\postgres-18\data'

if (-not (Test-Path -LiteralPath (Join-Path $dataDirectory 'PG_VERSION'))) {
  throw 'A instância local do projeto não foi encontrada.'
}

& $pgCtl -D $dataDirectory status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'PostgreSQL do projeto ja esta parado.'
  exit 0
}

& $pgCtl -D $dataDirectory -m fast -w stop
if ($LASTEXITCODE -ne 0) {
  throw 'Não foi possível parar o PostgreSQL do projeto.'
}

Write-Host 'PostgreSQL do projeto parado com seguranca.'

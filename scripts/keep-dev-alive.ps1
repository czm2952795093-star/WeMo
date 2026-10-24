# 衣刻WeMo dev 服务器守护脚本：崩溃后自动重启（Windows）
# 用法：powershell -ExecutionPolicy Bypass -File scripts/keep-dev-alive.ps1

$PROJECT_DIR = "C:\Users\29527\Desktop\衣刻WeMo"
$LOG  = Join-Path $env:TEMP "wemo-dev.log"
$ERR  = Join-Path $env:TEMP "wemo-dev.err.log"
$PORT = 3001

Set-Location $PROJECT_DIR

while ($true) {
    $up = $false
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:$PORT" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        $up = $true
    } catch {
        $up = $false
    }

    if (-not $up) {
        $time = Get-Date -Format "HH:mm:ss"
        Write-Host "[$time] server down, restarting..."

        # 结束残留的 dev 进程（命令行含 next dev 的 node.exe）
        Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -match "next\s+dev" } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

        Start-Sleep -Seconds 2

        # 后台重启 dev 服务器，输出写入日志
        Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev") `
            -WorkingDirectory $PROJECT_DIR `
            -RedirectStandardOutput $LOG `
            -RedirectStandardError $ERR `
            -WindowStyle Hidden
    }

    Start-Sleep -Seconds 10
}

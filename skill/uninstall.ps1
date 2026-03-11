# ============================================
# 鹰爪技能 - 卸载脚本
# ============================================

$ErrorActionPreference = "Stop"
$daemonPath = "D:\eagleclaw-daemon"
$taskName = "EagleClaw-Daemon"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          🦅 鹰爪技能 - 卸载程序                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 停止服务
Write-Host "[1/3] 停止服务..." -ForegroundColor Yellow

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "✅ 服务已停止并删除" -ForegroundColor Green
} else {
    Write-Host "⚠️  服务未找到" -ForegroundColor Yellow
}
Write-Host ""

# 删除 Daemon 目录
Write-Host "[2/3] 删除 Daemon 目录 ($daemonPath)..." -ForegroundColor Yellow

if (Test-Path $daemonPath) {
    Remove-Item $daemonPath -Recurse -Force
    Write-Host "✅ 目录已删除" -ForegroundColor Green
} else {
    Write-Host "⚠️  目录不存在" -ForegroundColor Yellow
}
Write-Host ""

# 清理 OpenClaw Skill
Write-Host "[3/3] 清理 OpenClaw 配置..." -ForegroundColor Yellow

$skillPath = "$env:USERPROFILE\.openclaw\skills\eagleclaw"
if (Test-Path $skillPath) {
    Remove-Item $skillPath -Recurse -Force
    Write-Host "✅ Skill 已卸载" -ForegroundColor Green
} else {
    Write-Host "⚠️  Skill 未找到" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              ✅ 卸载完成！                        ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

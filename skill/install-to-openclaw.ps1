# ============================================
# 🦅 鹰爪技能 - 安装到 OpenClaw
# ============================================
# 这才是真正的一键安装到 OpenClaw!
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     🦅 鹰爪技能 - 安装到 OpenClaw                ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  一键安装到 OpenClaw 技能目录                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# OpenClaw 技能目录
$openclawSkillsPath = "$env:USERPROFILE\.openclaw\skills\eagleclaw"
$sourcePath = "D:\projects\ainclaw\skill"

# 步骤 1: 检查 OpenClaw 目录
Write-Host "[1/4] 检查 OpenClaw 配置..." -ForegroundColor Yellow

if (-not (Test-Path "$env:USERPROFILE\.openclaw")) {
    Write-Host ""
    Write-Host "❌ 未找到 OpenClaw 配置目录" -ForegroundColor Red
    Write-Host "请先安装 OpenClaw:" -ForegroundColor Yellow
    Write-Host "  npm install -g openclaw" -ForegroundColor Gray
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "  ✅ OpenClaw 目录存在" -ForegroundColor Green
Write-Host ""

# 步骤 2: 创建技能目录
Write-Host "[2/4] 创建技能目录..." -ForegroundColor Yellow

if (Test-Path $openclawSkillsPath) {
    Write-Host "  ⚠️  目录已存在，删除旧版本..." -ForegroundColor Yellow
    Remove-Item $openclawSkillsPath -Recurse -Force
}

New-Item -ItemType Directory -Path $openclawSkillsPath -Force | Out-Null
Write-Host "  ✅ 目录已创建：$openclawSkillsPath" -ForegroundColor Green
Write-Host ""

# 步骤 3: 复制技能文件
Write-Host "[3/4] 复制技能文件..." -ForegroundColor Yellow

if (-not (Test-Path $sourcePath)) {
    Write-Host ""
    Write-Host "❌ 未找到技能源文件：$sourcePath" -ForegroundColor Red
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Copy-Item "$sourcePath\*" $openclawSkillsPath -Recurse -Force
Write-Host "  ✅ 已复制文件:" -ForegroundColor Green
Get-ChildItem $openclawSkillsPath | ForEach-Object {
    Write-Host "    - $($_.Name)" -ForegroundColor Gray
}
Write-Host ""

# 步骤 4: 重启 Gateway
Write-Host "[4/4] 重启 OpenClaw Gateway..." -ForegroundColor Yellow

Write-Host ""
Write-Host "  ⚠️  请手动执行以下命令重启 Gateway:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  openclaw gateway restart" -ForegroundColor Cyan
Write-Host ""
Write-Host "  或者在 OpenClaw 中执行：/gateway restart" -ForegroundColor Gray
Write-Host ""

# 完成信息
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         ✅ 鹰爪技能已安装到 OpenClaw!            ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  安装位置：$openclawSkillsPath" -ForegroundColor White
Write-Host "║                                                  ║" -ForegroundColor White
Write-Host "║  下一步：                                        ║" -ForegroundColor White
Write-Host "║  1. 重启 Gateway: openclaw gateway restart       ║" -ForegroundColor White
Write-Host "║  2. 在 OpenClaw 中使用：/skills list             ║" -ForegroundColor White
Write-Host "║  3. 鹰爪技能应该出现在列表中                     ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

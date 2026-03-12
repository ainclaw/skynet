# ============================================
# 🦅 鹰爪技能 - 一键安装脚本
# ============================================
# 自动完成：
# 1. 检查前置条件 (Node.js, Git)
# 2. 下载代码到 D:\eagleclaw-daemon\
# 3. 安装 npm 依赖
# 4. 生成 Ed25519 密钥对
# 5. 配置 .env 文件
# 6. 注册开机自启
# 7. 启动服务
# ============================================

$ErrorActionPreference = "Stop"

# 颜色配置
$Cyan = "#00d4ff"
$Green = "#00ff88"
$Yellow = "#ffe600"
$Red = "#ff4444"

# 路径配置
$daemonPath = "D:\eagleclaw-daemon"
$repoUrl = "https://github.com/ainclaw/ainclaw.git"
$taskName = "EagleClaw-Daemon"

# 欢迎信息
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          🦅 鹰爪技能 - 一键安装程序              ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║  去中心化 AI 协作网络 · 自动抢单赚钱              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 步骤 1: 检查前置条件
Write-Host "[1/7] 检查系统环境..." -ForegroundColor Yellow

$nodeFound = Get-Command node -ErrorAction SilentlyContinue
$gitFound = Get-Command git -ErrorAction SilentlyContinue

if (-not $nodeFound) {
    Write-Host ""
    Write-Host "❌ 未找到 Node.js" -ForegroundColor Red
    Write-Host "请先安装 Node.js 18+: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

if (-not $gitFound) {
    Write-Host ""
    Write-Host "❌ 未找到 Git" -ForegroundColor Red
    Write-Host "请先安装 Git: https://git-scm.com/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "  ✅ Node.js: $(node --version)" -ForegroundColor Green
Write-Host "  ✅ Git: $(git --version)" -ForegroundColor Green
Write-Host "  ✅ PowerShell: $($PSVersionTable.PSVersion)" -ForegroundColor Green
Write-Host ""

# 步骤 2: 下载代码
Write-Host "[2/7] 下载鹰爪代码到 $daemonPath..." -ForegroundColor Yellow

if (Test-Path $daemonPath) {
    Write-Host "  ⚠️  目录已存在，删除旧版本..." -ForegroundColor Yellow
    Remove-Item $daemonPath -Recurse -Force
}

try {
    git clone $repoUrl $daemonPath --quiet
    Write-Host "  ✅ 下载完成" -ForegroundColor Green
} catch {
    Write-Host "  ❌ 下载失败：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
Write-Host ""

# 步骤 3: 安装依赖
Write-Host "[3/7] 安装 npm 依赖..." -ForegroundColor Yellow
Set-Location $daemonPath

try {
    npm install --silent
    Write-Host "  ✅ 依赖安装完成" -ForegroundColor Green
} catch {
    Write-Host "  ❌ 安装失败：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
Write-Host ""

# 步骤 4: 生成密钥对
Write-Host "[4/7] 生成 Ed25519 密钥对..." -ForegroundColor Yellow

try {
    $keygenOutput = npm run keygen --silent 2>&1
    Write-Host $keygenOutput
} catch {
    Write-Host "  ❌ 密钥生成失败" -ForegroundColor Red
    Write-Host ""
    Write-Host "按任意键退出..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "  请输入节点别名 (默认：eagle-node-01): " -ForegroundColor Yellow
$alias = Read-Host
if ([string]::IsNullOrWhiteSpace($alias)) {
    $alias = "eagle-node-01"
}
Write-Host ""

# 步骤 5: 配置环境
Write-Host "[5/7] 配置环境变量..." -ForegroundColor Yellow

Copy-Item ".env.example" ".env" -Force

Write-Host "  请复制上面生成的 Private Key (64 字符):" -ForegroundColor Yellow
$privateKey = Read-Host
while ($privateKey.Length -ne 64) {
    Write-Host "  ❌ 密钥长度不正确，请输入 64 字符的 Private Key:" -ForegroundColor Red
    $privateKey = Read-Host
}

Write-Host "  请复制上面生成的 Public Key (64 字符):" -ForegroundColor Yellow
$publicKey = Read-Host
while ($publicKey.Length -ne 64) {
    Write-Host "  ❌ 密钥长度不正确，请输入 64 字符的 Public Key:" -ForegroundColor Red
    $publicKey = Read-Host
}

# 更新 .env 文件
$envContent = Get-Content ".env" -Raw
$envContent = $envContent -replace "NODE_PRIVATE_KEY=.*", "NODE_PRIVATE_KEY=$privateKey"
$envContent = $envContent -replace "NODE_PUBLIC_KEY=.*", "NODE_PUBLIC_KEY=$publicKey"
$envContent = $envContent -replace "NODE_ALIAS=.*", "NODE_ALIAS=$alias"
$envContent | Set-Content ".env" -NoNewline

Write-Host "  ✅ 配置完成" -ForegroundColor Green
Write-Host ""

# 步骤 6: 编译代码
Write-Host "[6/7] 编译 TypeScript 代码..." -ForegroundColor Yellow

try {
    npm run build --silent
    Write-Host "  ✅ 编译完成" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  编译警告 (不影响运行)" -ForegroundColor Yellow
}
Write-Host ""

# 步骤 7: 注册开机自启
Write-Host "[7/7] 注册开机自启..." -ForegroundColor Yellow

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "  ⚠️  任务已存在，更新配置..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$taskAction = New-ScheduledTaskAction -Execute "node" -Argument "dist/index.js" -WorkingDirectory $daemonPath
$taskTrigger = New-ScheduledTaskTrigger -AtStartup
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Description "鹰爪技能 Daemon 服务" -RunLevel Highest -ErrorAction Stop
    Write-Host "  ✅ 开机自启注册完成" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  注册失败 (可能需要管理员权限)" -ForegroundColor Yellow
    Write-Host "  可以稍后手动运行：npm run start" -ForegroundColor Gray
}
Write-Host ""

# 启动服务
Write-Host "🚀 启动鹰爪 Daemon..." -ForegroundColor Green
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3

# 完成信息
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              ✅ 安装完成！                        ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  📂 安装位置：$daemonPath" -ForegroundColor White
Write-Host "║  📝 配置文件：$daemonPath\.env" -ForegroundColor White
Write-Host "║  📊 日志文件：$daemonPath\logs\" -ForegroundColor White
Write-Host "║                                                  ║" -ForegroundColor White
Write-Host "║  🛠️  管理命令：                                   ║" -ForegroundColor White
Write-Host "║    查看状态：eagle status                         ║" -ForegroundColor White
Write-Host "║    查看日志：Get-Content logs\latest.log -Tail 50 ║" -ForegroundColor White
Write-Host "║    重启服务：eagle restart                        ║" -ForegroundColor White
Write-Host "║                                                  ║" -ForegroundColor White
Write-Host "║  🔗 文档：https://github.com/ainclaw/ainclaw     ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

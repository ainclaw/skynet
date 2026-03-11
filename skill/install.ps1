# ============================================
# 鹰爪技能 - 安装脚本
# ============================================
# 自动完成：
# 1. 下载 Daemon 到 D:\eagleclaw-daemon\
# 2. 安装依赖
# 3. 生成密钥对
# 4. 配置 .env
# 5. 注册开机自启
# 6. 启动服务
# ============================================

$ErrorActionPreference = "Stop"
$daemonPath = "D:\eagleclaw-daemon"
$repoUrl = "https://github.com/yinliang91/ainclaw.git"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          🦅 鹰爪技能 - 安装程序                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 步骤 1: 检查前置条件
Write-Host "[1/6] 检查前置条件..." -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 Node.js，请先安装 Node.js 18+" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 Git，请先安装 Git" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js: $(node --version)" -ForegroundColor Green
Write-Host "✅ Git: $(git --version)" -ForegroundColor Green
Write-Host ""

# 步骤 2: 下载 Daemon
Write-Host "[2/6] 下载鹰爪 Daemon 到 $daemonPath..." -ForegroundColor Yellow

if (Test-Path $daemonPath) {
    Write-Host "⚠️  目录已存在，删除旧版本..." -ForegroundColor Yellow
    Remove-Item $daemonPath -Recurse -Force
}

git clone $repoUrl $daemonPath
Set-Location $daemonPath

Write-Host "✅ 下载完成" -ForegroundColor Green
Write-Host ""

# 步骤 3: 安装依赖
Write-Host "[3/6] 安装 npm 依赖..." -ForegroundColor Yellow

npm install

Write-Host "✅ 依赖安装完成" -ForegroundColor Green
Write-Host ""

# 步骤 4: 生成密钥对
Write-Host "[4/6] 生成 Ed25519 密钥对..." -ForegroundColor Yellow

npm run keygen

Write-Host ""
Write-Host "请输入节点别名 (默认：eagle-node-01): " -ForegroundColor Yellow
$alias = Read-Host
if ([string]::IsNullOrWhiteSpace($alias)) {
    $alias = "eagle-node-01"
}

Write-Host ""

# 步骤 5: 配置 .env
Write-Host "[5/6] 配置环境变量..." -ForegroundColor Yellow

# 复制 .env.example
Copy-Item ".env.example" ".env" -Force

# 读取密钥 (从 keygen 输出解析，这里简化处理)
Write-Host "请复制上面生成的 Private Key:" -ForegroundColor Yellow
$privateKey = Read-Host
Write-Host "请复制上面生成的 Public Key:" -ForegroundColor Yellow
$publicKey = Read-Host

# 更新 .env 文件
$envContent = Get-Content ".env" -Raw
$envContent = $envContent -replace "NODE_PRIVATE_KEY=", "NODE_PRIVATE_KEY=$privateKey"
$envContent = $envContent -replace "NODE_PUBLIC_KEY=", "NODE_PUBLIC_KEY=$publicKey"
$envContent = $envContent -replace "NODE_ALIAS=", "NODE_ALIAS=$alias"
$envContent | Set-Content ".env" -NoNewline

Write-Host "✅ 配置完成" -ForegroundColor Green
Write-Host ""

# 步骤 6: 注册开机自启
Write-Host "[6/6] 注册开机自启..." -ForegroundColor Yellow

$taskName = "EagleClaw-Daemon"
$taskAction = New-ScheduledTaskAction -Execute "node" -Argument "dist/index.js" -WorkingDirectory $daemonPath
$taskTrigger = New-ScheduledTaskTrigger -AtStartup
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# 检查是否已存在
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "⚠️  任务已存在，更新配置..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -Description "鹰爪技能 Daemon 服务"

Write-Host "✅ 开机自启注册完成" -ForegroundColor Green
Write-Host ""

# 启动服务
Write-Host "🚀 启动鹰爪 Daemon..." -ForegroundColor Yellow

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              ✅ 安装完成！                        ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Daemon 位置：$daemonPath" -ForegroundColor White
Write-Host "║  配置文件：$daemonPath\.env" -ForegroundColor White
Write-Host "║  日志文件：$daemonPath\logs\" -ForegroundColor White
Write-Host "║                                                  ║" -ForegroundColor White
Write-Host "║  可用命令：                                       ║" -ForegroundColor White
Write-Host "║    eagle status    - 查看节点状态                 ║" -ForegroundColor White
Write-Host "║    eagle balance   - 查询积分余额                 ║" -ForegroundColor White
Write-Host "║    eagle restart   - 重启服务                     ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

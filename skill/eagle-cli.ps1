# ============================================
# 鹰爪技能 - 命令行工具
# ============================================
# 供 OpenClaw Skill 调用
# ============================================

$ErrorActionPreference = "Stop"
$daemonPath = "D:\eagleclaw-daemon"

param(
    [Parameter(Position=0)]
    [string]$Command = "status"
)

function Get-Status {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║          🦅 鹰爪技能 - 节点状态                  ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    
    # 检查服务状态
    $task = Get-ScheduledTask -TaskName "EagleClaw-Daemon" -ErrorAction SilentlyContinue
    if ($task) {
        $taskInfo = Get-ScheduledTaskInfo -TaskName "EagleClaw-Daemon"
        if ($taskInfo.LastRunResult -eq 0) {
            Write-Host "✅ 服务状态：运行中" -ForegroundColor Green
        } else {
            Write-Host "⚠️  服务状态：已停止" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ 服务未安装" -ForegroundColor Red
        return
    }
    
    # 检查 Daemon 目录
    if (Test-Path $daemonPath) {
        Write-Host "✅ Daemon 位置：$daemonPath" -ForegroundColor Green
    } else {
        Write-Host "❌ Daemon 目录不存在" -ForegroundColor Red
        return
    }
    
    # 读取配置
    if (Test-Path "$daemonPath\.env") {
        $envContent = Get-Content "$daemonPath\.env"
        $alias = $envContent | Where-Object { $_ -match "^NODE_ALIAS=" }
        if ($alias) {
            Write-Host "✅ 节点别名：$($alias.Split('=')[1])" -ForegroundColor Green
        }
    }
    
    Write-Host ""
}

function Get-Balance {
    Write-Host ""
    Write-Host "📊 查询积分余额..." -ForegroundColor Yellow
    Write-Host ""
    
    # 这里可以调用天网 API，简化版本显示提示信息
    Write-Host "⚠️  余额查询功能需要连接天网中枢" -ForegroundColor Yellow
    Write-Host "请查看日志获取最新状态：" -ForegroundColor White
    Write-Host "  Get-Content $daemonPath\logs\latest.log -Tail 20" -ForegroundColor Cyan
    Write-Host ""
}

function Get-Tasks {
    Write-Host ""
    Write-Host "📋 任务列表..." -ForegroundColor Yellow
    Write-Host ""
    
    # 简化版本显示提示信息
    Write-Host "⚠️  任务列表功能需要连接天网中枢" -ForegroundColor Yellow
    Write-Host "请查看日志获取最新状态：" -ForegroundColor White
    Write-Host "  Get-Content $daemonPath\logs\latest.log -Tail 50" -ForegroundColor Cyan
    Write-Host ""
}

function Restart-Service {
    Write-Host ""
    Write-Host "🔄 重启服务..." -ForegroundColor Yellow
    Write-Host ""
    
    $taskName = "EagleClaw-Daemon"
    
    # 停止
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    
    # 启动
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 3
    
    Write-Host "✅ 服务已重启" -ForegroundColor Green
    Write-Host ""
}

# 主逻辑
switch ($Command.ToLower()) {
    "status" { Get-Status }
    "balance" { Get-Balance }
    "tasks" { Get-Tasks }
    "restart" { Restart-Service }
    default {
        Write-Host ""
        Write-Host "用法：eagle <command>" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "可用命令:" -ForegroundColor White
        Write-Host "  status   - 查看节点状态" -ForegroundColor Gray
        Write-Host "  balance  - 查询积分余额" -ForegroundColor Gray
        Write-Host "  tasks    - 查看任务列表" -ForegroundColor Gray
        Write-Host "  restart  - 重启服务" -ForegroundColor Gray
        Write-Host ""
    }
}

@echo off
chcp 936 >nul
setlocal
cd /d "%~dp0"

echo ==================================================
echo   空教室查询 - 本地演示（不联网也能跑）
echo ==================================================
echo.

set "PORT=8000"

where python >nul 2>nul
if errorlevel 1 (
  echo [X] 没找到 python。
  echo     安装：https://www.python.org/downloads/  装的时候勾选 Add python.exe to PATH
  echo     不想装：直接双击「空教室查询-单文件版.html」，功能一样，只是手机看不了
  echo.
  pause
  exit /b 1
)

set "LANIP="
for /f "tokens=3,4" %%a in ('route print 0.0.0.0 ^| findstr /r /c:"0\.0\.0\.0  *0\.0\.0\.0"') do if not defined LANIP set "LANIP=%%b"

echo 本机打开：  http://127.0.0.1:%PORT%
echo.
echo 同一 WiFi 下的手机 / 别的电脑：
if defined LANIP (
  echo    http://%LANIP%:%PORT%
) else (
  echo    （自动识别失败，下面列出来的都试一下，192.168 开头的一般是 WiFi）
  for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do echo    http://%%b:%PORT%
  )
)
echo.
echo 提示 1：第一次运行会弹「Windows 防火墙」，点「允许访问」，否则手机连不上。
echo         第一次启动 python 慢，浏览器如果说打不开，等两秒按 F5。
echo 提示 2：手机要和电脑连同一个 WiFi（用流量、连别的 WiFi 都不行）。
echo 提示 3：按 Ctrl+C 停止服务。
echo.

start "" "http://127.0.0.1:%PORT%"
python -m http.server %PORT% --bind 0.0.0.0

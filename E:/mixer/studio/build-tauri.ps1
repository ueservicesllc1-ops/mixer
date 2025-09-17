# ==============================================================================
# Script de PowerShell para construir la aplicación Tauri de forma fiable.
#
# Este script automatiza todos los pasos necesarios:
# 1. Restaura el proyecto a la última versión de GitHub para empezar desde cero.
# 2. Instala todas las dependencias de Node.js.
# 3. Ejecuta el comando para construir la aplicación Tauri.
#
# Para ejecutar este script:
# 1. Abre una terminal de PowerShell.
# 2. Navega a la carpeta de tu proyecto con: cd E:\mixer\studio
# 3. Ejecuta el script con: .\build-tauri.ps1
#
# Si PowerShell te da un error de seguridad sobre la ejecución de scripts,
# puede que necesites ejecutar este comando primero (una sola vez):
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# ==============================================================================

Write-Host "🚧 Iniciando el proceso de compilación de la aplicación Tauri..." -ForegroundColor Yellow

# Paso 1: Forzar restauración desde GitHub para asegurar un estado limpio.
Write-Host "`n🔄 Paso 1 de 3: Restaurando el proyecto desde GitHub..." -ForegroundColor Cyan
git fetch origin
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: 'git fetch' falló. Revisa tu conexión o la URL del repositorio." -ForegroundColor Red
    exit 1
}
git reset --hard origin/main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: 'git reset --hard' falló." -ForegroundColor Red
    exit 1
}
git clean -dfx
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: 'git clean' falló." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Proyecto restaurado correctamente." -ForegroundColor Green


# Paso 2: Instalar las dependencias de npm.
Write-Host "`n📦 Paso 2 de 3: Instalando dependencias de Node.js (npm install)..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: 'npm install' falló. Revisa los mensajes de error." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencias instaladas correctamente." -ForegroundColor Green


# Paso 3: Construir la aplicación Tauri.
Write-Host "`n🚀 Paso 3 de 3: Construyendo la aplicación Tauri (npm run tauri:build)..." -ForegroundColor Cyan
Write-Host "Este proceso puede tardar varios minutos. Por favor, sé paciente." -ForegroundColor Yellow

npm run tauri:build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: 'npm run tauri:build' falló. Revisa los mensajes de error." -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 ¡Éxito! La aplicación ha sido compilada." -ForegroundColor Green
Write-Host "Puedes encontrar el instalador en: E:\mixer\studio\src-tauri\target\release\bundle\"

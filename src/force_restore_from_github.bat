
@echo off
rem ==============================================================================
rem Script para restaurar el proyecto a la ultima version de GitHub de forma FORZADA.
rem
rem ADVERTENCIA! Este script es destructivo.
rem Borrara TODOS tus cambios locales que no esten en GitHub.
rem
rem Usalo solo cuando quieras que tu proyecto sea un espejo exacto del repositorio.
rem
rem Para ejecutar este script, simplemente haz doble clic en el,
rem o ejecutalo desde la terminal en el directorio raiz de tu proyecto:
rem    .\force_restore_from_github.bat
rem ==============================================================================

echo Iniciando restauracion FORZADA desde GitHub...

echo    => Descargando la informacion mas reciente del repositorio...
git fetch origin
if %errorlevel% neq 0 (
    echo Error: 'git fetch' fallo. Revisa tu conexion o la URL del repositorio.
    exit /b 1
)

echo    => Reseteando el proyecto a la ultima version de 'main'...
git reset --hard origin/main
if %errorlevel% neq 0 (
    echo Error: 'git reset --hard' fallo.
    exit /b 1
)

echo    => Limpiando archivos y carpetas no rastreados...
git clean -dfx
if %errorlevel% neq 0 (
    echo Error: 'git clean' fallo.
    exit /b 1
)

echo Exito! Tu proyecto ha sido restaurado y ahora es un clon exacto de la rama 'main' de GitHub.
pause

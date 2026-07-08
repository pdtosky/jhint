@echo off
cd /d "%~dp0"
node tools\backup-supabase-state.mjs --retention-days=90
pause

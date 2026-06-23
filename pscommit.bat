@echo off

echo git push
git push

if "%~1"=="" (
  echo Please provide a commit message.
  echo Example: gcommit.bat "added mixpanel tracking"
  exit /b 1
)

echo git status
git status

echo git add .
git add .

echo git commit -m "%*"
git commit -m "%*"

echo git push
git push
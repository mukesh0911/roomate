@echo off
REM Runs BOTH security-rules emulator suites (Firestore + Storage) with a
REM JDK 21+ runtime. firebase-tools requires Java >= 21.
REM Usage: run-emulator-tests.cmd <path-to-jdk21-home>
REM Example: scripts\run-emulator-tests.cmd C:\tools\jdk-21
setlocal
if "%~1"=="" (
  echo Usage: run-emulator-tests.cmd ^<path-to-jdk21-home^>
  exit /b 2
)
set "JAVA_HOME=%~1"
set "PATH=%JAVA_HOME%\bin;%PATH%"
java -version || exit /b 1

echo === FIRESTORE RULES SUITE ===
pushd app
call npx -y firebase-tools emulators:exec --only firestore --project demo-nestmate "node ../scripts/run-rules-tests.cjs"
if errorlevel 1 goto :fail
popd

echo === STORAGE RULES SUITE ===
pushd app
call npx -y firebase-tools emulators:exec --only firestore,storage --project demo-nestmate "node ../scripts/run-storage-rules-tests.cjs"
if errorlevel 1 goto :fail
popd

echo === ALL EMULATOR SUITES PASSED ===
exit /b 0

:fail
popd
echo === EMULATOR SUITES FAILED ===
exit /b 1
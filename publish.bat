@echo off
chcp 65001 > nul
echo ===================================================
echo   أرز مارت - سكربت البناء والنشر التلقائي
echo   ArzMart - Automatic Builder & Publisher Script
echo ===================================================
echo.
echo 1. جاري بناء الواجهة الأمامية للإنتاج (Building Frontend)...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] فشل بناء المشروع. تم إلغاء النشر.
    pause
    exit /b %errorlevel%
)
cd ..

echo.
echo 2. جاري إضافة التعديلات إلى Git...
git add .

echo.
echo 3. جاري إنشاء نقطة حفظ (Commit)...
set /p commit_msg="أدخل وصف التعديل (أو اضغط Enter للوصف الافتراضي): "
if "%commit_msg%"=="" (
    set commit_msg="build: auto build and publish"
)
git commit -m "%commit_msg%"

echo.
echo 4. جاري رفع الكود إلى GitHub (Pushing)...
git -c http.sslVerify=false push origin main

echo.
echo ===================================================
echo   [SUCCESS] تم البناء والرفع إلى GitHub بنجاح!
echo ===================================================
pause

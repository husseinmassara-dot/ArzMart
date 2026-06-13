package com.arzmart.app

import android.os.Bundle
import android.widget.Toast
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import java.util.concurrent.Executor

@Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
class MainActivity : AppCompatActivity() {

    companion object {
        private const val IS_PRODUCTION = true // اجعلها true عند رفع التطبيق للإنتاج ومشاركة الرابط
        private const val PRODUCTION_URL = "https://arz-mart.vercel.app" // ضع رابط الاستضافة الجديد هنا
    }

    private lateinit var executor: Executor
    private lateinit var biometricPrompt: BiometricPrompt
    private lateinit var promptInfo: BiometricPrompt.PromptInfo
    private lateinit var webView: WebView

    private val urlsToTry = mutableListOf<String>()
    private var currentUrlIndex = 0
    private var isLoaderActiveForIndex = -1

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        setupWebView()
    }

    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        // إضافة واجهة الجافا سكريبت للربط مع المتصفح الداخلي
        webView.addJavascriptInterface(WebAppInterface(), "AndroidApp")

        // تجهيز قائمة العناوين للاتصال التلقائي المتتالي
        urlsToTry.clear()
        if (IS_PRODUCTION) {
            urlsToTry.add(PRODUCTION_URL)
        } else {
            urlsToTry.add("http://localhost:5000")       // 1. USB Reverse Forwarding (الكابل)
            urlsToTry.add("http://10.0.2.2:5000")         // 2. Emulator Loopback (المحاكي)
            urlsToTry.add("http://192.168.1.104:5000")    // 3. Local Wi-Fi Network IP (الواي فاي)
        }

        webView.webViewClient = object : WebViewClient() {
            @Suppress("DEPRECATION")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return false
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: android.webkit.WebResourceRequest?
            ): Boolean {
                return false
            }

            // التعامل مع الأخطاء لإصدارات أندرويد القديمة
            @Suppress("DEPRECATION")
            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                super.onReceivedError(view, errorCode, description, failingUrl)
                handleLoadFailure()
            }

            // التعامل مع الأخطاء لإصدارات أندرويد الحديثة (API 23+)
            override fun onReceivedError(
                view: WebView?,
                request: android.webkit.WebResourceRequest?,
                error: android.webkit.WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    handleLoadFailure()
                }
            }
        }

        // بدء محاولة الاتصال بالعنوان الأول
        loadUrlAtIndex(0)
    }

    private fun loadUrlAtIndex(index: Int) {
        if (index >= urlsToTry.size) {
            runOnUiThread {
                Toast.makeText(this, "تعذر الاتصال بالخادم. يرجى التأكد من تشغيل السيرفر على الكمبيوتر.", Toast.LENGTH_LONG).show()
            }
            return
        }
        currentUrlIndex = index
        isLoaderActiveForIndex = index
        webView.loadUrl(urlsToTry[index])
    }

    private fun handleLoadFailure() {
        if (isLoaderActiveForIndex == currentUrlIndex) {
            isLoaderActiveForIndex = -1
            webView.post {
                loadUrlAtIndex(currentUrlIndex + 1)
            }
        }
    }

    inner class WebAppInterface {
        @JavascriptInterface
        fun triggerFingerprintAuth() {
            runOnUiThread {
                checkBiometricSupport()
            }
        }
    }

    private fun checkBiometricSupport() {
        val biometricManager = BiometricManager.from(this)
        when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> {
                setupBiometric()
            }
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                Toast.makeText(this, "الجهاز لا يدعم المصادقة البيومترية", Toast.LENGTH_LONG).show()
                sendBiometricResultToJS(false, "device_no_hardware")
            }
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                Toast.makeText(this, "المصادقة البيومترية غير متوفرة حالياً", Toast.LENGTH_LONG).show()
                sendBiometricResultToJS(false, "device_hw_unavailable")
            }
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                Toast.makeText(this, "لا توجد بصمة مسجلة. قم بتسجيل بصمة في الإعدادات", Toast.LENGTH_LONG).show()
                sendBiometricResultToJS(false, "device_no_biometrics_enrolled")
            }
        }
    }

    private fun setupBiometric() {
        executor = ContextCompat.getMainExecutor(this)

        biometricPrompt = BiometricPrompt(this, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    Toast.makeText(applicationContext, "خطأ في المصادقة: $errString", Toast.LENGTH_SHORT).show()
                    sendBiometricResultToJS(false, errString.toString())
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    Toast.makeText(applicationContext, "تم المصادقة بنجاح!", Toast.LENGTH_SHORT).show()
                    sendBiometricResultToJS(true, null)
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    Toast.makeText(applicationContext, "فشلت المصادقة", Toast.LENGTH_SHORT).show()
                    sendBiometricResultToJS(false, "Authentication failed")
                }
            })

        promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("المصادقة البيومترية")
            .setSubtitle("استخدم بصمة إصبعك للدخول إلى التطبيق")
            .setDescription("المصادقة مطلوبة للوصول الآمن")
            .setNegativeButtonText("إلغاء")
            .build()

        biometricPrompt.authenticate(promptInfo)
    }

    private fun sendBiometricResultToJS(success: Boolean, errorMsg: String?) {
        val script = if (success) {
            "javascript:if(window.onBiometricSuccess) { window.onBiometricSuccess(); } else { console.log('onBiometricSuccess not defined'); }"
        } else {
            val safeMsg = errorMsg?.replace("'", "\\'") ?: ""
            "javascript:if(window.onBiometricFailed) { window.onBiometricFailed('$safeMsg'); } else { console.log('onBiometricFailed not defined'); }"
        }
        webView.evaluateJavascript(script, null)
    }
}

package fr.lazpizza.pos

import android.annotation.SuppressLint
import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.graphics.Color
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

/**
 * WebView résidente — charge le module Next.js (POS / KDS / livreur selon flavor Gradle).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val allowedHost = BuildConfig.ALLOWED_HOST
    private val orientationHandler = Handler(Looper.getMainLooper())
    private var landscapeWatchdogActive = false

    /** Vérifie rarement — le manifest force déjà sensorLandscape sur KDS / tablette. */
    private val landscapeWatchdog = object : Runnable {
        override fun run() {
            if (!landscapeWatchdogActive || !prefersLandscape()) return
            lockLandscapeIfNeeded()
            orientationHandler.postDelayed(this, 5000)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        applyScreenOrientation()
        super.onCreate(savedInstanceState)

        if (BuildConfig.HAS_SUNMI_PRINTER && SunmiWebViewBootstrap.needsBootstrap(this) && savedInstanceState == null) {
            setContentView(R.layout.activity_webview_upgrade)
            val status = findViewById<TextView>(R.id.upgrade_status)
            val progress = findViewById<ProgressBar>(R.id.upgrade_progress)
            SunmiWebViewBootstrap.ensureUpgraded(
                this,
                onProgress = { pct ->
                    progress.progress = pct
                    status.text = if (pct < 100) "Téléchargement… $pct %" else "Installation du moteur Chromium…"
                },
                onReady = { initWebViewContent(savedInstanceState, webViewBootstrapped = true) },
                onError = { msg ->
                    status.text = msg
                    showToast("WebView : $msg — essayez le Play Store")
                    WebViewGuard.openWebViewUpdate(this)
                    initWebViewContent(savedInstanceState, webViewBootstrapped = false)
                },
            )
            return
        }

        initWebViewContent(savedInstanceState, webViewBootstrapped = false)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun initWebViewContent(savedInstanceState: Bundle?, webViewBootstrapped: Boolean) {
        setContentView(R.layout.activity_main)

        if (BuildConfig.HAS_SUNMI_PRINTER) {
            SunmiPrintFacade.bind(applicationContext)
        }

        setupOrientationBar()

        webView = findViewById(R.id.webview)
        webView.setBackgroundColor(Color.parseColor("#1A1412"))
        configureWebView(webView)

        webView.addJavascriptInterface(PrinterBridge(this), "SunmiPrinter")
        webView.addJavascriptInterface(EpsonPrinterBridge(), "EpsonPrinter")
        webView.addJavascriptInterface(PaymentTerminalBridge(this), "PaymentTerminal")
        webView.addJavascriptInterface(DeviceBridge(this), "LaZPizzaDevice")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: android.webkit.ConsoleMessage?): Boolean {
                message?.let {
                    android.util.Log.d("LaZPizzaWebView", "${it.message()} (${it.sourceId()}:${it.lineNumber()})")
                }
                return true
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                // false = laisser la WebView charger l'URL (sinon écran blanc)
                return !isAllowedHost(request?.url?.host)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                val host = url?.let { android.net.Uri.parse(it).host }
                return !isAllowedHost(host)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                if (request?.isForMainFrame != true) return
                val desc = error?.description?.toString() ?: "Erreur réseau"
                val code = error?.errorCode ?: -1
                android.util.Log.e("LaZPizzaWebView", "onReceivedError $code $desc ${request.url}")
                view?.loadDataWithBaseURL(
                    BuildConfig.APP_URL,
                    """
                    <html><body style="background:#1A1412;color:#e8e4dc;font-family:sans-serif;padding:24px">
                    <h2>Connexion impossible</h2>
                    <p>$desc (code $code)</p>
                    <p>Vérifiez le Wi‑Fi et que l'URL est joignable :</p>
                    <p style="color:#fbbf24;font-size:13px"><b>${BuildConfig.APP_URL}</b></p>
                    <p style="color:#888;font-size:12px">Hôte autorisé : ${BuildConfig.ALLOWED_HOST}</p>
                    </body></html>
                    """.trimIndent(),
                    "text/html",
                    "UTF-8",
                    null,
                )
                showToast("Erreur chargement: $desc")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                android.util.Log.d("LaZPizzaWebView", "Page loaded: $url")
            }
        }

        if (savedInstanceState == null) {
            if (!WebViewGuard.isCompatible(this) && !webViewBootstrapped) {
                val major = WebViewGuard.chromeMajorVersion(this)
                android.util.Log.w("LaZPizzaWebView", "WebView trop ancien: Chrome $major (min ${WebViewGuard.MIN_CHROME_MAJOR})")
                webView.loadDataWithBaseURL(
                    BuildConfig.APP_URL,
                    WebViewGuard.blockedHtml(this),
                    "text/html",
                    "UTF-8",
                    null,
                )
                showToast("Mettez à jour Android System WebView (Play Store)")
                WebViewGuard.openWebViewUpdate(this)
            } else {
                webView.loadUrl(BuildConfig.APP_URL)
            }
        } else {
            webView.restoreState(savedInstanceState)
        }

        webView.requestFocus(View.FOCUS_DOWN)
        startLandscapeWatchdog()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView(view: WebView) {
        view.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        val settings = view.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mediaPlaybackRequiresUserGesture = false
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.userAgentString = settings.userAgentString + BuildConfig.USER_AGENT_SUFFIX

        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            WebSettingsCompat.setForceDark(settings, WebSettingsCompat.FORCE_DARK_OFF)
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, true)
    }

    private fun setupOrientationBar() {
        val bar = findViewById<LinearLayout>(R.id.orientation_bar)
        val label = findViewById<TextView>(R.id.orientation_label)
        val button = findViewById<Button>(R.id.btn_lock_landscape)

        if (!prefersLandscape()) {
            bar.visibility = View.GONE
            return
        }

        bar.visibility = View.VISIBLE
        label.text = "${getString(R.string.app_name)} · v${BuildConfig.VERSION_NAME} · paysage"
        button.setOnClickListener {
            lockLandscapeIfNeeded()
            Toast.makeText(this, "Mode paysage activé", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onResume() {
        super.onResume()
        lockLandscapeIfNeeded()
        startLandscapeWatchdog()
        if (::webView.isInitialized) {
            webView.onResume()
            webView.resumeTimers()
        }
    }

    override fun onPause() {
        stopLandscapeWatchdog()
        if (::webView.isInitialized) {
            webView.onPause()
            webView.pauseTimers()
        }
        super.onPause()
    }

    override fun onDestroy() {
        stopLandscapeWatchdog()
        if (BuildConfig.HAS_SUNMI_PRINTER) {
            SunmiPrintFacade.unbind(applicationContext)
        }
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            lockLandscapeIfNeeded()
            if (::webView.isInitialized) webView.requestFocus(View.FOCUS_DOWN)
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        if (prefersLandscape() && newConfig.orientation != Configuration.ORIENTATION_LANDSCAPE) {
            lockLandscapeIfNeeded()
        }
    }

    fun prefersLandscape(): Boolean = BuildConfig.FORCE_LANDSCAPE

    fun applyScreenOrientation() {
        if (prefersLandscape()) {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
        } else {
            requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }
    }

    fun lockLandscape() {
        if (!prefersLandscape()) return
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    }

    fun lockPortrait() {
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    }

    fun currentOrientationLabel(): String {
        return when (resources.configuration.orientation) {
            Configuration.ORIENTATION_LANDSCAPE -> "landscape"
            Configuration.ORIENTATION_PORTRAIT -> "portrait"
            else -> "unknown"
        }
    }

    private fun lockLandscapeIfNeeded() {
        if (!prefersLandscape()) return
        requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    }

    private fun startLandscapeWatchdog() {
        if (!prefersLandscape()) return
        landscapeWatchdogActive = true
        orientationHandler.removeCallbacks(landscapeWatchdog)
        orientationHandler.postDelayed(landscapeWatchdog, 5000)
    }

    private fun stopLandscapeWatchdog() {
        landscapeWatchdogActive = false
        orientationHandler.removeCallbacks(landscapeWatchdog)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) webView.saveState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else moveTaskToBack(true)
    }

    fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun isAllowedHost(host: String?): Boolean {
        if (host.isNullOrBlank()) return false
        return host == allowedHost ||
            host.endsWith(".pizzeria.fr") ||
            host.endsWith(".gsms-security.com") ||
            host == "localhost" ||
            host == "127.0.0.1"
    }
}

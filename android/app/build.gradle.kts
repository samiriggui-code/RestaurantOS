plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "fr.lazpizza.pos"
    compileSdk = 34

    val opsHostUrl = (project.findProperty("OPS_HOST") as String?) ?: "https://pizza-app.gsms-security.com"
    val publicHostUrl = (project.findProperty("PUBLIC_HOST") as String?) ?: "https://pizza.gsms-security.com"
    val opsHost = opsHostUrl.removePrefix("https://").removePrefix("http://").substringBefore("/").substringBefore(":")
    val publicHost = publicHostUrl.removePrefix("https://").removePrefix("http://").substringBefore("/").substringBefore(":")

    defaultConfig {
        minSdk = 25
        targetSdk = 34
        versionCode = 20
        versionName = "1.0.19"
        buildConfigField("String", "APP_KIND", "\"unknown\"")
        buildConfigField("String", "TERMINAL_BT_ADDRESS", "\"\"")
        buildConfigField("boolean", "FORCE_LANDSCAPE", "false")
        buildConfigField("boolean", "HAS_SUNMI_PRINTER", "false")
        manifestPlaceholders["screenOrientation"] = "unspecified"
    }

    flavorDimensions += "app"

    productFlavors {
        create("posSunmi") {
            dimension = "app"
            applicationId = "fr.lazpizza.pos.sunmi"
            buildConfigField("String", "APP_KIND", "\"pos-sunmi\"")
            resValue("string", "app_name", "La Z Pizza — Caisse SUNMI")
            buildConfigField("String", "APP_URL", "\"${opsHostUrl.trimEnd('/')}/pos\"")
            buildConfigField("String", "ALLOWED_HOST", "\"$opsHost\"")
            buildConfigField("String", "USER_AGENT_SUFFIX", "\" LaZPizzaPOS/1.0 SunmiV2\"")
            buildConfigField("String", "SCREEN_ORIENTATION", "\"portrait\"")
            buildConfigField("boolean", "FORCE_LANDSCAPE", "false")
            buildConfigField("boolean", "HAS_SUNMI_PRINTER", "true")
            manifestPlaceholders["screenOrientation"] = "portrait"
        }
        create("posTablet") {
            dimension = "app"
            applicationId = "fr.lazpizza.pos.tablet"
            buildConfigField("String", "APP_KIND", "\"pos-tablet\"")
            resValue("string", "app_name", "La Z Pizza — Caisse tablette")
            buildConfigField("String", "APP_URL", "\"${opsHostUrl.trimEnd('/')}/pos\"")
            buildConfigField("String", "ALLOWED_HOST", "\"$opsHost\"")
            buildConfigField("String", "USER_AGENT_SUFFIX", "\" LaZPizzaPOS/1.0 Tablet\"")
            buildConfigField("String", "SCREEN_ORIENTATION", "\"landscape\"")
            buildConfigField("boolean", "FORCE_LANDSCAPE", "true")
            manifestPlaceholders["screenOrientation"] = "landscape"
        }
        create("kds") {
            dimension = "app"
            applicationId = "fr.lazpizza.kds"
            buildConfigField("String", "APP_KIND", "\"kds\"")
            resValue("string", "app_name", "La Z Pizza — Cuisine KDS")
            buildConfigField("String", "APP_URL", "\"${opsHostUrl.trimEnd('/')}/kitchen\"")
            buildConfigField("String", "ALLOWED_HOST", "\"$opsHost\"")
            buildConfigField("String", "USER_AGENT_SUFFIX", "\" LaZPizzaKDS/1.0\"")
            buildConfigField("String", "SCREEN_ORIENTATION", "\"landscape\"")
            buildConfigField("boolean", "FORCE_LANDSCAPE", "true")
            manifestPlaceholders["screenOrientation"] = "landscape"
        }
        create("livreur") {
            dimension = "app"
            applicationId = "fr.lazpizza.livreur"
            buildConfigField("String", "APP_KIND", "\"livreur\"")
            resValue("string", "app_name", "La Z Pizza — Livreur")
            buildConfigField("String", "APP_URL", "\"${publicHostUrl.trimEnd('/')}/livreur\"")
            buildConfigField("String", "ALLOWED_HOST", "\"$publicHost\"")
            buildConfigField("String", "USER_AGENT_SUFFIX", "\" LaZPizzaLivreur/1.0\"")
            buildConfigField("String", "SCREEN_ORIENTATION", "\"portrait\"")
            buildConfigField("boolean", "FORCE_LANDSCAPE", "false")
            manifestPlaceholders["screenOrientation"] = "portrait"
        }
    }

    buildTypes {
        debug {
            // Dev LAN : ./gradlew assemblePosSunmiDebug -PDEV_LAN_URL=http://192.168.1.10:3000
            val devLan = project.findProperty("DEV_LAN_URL") as String?
            if (devLan != null) {
                productFlavors.configureEach {
                    val path = when (name) {
                        "kds" -> "/kitchen"
                        "livreur" -> "/livreur"
                        else -> "/pos"
                    }
                    buildConfigField("String", "APP_URL", "\"${devLan.trimEnd('/')}$path\"")
                    buildConfigField("String", "ALLOWED_HOST", "\"${devLan.removePrefix("http://").removePrefix("https://").split(":")[0]}\"")
                }
            }
        }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Labo / sideload : keystore debug Android (installe sans certificat prod)
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("io.github.jonanorman.android.webviewup:core:0.1.0")
    "posSunmiImplementation"("com.sunmi:printerlibrary:1.0.18")
}

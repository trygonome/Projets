package net.celeste.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewFeature;

/**
 * Coquille de Céleste.
 *
 * L'application web n'est pas chargée depuis « file:// », qui n'offre pas
 * d'origine véritable — les modules ES y sont bloqués et le stockage local est
 * cloisonné. Elle est servie depuis les assets par {@link WebViewAssetLoader},
 * sous une origine « https » virtuelle : le WebView la traite alors exactement
 * comme un site, modules, stockage et service worker compris.
 *
 * Aucune requête ne sort de l'appareil : tout est empaqueté dans l'APK. La
 * classe s'en tient volontairement aux API du système et à androidx.webkit,
 * la seule dont la coquille ait réellement besoin.
 */
public class MainActivity extends Activity {

    /** Domaine virtuel réservé par AndroidX, jamais résolu sur le réseau. */
    private static final String DOMAINE = "appassets.androidplatform.net";
    /**
     * Le paramètre « hote » annonce à l'application qu'elle est hébergée par
     * l'APK et non par un navigateur : elle adapte alors ce qu'elle dit de son
     * installation et de ses mises à jour.
     */
    private static final String PAGE =
            "https://" + DOMAINE + "/assets/celeste/index.html?hote=android";

    private static final int DEMANDE_POSITION = 1;

    private WebView webView;
    private WebViewAssetLoader assetLoader;

    /** Demande de position en attente, le temps que l'utilisateur réponde. */
    @Nullable private String origineEnAttente;
    @Nullable private GeolocationPermissions.Callback rappelGeolocalisation;

    @Override
    protected void onCreate(@Nullable Bundle etat) {
        super.onCreate(etat);
        dessinerBordABord();

        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(DOMAINE)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF05070E);
        configurer(webView.getSettings());
        webView.setWebViewClient(new ClientLocal());
        webView.setWebChromeClient(new ClientChrome());
        interceptePourLeServiceWorker();

        FrameLayout racine = new FrameLayout(this);
        racine.setBackgroundColor(0xFF05070E);
        racine.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(racine);

        if (etat == null) {
            webView.loadUrl(PAGE);
        } else {
            webView.restoreState(etat);
        }
    }

    /**
     * L'application dessine sous les barres système ; ses marges de sécurité
     * viennent des variables CSS env(safe-area-inset-*), que le WebView
     * renseigne dans cette configuration.
     */
    @SuppressWarnings("deprecation") // setSystemUiVisibility : seul recours avant Android 11
    private void dessinerBordABord() {
        Window fenetre = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            fenetre.setDecorFitsSystemWindows(false);
        } else {
            fenetre.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    private void configurer(WebSettings reglages) {
        reglages.setJavaScriptEnabled(true);
        reglages.setDomStorageEnabled(true);
        reglages.setGeolocationEnabled(true);
        reglages.setDatabaseEnabled(true);

        // Rien n'est chargé depuis le disque ni depuis le réseau : le contenu
        // vient uniquement des assets, par l'intercepteur.
        reglages.setAllowFileAccess(false);
        reglages.setAllowContentAccess(false);
        reglages.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Les vues du ciel et du système gèrent elles-mêmes le pincement ;
        // le zoom du WebView entrerait en conflit avec elles.
        reglages.setSupportZoom(false);
        reglages.setBuiltInZoomControls(false);
        reglages.setDisplayZoomControls(false);

        reglages.setMediaPlaybackRequiresUserGesture(true);
        reglages.setUseWideViewPort(true);
        reglages.setLoadWithOverviewMode(false);
        // La mise en page est exprimée en pixels CSS : la laisser à 100 évite
        // qu'un réglage système de police ne déforme les cartes du ciel.
        reglages.setTextZoom(100);
    }

    /**
     * Le service worker de l'application doit voir les mêmes ressources que la
     * page. Sans cet intercepteur, ses requêtes échoueraient et la mise en
     * cache resterait vaine.
     */
    private void interceptePourLeServiceWorker() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            return;
        }
        ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(
                new ServiceWorkerClientCompat() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(
                            @NonNull WebResourceRequest requete) {
                        return assetLoader.shouldInterceptRequest(requete.getUrl());
                    }
                });
    }

    private class ClientLocal extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(
                WebView vue, WebResourceRequest requete) {
            return assetLoader.shouldInterceptRequest(requete.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView vue, WebResourceRequest requete) {
            Uri adresse = requete.getUrl();
            if (DOMAINE.equals(adresse.getHost())) return false;
            // Tout lien extérieur part au navigateur : la coquille ne devient
            // jamais un navigateur générique.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, adresse)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignoree) {
                // Aucune application pour ce lien : on ne fait rien.
            }
            return true;
        }
    }

    private class ClientChrome extends WebChromeClient {
        @Override
        public void onGeolocationPermissionsShowPrompt(
                String origine, GeolocationPermissions.Callback rappel) {
            // La page ne demande la position que si l'utilisateur le lui
            // demande ; on relaie alors la demande au système.
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED) {
                rappel.invoke(origine, true, false);
                return;
            }
            origineEnAttente = origine;
            rappelGeolocalisation = rappel;
            requestPermissions(
                    new String[] { Manifest.permission.ACCESS_FINE_LOCATION },
                    DEMANDE_POSITION);
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int code, @NonNull String[] permissions, @NonNull int[] resultats) {
        super.onRequestPermissionsResult(code, permissions, resultats);
        if (code != DEMANDE_POSITION || rappelGeolocalisation == null) return;
        boolean accorde = resultats.length > 0
                && resultats[0] == PackageManager.PERMISSION_GRANTED;
        rappelGeolocalisation.invoke(origineEnAttente, accorde, false);
        rappelGeolocalisation = null;
        origineEnAttente = null;
    }

    /** Le retour système suit l'historique des vues avant de quitter. */
    @Override
    public boolean onKeyDown(int code, KeyEvent evenement) {
        if (code == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(code, evenement);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle etat) {
        super.onSaveInstanceState(etat);
        webView.saveState(etat);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Le rendu tridimensionnel et l'horloge s'arrêtent quand l'application
        // passe en arrière-plan : inutile de consommer la batterie.
        webView.onPause();
        webView.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.resumeTimers();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}

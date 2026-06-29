import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withPWA({
  dest: "public",
  // On évite le cache agressif des pages : après un déploiement, les
  // navigations vont toujours chercher la version fraîche (plus de
  // « rien ne change » / mélange ancien-nouveau code). L'app reste installable.
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // On conserve le cache par défaut pour tout le reste…
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    // …mais les gabarits PDF (ordonnances) vont TOUJOURS au réseau : sinon le
    // service worker peut renvoyer le HTML de l'app au lieu du PDF, ce qui fait
    // planter pdf-lib (« No PDF header found ») sur certains mobiles.
    runtimeCaching: [
      { urlPattern: /\.pdf$/i, handler: "NetworkOnly" },
    ],
  },
})(nextConfig);

import Script from "next/script";
import { getSeoSettings } from "@/lib/seo/settings";

/**
 * GA4 + Meta Pixel loaders (BUILD_PROMPT §7.8) driven by settings, not env.
 * Nothing renders until an id is configured, so the demo stays script-free.
 */
export async function AnalyticsScripts() {
  const seo = await getSeoSettings();
  if (!seo.ga4_id && !seo.meta_pixel_id) return null;
  return (
    <>
      {seo.ga4_id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(seo.ga4_id)}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${seo.ga4_id.replace(/[^A-Z0-9-]/gi, "")}',{currency:'BDT'});`}</Script>
        </>
      )}
      {seo.meta_pixel_id && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${seo.meta_pixel_id.replace(/\D/g, "")}');fbq('track','PageView');`}</Script>
      )}
    </>
  );
}

import type {Metadata} from 'next';
import {IBM_Plex_Sans_Arabic, JetBrains_Mono, Manrope} from 'next/font/google';
import './globals.css';

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-latin',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'From Beginning to Civilization — Civilization Observatory',
  description:
    'Autonomous evolutionary civilization simulation engine with independent local neural agents, 5 km2 ecology, emergent proto-language, 3-layer history, and atomic checkpointing.',
  openGraph: {
    title: 'From Beginning to Civilization — Civilization Observatory',
    description:
      'Autonomous evolutionary civilization simulation engine with independent local neural agents, 5 km2 ecology, emergent proto-language, 3-layer history, and atomic checkpointing.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'From Beginning to Civilization — Civilization Observatory',
    description:
      'Autonomous evolutionary civilization simulation engine with independent local neural agents, 5 km2 ecology, emergent proto-language, 3-layer history, and atomic checkpointing.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${ibmArabic.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                if (typeof window === 'undefined') return;
                window.__OBS_DIAGNOSTICS__ = window.__OBS_DIAGNOSTICS__ || [];
                function pushDiag(src, msg, stk) {
                  try {
                    window.__OBS_DIAGNOSTICS__.push({
                      id: Date.now() + '-' + Math.random().toString(36).slice(2,7),
                      timestamp: new Date().toISOString(),
                      source: src,
                      message: String(msg || 'Unknown error'),
                      stack: stk ? String(stk).slice(0, 1200) : undefined
                    });
                    if (window.__OBS_DIAGNOSTICS__.length > 60) {
                      window.__OBS_DIAGNOSTICS__ = window.__OBS_DIAGNOSTICS__.slice(-60);
                    }
                  } catch(_) {}
                }
                window.addEventListener('error', function(e) {
                  pushDiag('window.onerror', e && (e.message || 'Script error'), e && e.error && e.error.stack);
                });
                window.addEventListener('unhandledrejection', function(e) {
                  var r = e && e.reason;
                  pushDiag('unhandledrejection', r && r.message ? r.message : String(r || 'Promise rejected'), r && r.stack);
                });
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="bg-[#0B0F14] font-sans text-[#E6EDF3] antialiased selection:bg-[#D99B26]/30 selection:text-[#F2BE49]"
      >
        {children}
      </body>
    </html>
  );
}

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Custom HTML template for the web app.
 * This file is used to customize the HTML shell of the web app.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* iOS Safari viewport fix: viewport-fit=cover allows content to extend into safe areas */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover, shrink-to-fit=no"
        />
        
        {/* iOS Safari specific meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* Theme color for browser chrome */}
        <meta name="theme-color" content="#151718" />
        <meta name="msapplication-TileColor" content="#151718" />
        
        {/* Expo scroll view reset */}
        <ScrollViewStyleReset />

        {/* iOS Safari safe area and viewport CSS fixes */}
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --sat: env(safe-area-inset-top, 0px);
            --sar: env(safe-area-inset-right, 0px);
            --sab: env(safe-area-inset-bottom, 0px);
            --sal: env(safe-area-inset-left, 0px);
            --app-bg: #151718;
          }
          
          html {
            height: 100%;
            /* Prevent overscroll/bounce on iOS Safari */
            overscroll-behavior: none;
          }
          
          body {
            margin: 0;
            padding: 0;
            width: 100%;
            min-height: 100%;
            overflow: hidden;
            background-color: var(--app-bg);
            /* iOS Safari full height fix */
            min-height: -webkit-fill-available;
          }
          
          #root {
            display: flex;
            flex: 1;
            width: 100%;
            min-height: 100%;
            min-height: 100dvh;
            min-height: -webkit-fill-available;
            /* Apply safe area padding */
            padding-top: env(safe-area-inset-top, 0px);
            padding-right: env(safe-area-inset-right, 0px);
            padding-bottom: env(safe-area-inset-bottom, 0px);
            padding-left: env(safe-area-inset-left, 0px);
            box-sizing: border-box;
            background-color: var(--app-bg);
          }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}

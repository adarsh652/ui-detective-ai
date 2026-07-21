/**
 * UI Detective AI - Main World Detector Script
 * Runs in the web page's MAIN JavaScript execution world to detect
 * frameworks, meta-frameworks, and CSS libraries exposed on window/DOM.
 */
(function () {
  function detectFullTechStack() {
    const stack = [];

    // --- 1. META-FRAMEWORKS ---
    // Next.js
    if (
      window.__NEXT_DATA__ ||
      document.getElementById('__next') ||
      Array.from(document.scripts).some(s => s.src && s.src.includes('/_next/'))
    ) {
      stack.push({ name: 'Next.js', icon: '⚡', color: '#ffffff', bg: '#000000' });
    }

    // Nuxt.js
    if (
      window.__NUXT__ ||
      document.getElementById('__nuxt') ||
      Array.from(document.scripts).some(s => s.src && s.src.includes('/_nuxt/'))
    ) {
      stack.push({ name: 'Nuxt.js', icon: '💚', color: '#00dc82', bg: '#09251b' });
    }

    // Remix
    if (
      window.__remixContext ||
      window.__remixManifest ||
      Array.from(document.scripts).some(s => s.src && s.src.includes('/build/root-'))
    ) {
      stack.push({ name: 'Remix', icon: '💿', color: '#e879f9', bg: '#3b0764' });
    }

    // Astro
    if (
      window.__ASTRO__ ||
      document.querySelector('astro-island, astro-slot') ||
      Array.from(document.attributes || []).some(a => a.name && a.name.startsWith('data-astro-')) ||
      Array.from(document.querySelectorAll('*')).slice(0, 50).some(el => Array.from(el.attributes || []).some(a => a.name.startsWith('data-astro-')))
    ) {
      stack.push({ name: 'Astro', icon: '🚀', color: '#ff5d01', bg: '#311204' });
    }

    // --- 2. JS FRAMEWORKS ---
    // React
    if (
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
      window.React ||
      document.querySelector('[data-reactroot], [data-reactid]') ||
      stack.some(s => s.name === 'Next.js' || s.name === 'Remix') ||
      Array.from(document.querySelectorAll('*')).slice(0, 50).some(el => {
        return Object.keys(el).some(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$') || k.startsWith('__reactContainer$'));
      })
    ) {
      if (!stack.some(s => s.name === 'React')) {
        stack.push({ name: 'React', icon: '⚛️', color: '#61dafb', bg: '#1c2c38' });
      }
    }

    // Vue.js
    if (
      window.__VUE__ ||
      window.Vue ||
      document.querySelector('[data-v-], [v-cloak]') ||
      stack.some(s => s.name === 'Nuxt.js') ||
      Array.from(document.querySelectorAll('*')).slice(0, 50).some(el => el.__vue__ || el.__vue_app__)
    ) {
      if (!stack.some(s => s.name === 'Vue.js')) {
        stack.push({ name: 'Vue.js', icon: '🟢', color: '#42b883', bg: '#0f291e' });
      }
    }

    // Angular
    if (
      window.ng ||
      window.getAllAngularRootElements ||
      document.querySelector('[ng-version], [ng-app], ng-component, [ng-content]')
    ) {
      stack.push({ name: 'Angular', icon: '🅰️', color: '#dd0031', bg: '#38000c' });
    }

    // Svelte
    if (
      window.__svelte ||
      Array.from(document.querySelectorAll('*')).slice(0, 50).some(el => typeof el.className === 'string' && el.className.includes('svelte-'))
    ) {
      stack.push({ name: 'Svelte', icon: '🔥', color: '#ff3e00', bg: '#380e00' });
    }

    // --- 3. CSS FRAMEWORKS & LIBRARIES ---
    // Tailwind CSS
    let hasTailwindVars = false;
    try {
      const rootStyle = getComputedStyle(document.documentElement);
      hasTailwindVars = !!(
        rootStyle.getPropertyValue('--tw-ring-offset-width') ||
        rootStyle.getPropertyValue('--tw-ring-color') ||
        rootStyle.getPropertyValue('--tw-shadow') ||
        rootStyle.getPropertyValue('--spacing') ||
        rootStyle.getPropertyValue('--font-sans')
      );
    } catch (e) {}

    const hasTailwindClasses = Array.from(document.querySelectorAll('*')).slice(0, 100).some(el => {
      const cls = el.className;
      if (typeof cls !== 'string') return false;
      return /\b(flex|grid|hidden|block|relative|absolute|items-center|justify-between|bg-[a-z0-9#-]+|text-[a-z0-9#-]+|p-\d+|px-\d+|py-\d+|m-\d+|rounded-[a-z0-9]+)\b/.test(cls);
    });

    const hasTailwindLink = Array.from(document.querySelectorAll('link[rel="stylesheet"], script')).some(el => {
      const src = el.src || el.href || '';
      return src.includes('tailwind') || src.includes('tailwindcss');
    });

    if (hasTailwindVars || hasTailwindClasses || hasTailwindLink) {
      stack.push({ name: 'Tailwind CSS', icon: '🎨', color: '#38bdf8', bg: '#0c2a38' });
    }

    // Bootstrap
    const hasBootstrap = !!(
      window.bootstrap ||
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(l => l.href && l.href.includes('bootstrap')) ||
      Array.from(document.querySelectorAll('*')).slice(0, 50).some(el => typeof el.className === 'string' && /\b(btn-primary|col-md-\d+|navbar-expand|container-fluid)\b/.test(el.className))
    );
    if (hasBootstrap) {
      stack.push({ name: 'Bootstrap', icon: '🅱️', color: '#7952b3', bg: '#1f1430' });
    }

    // Material UI / MUI
    const hasMUI = Array.from(document.querySelectorAll('*')).slice(0, 50).some(el => {
      const cls = el.className;
      return typeof cls === 'string' && /\bMui[A-Z][a-zA-Z]+-root\b/.test(cls);
    });
    if (hasMUI) {
      stack.push({ name: 'Material UI', icon: '🟦', color: '#007fff', bg: '#001e3c' });
    }

    // Chakra UI
    const hasChakra = !!(
      document.querySelector('[class*="chakra-"], .chakra-ui-light, .chakra-ui-dark') ||
      Array.from(document.querySelectorAll('*')).slice(0, 50).some(el => typeof el.className === 'string' && el.className.includes('chakra-'))
    );
    if (hasChakra) {
      stack.push({ name: 'Chakra UI', icon: '⚡', color: '#319795', bg: '#0d2827' });
    }

    // Radix UI / Shadcn
    const hasShadcnRadix = !!(
      document.querySelector('[data-radix-collection-item], [data-radix-focus-guard], [data-state="open"], [data-state="closed"], [data-slot]')
    );
    if (hasShadcnRadix) {
      stack.push({ name: 'Radix / Shadcn', icon: '🖤', color: '#e2e8f0', bg: '#18181b' });
    }

    // Framer Motion
    if (
      document.querySelector('[data-framer-motion]') ||
      Array.from(document.querySelectorAll('*')).slice(0, 50).some(el => {
        const style = el.getAttribute('style') || '';
        return style.includes('framer-motion');
      })
    ) {
      stack.push({ name: 'Framer Motion', icon: '📐', color: '#f43f5e', bg: '#380c16' });
    }

    return stack;
  }

  // Run detection and send to ISOLATED content script via postMessage
  try {
    const stack = detectFullTechStack();
    window.postMessage({ type: 'UI_DETECTIVE_STACK_RESULT', data: stack }, '*');
  } catch (err) {
    console.warn('UI Detective AI: Error detecting tech stack in MAIN world:', err);
  }
})();

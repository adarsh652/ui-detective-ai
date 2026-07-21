let isInspecting = false;
let overlayEl = null;

function createOverlay() {
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'ui-detective-overlay';
    document.body.appendChild(overlayEl);
  }
}

function removeOverlay() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}

function detectTechStack() {
  const stack = [];

  // 1. Next.js
  if (
    document.getElementById('__next') ||
    window.__NEXT_DATA__ ||
    Array.from(document.scripts).some(s => s.src && s.src.includes('/_next/'))
  ) {
    stack.push({ name: 'Next.js', icon: '⚡', color: '#ffffff', bg: '#000000' });
  }

  // 2. React
  if (
    document.querySelector('[data-reactroot]') ||
    document.querySelector('[data-reactid]') ||
    Array.from(document.querySelectorAll('*')).some(el => {
      return Object.keys(el).some(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$') || k.startsWith('__reactContainer$'));
    }) ||
    stack.some(s => s.name === 'Next.js')
  ) {
    if (!stack.some(s => s.name === 'React')) {
      stack.push({ name: 'React', icon: '⚛️', color: '#61dafb', bg: '#1c2c38' });
    }
  }

  // 3. Vue
  if (
    document.querySelector('[data-v-]') ||
    document.querySelector('[v-cloak]') ||
    Array.from(document.querySelectorAll('*')).some(el => el.__vue__ || el.__vue_app__)
  ) {
    stack.push({ name: 'Vue.js', icon: '🟢', color: '#42b883', bg: '#0f291e' });
  }

  // 4. Tailwind CSS
  const hasTailwindClasses = Array.from(document.querySelectorAll('*')).slice(0, 100).some(el => {
    const cls = el.className;
    if (typeof cls !== 'string') return false;
    return /\b(flex|grid|hidden|block|relative|absolute|items-center|justify-between|bg-[a-z0-9#-]+|text-[a-z0-9#-]+|p-\d+|px-\d+|py-\d+|m-\d+|rounded-[a-z0-9]+)\b/.test(cls);
  });
  const hasTailwindLink = Array.from(document.querySelectorAll('link[rel="stylesheet"], script')).some(el => {
    const src = el.src || el.href || '';
    return src.includes('tailwind') || src.includes('tailwindcss');
  });

  if (hasTailwindClasses || hasTailwindLink) {
    stack.push({ name: 'Tailwind CSS', icon: '🎨', color: '#38bdf8', bg: '#0c2a38' });
  }

  // 5. Framer Motion
  if (
    document.querySelector('[data-framer-motion]') ||
    Array.from(document.querySelectorAll('*')).slice(0, 100).some(el => {
      const style = el.getAttribute('style') || '';
      return style.includes('framer-motion');
    })
  ) {
    stack.push({ name: 'Framer Motion', icon: '📐', color: '#f43f5e', bg: '#380c16' });
  }

  return stack;
}

function rgbToHex(rgbStr) {
  if (!rgbStr || rgbStr === 'transparent' || rgbStr === 'rgba(0, 0, 0, 0)') return null;
  const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  const a = match[4] !== undefined ? parseFloat(match[4]) : 1;

  if (a === 0) return null;

  const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  return { hex, alpha: a };
}

function pxToTailwindSpacing(pxStr) {
  if (!pxStr) return null;
  const val = parseFloat(pxStr);
  if (isNaN(val) || val === 0) return '0';

  const spacingMap = [
    { px: 0, scale: '0' },
    { px: 2, scale: '0.5' },
    { px: 4, scale: '1' },
    { px: 6, scale: '1.5' },
    { px: 8, scale: '2' },
    { px: 10, scale: '2.5' },
    { px: 12, scale: '3' },
    { px: 14, scale: '3.5' },
    { px: 16, scale: '4' },
    { px: 20, scale: '5' },
    { px: 24, scale: '6' },
    { px: 28, scale: '7' },
    { px: 32, scale: '8' },
    { px: 36, scale: '9' },
    { px: 40, scale: '10' },
    { px: 44, scale: '11' },
    { px: 48, scale: '12' },
    { px: 56, scale: '14' },
    { px: 64, scale: '16' },
    { px: 80, scale: '20' },
    { px: 96, scale: '24' }
  ];

  let closest = spacingMap[0];
  let minDiff = Math.abs(val - closest.px);

  for (const item of spacingMap) {
    const diff = Math.abs(val - item.px);
    if (diff < minDiff) {
      minDiff = diff;
      closest = item;
    }
  }

  if (minDiff > 3 && val > 16) {
    return `[${Math.round(val)}px]`;
  }
  return closest.scale;
}

function mapFontSize(fontSizePx) {
  const val = parseFloat(fontSizePx);
  if (isNaN(val)) return null;

  const fontSizes = [
    { px: 12, class: 'text-xs' },
    { px: 14, class: 'text-sm' },
    { px: 16, class: 'text-base' },
    { px: 18, class: 'text-lg' },
    { px: 20, class: 'text-xl' },
    { px: 24, class: 'text-2xl' },
    { px: 30, class: 'text-3xl' },
    { px: 36, class: 'text-4xl' },
    { px: 48, class: 'text-5xl' },
    { px: 60, class: 'text-6xl' },
    { px: 72, class: 'text-7xl' },
    { px: 96, class: 'text-8xl' }
  ];

  let closest = fontSizes[0];
  let minDiff = Math.abs(val - closest.px);
  for (const f of fontSizes) {
    const diff = Math.abs(val - f.px);
    if (diff < minDiff) {
      minDiff = diff;
      closest = f;
    }
  }
  if (minDiff > 2) {
    return `text-[${Math.round(val)}px]`;
  }
  return closest.class;
}

function mapFontWeight(weightStr) {
  const val = parseInt(weightStr);
  if (isNaN(val)) {
    if (weightStr === 'bold') return 'font-bold';
    if (weightStr === 'normal') return 'font-normal';
    return null;
  }
  if (val <= 150) return 'font-thin';
  if (val <= 250) return 'font-extralight';
  if (val <= 350) return 'font-light';
  if (val <= 450) return 'font-normal';
  if (val <= 550) return 'font-medium';
  if (val <= 650) return 'font-semibold';
  if (val <= 750) return 'font-bold';
  if (val <= 850) return 'font-extrabold';
  return 'font-black';
}

function getTailwindBorderRadius(radiusStr, width, height) {
  if (!radiusStr) return 'rounded-none';
  if (radiusStr.includes('%')) {
    const val = parseFloat(radiusStr);
    if (val >= 50) return 'rounded-full';
  }
  const pxVal = parseFloat(radiusStr);
  if (isNaN(pxVal) || pxVal === 0) return 'rounded-none';

  const minDim = Math.min(width || 0, height || 0);
  if (minDim > 0 && pxVal >= minDim / 2) return 'rounded-full';

  const thresholds = [
    { limit: 1, class: 'rounded-none' },
    { limit: 3, class: 'rounded-sm' },
    { limit: 5, class: 'rounded' },
    { limit: 7, class: 'rounded-md' },
    { limit: 10, class: 'rounded-lg' },
    { limit: 14, class: 'rounded-xl' },
    { limit: 20, class: 'rounded-2xl' },
    { limit: 28, class: 'rounded-3xl' },
    { limit: Infinity, class: 'rounded-full' }
  ];

  for (const t of thresholds) {
    if (pxVal <= t.limit) return t.class;
  }
  return 'rounded-full';
}

function cssToTailwind(style, rect) {
  const classes = [];

  // Font Size & Weight
  const fontSizeCls = mapFontSize(style.fontSize);
  if (fontSizeCls) classes.push(fontSizeCls);

  const fontWeightCls = mapFontWeight(style.fontWeight);
  if (fontWeightCls && fontWeightCls !== 'font-normal') classes.push(fontWeightCls);

  // Colors
  const textColor = rgbToHex(style.color);
  if (textColor) {
    if (textColor.hex === '#ffffff') classes.push('text-white');
    else if (textColor.hex === '#000000') classes.push('text-black');
    else classes.push(`text-[${textColor.hex}]`);
  }

  const bgColor = rgbToHex(style.backgroundColor);
  if (bgColor) {
    if (bgColor.hex === '#ffffff') classes.push('bg-white');
    else if (bgColor.hex === '#000000') classes.push('bg-black');
    else classes.push(`bg-[${bgColor.hex}]`);
  }

  // Padding
  const pt = pxToTailwindSpacing(style.paddingTop);
  const pr = pxToTailwindSpacing(style.paddingRight);
  const pb = pxToTailwindSpacing(style.paddingBottom);
  const pl = pxToTailwindSpacing(style.paddingLeft);

  if (pt && pr && pb && pl) {
    if (pt === pr && pr === pb && pb === pl) {
      if (pt !== '0') classes.push(`p-${pt}`);
    } else if (pt === pb && pr === pl) {
      if (pt !== '0') classes.push(`py-${pt}`);
      if (pr !== '0') classes.push(`px-${pr}`);
    } else {
      if (pt !== '0') classes.push(`pt-${pt}`);
      if (pr !== '0') classes.push(`pr-${pr}`);
      if (pb !== '0') classes.push(`pb-${pb}`);
      if (pl !== '0') classes.push(`pl-${pl}`);
    }
  }

  // Margin
  const mt = pxToTailwindSpacing(style.marginTop);
  const mr = pxToTailwindSpacing(style.marginRight);
  const mb = pxToTailwindSpacing(style.marginBottom);
  const ml = pxToTailwindSpacing(style.marginLeft);

  if (mt && mr && mb && ml) {
    if (mt === mr && mr === mb && mb === ml) {
      if (mt !== '0') classes.push(`m-${mt}`);
    } else if (mt === mb && mr === ml) {
      if (mt !== '0') classes.push(`my-${mt}`);
      if (mr !== '0') classes.push(`mx-${mr}`);
    } else {
      if (mt !== '0') classes.push(`mt-${mt}`);
      if (mr !== '0') classes.push(`mr-${mr}`);
      if (mb !== '0') classes.push(`mb-${mb}`);
      if (ml !== '0') classes.push(`ml-${ml}`);
    }
  }

  // Border Radius
  const radius = getTailwindBorderRadius(style.borderRadius, rect ? rect.width : 0, rect ? rect.height : 0);
  if (radius && radius !== 'rounded-none') {
    classes.push(radius);
  }

  return classes;
}

function handleMouseMove(e) {
  if (!isInspecting) return;

  const target = e.target;
  if (!target || target === overlayEl || target.id === 'ui-detective-overlay') return;

  const rect = target.getBoundingClientRect();
  createOverlay();

  overlayEl.style.display = 'block';
  overlayEl.style.top = `${rect.top}px`;
  overlayEl.style.left = `${rect.left}px`;
  overlayEl.style.width = `${rect.width}px`;
  overlayEl.style.height = `${rect.height}px`;

  const style = window.getComputedStyle(target);
  const padding = `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`;
  const margin = `${style.marginTop} ${style.marginRight} ${style.marginBottom} ${style.marginLeft}`;
  const borderRadius = style.borderRadius;
  const tailwindRadius = getTailwindBorderRadius(borderRadius, rect.width, rect.height);
  const tailwindClasses = cssToTailwind(style, rect);

  const inspectData = {
    tagName: target.tagName.toLowerCase(),
    width: `${Math.round(rect.width)}px`,
    height: `${Math.round(rect.height)}px`,
    fontFamily: style.fontFamily.replace(/"/g, "'"),
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    color: style.color,
    backgroundColor: style.backgroundColor,
    padding: padding,
    margin: margin,
    borderRadius: borderRadius,
    border: `${style.borderWidth} ${style.borderStyle} ${style.borderColor}`,
    borderWidth: style.borderWidth,
    borderStyle: style.borderStyle,
    borderColor: style.borderColor,
    display: style.display,
    flexDirection: style.flexDirection,
    gap: style.gap,
    tailwindRadius: tailwindRadius,
    tailwindClasses: tailwindClasses
  };

  chrome.runtime.sendMessage({
    type: 'UI_INSPECT_DATA',
    data: inspectData
  }).catch(() => {
    // Ignore error if sidepanel is not open / listening
  });
}

let latestTechStack = [];

window.addEventListener('message', (event) => {
  if (event.source === window && event.data && event.data.type === 'UI_DETECTIVE_STACK_RESULT') {
    latestTechStack = event.data.data || [];
    chrome.storage.local.set({ currentTechStack: latestTechStack });
    chrome.runtime.sendMessage({
      type: 'TECH_STACK_UPDATED',
      techStack: latestTechStack
    }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_INSPECTOR') {
    if (message.isInspecting !== undefined) {
      isInspecting = message.isInspecting;
    } else if (message.enabled !== undefined) {
      isInspecting = message.enabled;
    } else {
      isInspecting = !isInspecting;
    }

    if (isInspecting) {
      document.addEventListener('mousemove', handleMouseMove, true);
      createOverlay();
    } else {
      document.removeEventListener('mousemove', handleMouseMove, true);
      removeOverlay();
    }
    const stack = latestTechStack.length > 0 ? latestTechStack : detectTechStack();
    sendResponse({ isInspecting, techStack: stack });
  } else if (message.type === 'GET_TECH_STACK') {
    const stack = latestTechStack.length > 0 ? latestTechStack : detectTechStack();
    sendResponse({ techStack: stack });
  }
  return true;
});

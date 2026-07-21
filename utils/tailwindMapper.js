/**
 * UI Detective AI - Client-Side CSS to Tailwind Tokenizer Utility
 * Converts computed DOM element styles into standard Tailwind v3/v4 utility classes.
 */

export function rgbToHex(rgbStr) {
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

export function pxToSpacingToken(pxStr) {
  if (!pxStr) return null;
  const val = parseFloat(pxStr);
  if (isNaN(val) || val === 0) return '0';

  const spacingMap = [
    { px: 0, token: '0' },
    { px: 2, token: '0.5' },
    { px: 4, token: '1' },
    { px: 6, token: '1.5' },
    { px: 8, token: '2' },
    { px: 10, token: '2.5' },
    { px: 12, token: '3' },
    { px: 14, token: '3.5' },
    { px: 16, token: '4' },
    { px: 20, token: '5' },
    { px: 24, token: '6' },
    { px: 28, token: '7' },
    { px: 32, token: '8' },
    { px: 36, token: '9' },
    { px: 40, token: '10' },
    { px: 44, token: '11' },
    { px: 48, token: '12' },
    { px: 56, token: '14' },
    { px: 64, token: '16' },
    { px: 80, token: '20' },
    { px: 96, token: '24' }
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
  return closest.token;
}

export function mapFontSizeToken(fontSizePx) {
  const val = parseFloat(fontSizePx);
  if (isNaN(val)) return null;

  const fontSizes = [
    { px: 12, token: 'text-xs' },
    { px: 14, token: 'text-sm' },
    { px: 16, token: 'text-base' },
    { px: 18, token: 'text-lg' },
    { px: 20, token: 'text-xl' },
    { px: 24, token: 'text-2xl' },
    { px: 30, token: 'text-3xl' },
    { px: 36, token: 'text-4xl' },
    { px: 48, token: 'text-5xl' },
    { px: 60, token: 'text-6xl' },
    { px: 72, token: 'text-7xl' },
    { px: 96, token: 'text-8xl' }
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
  return closest.token;
}

export function mapFontWeightToken(weightStr) {
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

export function mapBorderRadiusToken(radiusStr, width, height) {
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
    { limit: 1, token: 'rounded-none' },
    { limit: 3, token: 'rounded-sm' },
    { limit: 5, token: 'rounded' },
    { limit: 7, token: 'rounded-md' },
    { limit: 10, token: 'rounded-lg' },
    { limit: 14, token: 'rounded-xl' },
    { limit: 20, token: 'rounded-2xl' },
    { limit: 28, token: 'rounded-3xl' },
    { limit: Infinity, token: 'rounded-full' }
  ];

  for (const t of thresholds) {
    if (pxVal <= t.limit) return t.token;
  }
  return 'rounded-full';
}

export function generateTailwindTokens(data) {
  if (!data) return [];
  const tokens = [];

  // Layout Display
  if (data.display) {
    if (data.display === 'flex') tokens.push('flex');
    else if (data.display === 'inline-flex') tokens.push('inline-flex');
    else if (data.display === 'grid') tokens.push('grid');
    else if (data.display === 'block') tokens.push('block');
    else if (data.display === 'inline-block') tokens.push('inline-block');
    else if (data.display === 'hidden' || data.display === 'none') tokens.push('hidden');
  }

  // Flex Direction
  if (data.flexDirection && (data.display === 'flex' || data.display === 'inline-flex')) {
    if (data.flexDirection === 'column') tokens.push('flex-col');
    else if (data.flexDirection === 'column-reverse') tokens.push('flex-col-reverse');
    else if (data.flexDirection === 'row-reverse') tokens.push('flex-row-reverse');
  }

  // Gap
  if (data.gap && data.gap !== 'normal' && data.gap !== '0px') {
    const gapToken = pxToSpacingToken(data.gap);
    if (gapToken && gapToken !== '0') tokens.push(`gap-${gapToken}`);
  }

  // Typography
  const fontCls = mapFontSizeToken(data.fontSize);
  if (fontCls) tokens.push(fontCls);

  const weightCls = mapFontWeightToken(data.fontWeight);
  if (weightCls && weightCls !== 'font-normal') tokens.push(weightCls);

  // Line Height
  if (data.lineHeight && data.lineHeight !== 'normal') {
    const lhPx = parseFloat(data.lineHeight);
    const fsPx = parseFloat(data.fontSize);
    if (!isNaN(lhPx) && !isNaN(fsPx) && fsPx > 0) {
      const ratio = lhPx / fsPx;
      if (ratio <= 1.1) tokens.push('leading-none');
      else if (ratio <= 1.3) tokens.push('leading-tight');
      else if (ratio <= 1.4) tokens.push('leading-snug');
      else if (ratio <= 1.6) tokens.push('leading-normal');
      else if (ratio <= 1.8) tokens.push('leading-relaxed');
      else tokens.push('leading-loose');
    }
  }

  // Letter Spacing
  if (data.letterSpacing && data.letterSpacing !== 'normal' && data.letterSpacing !== '0px') {
    const lsPx = parseFloat(data.letterSpacing);
    if (!isNaN(lsPx)) {
      if (lsPx <= -0.8) tokens.push('tracking-tighter');
      else if (lsPx < 0) tokens.push('tracking-tight');
      else if (lsPx >= 1.5) tokens.push('tracking-widest');
      else if (lsPx >= 0.8) tokens.push('tracking-wider');
      else if (lsPx > 0) tokens.push('tracking-wide');
    }
  }

  // Colors
  const textColor = rgbToHex(data.color);
  if (textColor) {
    if (textColor.hex === '#ffffff') tokens.push('text-white');
    else if (textColor.hex === '#000000') tokens.push('text-black');
    else tokens.push(`text-[${textColor.hex}]`);
  }

  const bgColor = rgbToHex(data.backgroundColor);
  if (bgColor) {
    if (bgColor.hex === '#ffffff') tokens.push('bg-white');
    else if (bgColor.hex === '#000000') tokens.push('bg-black');
    else tokens.push(`bg-[${bgColor.hex}]`);
  }

  // Padding & Margin (if individual properties provided)
  if (data.padding) {
    const parts = data.padding.split(' ');
    if (parts.length === 4) {
      const pt = pxToSpacingToken(parts[0]);
      const pr = pxToSpacingToken(parts[1]);
      const pb = pxToSpacingToken(parts[2]);
      const pl = pxToSpacingToken(parts[3]);

      if (pt && pr && pb && pl) {
        if (pt === pr && pr === pb && pb === pl) {
          if (pt !== '0') tokens.push(`p-${pt}`);
        } else if (pt === pb && pr === pl) {
          if (pt !== '0') tokens.push(`py-${pt}`);
          if (pr !== '0') tokens.push(`px-${pr}`);
        } else {
          if (pt !== '0') tokens.push(`pt-${pt}`);
          if (pr !== '0') tokens.push(`pr-${pr}`);
          if (pb !== '0') tokens.push(`pb-${pb}`);
          if (pl !== '0') tokens.push(`pl-${pl}`);
        }
      }
    }
  }

  // Border Radius
  const radius = mapBorderRadiusToken(data.borderRadius, parseFloat(data.width), parseFloat(data.height));
  if (radius && radius !== 'rounded-none') {
    tokens.push(radius);
  }

  return tokens;
}

if (typeof window !== 'undefined') {
  window.tailwindMapper = {
    rgbToHex,
    pxToSpacingToken,
    mapFontSizeToken,
    mapFontWeightToken,
    mapBorderRadiusToken,
    generateTailwindTokens
  };
}

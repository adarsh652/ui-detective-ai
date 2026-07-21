/**
 * UI Detective AI - Accessibility (a11y) and Responsiveness Auditor Utility
 * Performs offline client-side WCAG contrast ratio calculations, touch target audits,
 * screen reader attribute checks, and responsiveness strategy detection.
 */

export function parseRgb(rgbStr) {
  if (!rgbStr || rgbStr === 'transparent' || rgbStr === 'rgba(0, 0, 0, 0)') return null;
  const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
  if (a === 0) return null;
  return { r, g, b, a };
}

function getLinearComponent(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(r, g, b) {
  const R = getLinearComponent(r);
  const G = getLinearComponent(g);
  const B = getLinearComponent(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function calculateContrastRatio(fgStr, bgStr) {
  let fgRgb = parseRgb(fgStr);
  let bgRgb = parseRgb(bgStr);

  if (!bgRgb) bgRgb = { r: 255, g: 255, b: 255, a: 1 };
  if (!fgRgb) fgRgb = { r: 0, g: 0, b: 0, a: 1 };

  const l1 = getRelativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const l2 = getRelativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  const rounded = Math.round(ratio * 10) / 10;

  let badge = '';
  let level = '';

  if (rounded >= 7.0) {
    level = 'AAA';
    badge = `${rounded}:1 (AAA ✅)`;
  } else if (rounded >= 4.5) {
    level = 'AA';
    badge = `${rounded}:1 (AA ✅)`;
  } else {
    level = 'Fail';
    badge = `${rounded}:1 (Fail ❌)`;
  }

  return { ratio: rounded, level, badge };
}

export function auditTouchTarget(data) {
  const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
  const isInteractive =
    interactiveTags.includes(data.tagName) ||
    data.role === 'button' ||
    data.role === 'link' ||
    data.hasOnClick ||
    data.isClickable;

  const width = parseFloat(data.width) || 0;
  const height = parseFloat(data.height) || 0;

  if (!isInteractive) {
    return { isInteractive: false, status: 'N/A' };
  }

  if (width >= 24 && height >= 24) {
    if (width >= 44 && height >= 44) {
      return { isInteractive: true, status: `Pass (${width}×${height}px ✅)` };
    }
    return { isInteractive: true, status: `Pass (${width}×${height}px ⚠️)` };
  } else {
    return { isInteractive: true, status: `Small Target (${width}×${height}px ❌)` };
  }
}

export function auditScreenReader(data) {
  const hasA11yAttr = !!(
    (data.ariaLabel && data.ariaLabel.trim()) ||
    (data.ariaLabelledBy && data.ariaLabelledBy.trim()) ||
    (data.title && data.title.trim()) ||
    (data.alt !== undefined && data.alt !== null && data.alt.trim() !== '')
  );

  const isMediaOrInteractive =
    ['button', 'a', 'input', 'select', 'textarea', 'img'].includes(data.tagName) ||
    data.role === 'button' ||
    data.role === 'link' ||
    data.isClickable;

  if (isMediaOrInteractive) {
    if (hasA11yAttr || data.hasText) {
      return 'Present ✅';
    }
    return 'Missing ⚠️';
  }

  return 'N/A';
}

export function detectResponsiveness(data) {
  if (data.flexWrap === 'wrap' || data.display === 'flex' || data.display === 'inline-flex') {
    return 'Fluid / Flex';
  }
  if (data.gridTemplateColumns && (data.gridTemplateColumns.includes('repeat') || data.display === 'grid')) {
    return 'Auto Layout';
  }
  if (data.styleAttr && (data.styleAttr.includes('%') || data.styleAttr.includes('vw') || data.styleAttr.includes('rem'))) {
    return 'Fluid Width';
  }
  return 'Fixed Width';
}

export function runFullA11yAudit(data) {
  const contrast = calculateContrastRatio(data.color, data.effectiveBgColor || data.backgroundColor);
  const touch = auditTouchTarget(data);
  const a11y = auditScreenReader(data);
  const responsive = detectResponsiveness(data);

  return {
    contrast,
    touch,
    a11y,
    responsive,
    contrastRatio: contrast.badge,
    touchTarget: touch.status,
    screenReader: a11y,
    responsiveStrategy: responsive
  };
}

if (typeof window !== 'undefined') {
  window.a11yAuditor = {
    parseRgb,
    calculateContrastRatio,
    auditTouchTarget,
    auditScreenReader,
    detectResponsiveness,
    runFullA11yAudit
  };
}

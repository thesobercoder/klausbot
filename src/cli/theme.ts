/**
 * CLI theme module with muted aesthetic output helpers
 *
 * All methods output directly to console (void return).
 * Respects NO_COLOR environment variable for accessibility.
 */

import pc from 'picocolors';

// Check NO_COLOR at module load (picocolors handles this, but be explicit)
const noColor = Boolean(process.env.NO_COLOR);

/**
 * Color functions that respect NO_COLOR
 * Picocolors already handles this, but we wrap for clarity
 */
const colors = {
  green: noColor ? (s: string) => s : pc.green,
  red: noColor ? (s: string) => s : pc.red,
  yellow: noColor ? (s: string) => s : pc.yellow,
  magenta: noColor ? (s: string) => s : pc.magenta,
  dim: noColor ? (s: string) => s : pc.dim,
  bold: noColor ? (s: string) => s : pc.bold,
  boldGreen: noColor ? (s: string) => s : (s: string) => pc.bold(pc.green(s)),
  boldMagenta: noColor ? (s: string) => s : (s: string) => pc.bold(pc.magenta(s)),
  boldYellow: noColor ? (s: string) => s : (s: string) => pc.bold(pc.yellow(s)),
};

/**
 * Unicode symbols for output - modern minimal style
 */
const symbols = {
  check: '\u2713',   // ✓ checkmark
  cross: '\u2717',   // ✗ x mark
  warning: '\u26A0', // ⚠ warning triangle
  info: '\u2139',    // ℹ info circle
  bullet: '\u2022',  // • bullet point
  arrow: '\u2192',   // → right arrow
  pointer: '\u25B8', // ▸ right pointer (modern header icon)
};

/**
 * Box drawing characters for tables and boxes
 */
const box = {
  topLeft: '\u250C',     // ┌
  topRight: '\u2510',    // ┐
  bottomLeft: '\u2514',  // └
  bottomRight: '\u2518', // ┘
  horizontal: '\u2500',  // ─
  vertical: '\u2502',    // │
  leftT: '\u251C',       // ├
  rightT: '\u2524',      // ┤
  topT: '\u252C',        // ┬
  bottomT: '\u2534',     // ┴
  cross: '\u253C',       // ┼
};

/**
 * Output success message with green checkmark
 * Style: ✓ message (green)
 */
function success(msg: string): void {
  console.log(`${colors.green(symbols.check)} ${colors.green(msg)}`);
}

/**
 * Output error message with red X
 * Style: ✗ message (red)
 */
function error(msg: string): void {
  console.log(`${colors.red(symbols.cross)} ${colors.red(msg)}`);
}

/**
 * Output warning message with yellow warning symbol
 * Style: ⚠ message (yellow)
 */
function warn(msg: string): void {
  console.log(`${colors.yellow(symbols.warning)}  ${colors.yellow(msg)}`);
}

/**
 * Output info message with dim info symbol
 * Style: ℹ message (dim for subtle info)
 */
function info(msg: string): void {
  console.log(`${colors.dim(symbols.info)} ${colors.dim(msg)}`);
}

/**
 * Output header with equal sign borders
 * Uses magenta equal sign lines (top/bottom) + pointer icon + bold magenta title
 */
function header(title: string, lineWidth = 23): void {
  const equalLine = '\u2550'.repeat(lineWidth); // ═ double horizontal
  console.log(''); // blank line before for separation
  console.log(colors.magenta(equalLine));
  console.log(`${colors.boldMagenta(symbols.pointer)} ${colors.boldMagenta(title)}`);
  console.log(colors.magenta(equalLine));
}

/**
 * Output blank line
 */
function blank(): void {
  console.log('');
}

/**
 * Output horizontal divider
 */
function divider(char = box.horizontal, width = 40): void {
  console.log(colors.dim(char.repeat(width)));
}

interface ListOptions {
  indent?: number;
  bullet?: string;
}

/**
 * Output bullet list with optional indentation
 */
function list(items: string[], opts: ListOptions = {}): void {
  const { indent = 0, bullet = symbols.bullet } = opts;
  const prefix = ' '.repeat(indent);
  for (const item of items) {
    console.log(`${prefix}${colors.dim(bullet)} ${item}`);
  }
}

interface KeyValueOptions {
  keyWidth?: number;
  separator?: string;
}

/**
 * Output aligned key-value pair
 */
function keyValue(key: string, value: string, opts: KeyValueOptions = {}): void {
  const { keyWidth = 12, separator = ':' } = opts;
  const paddedKey = key.padEnd(keyWidth);
  console.log(`${colors.dim(paddedKey)}${separator} ${value}`);
}

interface TableOptions {
  headers?: string[];
  columnWidths?: number[];
}

/**
 * Calculate column widths from data
 */
function calculateColumnWidths(
  rows: string[][],
  headers?: string[]
): number[] {
  const allRows = headers ? [headers, ...rows] : rows;
  if (allRows.length === 0) return [];

  const numCols = Math.max(...allRows.map((r) => r.length));
  const widths: number[] = new Array(numCols).fill(0);

  for (const row of allRows) {
    for (let i = 0; i < row.length; i++) {
      widths[i] = Math.max(widths[i], String(row[i] || '').length);
    }
  }

  return widths;
}

/**
 * Output Unicode box-drawing table
 */
function table(rows: string[][], opts: TableOptions = {}): void {
  const { headers } = opts;
  let { columnWidths } = opts;

  if (!columnWidths) {
    columnWidths = calculateColumnWidths(rows, headers);
  }

  // Build row formatter
  const formatRow = (cells: string[]): string => {
    const formatted = columnWidths!.map((w, i) => {
      const cell = String(cells[i] || '').padEnd(w);
      return cell;
    });
    return `${box.vertical} ${formatted.join(` ${box.vertical} `)} ${box.vertical}`;
  };

  // Top border
  const topBorder = `${box.topLeft}${columnWidths
    .map((w) => box.horizontal.repeat(w + 2))
    .join(box.topT)}${box.topRight}`;

  // Header separator
  const headerSep = `${box.leftT}${columnWidths
    .map((w) => box.horizontal.repeat(w + 2))
    .join(box.cross)}${box.rightT}`;

  // Bottom border
  const bottomBorder = `${box.bottomLeft}${columnWidths
    .map((w) => box.horizontal.repeat(w + 2))
    .join(box.bottomT)}${box.bottomRight}`;

  // Output
  console.log(topBorder);
  if (headers) {
    console.log(formatRow(headers.map((h) => colors.bold(h))));
    console.log(headerSep);
  }
  for (const row of rows) {
    console.log(formatRow(row));
  }
  console.log(bottomBorder);
}

interface BoxOptions {
  title?: string;
  padding?: number;
  width?: number;
}

/**
 * Output bordered box with optional title
 */
function boxed(content: string | string[], opts: BoxOptions = {}): void {
  const { title, padding = 1, width: fixedWidth } = opts;
  const lines = Array.isArray(content) ? content : content.split('\n');

  // Calculate width
  const contentWidth = Math.max(...lines.map((l) => l.length));
  const titleWidth = title ? title.length + 2 : 0; // +2 for spaces
  const innerWidth = fixedWidth
    ? fixedWidth - 4 // subtract borders and min padding
    : Math.max(contentWidth, titleWidth) + padding * 2;

  // Horizontal padding
  const hPad = ' '.repeat(padding);

  // Top border with optional title
  let topLine: string;
  if (title) {
    const titlePart = ` ${title} `;
    const remainingWidth = innerWidth - titlePart.length;
    const leftWidth = Math.floor(remainingWidth / 2);
    const rightWidth = remainingWidth - leftWidth;
    topLine = `${box.topLeft}${box.horizontal.repeat(leftWidth)}${titlePart}${box.horizontal.repeat(rightWidth)}${box.topRight}`;
  } else {
    topLine = `${box.topLeft}${box.horizontal.repeat(innerWidth)}${box.topRight}`;
  }

  // Bottom border
  const bottomLine = `${box.bottomLeft}${box.horizontal.repeat(innerWidth)}${box.bottomRight}`;

  // Output
  console.log(topLine);
  for (const line of lines) {
    const paddedLine = line.padEnd(innerWidth - padding * 2);
    console.log(`${box.vertical}${hPad}${paddedLine}${hPad}${box.vertical}`);
  }
  console.log(bottomLine);
}

/**
 * Output klausbot ASCII art branding
 * Solid filled block letter style - just the name
 */
function asciiArt(): void {
  const lines = [
    '',
    '██╗  ██╗██╗      █████╗ ██╗   ██╗███████╗██████╗  ██████╗ ████████╗',
    '██║ ██╔╝██║     ██╔══██╗██║   ██║██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝',
    '█████╔╝ ██║     ███████║██║   ██║███████╗██████╔╝██║   ██║   ██║   ',
    '██╔═██╗ ██║     ██╔══██║██║   ██║╚════██║██╔══██╗██║   ██║   ██║   ',
    '██║  ██╗███████╗██║  ██║╚██████╔╝███████║██████╔╝╚██████╔╝   ██║   ',
    '╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═════╝  ╚═════╝    ╚═╝   ',
    '',
  ];

  for (const line of lines) {
    console.log(colors.magenta(line));
  }
}

/**
 * Output muted/dim text
 */
function muted(msg: string): void {
  console.log(colors.dim(msg));
}

/**
 * Output text with specific color
 */
function text(msg: string): void {
  console.log(msg);
}

/**
 * Theme singleton with all output helpers
 */
export const theme = {
  // Status messages
  success,
  error,
  warn,
  info,

  // Structural output
  header,
  divider,
  blank,

  // Lists and tables
  list,
  keyValue,
  table,

  // Boxes
  box: boxed,

  // Branding
  asciiArt,

  // Text variants
  muted,
  text,

  // Raw color access (for advanced usage)
  colors,
  symbols,
};

// Named exports for convenience
export {
  success,
  error,
  warn,
  info,
  header,
  divider,
  blank,
  list,
  keyValue,
  table,
  boxed as box,
  asciiArt,
  muted,
  text,
};

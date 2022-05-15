type WalkFunction = (node: BaseNode, context?: any) => 'skipchildren' | any;

export function walk(node: BaseNode, fn: WalkFunction, context?: any) {
  context = fn(node, context);
  if (context === 'skipchildren') {
    return;
  }
  if ((<ChildrenMixin>node).children) {
    (<ChildrenMixin>node).children.forEach(child => walk(child, fn, context));
  }
}


export function pageContainingNode(node: BaseNode) {
  while (node?.type !== 'PAGE') {
    node = node.parent!;
  }
  return node.type === 'PAGE' ? node : null;
}

/**
 * Mixes the given colors (RGBA dicts) at the given amount (0 to 1).
 */
export function mixColors(c1: RGBA, c2: RGBA, amount: number): RGBA {
  // from tinycolor
  // https://github.com/bgrins/TinyColor/blob/master/tinycolor.js#L701
  amount = (amount === 0) ? 0 : (amount || 50);

  return {
    r: ((c2.r - c1.r) * amount) + c1.r,
    g: ((c2.g - c1.g) * amount) + c1.g,
    b: ((c2.b - c1.b) * amount) + c1.b,
    a: ((c2.a - c1.a) * amount) + c1.a
  };
}


/**
 * Blends the given colors (RGBA dicts) using the "over" paint operation.
 */
export function flattenColors(fg: RGBA, bg: RGBA): RGBA {
  // https://en.wikipedia.org/wiki/Alpha_compositing
  let a = fg.a + bg.a * (1 - fg.a);
  if (a == 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  return {
    r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
    g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
    b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
    a
  };
}


/**
 * Calculates the luminance of the given RGB color.
 */
export function srgbLuminance({ r, g, b }: RGB) {
  // from tinycolor
  // https://github.com/bgrins/TinyColor/blob/master/tinycolor.js#L75
  // http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
  let R: number, G: number, B: number;
  if (r <= 0.03928) { R = r / 12.92; } else { R = Math.pow(((r + 0.055) / 1.055), 2.4); }
  if (g <= 0.03928) { G = g / 12.92; } else { G = Math.pow(((g + 0.055) / 1.055), 2.4); }
  if (b <= 0.03928) { B = b / 12.92; } else { B = Math.pow(((b + 0.055) / 1.055), 2.4); }
  return (0.2126 * R) + (0.7152 * G) + (0.0722 * B);
}

export async function sleep(delay = 0) {
  await new Promise(resolve => setTimeout(resolve, delay));
}
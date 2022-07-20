import { emit, on, showUI } from '@create-figma-plugin/utilities';
import * as util from '../../util';

const WINDOW_SIZE_KEY = 'size';

export default function () {
  if (!figma.currentPage.children.length) {
    figma.notify('Nothing to report!');
    figma.closePlugin();
    return;
  }

  (async () => {
    let size = await figma.clientStorage.getAsync(WINDOW_SIZE_KEY) || { width: 900, height: 600 };
    let { allOnPage, targetFrames } = identifyTargetFrames();
    let subject = `page "${figma.currentPage.name}"`;
    if (!allOnPage) {
      subject = targetFrames.length === 1
        ? `frame "${targetFrames[0].name}"`
        : `${targetFrames.length} frames`;
    }
    showUI({
      title: `Contrast for ${subject}`,
      ...size
    });
    let frameReports = await generateReportsForFrames(targetFrames);
    emit('REPORT_AVAILABLE', { frameReports });
  })();

  on('RESIZE', (width, height) => {
    width = Math.ceil(width);
    height = Math.ceil(height);
    figma.ui.resize(width, height);
    figma.clientStorage.setAsync(WINDOW_SIZE_KEY, { width, height });
  });

  on('SELECT_NODE', nodeId => {
    let node = figma.getNodeById(nodeId) as SceneNode;
    if (!node) {
      console.warn(`Node ${nodeId} not found.`);
      return;
    }

    figma.currentPage = util.pageContainingNode(node)!;

    // do some math to ensure that when the selection changes, the newly selected
    // node will be roughly in the same place in the viewport
    let selInViewportOffset = null;
    if (figma.currentPage.selection.length) {
      let firstSelected = figma.currentPage.selection[0];
      selInViewportOffset = {
        x: firstSelected.absoluteTransform[0][2] + firstSelected.width / 2 - figma.viewport.center.x,
        y: firstSelected.absoluteTransform[1][2] + firstSelected.height / 2 - figma.viewport.center.y,
      };
      selInViewportOffset.x = Math.min(figma.viewport.bounds.width / 2, Math.max(-figma.viewport.bounds.width / 2, selInViewportOffset.x));
      selInViewportOffset.y = Math.min(figma.viewport.bounds.height / 2, Math.max(-figma.viewport.bounds.height / 2, selInViewportOffset.y));
    }
    // set the selection
    figma.currentPage.selection = [node];
    if (selInViewportOffset) {
      // adjust the viewport per the comment above
      let nodeCenter = {
        x: node.absoluteTransform[0][2] + node.width / 2,
        y: node.absoluteTransform[1][2] + node.height / 2
      };
      figma.viewport.center = {
        x: nodeCenter.x - selInViewportOffset.x,
        y: nodeCenter.y - selInViewportOffset.y
      };
    } else {
      figma.viewport.scrollAndZoomIntoView([node]);
    }
  });

  on('REGENERATE_REPORT', async nodeId => {
    let node = figma.getNodeById(nodeId);
    if (!node) {
      console.warn(`Node ${nodeId} not found.`);
      return;
    }

    if (node.type !== 'FRAME') {
      console.warn(`Node ${nodeId} somehow isn't a frame anymore?`);
      return;
    }

    let frameReports = await generateReportsForFrames([node]);
    emit('REPORT_AVAILABLE', { frameReports });
  });
}

function identifyTargetFrames(): { targetFrames: FrameNode[], allOnPage: boolean } {
  let targetNodes = figma.currentPage.selection;
  let allOnPage = false;
  if (!targetNodes.length) {
    targetNodes = [...figma.currentPage.children];
    allOnPage = true;
  }

  // find all top-level frames to report on
  let targetFrames: FrameNode[] = [...new Set(
    targetNodes
      .map((selectedNode: SceneNode) => {
        let node: SceneNode = selectedNode;
        while (node?.parent?.type !== 'PAGE') {
          node = node.parent as SceneNode;
        }
        return (node?.type === 'FRAME') ? node as FrameNode : null;
      })
      .filter(n => !!n)
  )] as FrameNode[];

  if (!targetFrames.length) {
    targetFrames = figma.currentPage.children.filter(node => node.type === 'FRAME') as FrameNode[];
    allOnPage = true;
  }

  return { targetFrames, allOnPage };
}

const EXPORT_SETTINGS: ExportSettings = {
  format: 'PNG',
  contentsOnly: false,
  constraint: {
    type: 'SCALE',
    value: 1
  }
};

async function generateReportsForFrames(targetFrames: FrameNode[]): Promise<FrameReport[]> {
  // TODO: for multiple top-level frames, return a list
  // TODO: actually find a FrameNode

  let frameReports: FrameReport[] = [];

  for (let targetFrame of targetFrames) {
    let dup = targetFrame.clone();
    let nodeIdMap = mapNodeIds(targetFrame, dup);
    await util.sleep(100);
    let imageWithTextLayers = await dup.exportAsync(EXPORT_SETTINGS);
    let textNodes: { textNode: TextNode, effectiveOpacity: number }[] = [];

    util.walk(dup, (node, { opacity }) => {
      if ('opacity' in node && node.opacity) {
        opacity *= node.opacity;
      }
      if (node.type == 'TEXT' && !!node.visible) {
        node = node as TextNode;
        textNodes.push({
          textNode: node,
          effectiveOpacity: opacity * node.opacity
        });
      }
      if (!('visible' in node) || !node.visible) {
        return 'skipchildren';
      }
      return { opacity }; // context for children
    }, { opacity: 1 });

    let imageWithoutTextLayers = await dup.exportAsync(EXPORT_SETTINGS);

    let textNodeInfos: TextNodeInfo[] = textNodes
      .map(({ textNode, effectiveOpacity }: { textNode: TextNode, effectiveOpacity: number }) => {
        let textStyleSamples = [];

        let colorsForPaint = (paint: Paint): RGBA[] => {
          switch (paint.type) {
            case 'SOLID':
              return [{
                ...paint.color,
                a: paint.opacity === undefined ? 1 : paint.opacity
              }];

            case 'GRADIENT_LINEAR':
            case 'GRADIENT_RADIAL':
            case 'GRADIENT_ANGULAR':
            case 'GRADIENT_DIAMOND':
              return paint.gradientStops.map(stop => stop.color);

            case 'IMAGE':
              // TODO: somehow figure out image text fills?
              return [];
          }
        }

        let isBold = ({ style }: FontName): boolean => !!style.match(/medium|bold|black/i);

        if (textNode.fontName === figma.mixed
          || textNode.fontSize === figma.mixed
          || textNode.fills === figma.mixed) {

          let samples = new Set<string>(); // for de-duping samples
          for (let i = textNode.characters.length - 1; i >= 0; i--) {
            for (let color of (textNode.getRangeFills(i, i + 1) as Paint[])
              .flatMap(paint => colorsForPaint(paint))) {
              samples.add(JSON.stringify({
                isBold: isBold(textNode.getRangeFontName(i, i + 1) as FontName),
                textSize: textNode.getRangeFontSize(i, i + 1) as number,
                color,
              } as TextStyleSample));
            }
          }

          textStyleSamples = [...samples].map(s => JSON.parse(s) as TextStyleSample);
        } else {
          let { fontName, fontSize, fills } = textNode;
          textStyleSamples = fills
            .flatMap(paint => colorsForPaint(paint))
            .map(color => ({
              isBold: isBold(fontName as FontName),
              textSize: fontSize as number,
              color,
            }));
        }

        let textNodeInfo: TextNodeInfo = {
          x: textNode.absoluteTransform[0][2] - dup.absoluteTransform[0][2],
          y: textNode.absoluteTransform[1][2] - dup.absoluteTransform[1][2],
          w: textNode.width,
          h: textNode.height,
          nodeId: nodeIdMap.get(textNode.id)!,
          textStyleSamples,
          effectiveOpacity,
        };

        textNode.opacity = 0;
        return textNodeInfo;
      })
      .filter(x => !!x);

    dup.remove();

    frameReports.push({
      name: targetFrame.name,
      imageWithTextLayers,
      imageWithoutTextLayers,
      textNodeInfos,
      pageBgColor: (util.pageContainingNode(targetFrame)?.backgrounds?.[0] as SolidPaint)?.color,
      nodeId: targetFrame.id,
      width: targetFrame.width,
      height: targetFrame.height,
    });
  }

  return frameReports;
}

function mapNodeIds(original: BaseNode, dup: BaseNode): Map<string, string> {
  let map = new Map<string, string>();
  let fromIds: string[] = [];
  let toIds: string[] = [];

  // walking the original and the duplicate should
  // always return corresponding nodes in the same order
  util.walk(original, node => fromIds.push(node.id));
  util.walk(dup, node => toIds.push(node.id));

  if (fromIds.length !== toIds.length) {
    // TODO: can this ever happen?
    return map;
  }

  for (let [idx, id] of toIds.entries()) {
    map.set(id, fromIds[idx]);
  }

  return map;
}
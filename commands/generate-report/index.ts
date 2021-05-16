import { createMainThreadMessenger } from 'figma-messenger';
import * as util from '../../util';

const messenger = createMainThreadMessenger<ReportMainToIframe, ReportIframeToMain>();

export default function () {
  if (!figma.currentPage.children.length) {
    figma.notify('Nothing to report!');
    figma.closePlugin();
    return;
  }

  figma.showUI(__html__, { width: 900, height: 600 });
  generateReport();
}

const EXPORT_SETTINGS: ExportSettings = {
  format: 'PNG',
  constraint: {
    type: 'SCALE',
    value: 1
  }
};

async function generateReport() {
  let targetNodes = figma.currentPage.selection;
  if (!targetNodes.length) {
    targetNodes = [...figma.currentPage.children];
  }

  // find all top-level frames to report on
  let targetFrames: FrameNode[] = [...new Set(targetNodes
    .map((selectedNode: SceneNode) => {
      let node: BaseNode = selectedNode;
      while (node && node.parent.type != 'PAGE') {
        node = node.parent;
      }
      return (!node || node.type != 'FRAME') ? null : (node as FrameNode);
    })
    .filter(n => !!n)
  )];

  // TODO: for multiple top-level frames, return a list
  // TODO: actually find a FrameNode

  // figma.ui.resize(
  //   Math.min(1000, reportNode.width),
  //   Math.min(1000, reportNode.height));

  // let imageWithTextLayers = await reportNode.exportAsync(EXPORT_SETTINGS);
  let frameReports = [];

  for (let targetFrame of targetFrames) {
    let dup = targetFrame.clone();
    await util.sleep(100);
    let imageWithTextLayers = await dup.exportAsync(EXPORT_SETTINGS);
    let textNodes = [];

    util.walk(dup, (node, { opacity }) => {
      if (node.opacity) {
        opacity *= node.opacity;
      }
      if (node.type == 'TEXT' && !!node.visible) {
        node = node as TextNode;
        textNodes.push({
          textNode: node,
          effectiveOpacity: opacity * node.opacity
        });
      }
      if (!node.visible) {
        return 'skipchildren';
      }
      return { opacity }; // context for children
    }, { opacity: 1 });

    let imageWithoutTextLayers = await dup.exportAsync(EXPORT_SETTINGS);

    let textNodeInfos: TextNodeInfo[] = textNodes
      .map(({ textNode, effectiveOpacity }: { textNode: TextNode, effectiveOpacity: number }) => {
        let color: RGBA = null;
        let paint = textNode.fills[0] as Paint;
        if (paint && paint.type == 'SOLID') {
          color = {
            ...paint.color,
            a: paint.opacity
          }
        }

        // TODO: handle "mixed" using textNode.getRange**
        if (textNode.fontName === figma.mixed || textNode.fontSize === figma.mixed) {
          return null;
        }

        let textNodeInfo: TextNodeInfo = {
          x: textNode.absoluteTransform[0][2] - dup.absoluteTransform[0][2],
          y: textNode.absoluteTransform[1][2] - dup.absoluteTransform[1][2],
          w: textNode.width,
          h: textNode.height,
          isBold: !!(<FontName>textNode.fontName).style.match(/medium|bold|black/i),
          textSize: textNode.fontSize as number,
          effectiveOpacity: effectiveOpacity,
          color
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
    });
  }

  // push the report
  messenger.send('reportAvailable', { frameReports });
}
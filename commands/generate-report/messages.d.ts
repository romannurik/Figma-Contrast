interface ReportIframeToMain {
  regenerateReport(frameNodeId: string);
  selectNode(nodeId: string);
}

interface ReportMainToIframe {
  reportAvailable(report: { frameReports: FrameReport[] });
}

interface FrameReport {
  frameNodeId: string;
  name: string;
  imageWithTextLayers: Uint8Array;
  imageWithoutTextLayers: Uint8Array;
  textNodeInfos: TextNodeInfo[];
}

interface TextStyleSample {
  color: RGBA;
  isBold: boolean;
  textSize: number;
}

interface TextNodeInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  nodeId: string;
  textStyleSamples: TextStyleSample[];
  effectiveOpacity: number;
}

interface ContrastResultDetail {
  status: 'fail' | 'pass' | 'mixed' | 'unknown';
  contrastRatio: number,
  note?: string;
}

interface ContrastResult {
  aa: ContrastResultDetail;
  aaa: ContrastResultDetail;
}
interface ReportIframeToMain {
  regenerateReport(nodeId: string);
  selectNode(nodeId: string);
  resize(width: number, height: number);
}

interface ReportMainToIframe {
  reportAvailable(report: { frameReports: FrameReport[] });
}

interface FrameReport {
  nodeId: string;
  width: number;
  height: number;
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
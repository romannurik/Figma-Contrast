interface ReportAvailableMessage {
  frameReports: FrameReport[];
}

interface FrameReport {
  name: string;
  imageWithTextLayers: Uint8Array;
  imageWithoutTextLayers: Uint8Array;
  textNodeInfos: TextNodeInfo[];
}

interface TextNodeInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  color: RGBA;
  isBold: boolean;
  textSize: number;
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
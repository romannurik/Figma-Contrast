import '!./ui.css';
import { Container, IconButton, IconSwap32, IconToggleButton, LoadingIndicator, render, SegmentedControl } from '@create-figma-plugin/ui';
import { emit, on } from '@create-figma-plugin/utilities';
import cn from 'classnames';
import { Fragment, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { decodeToImageData } from '../../image-decode-encode';
import { computeTypeContrast, formatContrastRatio } from './compute-contrast';
import IconResizeHandle12 from './images/IconResizeHandle12';
import { useResizeObserver } from './useResizeObserver';

type HotSpot = TextNodeInfo & ContrastResult;

type Benchmark = "aa" | "aaa";

interface FR {
  name: string;
  nodeId: string;
  width: number;
  height: number;
  imageUri: string;
  hotspots: HotSpot[];
  pageBgColor?: RGB;
}

function Plugin() {
  let [frameReports, setFrameReports] = useState<FR[]>([]);
  let [selectedFR, setSelectedFR] = useState<FR | null>(null);
  let [benchmark, setBenchmark] = useState<Benchmark>('aa');
  let [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let unsub = on('REPORT_AVAILABLE', async (report: { frameReports: FrameReport[] }) => {
      // called when either the initial or a refreshed report is available
      let newFrameReports: FR[] = [...frameReports];
      for (let frame of report.frameReports) {
        let {
          nodeId, width, height, name,
          imageWithoutTextLayers, imageWithTextLayers, textNodeInfos,
          pageBgColor,
        } = frame;
        let bgImageData = await decodeToImageData(imageWithoutTextLayers);
        let imageUri = urlForImageBytes(imageWithTextLayers);
        let hotspots: HotSpot[] = [];
        for (let textNodeInfo of textNodeInfos) {
          let contrastReport = computeTypeContrast(textNodeInfo, bgImageData);
          hotspots.push({
            ...textNodeInfo,
            ...contrastReport,
          });
        }

        let fr: FR = { nodeId, name, imageUri, hotspots, width, height, pageBgColor };
        let existingIndex = newFrameReports.findIndex(({ nodeId }) => nodeId === fr.nodeId);
        if (existingIndex >= 0) {
          newFrameReports.splice(existingIndex, 1, fr);
        } else {
          newFrameReports.push(fr);
        }
      }

      setLoaded(true);
      setFrameReports(newFrameReports);
      if (selectedFR) {
        setSelectedFR(newFrameReports.find(({ nodeId }) => nodeId === selectedFR!.nodeId)!);
      } else {
        setSelectedFR(newFrameReports[0]);
      }
    });
    return () => unsub();
  }, [selectedFR, frameReports]);

  if (!loaded) {
    return <>
      <div className="loading-state">
        <LoadingIndicator />
        Generating contrast report&hellip;
      </div>
      <ResizeHandle />
    </>;
  }

  return <>
    <div className="toolbar">
      <SegmentedControl
        value={benchmark}
        options={[
          { value: 'aa', children: <Container space="small">AA</Container> },
          { value: 'aaa', children: <Container space="small">AAA</Container> },
        ]}
        onValueChange={value => setBenchmark(value)} />
      <div style={{ flex: 1 }} />
      {selectedFR && <IconButton onClick={() => emit('REGENERATE_REPORT', selectedFR!.nodeId)}>
        <IconSwap32 />
      </IconButton>}
    </div>
    <div className="main">
      {frameReports.length >= 2 && <FrameReportList
        frameReports={frameReports}
        selectedItem={selectedFR}
        benchmark={benchmark}
        onSelectItem={fr => setSelectedFR(fr)} />}
      {selectedFR && <ReportScreenshot
        frameReport={selectedFR}
        benchmark={benchmark} />}
    </div>
    <ResizeHandle />
  </>;
}

function ResizeHandle() {
  return <div className="resize-handle"
    onPointerDown={ev => {
      ev.preventDefault();
      let down = { x: ev.clientX, y: ev.clientY };
      let downSize = { width: window.innerWidth, height: window.innerHeight };
      let move_ = (ev: PointerEvent) => {
        let newSize = {
          width: downSize.width + (ev.clientX - down.x),
          height: downSize.height + (ev.clientY - down.y)
        };
        emit('RESIZE', newSize.width, newSize.height);
      };
      let up_ = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move_);
        window.removeEventListener('pointerup', up_);
        window.removeEventListener('pointercancel', up_);
      };
      window.addEventListener('pointermove', move_);
      window.addEventListener('pointerup', up_);
      window.addEventListener('pointercancel', up_);
    }}>
    <IconResizeHandle12 />
  </div>;
}

function FrameReportList({ frameReports, benchmark, selectedItem, onSelectItem }:
  { frameReports: FR[], benchmark: Benchmark, selectedItem: FR | null, onSelectItem: (fr: FR) => any }) {

  return <div className="frame-list">
    {frameReports.map((fr, i) => {
      let scoresByStatus: { [status: string]: number } = {};
      for (let hotspot of fr.hotspots) {
        let contrastResult = hotspot as ContrastResult;
        let { status } = (benchmark === 'aa') ? contrastResult.aa : contrastResult.aaa;
        scoresByStatus[status] = (scoresByStatus[status] || 0) + 1;
      }

      return <button
        key={i}
        className={cn('frame-list-item', 'type', { 'is-selected': fr === selectedItem })}
        onClick={() => onSelectItem(fr)}>
        <span>{fr.name}</span>
        <div className="frame-list-item-score">
          {Object.keys(scoresByStatus).sort().map(status =>
            <div className={`score-${status}`}>{scoresByStatus[status]}</div>)}
        </div>
      </button>;
    })}
  </div>;
}

function ReportScreenshot({ frameReport, benchmark }: { frameReport: FR, benchmark: Benchmark }) {
  let [previewNode, setPreviewNode] = useState<HTMLDivElement>();
  let [previewContentNode, setPreviewContentNode] = useState<HTMLDivElement>();
  let [translate, setTranslate] = useState<Vector>({ x: 0, y: 0 });
  let [zoom, setZoom] = useState<number>(1);
  let [isDragging, setIsDragging] = useState<boolean>(false);
  let [isViewportModified, setViewportModified] = useState<boolean>(false);

  useResizeObserver(() => resize(), previewNode);

  useEffect(() => {
    setZoom(1);
    setTranslate({ x: 0, y: 0 });
    setViewportModified(false);
    setTimeout(resize);
  }, [frameReport.nodeId]);

  function resize() {
    if (isViewportModified || !previewContentNode || !previewNode) {
      return;
    }

    let fittedSize = fitted(
      previewContentNode.offsetWidth,
      previewContentNode.offsetHeight,
      previewNode.offsetWidth,
      previewNode.offsetHeight);

    setZoom(fittedSize.scaleFactor);
  }

  return <div className={cn('preview', { 'is-dragging': isDragging })}
    style={{
      backgroundColor: frameReport.pageBgColor
        ? rgbToCssColor(frameReport.pageBgColor)
        : 'transparent'
    }}
    ref={node => node !== previewNode && setPreviewNode(node!)}
    onWheel={ev => {
      setZoom(Math.max(0.1, Math.min(10, zoom * (1.01 ** -ev.deltaY))));
      setViewportModified(true);
    }}
    onPointerDown={ev => {
      ev.preventDefault();
      let down = { x: ev.clientX, y: ev.clientY };
      setIsDragging(true);
      let move_ = (ev: PointerEvent) => {
        setTranslate({
          x: translate.x + (ev.clientX - down.x) / zoom,
          y: translate.y + (ev.clientY - down.y) / zoom,
        });
        setViewportModified(true);
      };
      let up_ = () => {
        window.removeEventListener('pointermove', move_);
        window.removeEventListener('pointerup', up_);
        window.removeEventListener('pointercancel', up_);
        setIsDragging(false);
      };
      window.addEventListener('pointermove', move_);
      window.addEventListener('pointerup', up_);
      window.addEventListener('pointercancel', up_);
    }}>
    {frameReport && <div className="preview-content"
      style={{
        transform: `translate(${translate.x}px, ${translate.y}px)`,
        zoom,
        '--zoom': String(zoom),
      }}
      ref={node => node !== previewContentNode && setPreviewContentNode(node!)}>
      <img src={frameReport.imageUri} width={frameReport.width} height={frameReport.height}
        onLoad={() => setTimeout(resize)} />
      {frameReport.hotspots.map(({ x, y, w, h: height, nodeId, aa, aaa }, i) => {
        let { note, contrastRatio, status } = (benchmark === 'aa') ? aa : aaa;
        return <div className={cn('text-node-hotspot', `status-${status}`)}
          onClick={() => emit('SELECT_NODE', nodeId)}
          key={i}
          style={{
            left: x,
            top: y,
            width: w,
            height,
          }}>
          <span>{note || formatContrastRatio(contrastRatio)}</span>
        </div>;
      })}
    </div>}
  </div>
}

function rgbToCssColor({ r, g, b }: RGB) {
  return `rgb(${r * 255},${g * 255},${b * 255})`;
}

function urlForImageBytes(ui8arr: Uint8Array) {
  //let base64Data = btoa(String.fromCharCode.apply(null, report.imageWithTextLayers));
  //return `data:image/png;base64,${base64Data}`;
  return URL.createObjectURL(new Blob([ui8arr]));
}

/**
 * Fit-inside algorithm
 */
function fitted(contentWidth: number, contentHeight: number, containerWidth: number, containerHeight: number) {
  if (contentWidth / contentHeight < containerWidth / containerHeight) {
    let scaleFactor = containerHeight / contentHeight;
    return {
      width: contentWidth * scaleFactor,
      height: containerHeight,
      scaleFactor
    };
  } else {
    let scaleFactor = containerWidth / contentWidth;
    return {
      width: containerWidth,
      height: contentHeight * scaleFactor,
      scaleFactor
    };
  }
}

export default render(Plugin);
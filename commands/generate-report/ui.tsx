import cn from 'classnames';
import { createIframeMessenger } from 'figma-messenger';
import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Button, Checkbox } from 'react-figma-plugin-ds';
import { decodeToImageData } from '../../image-decode-encode';
import { computeTypeContrast, formatContrastRatio } from './compute-contrast';
import './ui.scss';
import { useResizeObserver } from './useResizeObserver';

const messenger = createIframeMessenger<ReportIframeToMain, ReportMainToIframe>();

type HotSpot = TextNodeInfo & ContrastResult;

type Benchmark = "aa" | "aaa";

interface FR {
  name: string;
  nodeId: string;
  width: number;
  height: number;
  imageUri: string;
  hotspots: HotSpot[];
}

function App() {
  let [frameReports, setFrameReports] = useState<FR[]>([]);
  let [selectedFR, setSelectedFR] = useState<FR | null>(null);
  let [benchmark, setBenchmark] = useState<Benchmark>('aa');
  let [loaded, setLoaded] = useState(false);

  useEffect(() => {
    messenger.on('reportAvailable', async report => {
      // called when either the initial or a refreshed report is available
      let newFrameReports: FR[] = [...frameReports];
      for (let frame of report.frameReports) {
        let {
          nodeId, width, height, name,
          imageWithoutTextLayers, imageWithTextLayers, textNodeInfos
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

        let fr = { nodeId, name, imageUri, hotspots, width, height };
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
        setSelectedFR(newFrameReports.find(({ nodeId }) => nodeId === selectedFR.nodeId));
      } else {
        setSelectedFR(newFrameReports[0]);
      }
    });
    return () => messenger.off('reportAvailable');
  }, [selectedFR, frameReports]);

  if (!loaded) {
    return <div className="loading-spinner">Generating contrast report&hellip;</div>;
  }

  return <>
    <div className="toolbar">
      {(['aa', 'aaa'] as Benchmark[]).map(bm =>
        <Checkbox
          type="radio"
          key={bm}
          label={bm.toUpperCase()}
          name="benchmark"
          defaultValue={benchmark === bm}
          onChange={() => setBenchmark(bm)} />
      )}
      <div style={{ flex: 1 }} />
      {selectedFR && <Button
        onClick={() => messenger.send('regenerateReport', selectedFR.nodeId)}>
        Refresh this frame
      </Button>}
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
  </>;
}

function FrameReportList({ frameReports, benchmark, selectedItem, onSelectItem }:
  { frameReports: FR[], benchmark: Benchmark, selectedItem: FR | null, onSelectItem: (fr: FR) => any }) {

  return <div className="frame-list">
    {frameReports.map((fr, i) => {
      let scoresByStatus = {};
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

  useResizeObserver(() => {
    resize();
  }, previewNode);

  useEffect(() => {
    setZoom(1);
    setTranslate({ x: 0, y: 0 });
    setTimeout(resize);
  }, [frameReport.nodeId]);

  function resize() {
    console.log('resize');
    if (!previewContentNode || !previewNode) {
      return;
    }

    let fittedSize = fitted(
      previewContentNode.offsetWidth,
      previewContentNode.offsetHeight,
      previewNode.offsetWidth,
      previewNode.offsetHeight);

    if (zoom === 1) {
      setZoom(fittedSize.scaleFactor);
    }
  }

  return <div className={cn('preview', { 'is-dragging': isDragging })}
    ref={node => setPreviewNode(node)}
    onWheel={ev => {
      setZoom(Math.max(0.1, Math.min(10, zoom * (1.01 ** -ev.deltaY))));
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
      };
      let up_ = (ev: PointerEvent) => {
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
      } as CSSProperties}
      ref={node => setPreviewContentNode(node)}>
      <img src={frameReport.imageUri} width={frameReport.width} height={frameReport.height}
        onLoad={() => setTimeout(resize)} />
      {frameReport.hotspots.map(({ x, y, w, h, nodeId, aa, aaa }, i) => {
        let { note, contrastRatio, status } = (benchmark === 'aa') ? aa : aaa;
        return <div className={cn('text-node-hotspot', `status-${status}`)}
          onClick={() => messenger.send('selectNode', nodeId)}
          key={i}
          style={{
            left: x,
            top: y,
            width: w,
            height: h,
          }}>
          <span>{note || formatContrastRatio(contrastRatio)}</span>
        </div>;
      })}
    </div>}
  </div>
}

function urlForImageBytes(ui8arr) {
  //let base64Data = btoa(String.fromCharCode.apply(null, report.imageWithTextLayers));
  //return `data:image/png;base64,${base64Data}`;
  return URL.createObjectURL(new Blob([ui8arr]));
}

/**
 * Fit-inside algorithm
 */
function fitted(contentWidth, contentHeight, containerWidth, containerHeight) {
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

ReactDOM.render(<App />, document.querySelector('.root'));

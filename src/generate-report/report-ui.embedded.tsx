import classnames from 'classnames';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { decodeToImageData } from '../image-decode-encode';
import { computeTypeContrast, formatContrastRatio } from './compute-contrast';
import { Button } from 'react-figma-plugin-ds';

class App extends React.Component {
  previewRef = React.createRef() as React.RefObject<HTMLDivElement>;
  previewContentRef = React.createRef() as React.RefObject<HTMLDivElement>;

  state = {
    frameReports: [],
    selectedFrame: null,
    benchmark: 'aa',
    loaded: false,
  }

  componentDidMount() {
    this.resize();
    window.onresize = () => this.resize();
    window.onmessage = async event => {
      let message = event.data.pluginMessage;
      if (message.reportAvailable) {
        let report = message.reportAvailable as ReportAvailableMessage;
        let frameReports = [];
        for (let frame of report.frameReports) {
          let {name, imageWithoutTextLayers, imageWithTextLayers, textNodeInfos} = frame;
          let bgImageData = await decodeToImageData(imageWithoutTextLayers);
          let imageUri = urlForImageBytes(imageWithTextLayers);
          let hotspots = [];
          for (let textNodeInfo of textNodeInfos) {
            let contrastReport = computeTypeContrast(textNodeInfo, bgImageData);
            hotspots.push({
              ...textNodeInfo,
              ...contrastReport,
            });
          }

          frameReports.push({name, imageUri, hotspots});
        }

        this.setState({loaded: true, selectedFrame: frameReports[0], frameReports});
      }
    };    
  }

  componentDidUpdate() {
    setTimeout(() => this.resize(), 0);
  }

  resize() {
    if (!this.previewContentRef.current || !this.previewRef.current) {
      return;
    }

    let fitted = (content, into) => {
      if (content.width / content.height < into.width / into.height) {
        let scaleFactor = into.height / content.height;
        return {
          width: content.width * scaleFactor,
          height: into.height,
          scaleFactor
        }; 
      } else {
        let scaleFactor = into.width / content.width;
        return {
          width: into.width,
          height: content.height * scaleFactor,
          scaleFactor
        };
      }
    };
  
    // resize overview
    let fittedSize = fitted({
      width: this.previewContentRef.current.offsetWidth,
      height: this.previewContentRef.current.offsetHeight,
    }, {
      width: this.previewRef.current.offsetWidth,
      height: this.previewRef.current.offsetHeight,
    });

    this.previewContentRef.current.style.zoom = `${fittedSize.scaleFactor}`;
    this.previewContentRef.current.style.setProperty('--zoom', `${fittedSize.scaleFactor}`);
  }

  setActiveFrame(frame) {
    this.setState({selectedFrame: frame});
  }

  render() {
    let {frameReports, selectedFrame, benchmark, loaded} = this.state;

    if (!loaded) {
      return <div className="loading-spinner visual-bell visual-bell--loading">
        <div className="visual-bell__spinner-container">
          <span className="visual-bell__spinner"></span>
        </div>
        <span className="visual-bell__msg">Generating contrast report...</span>
      </div>;  
    }

    return <React.Fragment>
      <div className="toolbar">
        <Button isSecondary
            onClick={ ev => this.setState({ benchmark: (benchmark === 'aa') ? 'aaa' : 'aa' }) }>
          {benchmark.toUpperCase()}
        </Button>
      </div>
      <div className="main">
        {frameReports.length >= 2 && <div className="frame-list">
          {frameReports.map(frame => {
            let scoresByStatus = {};
            for (let hotspot of frame.hotspots) {
              let contrastResult = hotspot as ContrastResult;
              let {status} = (benchmark === 'aa') ? contrastResult.aa : contrastResult.aaa;
              scoresByStatus[status] = (scoresByStatus[status] || 0) + 1;
            }

            return <button
                  className={classnames('frame-list-item', {'is-selected': frame === selectedFrame})}
                  onClick={() => this.setActiveFrame(frame)}>
                <span className="frame-list-item-title">{frame.name}</span>
                <div className="frame-list-item-score">
                {Object.keys(scoresByStatus).sort().map(status =>
                    <div className={`score-${status}`}>{scoresByStatus[status]}</div>)}
                </div>
            </button>;
          })}
        </div>}
        <div className="preview" ref={this.previewRef}>
          {selectedFrame && <div className="preview-content" ref={this.previewContentRef}>
            <img src={selectedFrame.imageUri} />
            {selectedFrame.hotspots.map(({x, y, w, h, aa, aaa}) => {
              let {note, contrastRatio, status} = (benchmark === 'aa') ? aa : aaa;
              return <div className={classnames('text-node-hotspot', `status-${status}`)}
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
      </div>
    </React.Fragment>;
  }
}


ReactDOM.render(<App />, document.querySelector('.root'));



function urlForImageBytes(ui8arr) {
  //let base64Data = btoa(String.fromCharCode.apply(null, report.imageWithTextLayers));
  //return `data:image/png;base64,${base64Data}`;
  return URL.createObjectURL(new Blob([ui8arr]));
}
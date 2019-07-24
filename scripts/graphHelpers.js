

export function intersection(set1, set2){
    return new Set([...set1].filter(x => set2.has(x)));
}

export function difference(set1, set2){
    return new Set([...set1].filter(x => !set2.has(x)));
}

export function exportChartPNG(chartId) {
    let filename = chartId;
    let element = document.getElementById(chartId);
    if (element.className === "chartjs-render-monitor") {
        element.toBlob(function (blob) {
            let a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
        });
    } else {

        SVG2PNG(element.firstElementChild, function(canvas) { // Arguments: SVG element, callback function.
            let base64 = canvas.toDataURL("image/png"); // toDataURL return DataURI as Base64 format.
            generateLink(filename + '.png', base64).click(); // Trigger the Link is made by Link Generator and download.
        });

        // saveSvgAsPng(element.firstElementChild, filename + '.png');
    }
}

export function SVG2PNG(svg, callback) {
    let canvas = document.createElement('canvas'); // Create a Canvas element.
    let ctx = canvas.getContext('2d'); // For Canvas returns 2D graphic.
    let data = svg.outerHTML; // Get SVG element as HTML code.
    canvg(canvas, data); // Render SVG on Canvas.
    callback(canvas); // Execute callback function.
}


 export function generateLink(fileName, data) {
    let link = document.createElement('a');
    link.download = fileName;
    link.href = data;
    return link;
}


export function trimByDates(values, start, end){
    let trimmed = [];
    for (let date in values){
        if (new Date(date) >= new Date(start) && new Date(date) <= new Date(end)) {
            trimmed.push(values[date])
        }
    }
    return trimmed
}

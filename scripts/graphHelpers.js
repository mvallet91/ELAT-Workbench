import {sqlInsert} from "./databaseHelpers.js";


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

export function getForumSegmentation(weeklyPosters, weeklyViewers, connection) {
    let posters = {};
    let regularPosters = [];
    let occasionalPosters = [];
    for (let week in weeklyPosters) {
        let weekPosters = new Set(weeklyPosters[week]);
        for (let poster of weekPosters) {
            if (posters.hasOwnProperty(poster)) {
                posters[poster] = posters[poster] + 1
            } else {
                posters[poster] = 1
            }
        }
    }
    for (let p in posters) {
        if (posters[p] > 2) {
            regularPosters.push(p)
        } else {
            occasionalPosters.push(p)
        }
    }
    let fViewers = {};
    let regularViewers = [];
    let occasionalFViewers = [];
    for (let week in weeklyViewers) {
        let weekViewers = new Set(weeklyViewers[week]);
        for (let viewer of weekViewers) {
            if (fViewers.hasOwnProperty(viewer)) {
                fViewers[viewer] = fViewers[viewer] + 1
            } else {
                fViewers[viewer] = 1
            }
        }
    }
    for (let p in fViewers) {
        if (fViewers[p] > 2) {
            regularViewers.push(p)
        } else {
            occasionalFViewers.push(p)
        }
    }

    let forumSegmentation =  {
        'regularPosters': regularPosters,
        'regularViewers': regularViewers,
        'occasionalPosters': occasionalPosters,
        'occasionalViewers': occasionalFViewers
    };
    generateForumBehaviorTable(forumSegmentation, connection);
    return forumSegmentation;
}

export function generateForumBehaviorTable(forumSegmentation, connection) {
    let resultMatrix = {};
    for (let group in forumSegmentation){
        for (let studentId of forumSegmentation[group]) {
            if (studentId in resultMatrix) {
                resultMatrix[studentId].push(group)
            } else {
                resultMatrix[studentId] = [group]
            }
        }
    }
    let studentsForumBehavior = [{
        'name': 'studentsForumBehavior',
        'object': resultMatrix
    }];
    sqlInsert('webdata', studentsForumBehavior, connection)
}
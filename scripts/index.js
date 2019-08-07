import {learnerMode} from './metadataProcessing.js'
import {populateSamples, initiateEdxDb, clearWebdataForUpdate,
    deleteEverything, schemaMap, processTablesForDownload} from "./databaseHelpers.js";
import {loader, downloadForumSegmentation, progressDisplay, webdataJSON} from './helpers.js'
import {processGeneralSessions, processForumSessions, processVideoInteractionSessions,
    processAssessmentsSubmissions, processQuizSessions, processORASessions} from "./logProcessing.js";
import {exportChartPNG} from './graphHelpers.js'
import {drawCharts, updateCharts} from "./graphProcessing.js";
var connection = new JsStore.Instance();

window.onload = function () {
    //// PAGE INITIALIZATION  //////////////////////////////////////////////////////////////////////////////
    initiateEdxDb(connection);
    prepareDashboard();
    drawCharts(connection).then(function () {console.log('Charts Ready')}).catch(function (error) {
        loader(false);
        console.log(error)
    });

    //// MULTI FILE SYSTEMS  ///////////////////////////////////////////////////////////////////////////
    let  multiFileInputMetadata = document.getElementById('filesInput');
    multiFileInputMetadata.value = '';
    multiFileInputMetadata.addEventListener('change', function () {
        loader(true);
        readMetadataFiles(multiFileInputMetadata.files, processMetadataFiles);
    });

    let  multiFileInputLogs = document.getElementById('logFilesInput');
    multiFileInputLogs.value = '';
    multiFileInputLogs.addEventListener('change', function () {
        loader(true);
        prepareLogFiles(0, 0, 1);
    });

    //// BUTTONS /////////////////////////////////////////////////////////////////////////////////////////

    let buttons = document.querySelectorAll('button');
    buttons.forEach( btn => {
        btn.addEventListener('click', buttonHandler);
    });

    function buttonHandler(ev) {
        let id = ev.currentTarget.id;
        if (id === 'clearDB') {
            deleteEverything(connection).then(function () {console.log('Cleared Database')});
        } else if (id.startsWith('populate')) {
            let courseId = id.slice(id.indexOf('-') + 1,);
            populateSamples(courseId, connection);
        } else if (id === 'updateChartValues') {
            clearWebdataForUpdate(connection)
        } else if (id.startsWith('dl')) {
            let table = id.slice(id.indexOf('_') + 1,);
            if (table === 'all') {
                for (let table in schemaMap) {
                    processTablesForDownload(table, schemaMap[table], connection);
                }
            } else {
                processTablesForDownload(table, schemaMap[table], connection);
            }
        } else if (id === 'getForumList'){
            downloadForumSegmentation(connection)
        } else if (id === 'getWebdata'){
            webdataJSON(connection)
        }
    }

    // RADIO INPUT ////////////////////////////////////////////////////////////////////////////////////////////
    let inputs = document.querySelectorAll('input');
    inputs.forEach( input => {
        input.addEventListener('change', inputHandler);
    });

    function inputHandler(ev) {
        const name = ev.currentTarget.name;
        if (name === 'dailyOrWeekly' || name === 'processedOrInRange') {
            updateCharts(connection).then( function() {console.log('Update Charts')})
        }
    }

    //  ANCHOR ELEMENTS
    let anchors = document.querySelectorAll('a');
    anchors.forEach( a => {
        a.addEventListener('click', anchorHandler);
    });

    function anchorHandler(ev) {
        const id = ev.currentTarget.id;
        if (id.startsWith('png')) {
            let chartId = id.slice(id.indexOf('_') + 1,);
            exportChartPNG(chartId)
        }
    }
};

let reader = new FileReader();

// METADATA FILE PROCESSING /////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 * @param files
 * @param callback
 */
function readMetadataFiles(files, callback){
    loader(true);
    let output = [],
        checkedFiles = {},
        processedFiles = [],
        fileNames = 'Names: ',
        counter = 1;
    const sqlType = 'sql',
        jsonType = 'json',
        mongoType = 'mongo';
    for (const f of files) {
        output.push('<li><strong>', f.name, '</strong> (', f.type || 'n/a', ') - ',
            f.size, ' bytes', '</li>');

        if (f.name.includes('zip')) {
            loader(false);
            toastr.error('Metadata files have to be unzipped!');
            break;
        }

        if (f.name.includes(sqlType) || (f.name.includes(jsonType)) || (f.name.includes(mongoType))) {
            let reader = new FileReader();
            reader.onloadend = function () {
                let content = reader.result;
                checkedFiles[f.name] = reader.result;
                processedFiles.push({
                    key: f.name,
                    value: reader.result
                });
                fileNames = fileNames + f.name + ' size: ' + content.length + ' bytes \n';
                if (counter === files.length) {
                    callback(processedFiles, output);
                }
                counter++;
                reader.abort();
            };
            reader.readAsText(f);
        } else {
            counter ++;
        }
    }
}

/**
 *
 * @param processedFiles
 * @param output
 */
function processMetadataFiles(processedFiles, output){
    document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
    learnerMode(processedFiles, connection);
}

// LOGFILE PROCESSING /////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 * @param fileIndex
 * @param chunkIndex
 * @param totalChunks
 */
function prepareLogFiles(fileIndex, chunkIndex, totalChunks){
    const multiFileInputLogs = document.getElementById('logFilesInput'),
        files = multiFileInputLogs.files,
        totalFiles = files.length;

    if (chunkIndex < totalChunks && fileIndex < totalFiles) {
        console.log('File', fileIndex, 'out of', totalFiles, '-----------------------------');
        console.log('Chunk', chunkIndex, 'out of', totalChunks, '-----------------------------');
        progressDisplay(('Chunk ' + chunkIndex + ' of file'), (fileIndex));
        toastr.info('Processing a new chunk of file number ' + (fileIndex + 1));
        let counter = 0;
        for (const f of files) {
            if (counter === fileIndex) {
                const today = new Date();
                console.log('Starting at', today);
                unzipAndChunkLogfile(f, reader, fileIndex, totalFiles, chunkIndex, totalChunks, processUnzippedChunk)
            }
            counter += 1;
        }
    } else {
        fileIndex++;
        if (fileIndex < totalFiles) {
            toastr.info('Starting with file number ' + (fileIndex + 1));
            chunkIndex = 0;
            console.log('File', fileIndex, 'out of', totalFiles, '-----------------------------');
            console.log('Chunk', chunkIndex, 'out of', totalChunks, '-----------------------------');
            let counter = 0;
            for (const f of files) {
                if (counter === fileIndex) {
                    const today = new Date();
                    console.log('Starting at', today);
                    unzipAndChunkLogfile(f, reader, fileIndex, totalFiles, chunkIndex, totalChunks, processUnzippedChunk)
                }
                counter += 1;
            }
        } else {
            let table = document.getElementById("progress_tab"),
                row = table.insertRow(),
                cell1 = row.insertCell();
            setTimeout(function () {
                toastr.success('Please reload the page now', 'LogFiles Processed!', {timeOut: 0});
                cell1.innerHTML = ('Done! at ' + new Date().toLocaleString('en-GB'));
                loader(false)
            }, 1000);
        }
    }
}

let chunkSize = 500 * 1024 * 1024;

/**
 *
 * @param file
 * @param reader
 * @param fileIndex
 * @param totalFiles
 * @param chunkIndex
 * @param totalChunks
 * @param callback
 */
function unzipAndChunkLogfile(file, reader, fileIndex, totalFiles, chunkIndex, totalChunks, callback){
    let output = [];
    let processedFiles = [];
    let gzipType = /gzip/;
    output.push('<li><strong>', file.name, '</strong> (', file.type || 'n/a', ') - ',
                file.size, ' bytes', '</li>');
    if (!file.type.match(gzipType)) {
        loader(false);
        toastr.error(file.name + ' is not a log file (should end with: .log.gz)');
    } else {
        reader.onload = function (event) {
            try {
                let content = pako.inflate(event.target.result, {to: 'array'});
                let stringContent = new TextDecoder("utf-8").decode(content.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize));
                processedFiles.push({
                    key: file.name,
                    value: stringContent.slice(stringContent.indexOf('{"username":'),
                        stringContent.lastIndexOf('\n{'))
                });
                reader.abort();
                if (stringContent.split('\n').length > 10) {
                    totalChunks++;
                    callback(processedFiles, fileIndex, totalFiles, chunkIndex, totalChunks);
                } else {
                    fileIndex++;
                    chunkIndex = 0;
                    totalChunks = 1;
                    console.log('End of file');
                    prepareLogFiles(fileIndex, chunkIndex, totalChunks);
                }
            } catch (error) {
                if (error instanceof RangeError) {
                    console.log(error);
                    loader(false);
                } else {
                    toastr.error('There was an error unzipping the file, please try again');
                    toastr.info('If this happens again, restart Chrome and close all other tabs');
                    loader(false);
                }
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

/**
 *
 * @param processedFiles
 * @param fileIndex
 * @param totalFiles
 * @param chunkIndex
 * @param totalChunks
 */
function processUnzippedChunk(processedFiles, fileIndex, totalFiles, chunkIndex, totalChunks){
    connection.runSql("SELECT * FROM metadata WHERE name = 'metadata_map' ").then(function(result) {
        if (result.length === 0) {
            loader(false);
            toastr.error('Metadata has not been processed! Please upload all metadata files first');
        } else {
            let courseMetadataMap = result[0]['object'];
            if (chunkIndex === 0) {
                let table = document.getElementById("progress_tab"),
                    row = table.insertRow(),
                    cell1 = row.insertCell();
                cell1.innerHTML = ('Processing file ' + (fileIndex + 1) + '/' + totalFiles +
                    '\n at ' + new Date().toLocaleString('en-GB'));
            }
            processGeneralSessions(courseMetadataMap, processedFiles, fileIndex, totalFiles, chunkIndex, connection);
            processForumSessions(courseMetadataMap, processedFiles, fileIndex, totalFiles, chunkIndex, connection);
            processVideoInteractionSessions(courseMetadataMap, processedFiles, fileIndex, totalFiles, chunkIndex, connection);
            processAssessmentsSubmissions(courseMetadataMap, processedFiles, fileIndex, totalFiles, chunkIndex, connection);
            processQuizSessions(courseMetadataMap, processedFiles, fileIndex, totalFiles, chunkIndex, totalChunks, connection, prepareLogFiles);

            // processORASessions(courseMetadataMap, processedFiles, fileIndex, totalFiles, chunkIndex, totalChunks, connection, prepareLogFiles);
        }
    });
}

/**
 *
 */
function prepareDashboard() {
    $(function () {
        let localData = JSON.parse(localStorage.getItem('positions'));
        if (localData != null) {
            console.log('Loading dashboard position');
            $.each(localData, function (i, value) {
                let id_name = "#";
                id_name = id_name + value.id;
                $(id_name).attr({
                    "data-col": value.col,
                    "data-row": value.row,
                    "data-sizex": value.size_x,
                    "data-sizey": value.size_y
                });
            });
        } else {
            let defaultOrder = [{"id":"arcTile","col":1,"row":1,"size_x":12,"size_y":4},
                {"id":"cycleTile","col":3,"row":5,"size_x":8,"size_y":4},
                {"id":"areaTile","col":1,"row":9,"size_x":6,"size_y":3}, {"id":"lineTile","col":7,"row":9,"size_x":6,"size_y":3},
                {"id":"heatTile","col":1,"row":13,"size_x":5,"size_y":4}, {"id":"mixedTile","col":6,"row":13,"size_x":7,"size_y":4},
                {"id":"boxTile","col":1,"row":17,"size_x":6,"size_y":3}];
            $.each(defaultOrder, function (i, value) {
                let id_name = "#";
                id_name = id_name + value.id;
                $(id_name).attr({
                    "data-col": value.col,
                    "data-row": value.row,
                    "data-sizex": value.size_x,
                    "data-sizey": value.size_y
                });
            });
            console.log('Dashboard is in default state');
        }

        let gridster;
        $(function () {
            gridster = $(".gridster ul").gridster({
                widget_base_dimensions: [100, 120],
                widget_margins: [5, 5],
                helper: 'clone',
                resize: {
                    enabled: true,
                    stop: function (event, ui) {
                        let positions = JSON.stringify(this.serialize());
                        localStorage.setItem('positions', positions);
                    }
                },
                serialize_params: function ($w, wgd) {
                    return {
                        id: $($w).attr('id'),
                        col: wgd.col,
                        row: wgd.row,
                        size_x: wgd.size_x,
                        size_y: wgd.size_y,
                    };
                },
                draggable: {
                    handle: 'header',
                    stop: function (event, ui) {
                        let positions = JSON.stringify(this.serialize());
                        localStorage.setItem('positions', positions);
                        // drawVideoArc();
                    }
                }
            }).data('gridster');
        });
    });

    $(function() {
        $('input[name="daterange"]').daterangepicker({
            opens: 'left'
        }, function(start, end, label) {
            document.getElementById('allDatesRadio').checked = false;
            document.getElementById('courseDatesRadio').checked = false;
            updateCharts(connection, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')).then(function () {
                console.log('Charts updated')
            });
        });
    });
}




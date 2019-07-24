// let connection = new JsStore.Instance(new Worker('scripts/jsstore.worker.js'));
let connection = new JsStore.Instance();

import {learnerMode} from './metadataProcessing.js'
import {prepareTables} from "./prepareTables.js";
import {populateSamples, sqlInsert, getEdxDbQuery, updateChart,
    deleteEverything, schemaMap, processTablesForDownload} from "./databaseHelpers.js";
import {loader, progressDisplay, downloadCsv, webdataJSON,
    cmpDatetime, processNull, cleanUnicode, escapeString,
    getDayDiff, getNextDay, courseElementsFinder} from './helpers.js'
import {processGeneralSessions, processForumSessions, processVideoInteractionSessions,
    processAssessmentsSubmissions, processQuizSessions} from "./logProcessing.js";
import {intersection, difference, exportChartPNG, generateLink, SVG2PNG, trimByDates} from './graphHelpers.js'

window.onload = function () {
    //// PAGE INITIALIZATION  //////////////////////////////////////////////////////////////////////////////
    initiateEdxDb();
    getGraphElementMap(drawCharts);
    prepareDashboard();
    drawVideoArc();
    drawCycles();

    //// MULTI FILE SYSTEM  ///////////////////////////////////////////////////////////////////////////
    let  multiFileInputMetadata = document.getElementById('filesInput');
    multiFileInputMetadata.value = '';
    multiFileInputMetadata.addEventListener('change', function () {
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
            deleteEverything(connection);
        } else if (id.startsWith('populate')) {
            let courseId = id.slice(id.indexOf('-') + 1,);
            populateSamples(courseId, connection);
        } else if (id === 'updateChartValues') {
            updateChart(connection)
        } else if (id.startsWith('dl')) {
            let table = id.slice(id.indexOf('_') + 1,);
            if (table === 'all') {
                for (let table in schemaMap) {
                    processTablesForDownload(table, schemaMap[table], connection);
                }
            } else {
                processTablesForDownload(table, schemaMap[table], connection);
            }
        }
    }

    // RADIO INPUT ////////////////////////////////////////////////////////////////////////////////////////////
    let inputs = document.querySelectorAll('input');
    inputs.forEach( input => {
        input.addEventListener('change', inputHandler);
    });

    function inputHandler(ev) {
        const name = ev.currentTarget.name;
        if (name === 'dayVSweekRadio' || name === 'optradio') {
            getGraphElementMap(drawCharts)
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
// METADATA PROCESSING /////////////////////////////////////////////////////////////////////////////////////////
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
                let result = [processedFiles, output];
                if (counter === files.length) {
                    callback(result);
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


function processMetadataFiles(result){
    let names = result[0],
        output = result[1];
    document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
    loader(false);
    learnerMode(names, connection);
}

// LOGFILE PROCESSING /////////////////////////////////////////////////////////////////////////////////////////

function prepareLogFiles(fileIndex, chunkIndex, totalChunks){
    const multiFileInputLogs = document.getElementById('logFilesInput'),
        files = multiFileInputLogs.files,
        totalFiles = files.length;
    let counter = 0;
    for (const f of files) {
        if (counter === fileIndex){
            const today = new Date();
            console.log('Starting with file ' + fileIndex + ' at ' + today);
            unzipLogfile(f, reader, fileIndex, totalFiles, chunkIndex, totalChunks, processLogfile)
        }
        counter += 1;
    }
}

let chunkSize = 500 * 1024 * 1024;
function unzipLogfile(file, reader, fileIndex, totalFiles, chunkIndex, totalChunks, callback){
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
                if (stringContent.lastIndexOf('\n') + 2 < stringContent.length) {
                    totalChunks++;
                }
                reader.abort();
                callback(processedFiles, fileIndex, totalFiles, chunkIndex, totalChunks);
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


function processLogfile(processedFiles, fileIndex, totalFiles, chunkIndex, totalChunks){
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
        }
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////
// DATABASE FUNCTIONS
function initiateEdxDb() {
    let dbName = "edxdb";
    connection.runSql('ISDBEXIST ' + dbName).then(function (isExist) {
        if (isExist) {
            connection.runSql('OPENDB ' + dbName).then(function () {
                loader(false);
                toastr.success('Database ready', 'ELAT',  {timeOut: 1500});
                prepareTables(connection);
            });
        } else {
            toastr.info('Welcome! If this is your first time here, visit ELAT Home for more info', 'ELAT',  {timeOut: 7000});
            let dbQuery = getEdxDbQuery();
            connection.runSql(dbQuery).then(function (tables) {
                toastr.success('Database generated, please reload the page', 'ELAT',  {timeOut: 5000});
                console.log(tables);
                loader(false)
            });
        }
    }).catch(function (err) {
        console.log(err);
        alert(err.message);
    });
}


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
                {"id":"areaTile","col":1,"row":9,"size_x":6,"size_y":3},{"id":"lineTile","col":7,"row":9,"size_x":6,"size_y":3},
                {"id":"heatTile","col":1,"row":13,"size_x":5,"size_y":4},{"id":"mixedTile","col":6,"row":13,"size_x":7,"size_y":4},
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
                        drawVideoArc();
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
            getGraphElementMap(drawCharts, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
        });
    });
}




function drawCharts(graphElementMap, start, end) {
    let startDate = new Date(start);
    let endDate = new Date(end);
    let weekly = true;

    let radioValue = $("input[name='optradio']:checked").val();
    if (radioValue){
        if (radioValue === 'allDates'){
            startDate = new Date(graphElementMap['dateListChart'][0]);
            endDate = new Date(graphElementMap['dateListChart'][graphElementMap['dateListChart'].length - 1]);
        } else if (radioValue === 'courseDates') {
            endDate = new Date(graphElementMap['end_date']);
            startDate = new Date(graphElementMap['start_date']);
        }
    }

    let radioValueWeekly = $("input[name='dayVSweekRadio']:checked").val();
    if (radioValueWeekly){
        if (radioValueWeekly === 'weekly'){
            weekly = true
        } else if (radioValueWeekly === 'daily') {
            weekly = false
        }
    }

    drawApex(graphElementMap, startDate, endDate, weekly);

    let canvas = document.getElementById('lineChart');
    let lineCtx = canvas.getContext('2d');
    lineCtx.clearRect(0, 0, canvas.width, canvas.height);

    let lineData = {
        labels: graphElementMap['dateListChart'],
        datasets: [{
            fill: false,
            label: 'Total Students',
            yAxisID: 'A',
            data: Object.values(graphElementMap['orderedStudents']),
            borderColor: '#FAB930',
            backgroundColor: '#FAB930',
            lineTension: 0.2,
        }, {
            fill: false,
            label: 'Total Sessions',
            yAxisID: 'B',
            data: Object.values(graphElementMap['orderedSessions']),
            borderColor: '#12B1C7',
            backgroundColor: '#12B1C7',
            lineTension: 0.2,
        }]
    };

    let lineOptions = {
        type: 'line',
        data: lineData,
        options: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true
                }
            },
            // tooltips: {
            //     callbacks: {
            //         // value: function(value, index, values) {
            //         //     return value.toLocaleString("en-US");
            //         // },
            //         label: function(tooltipItem, data) {
            //             return (tooltipItem.value).toLocaleString("en-US");
            //         },
            //     }
            // },
            title: {
                display: true,
                text: 'Session and Student Count',
                position: 'top',
                fontSize:  16,
                color:  '#263238',
                fontFamily: 'Helvetica'
            },
            fill: true,
            responsive: true,
            scales: {
                xAxes: [{
                    type: 'time',
                    display: true,
                    time: {
                        unit: 'week',
                        min: startDate,
                        max: endDate
                    },
                    scaleLabel: {
                        display: true,
                        // labelString: "Date",
                    }
                }],
                yAxes: [{
                    id: 'A',
                    ticks: {
                        beginAtZero: true,
                        callback: function(value, index, values) {
                            return value.toLocaleString("en-US");
                        },
                        fontColor: '#FAB930',
                    },
                    position: 'left',
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: "Total Students",
                        fontColor: '#FAB930',
                        fontStyle: 'bold'
                    }
                }, {
                    id: 'B',
                    ticks: {
                        beginAtZero: true,
                        callback: function(value, index, values) {
                            return value.toLocaleString("en-US");
                        },
                        fontColor: '#12B1C7',
                    },
                    position: 'right',
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: "Total Sessions",
                        fontColor: '#12B1C7',
                        fontStyle: 'bold'
                    },
                }]
            }
        }
    };

    if (lineChart !== null) {
        lineChart.destroy();
    }
    lineChart = new Chart(lineCtx, lineOptions);

    let areaCtx = document.getElementById('areaChart').getContext('2d');

    let areaData = {
        labels: graphElementMap['dateListChart'],
        datasets: [{
            fill: false,
            label: 'Avg. Session Duration',
            yAxisID: 'A',
            data: Object.values(graphElementMap['orderedAvgDurations']),
            borderColor: '#6EC5FB',
            backgroundColor: '#6EC5FB',
            lineTension: 0,
        }, {
            fill: true,
            label: 'Video Sessions',
            yAxisID: 'B',
            data: Object.values(graphElementMap['orderedVideoSessions']),
            borderColor: '#753599',
            backgroundColor: '#753599',
            lineTension: 0,
        }, {
            fill: true,
            label: 'Quiz Sessions',
            yAxisID: 'B',
            data: Object.values(graphElementMap['orderedQuizSessions']),
            borderColor: '#13c70e',
            backgroundColor: '#13c70e',
            lineTension: 0,
        }, {
            fill: true,
            label: 'Forum Sessions',
            yAxisID: 'B',
            data: Object.values(graphElementMap['orderedForumSessions']),
            borderColor: '#992425',
            backgroundColor: '#992425',
            lineTension: 0,
        }, {
            fill: true,
            label: 'Quiz Start',
            yAxisID: 'B',
            // data: Object.values(graphElementMap['orderedForumSessions']),
            borderColor: 'green',
            backgroundColor: 'green',
            lineTension: 0,
        }, {
            fill: true,
            label: 'Quiz Due',
            yAxisID: 'B',
            // data: Object.values(graphElementMap['orderedForumSessions']),
            borderColor: 'red',
            backgroundColor: 'red',
            lineTension: 0,
        }]
    };

    let areaOptions = {
        type: 'line',
        data: areaData,
        options: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true
                }
            },
            title: {
                display: true,
                    text: 'Session Count Comparison',
                    position: 'top',
                    fontSize:  16,
                    color:  '#263238',
                    fontFamily: 'Helvetica'
            },
            annotation: {
                annotations: graphElementMap['annotations']
            },
            fill: false,
            responsive: true,
            scales: {
                xAxes: [{
                    type: 'time',
                    display: true,
                    time: {
                        unit: 'week',
                        min: startDate,
                        max: endDate
                    },
                    scaleLabel: {
                        display: false,
                        labelString: "Date",
                    }
                }],
                yAxes: [{
                    id: 'A',
                    ticks: {
                        beginAtZero: true,
                        callback: function(value, index, values) {
                            return value.toLocaleString("en-US");
                        },
                        fontColor: '#6EC5FB',
                    },
                    position: 'left',
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: "Duration in Seconds",
                        fontColor: '#6EC5FB',
                        fontStyle: 'bold'
                    }
                }, {
                    id: 'B',
                    stacked: true,
                    ticks: {
                        beginAtZero: true,
                        callback: function(value, index, values) {
                            return value.toLocaleString("en-US");
                        },
                    },
                    position: 'right',
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: "Total Sessions",
                        fontStyle: 'bold'
                    }
                }]
            }
        }
    };
    if (areaChart !== null) {
        areaChart.destroy();
    }
    areaChart = new Chart(areaCtx, areaOptions);

    // BOXPLOT https://codepen.io/sgratzl/pen/QxoLoY

    let weeklyPostContents = groupWeeklyMapped(graphElementMap, 'orderedForumPostContent');
    let weeklyRegPostContents = groupWeeklyMapped(graphElementMap, 'orderedForumPostContentRegulars');
    let weeklyOccPostContents = groupWeeklyMapped(graphElementMap, 'orderedForumPostContentOccasionals');

    let dateLabels = [];
    let postContentData = [];
    let regPostContentData = [];
    let occPostContentData = [];

    if (weekly === true){
        for (let date in weeklyPostContents['weeklySum']){
            dateLabels.push(new Date(date))
        }
        postContentData = Object.values(weeklyPostContents['weeklySum']);
        regPostContentData = Object.values(weeklyRegPostContents['weeklySum']);
        occPostContentData = Object.values(weeklyOccPostContents['weeklySum']);
    } else {
        for (let date of graphElementMap["dateListChart"]){
            dateLabels.push(date)
        }
        postContentData = Object.values(graphElementMap['orderedForumPostContent']);
        regPostContentData = Object.values(graphElementMap['orderedForumPostContentRegulars']);
        occPostContentData = Object.values(graphElementMap['orderedForumPostContentOccasionals']);
    }

    let boxCtx = document.getElementById("boxChart").getContext("2d");

    let boxplotData = {
        labels: dateLabels,
        datasets: [{
            label: 'Posts by Regulars - ' + graphElementMap['forumSegmentation']['regularPosters'] + ' students',
            backgroundColor:  'rgba(0,0,255,0.5)',
            borderColor: 'blue',
            borderWidth: 1,
            padding: 10,
            itemRadius: 0,
            outlierColor: '#999999',
            data: regPostContentData
        }, {
            label: 'Posts by Occasionals - ' + graphElementMap['forumSegmentation']['occasionalPosters'] + ' students',
            backgroundColor:  '#11aa00',
            borderColor: 'green',
            borderWidth: 1,
            padding: 10,
            itemRadius: 0,
            outlierColor: '#999999',
            data: occPostContentData
        }]
    };

    let boxOptions = {
        responsive: true,
        legend: {
            position: 'top',
            labels: {
                usePointStyle: true
            }
        },
        title: {
            display: true,
            text: ['Size of Forum Posting','(character count)'],
            position: 'top',
            fontSize:  16,
            color:  '#263238',
            fontFamily: 'Helvetica'
        },
        scales: {
            xAxes: [{
                type: 'time',
                display: true,
                time: {
                    unit: 'week',
                    min: startDate.setDate(startDate.getDate() - 5),
                    max: endDate.setDate(endDate.getDate() + 3),
                    tooltipFormat: 'll'
                },
                scaleLabel: {
                    display: false,
                    labelString: "Date",
                },
            }],
            yAxes: [{
                ticks: {
                    beginAtZero: true,
                    minStats: 'min',
                    maxStats: 'whiskerMax',
                    callback: function(value, index, values) {
                        return value.toLocaleString("en-US");
                    },

                },
                position: 'left',
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: "Number of Characters",
                }
            }]
        }
    };

    if (boxChart !== null) {
        boxChart.destroy();
    }

    boxChart = new Chart(boxCtx, {
        type: 'boxplot',
        data: boxplotData,
        options: boxOptions
    });
}

function getGraphElementMap(callback, start, end) {
    let graphElementMap = {};
    connection.runSql("SELECT * FROM webdata WHERE name = 'graphElements' ").then(function(result) {
        if (result.length === 1) {
            graphElementMap = result[0]['object'];
            callback(graphElementMap, start, end);
        } else {
            connection.runSql("SELECT * FROM metadata WHERE name = 'metadata_map' ").then(function(result) {
                if (result.length !== 1) {
                    console.log('Metadata empty')
                } else {
                    let course_metadata_map = result[0]['object'];
                    let query = '';

                    let dailySessions = {};
                    let dailyDurations = {};

                    let quizSessions = {};
                    let quizDurations = {};

                    let videoSessions = {};
                    let videoDurations = {};

                    let forumSessions = {};
                    let forumDurations = {};

                    let forumPosts = {};
                    let forumPosters = {};

                    let dateListChart = [];

                    let orderedSessions = {};
                    let orderedDurations = {};
                    let orderedStudents = {};
                    let orderedAvgDurations = {};

                    let orderedQuizSessions = {};
                    let orderedQuizDurations = {};

                    let orderedVideoSessions = {};
                    let orderedVideoDurations = {};

                    let orderedForumSessions = {};
                    let orderedForumStudents = {};
                    let orderedForumDurations = {};
                    let orderedForumAvgDurations = {};
                    let orderedForumRegulars = {};
                    let orderedForumSessionRegulars = {};
                    let orderedForumSessionOccasionals = {};
                    let orderedForumOccasionals = {};

                    let orderedForumPosts = {};
                    let orderedForumPostContent = {};
                    let orderedForumPosters = {};
                    let orderedForumPostsByRegulars = {};
                    let orderedForumPostersRegulars = {};
                    let orderedForumPostContentRegulars = {};
                    let orderedForumPostsByOccasionals = {};
                    let orderedForumPostersOccasionals = {};
                    let orderedForumPostContentOccasionals = {};

                    let start_date = '';
                    let end_date = '';
                    let course_name = '';

                    connection.runSql("SELECT * FROM courses").then(function(courses) {
                        courses.forEach(async function (course) {
                            $('#loading').show();
                            $.blockUI();
                            course_name = course['course_name'];
                            start_date = course['start_time'].toDateString();
                            end_date = course['end_time'].toDateString();

                            let start = new Date(),
                                start_str = '',
                                gradeMap = {},
                                idSet = new Set(),
                                posterPostMap = {},

                            query = "SELECT * FROM sessions";
                            await connection.runSql(query).then(function (sessions) {
                                toastr.info('Processing indicators');
                                sessions.forEach(function (session) {
                                    start = session["start_time"].toDateString();
                                    start = new Date(start);
                                    if (dailyDurations.hasOwnProperty(start)) {
                                        dailyDurations[start].push(session["duration"]);
                                        dailySessions[start].push(session["course_learner_id"]);
                                    } else {
                                        dailyDurations[start] = [];
                                        dailyDurations[start].push(session["duration"]);

                                        dailySessions[start] = [];
                                        dailySessions[start].push(session["course_learner_id"]);
                                    }
                                });
                            });
                            await connection.runSql("SELECT * FROM course_learner").then(function(learners) {
                                learners.forEach(function (learner) {
                                    idSet.add(learner.course_learner_id);
                                    gradeMap[learner.course_learner_id] = learner;
                                });
                            });

                            query = "SELECT * FROM quiz_sessions";
                            await connection.runSql(query).then(function (q_sessions) {
                                q_sessions.forEach(function (session) {
                                    let start = session["start_time"].toDateString();
                                    start = new Date(start);
                                    if (quizDurations.hasOwnProperty(start)) {
                                        quizDurations[start].push(session["duration"]);
                                        quizSessions[start].push(session["course_learner_id"]);
                                    } else {
                                        quizDurations[start] = [];
                                        quizDurations[start].push(session["duration"]);

                                        quizSessions[start] = [];
                                        quizSessions[start].push(session["course_learner_id"]);
                                    }
                                });
                            });
                            toastr.info('Crunching quiz data');
                            query = "SELECT * FROM video_interaction";
                            await connection.runSql(query).then(function (v_sessions) {
                                v_sessions.forEach(function (session) {
                                    // start_str = session["start_time"].toDateString();
                                    start_str = session["start_time"].toDateString();
                                    start = new Date(start_str);
                                    if (videoDurations.hasOwnProperty(start)) {
                                        videoDurations[start].push(session["duration"]);
                                        videoSessions[start].push(session["course_learner_id"]);
                                    } else {
                                        videoDurations[start] = [];
                                        videoDurations[start].push(session["duration"]);

                                        videoSessions[start] = [];
                                        videoSessions[start].push(session["course_learner_id"]);
                                    }
                                });
                                toastr.info('Working on video sessions...');
                            });
                            let dueDates = [];
                            query = "SELECT * FROM quiz_questions";
                            await connection.runSql(query).then(function (questions) {
                                questions.forEach(function (question) {
                                    dueDates.push(question['question_due'].toDateString())
                                });
                            });

                            let quizDates = Array.from(new Set(dueDates));
                            let annotationsDue = quizDates.map(function (date, index) {
                                return {
                                    type: 'line',
                                    id: 'line' + index,
                                    mode: 'vertical',
                                    scaleID: 'x-axis-0',
                                    value: new Date(date),
                                    borderColor: 'red',
                                    borderWidth: 2,
                                    borderDash: [2, 2],
                                    // label: {
                                    //     enabled: true,
                                    //     position: "top",
                                    //     content: 'Quiz Due'
                                    // }
                                }
                            });

                            let startDates = [];
                            for (let el in course_metadata_map.element_time_map) {
                                if (el.includes('problem')) {
                                    startDates.push(course_metadata_map.element_time_map[el].toDateString())
                                }
                            }
                            let quizReleaseDates = Array.from(new Set(startDates));
                            let offset = quizReleaseDates.length;
                            let annotationStart = quizReleaseDates.map(function (date, index) {
                                return {
                                    type: 'line',
                                    id: 'line' + (offset + index),
                                    mode: 'vertical',
                                    scaleID: 'x-axis-0',
                                    value: new Date(date),
                                    borderColor: 'green',
                                    borderWidth: 2,
                                    borderDash: [2, 2],
                                    borderDashOffset: 2
                                    // label: {
                                    //     enabled: true,
                                    //     position: "center",
                                    //     content: 'Quiz Start'
                                    // }
                                }
                            });

                            let annotations = annotationsDue.concat(annotationStart);
                            // console.log(annotations);

                            query = "SELECT * FROM forum_sessions";
                            await connection.runSql(query).then(function (f_sessions) {
                                f_sessions.forEach(function (session) {
                                    let start = session["start_time"].toDateString();
                                    start = new Date(start);

                                    if (forumDurations.hasOwnProperty(start)) {
                                        forumDurations[start].push(session["duration"]);
                                        forumSessions[start].push(session["course_learner_id"]);
                                    } else {
                                        forumDurations[start] = [];
                                        forumDurations[start].push(session["duration"]);

                                        forumSessions[start] = [];
                                        forumSessions[start].push(session["course_learner_id"]);
                                    }
                                });
                            });

                            query = "SELECT * FROM forum_interaction";
                            await connection.runSql(query).then(function (f_interactions) {
                                f_interactions.forEach(function (interaction) {
                                    let timestamp = interaction["post_timestamp"].toDateString();
                                    timestamp = new Date(timestamp);
                                    posterPostMap[interaction["post_content"]] = interaction["course_learner_id"];
                                    if (forumPosts.hasOwnProperty(timestamp)) {

                                        forumPosts[timestamp].push(interaction["post_content"]);
                                        forumPosters[timestamp].push(interaction["course_learner_id"]);

                                    } else {
                                        forumPosts[timestamp] = [];
                                        forumPosts[timestamp].push(interaction["post_content"]);

                                        forumPosters[timestamp] = [];
                                        forumPosters[timestamp].push(interaction["course_learner_id"]);
                                    }
                                });
                            });
                            toastr.info('Almost there!');

                            // FORUM SEGMENTATION /////////////////////////////////////////
                            let weeklyPosters = groupWeekly(forumPosters);
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

                            let weeklyFViewers = groupWeekly(forumSessions);
                            let fViewers = {};
                            let regularFViewers = [];
                            let occasionalFViewers = [];
                            for (let week in weeklyFViewers) {
                                let weekViewers = new Set(weeklyFViewers[week]);
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
                                    regularFViewers.push(p)
                                } else {
                                    occasionalFViewers.push(p)
                                }
                            }
                            let forumSegmentation = {
                                'regularPosters': new Set(regularPosters).size,
                                'regularViewers': new Set(regularFViewers).size,
                                'occasionalPosters': new Set(occasionalPosters).size,
                                'occasionalViewers': new Set(occasionalFViewers).size
                            };

                            let regPostersRegViewers = intersection(new Set(regularPosters), new Set(regularFViewers)),
                                regPostersOccViewers = intersection(new Set(regularPosters), new Set(occasionalFViewers)),
                                regPostersNonViewers = difference(new Set(regularPosters), new Set([...regularFViewers, ...occasionalFViewers])),
                                occPostersRegViewers = intersection(new Set(occasionalPosters), new Set(regularFViewers)),
                                occPostersOccViewers = intersection(new Set(occasionalPosters), new Set(occasionalFViewers)),
                                occPostersNonViewers = difference(new Set(occasionalPosters), new Set([...regularFViewers, ...occasionalFViewers])),
                                nonPostersRegViewers = difference(new Set([...regularPosters, ...occasionalPosters]), new Set(regularFViewers)),
                                nonPostersOccViewers = difference(new Set([...regularPosters, ...occasionalPosters]), new Set(occasionalFViewers)),
                                nonPostersNonViewers = difference(idSet, new Set([...regularPosters, ...occasionalPosters, ...regularFViewers, ...occasionalFViewers]));

                            let forumMatrixGroups = {
                                'regPostersRegViewers': regPostersRegViewers,
                                'regPostersOccViewers': regPostersOccViewers,
                                'regPostersNonViewers': regPostersNonViewers,
                                'occPostersRegViewers': occPostersRegViewers,
                                'occPostersOccViewers': occPostersOccViewers,
                                'occPostersNonViewers': occPostersNonViewers,
                                'nonPostersRegViewers': nonPostersRegViewers,
                                'nonPostersOccViewers': nonPostersOccViewers,
                                'nonPostersNonViewers': nonPostersNonViewers,
                            };

                            let gradeLists = {};
                            let counterLists = {};

                            for (let group in forumMatrixGroups) {
                                gradeLists[group] = [];
                                let passing = 0;
                                let notPassing = 0;
                                for (let student of forumMatrixGroups[group]){
                                    if (gradeMap.hasOwnProperty(student)) {
                                        if (gradeMap[student]["certificate_status"] === "downloadable") {
                                            gradeLists[group].push(gradeMap[student]["final_grade"])
                                            passing++
                                        } else {
                                            notPassing++;
                                        }
                                    } else {
                                        notPassing++;
                                    }
                                }
                                counterLists[group] = {'passing': passing, 'notPassing': notPassing}
                            }
                            // FORUM SEGMENTATION /////////////////////////////////////////

                            let dateList = Object.keys(dailySessions);
                            dateList.sort(function (a, b) {
                                return new Date(a) - new Date(b);
                            });

                            for (let date of dateList) {
                                orderedSessions[date] = dailySessions[date].length;
                                orderedStudents[date] = new Set(dailySessions[date]).size;
                                orderedDurations[date] = dailyDurations[date];

                                orderedForumStudents[date] = new Set(forumSessions[date]).size;

                                if (quizSessions.hasOwnProperty(date)) {
                                    orderedQuizSessions[date] = quizSessions[date].length;
                                } else {
                                    orderedQuizSessions[date] = 0
                                }

                                if (videoSessions.hasOwnProperty(date)) {
                                    orderedVideoSessions[date] = videoSessions[date].length;
                                } else {
                                    orderedVideoSessions[date] = 0
                                }

                                let regulars = [];
                                let occasionals = [];
                                if (forumSessions.hasOwnProperty(date)) {
                                    orderedForumSessions[date] = forumSessions[date].length;
                                    for (let student of forumSessions[date]) {
                                        if (regularFViewers.includes(student)) {
                                            regulars.push(student)
                                        } else {
                                            occasionals.push(student)
                                        }
                                    }
                                    orderedForumSessionRegulars[date] = regulars.length;
                                    orderedForumRegulars[date] = new Set(regulars).size;
                                    orderedForumSessionOccasionals[date] = occasionals.length;
                                    orderedForumOccasionals[date] = new Set(occasionals).size;
                                } else {
                                    orderedForumSessions[date] = 0;
                                    orderedForumSessionRegulars[date] = 0;
                                    orderedForumRegulars[date] = 0;
                                    orderedForumSessionOccasionals[date] = 0;
                                    orderedForumOccasionals[date] = 0;
                                }


                                orderedForumPostsByOccasionals[date] = 0;
                                orderedForumPostsByRegulars[date] = 0;
                                orderedForumPostersRegulars[date] = [];
                                orderedForumPostersOccasionals[date] = [];

                                if (forumPosters.hasOwnProperty(date)) {
                                    orderedForumPosters[date] = Math.round(forumPosters[date].length);
                                    for (let poster of forumPosters[date]) {
                                        if (regularPosters.includes(poster)) {
                                            orderedForumPostsByRegulars[date] = orderedForumPostsByRegulars[date] + 1;
                                            orderedForumPostersRegulars[date].push(poster)
                                        } else {
                                            orderedForumPostsByOccasionals[date] = orderedForumPostsByOccasionals[date] + 1;
                                            orderedForumPostersOccasionals[date].push(poster);
                                        }
                                    }
                                } else {
                                    orderedForumPosters[date] = 0;
                                    orderedForumPostsByRegulars[date] = 0;
                                    orderedForumPostsByOccasionals[date] = 0;
                                }

                                orderedForumPostersRegulars[date] = new Set(orderedForumPostersRegulars[date]).size;
                                orderedForumPostersOccasionals[date] = new Set(orderedForumPostersOccasionals[date]).size;

                                if (forumPosts.hasOwnProperty(date)) {
                                    orderedForumPosts[date] = Math.round(forumPosts[date].length);
                                    let dailyContent = [];
                                    let dailyContentReg = [];
                                    let dailyContentOcc = [];
                                    for (let post of forumPosts[date]) {
                                        dailyContent.push(post.length);
                                        if (regularPosters.includes(posterPostMap[post])) {
                                            dailyContentReg.push(post.length)
                                        } else {
                                            dailyContentOcc.push(post.length)
                                        }
                                    }
                                    orderedForumPostContent[date] = dailyContent;
                                    orderedForumPostContentRegulars[date] = dailyContentReg;
                                    orderedForumPostContentOccasionals[date] = dailyContentOcc
                                } else {
                                    orderedForumPosts[date] = 0;
                                    orderedForumPostContent[date] = [];
                                    orderedForumPostContentRegulars[date] = [];
                                    orderedForumPostContentOccasionals[date] = [];
                                }

                                let total = 0;
                                for (let i = 0; i < dailyDurations[date].length; i++) {
                                    total += dailyDurations[date][i];
                                }
                                orderedAvgDurations[date] = (total / dailyDurations[date].length).toFixed(2);

                                let quizTotal = 0;
                                for (let i = 0; i < orderedQuizSessions[date].length; i++) {
                                    quizTotal += quizDurations[date][i];
                                }
                                orderedQuizDurations[date] = quizTotal / orderedQuizSessions[date];

                                let vidTotal = 0;
                                for (let i = 0; i < orderedVideoSessions[date].length; i++) {
                                    vidTotal += videoDurations[date][i];
                                }
                                orderedVideoDurations[date] = vidTotal / orderedVideoSessions[date].length;

                                let forumTotal = 0;
                                if (forumDurations.hasOwnProperty(date)) {
                                    for (let i = 0; i < forumDurations[date].length; i++) {
                                        forumTotal += forumDurations[date][i];
                                    }
                                    orderedForumDurations[date] = Math.round(forumTotal);
                                    orderedForumAvgDurations[date] = Math.round(forumTotal / forumDurations[date].length);
                                } else {
                                    orderedForumDurations[date] = 0;
                                    orderedForumAvgDurations[date] = 0;
                                }

                                dateListChart.push(new Date(date));
                            }

                            graphElementMap = {
                                'course_name': course_name,
                                'start_date': start_date,
                                'end_date': end_date,
                                'dateListChart': dateListChart,

                                'orderedSessions': orderedSessions,
                                'orderedStudents': orderedStudents,
                                'orderedDurations': orderedDurations,
                                'orderedAvgDurations': orderedAvgDurations,

                                'orderedQuizSessions': orderedQuizSessions,
                                'orderedQuizDurations': orderedQuizDurations,

                                'orderedVideoSessions': orderedVideoSessions,
                                'orderedVideoDurations': orderedVideoDurations,

                                'orderedForumSessions': orderedForumSessions,
                                'orderedForumSessionRegulars': orderedForumSessionRegulars,
                                'orderedForumSessionOccasionals': orderedForumSessionOccasionals,
                                'orderedForumDurations': orderedForumDurations,
                                'orderedForumAvgDurations': orderedForumAvgDurations,

                                'forumSegmentation': forumSegmentation,
                                'orderedForumPosts': orderedForumPosts,
                                'orderedForumPostContent': orderedForumPostContent,
                                'orderedForumPostContentRegulars': orderedForumPostContentRegulars,
                                'orderedForumPostContentOccasionals': orderedForumPostContentOccasionals,
                                'orderedForumPosters': orderedForumPosters,
                                'orderedForumPostersRegulars': orderedForumPostersRegulars,
                                'orderedForumPostersOccasionals': orderedForumPostersOccasionals,
                                'orderedForumPostsByRegulars': orderedForumPostsByRegulars,
                                'orderedForumPostsByOccasionals': orderedForumPostsByOccasionals,

                                'gradeLists': gradeLists,
                                'counterLists': counterLists,

                                'orderedForumStudents': orderedForumStudents,
                                'orderedForumRegulars': orderedForumRegulars,
                                'orderedForumOccasionals': orderedForumOccasionals,
                                'annotations': annotations
                            };
                            let graphElements = [{
                                'name': 'graphElements',
                                'object': graphElementMap
                            }];
                            toastr.info('Processing graph data');
                            sqlInsert('webdata', graphElements, connection);
                            callback(graphElementMap, start, end);
                        });
                    });
                }
            })
        }
    })
}


function drawApex(graphElementMap, start, end, weekly){

    let weeklyPosts = groupWeeklyMapped(graphElementMap, 'orderedForumPosts');
    let weeklyRegPosts = groupWeeklyMapped(graphElementMap, 'orderedForumPostsByRegulars');
    let weeklyRegPosters = groupWeeklyMapped(graphElementMap, 'orderedForumPostersRegulars');
    let weeklyOccPosts = groupWeeklyMapped(graphElementMap, 'orderedForumPostsByOccasionals');
    let weeklyOccPosters = groupWeeklyMapped(graphElementMap, 'orderedForumPostersOccasionals');
    let weeklyForumSessions = groupWeeklyMapped(graphElementMap, 'orderedForumAvgDurations');
    let weeklyForumStudents = groupWeeklyMapped(graphElementMap, 'orderedForumStudents');
    let weeklyForumRegulars = groupWeeklyMapped(graphElementMap, 'orderedForumRegulars');
    let weeklyForumOccasionals = groupWeeklyMapped(graphElementMap, 'orderedForumOccasionals');

    let dateLabels = [];
    let forumData = [];
    let forumRegData = [];
    let forumRegPosters = [];
    let forumOccData = [];
    let forumOccPosters = [];
    let forumDurations = [];
    let forumStudents = [];
    let forumStudentsRegulars = [];
    let forumStudentsOccasionals = [];
    if (weekly === true){
        for (let date in weeklyPosts['weeklySum']){
            if (new Date(date) >= new Date(start) && new Date(date) <= new Date(end)) {
                // dateLabels.push(date.toLocaleString())
                dateLabels.push(new Date(date).toUTCString())
            }
        }
        forumData = trimByDates(weeklyPosts['weeklySum'], start, end);
        forumRegData = trimByDates(weeklyRegPosts['weeklySum'], start, end);
        forumRegPosters = trimByDates(weeklyRegPosters['weeklySum'], start, end);
        forumOccData = trimByDates(weeklyOccPosts['weeklySum'], start, end);
        forumOccPosters = trimByDates(weeklyOccPosters['weeklySum'], start, end);
        forumDurations = trimByDates(weeklyForumSessions['weeklyAvg'], start, end);
        forumStudents = trimByDates(weeklyForumStudents['weeklySum'], start, end);
        forumStudentsRegulars = trimByDates(weeklyForumRegulars['weeklySum'], start, end);
        forumStudentsOccasionals = trimByDates(weeklyForumOccasionals['weeklySum'], start, end);
    } else {
        for (let date of graphElementMap["dateListChart"]){
            if (new Date(date) >= new Date(start) && new Date(date) <= new Date(end)) {
                // dateLabels.push(date.toLocaleString())
                dateLabels.push(new Date(date).toUTCString())
            }
        }
        forumData = trimByDates(graphElementMap["orderedForumPosts"], start, end);
        forumRegData = trimByDates(graphElementMap["orderedForumPostsByRegulars"], start, end);
        forumRegPosters = trimByDates(graphElementMap["orderedForumPostersRegulars"], start, end);
        forumOccData = trimByDates(graphElementMap["orderedForumPostsByOccasionals"], start, end);
        forumOccPosters = trimByDates(graphElementMap["orderedForumPostersOccasionals"], start, end);
        forumDurations = trimByDates(graphElementMap['orderedForumAvgDurations'], start, end);
        forumStudents = trimByDates(graphElementMap['orderedForumStudents'], start, end);
        forumStudentsRegulars = trimByDates(graphElementMap['orderedForumRegulars'], start, end);
        forumStudentsOccasionals = trimByDates(graphElementMap['orderedForumOccasionals'], start, end);
    }
    let optionsMixed = {
        chart: {
            height: '420px',
            type: 'line',
            // stacked: true,
            toolbar: {
                show: true,
                tools: {
                    download: '<i class="fas fa-download"></i>',
                    selection: false,
                    zoom: false,
                    zoomin: false,
                    zoomout: false,
                    pan: false,
                    customIcons: []
                },
                autoSelected: 'zoom'
            },
        },
        responsive: [{
            breakpoint: 480,
            options: {
                legend: {
                    position: 'top',
                    offsetX: -10,
                    offsetY: 0
                }
            }
        }],
        legend: {
            position: 'top'
        },
        plotOptions: {
            bar: {
                horizontal: false,
                stacked: true
            },
        },
        series: [{
            name: 'Posts by Regulars',
            type: 'column',
            data: forumRegData
        }, {
            name: 'Regular Viewers', // - ' + graphElementMap['forumSegmentation']['regularViewers'] + ' students',
            type: 'line',
            data: forumStudentsRegulars
        }, {
            name: 'Regular Posters', // - ' + graphElementMap['forumSegmentation']['regularPosters'] + ' students',
            type: 'line',
            data: forumRegPosters
        }, {
            name: 'Posts by Occasionals',
            type: 'column',
            data: forumOccData
        }, {
            name: 'Occasional Viewers', //- ' + graphElementMap['forumSegmentation']['occasionalViewers'] + ' students',
            type: 'line',
            data: forumStudentsOccasionals
        }, {
            name: 'Occasional Posters' , // - ' + graphElementMap['forumSegmentation']['occasionalPosters'] + ' students',
            type: 'line',
            data: forumOccPosters
        }],
        stroke: {
            width: [1, 3, 3, 1, 3, 3],
            dashArray: [0, 0, 0, 0, 0, 0]
        },
        // colors: ['#C41E3D', '#7D1128', '#FF2C55', '#5EB1BF', '#54F2F2', '#042A2B'],
        colors: ['#c44f7e', '#5EB1BF','#1cef33', '#7D1128','#54F2F2','#138d00'],
        title: {
            text: 'Weekly Forum Analysis',
            align: 'center',
            style: {
                fontSize:  '16px',
                color:  '#263238',
                fontFamily: 'Helvetica'
            },
        },
        labels: dateLabels,
        xaxis: {
            type: 'datetime',
            min: new Date(start).getTime(),
            max: new Date(end).getTime(),
        },
        yaxis: [{
            seriesName: 'Posts by Regulars',
            showAlways: true,
            axisTicks: {
                show: true,
            },
            axisBorder: {
                show: true,
                color: '#ee000e'
            },
            labels: {
                style: {
                    color: '#ee000e',
                },
                formatter: v => (v.toFixed(0)).toLocaleString()
            },
            title: {
                text: "New Posts Added",
                style: {
                    color: '#ee000e',
                }
            }
        }, {
            seriesName: 'Regular Viewers',
            showAlways: true,
            opposite: true,
            axisTicks: {
                show: true,
                formatter: v => (v.toFixed(0))
            },
            axisBorder: {
                show: true,
                color: '#2c46b8'
            },
            labels: {
                style: {
                    color: '#2c46b8',
                },
                formatter: function(v) {
                    let label = new Number(v.toFixed(0));
                    label = label.toLocaleString('en-US');
                    return  label;
                }
            },
            title: {
                text: "Students visiting Forums",
                style: {
                    color: '#2c46b8',
                }
            }
        }, {
            seriesName: 'Regular Posters',
            showAlways: true,
            axisTicks: {
                show: true,
            },
            axisBorder: {
                show: true,
                color: '#138d00'
            },
            labels: {
                show: true,
                style: {
                    color: '#138d00',
                },
                formatter: v => v.toFixed(0)
            },
            title: {
                text: "Students Posting",
                style: {
                    color: '#138d00',
                }
            }
        }, {
            // seriesName: 'Posts by Occasionals', // REAL NAME
            seriesName: 'Posts by Regulars', // NAME FOR AXIS
            opposite: true,
            axisTicks: {
                show: false,
            },
            axisBorder: {
                show: false,
                color: '#5EB1BF'
            },
            labels: {
                show: false,
                style: {
                    color: '#5EB1BF',
                },
                formatter: v => v.toFixed(0)
            },
            title: {
                // text: "Posts by Occasional Students",
                style: {
                    color: '#5EB1BF',
                }
            }
        }, {
            // seriesName: 'Occasional Viewers',
            seriesName: 'Regular Viewers',
            opposite: true,
            axisTicks: {
                show: false,
            },
            axisBorder: {
                show: false,
                color: '#54F2F2'
            },
            labels: {
                show: false,
                style: {
                    color: '#54F2F2',
                },
                formatter: v => v.toFixed(0)
            },
            title: {
                // text: "New Posts",
                style: {
                    color: '#54F2F2',
                }
            }
        }, {
            // name: 'Occasional Posters',
            seriesName: 'Regular Posters',
            axisTicks: {
                show: false,
            },
            axisBorder: {
                show: false,
                color: '#042A2B'
            },
            labels: {
                show: false,
                style: {
                    color: '#042A2B',
                },
                formatter: v => v.toFixed(0)
            },
            title: {
                // text: "New Posts",
                style: {
                    color: '#042A2B',
                }
            }
        }]
    };

    if (mixedChart !== null) {
        mixedChart.destroy();
    }

    mixedChart = new ApexCharts(
        document.querySelector("#mixedChart"),
        optionsMixed
    );

    mixedChart.render();

    let heatOptions = {
        chart: {
            height: 350,
            type: 'heatmap',
            toolbar: {
                show: true,
                tools: {
                    download: '<i class="fas fa-download"></i>',
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter:  function (value) {
                for (let group in graphElementMap['gradeLists']){
                    let grades = graphElementMap['gradeLists'][group];
                    let gradeAvg = arr => arr.reduce((a,b) => a + b, 0) / arr.length;
                    if (gradeAvg(grades) === value) {
                        return (value + JSON.stringify(graphElementMap['counterLists'][group]))
                    } else {
                        return value * 100
                    }
                }
            }
        },
        tooltip: {
            enabled: false,
            // x: {
            //     show: false,
            //     formatter:  function (value) {
            //         return (value + ' this')
            //     }
            // },
            // y: {
            //     show: false,
            //     formatter: function (value) {
            //         return (value + ' here x')
            //     },
            //     title: {
            //         formatter: function (value) {
            //             return (value + ' here y')
            //         }
            //     }
            // },
            // z: {
            //     show: false,
            //     formatter: function (value) {
            //         return (value + ' z ')
            //     },
            //     title: {
            //         formatter: function (value) {
            //             return (value + ' z 2 ')
            //         }
            //     }
            // },
        },
        colors: ['#008FFB'],
        series: [{
                name: 'Non-Posters',
                data: [
                    { x:'Regular Viewers', y: zeroIfEmptyArray(graphElementMap['gradeLists']['nonPostersRegViewers'])},
                    { x:'Occasional Viewers', y: zeroIfEmptyArray(graphElementMap['gradeLists']['nonPostersOccViewers'])},
                    { x:'Non-Viewers', y: zeroIfEmptyArray(graphElementMap['gradeLists']['nonPostersNonViewers'])}
                ]
            },
            {
                name: 'Occasional Posters',
                data: [
                    { x:'Regular Viewers', y: zeroIfEmptyArray(graphElementMap['gradeLists']['occPostersRegViewers'])},
                    { x:'Occasional Viewers', y: zeroIfEmptyArray(graphElementMap['gradeLists']['occPostersOccViewers'])},
                    { x:'Non-Viewers', y: zeroIfEmptyArray(graphElementMap['gradeLists']['occPostersNonViewers'])}
                ]
            },
            {
                name: 'Regular Posters',
                data: [
                    { x:'Regular Viewers', y: zeroIfEmptyArray(graphElementMap['gradeLists']['regPostersRegViewers'])},
                    { x:'Occasional Viewers', y: zeroIfEmptyArray(graphElementMap['gradeLists']['regPostersOccViewers'])},
                    { x:'Non-Viewers', y: zeroIfEmptyArray(graphElementMap['gradeLists']['regPostersNonViewers'])}
                ],
            }
        ],
        title: {
            text: 'Average Grade per Group by Forum Behavior'
        },
    };

    let heatChart = new ApexCharts(
        document.querySelector("#heatChart"),
        heatOptions
    );
    heatChart.render();
}


function zeroIfEmptyArray(array){
    if (array.length === 0){
        return [0]
    }
    return array
}



Date.prototype.getWeek = function() {
    let date = new Date(this.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    let week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
        - 3 + (week1.getDay() + 6) % 7) / 7);
};


Date.prototype.getWeekYear = function() {
    let date = new Date(this.getTime());
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    return date.getFullYear();
};

function groupWeekly(elementObject) {
    let grouped = _.groupBy(Object.keys(elementObject), (result) => moment(new Date(result), 'DD/MM/YYYY').startOf('isoWeek'));
    let weeklySum = {};
    for (let week in grouped) {
        let weekDays = grouped[week];
        let weekTotal = 0;
        let weekList = [];
        let weekType = 'number';
        for (let day of weekDays) {
            if (typeof elementObject[day] === "number") {
                weekTotal += elementObject[day];
            } else {
                weekType = 'list';
                let weekValues = [];
                if (elementObject.hasOwnProperty(day)) {
                    weekValues = elementObject[day];
                }
                for (let element of weekValues) {
                    weekList.push(element);
                }
            }
        }
        if (weekType === "number") {
            weeklySum[week] = weekTotal;
        } else {
            weeklySum[week] = weekList;
        }
    }
    return weeklySum
}


function groupWeeklyMapped(graphElementMap, orderedElements) {
    let grouped = _.groupBy(graphElementMap['dateListChart'], (result) => moment(result, 'DD/MM/YYYY').startOf('isoWeek'));
    let weeklySum = {};
    let weeklyAvg = {};
    for (let week in grouped) {
        let weekDays = grouped[week];
        let weekTotal = 0;
        let weekList = [];
        let weekType = 'number';
        for (let day of weekDays) {
            if (graphElementMap[orderedElements].hasOwnProperty(day)) {
                if (typeof graphElementMap[orderedElements][day] === "number") {
                    weekTotal += graphElementMap[orderedElements][day];
                } else {
                    weekType = 'list';
                    let weekValues = [];
                    if (graphElementMap[orderedElements].hasOwnProperty(day)) {
                        weekValues = graphElementMap[orderedElements][day];
                    }
                    for (let element of weekValues) {
                        weekList.push(element);
                    }
                }
            }
        }
        if (weekType === "number") {
            weeklySum[week] = weekTotal;
            weeklyAvg[week] = weekTotal / 7;
        } else {
            weeklySum[week] = weekList;
            weeklyAvg[week] = 'noAvg'
        }
    }
    return {'weeklySum':weeklySum, 'weeklyAvg': weeklyAvg}
}


function videoTransitions() {
    let learnerIds = [];
    let learnerStatus = {};
    let videoIds = {};
    let videoIdsP = {};
    let videoIdsF = {};
    let unorderedVideos = [];
    let arcData = {};
    connection.runSql("SELECT * FROM metadata WHERE name = 'metadata_map' ").then(async function (result) {
        if (result.length !== 1) {
            console.log('Metadata empty')
        } else {
            let course_metadata_map = result[0]['object'];
            let courseId = course_metadata_map.course_id;
            courseId = courseId.slice(courseId.indexOf(':') + 1,);
            await connection.runSql("SELECT * FROM course_learner").then(function (learners) {
                learners.forEach(function (learner) {
                    learnerIds.push(learner.course_learner_id);
                    learnerStatus[learner.course_learner_id] = learner.certificate_status;
                });
            });

            let chapterMap = {};

            for (let elementId in course_metadata_map.child_parent_map) {
                if (! elementId.includes('video')) {
                    continue;
                } else {
                    let parentId = course_metadata_map.child_parent_map[elementId];
                    let parent2Id = course_metadata_map.child_parent_map[parentId];
                    let parent3Id = course_metadata_map.child_parent_map[parent2Id];
                    unorderedVideos.push({
                        'elementId': elementId,
                        'chapter': course_metadata_map.order_map[parent3Id],
                        'section': course_metadata_map.order_map[parent2Id],
                        'block': course_metadata_map.order_map[parentId]
                    });
                    chapterMap[elementId.slice(elementId.lastIndexOf('@') + 1,)] = {
                        'chapter': course_metadata_map.order_map[parent3Id],
                        'chapterName': course_metadata_map.element_name_map[parent3Id]
                    }
                }
            }

            let orderedVideos = unorderedVideos.sort(function (a, b) {
                return a.block - b.block
            });
            orderedVideos.sort(function (a, b) {
                return a.section - b.section
            });
            orderedVideos.sort(function (a, b) {
                return a.chapter - b.chapter
            });

            for (let video of orderedVideos) {
                let videoId = video.elementId;
                videoId = videoId.slice(videoId.lastIndexOf('@') + 1,);
                videoIds[videoId] = [];
                videoIdsP[videoId] = [];
                videoIdsF[videoId] = [];
            }

            let videoChains = {};
            let passingChains = {};
            let failingChains = {};
            let maxViewers = 0;
            let passingViewers = 0;
            let failingViewers = 0;
            let counter = 0;
            for (let learner of learnerIds) {
                let learnerSessions = [];
                let query = "SELECT * FROM video_interaction WHERE course_learner_id = '" + learner + "'";
                await connection.runSql(query).then(function (sessions) {
                    learnerSessions = sessions;
                    learnerSessions.sort(function (a, b) {
                        return new Date(a.start_time) - new Date(b.start_time)
                    });
                    let videoChain = [];
                    let currentVideo = '';
                    for (let session of learnerSessions) {
                        if (session.video_id !== currentVideo) {
                            currentVideo = session.video_id;
                            videoChain.push(currentVideo);
                        }
                    }
                    if (videoChain.length > 1) {
                        videoChains[learner] = videoChain;
                        if (learnerStatus[learner] === 'downloadable') {
                            passingChains[learner] = videoChain;
                            passingViewers++;
                        } else {
                            failingChains[learner] = videoChain;
                            failingViewers++;
                        }
                    }

                    counter++;

                    if (counter === learnerIds.length) {
                        for (let learner in videoChains) {
                            for (let i = 0; i < videoChains[learner].length - 1; i++) {
                                let currentVideo = videoChains[learner][i];
                                let followingVideo = videoChains[learner][i + 1];
                                videoIds[currentVideo].push(followingVideo);
                            }
                        }
                        let frequencies = {};
                        for (let video in videoIds) {
                            let frequency = _.countBy(videoIds[video]);
                            for (let nextVideo in videoIds) {
                                if (frequency.hasOwnProperty(nextVideo)) {
                                    frequency[nextVideo] = frequency[nextVideo] / (failingViewers + passingViewers) // For normalized value
                                }
                            }
                            let freqSorted = Object.keys(frequency).sort(function (a, b) {
                                return frequency[b] - frequency[a]
                            });
                            let top3 = {};
                            for (let video of freqSorted.slice(0, 3)) {
                                top3[video] = frequency[video]
                            }
                            frequencies[video] = top3;
                            maxViewers = Math.max(maxViewers, videoIds[video].length)
                        }

                        // PASSING STUDENTS //////////////////////////////////////////////////////////
                        for (let learner in passingChains) {
                            for (let i = 0; i < passingChains[learner].length - 1; i++) {
                                let currentVideo = passingChains[learner][i];
                                let followingVideo = passingChains[learner][i + 1];
                                videoIdsP[currentVideo].push(followingVideo);
                            }
                        }
                        let frequenciesP = {};
                        for (let video in videoIdsP) {
                            let frequency = _.countBy(videoIdsP[video]);
                            for (let nextVideo in videoIdsP) {
                                if (frequency.hasOwnProperty(nextVideo)) {
                                    frequency[nextVideo] = frequency[nextVideo] / passingViewers; //  For normalized value
                                }
                            }
                            let freqSorted = Object.keys(frequency).sort(function (a, b) {
                                return frequency[b] - frequency[a]
                            });
                            let top3 = {};
                            for (let video of freqSorted.slice(0, 3)) {
                                top3[video] = frequency[video]
                            }
                            frequenciesP[video] = top3;
                        }
                        // PASSING STUDENTS //////////////////////////////////////////////////////////

                        // FAILING STUDENTS //////////////////////////////////////////////////////////
                        for (let learner in failingChains) {
                            for (let i = 0; i < failingChains[learner].length - 1; i++) {
                                let currentVideo = failingChains[learner][i];
                                let followingVideo = failingChains[learner][i + 1];
                                videoIdsF[currentVideo].push(followingVideo);
                            }
                        }
                        let frequenciesF = {};
                        for (let video in videoIdsF) {
                            let frequency = _.countBy(videoIdsF[video]);
                            for (let nextVideo in videoIdsF) {
                                if (frequency.hasOwnProperty(nextVideo)) {
                                    frequency[nextVideo] = frequency[nextVideo] / failingViewers; // For normalized value
                                }
                            }
                            let freqSorted = Object.keys(frequency).sort(function (a, b) {
                                return frequency[b] - frequency[a]
                            });
                            let top3 = {};
                            for (let video of freqSorted.slice(0, 3)) {
                                top3[video] = frequency[video]
                            }
                            frequenciesF[video] = top3;
                        }
                        // FAILING STUDENTS //////////////////////////////////////////////////////////

                        let i = 0;
                        let nodes = [];
                        let links = [];
                        let currentChapter = '';
                        for (let currentVideo in frequencies) {
                            let percentages = "<span style='font-size: 14px;'>" +
                                course_metadata_map['element_name_map']["block-v1:" + courseId + "+type@video+block@" + currentVideo] +
                                "</span><br>";
                            for (let followingVideo in frequencies[currentVideo]) {
                                if (frequencies[currentVideo][followingVideo] > 0) {
                                    let link = {
                                        'source': currentVideo,
                                        'target': followingVideo,
                                        'value': frequencies[currentVideo][followingVideo],
                                        'status': 'general'
                                    };
                                    links.push(link);
                                    percentages += "<span style='font-size: 12px;'>" +
                                        course_metadata_map['element_name_map']["block-v1:" + courseId + "+type@video+block@" + followingVideo] +
                                        ": " + (frequencies[currentVideo][followingVideo] * 100).toFixed(0) +
                                        "%</span><br>"
                                }
                            }
                            for (let followingVideo in frequenciesP[currentVideo]) {
                                if (frequenciesP[currentVideo][followingVideo] > 0) {
                                    let link = {
                                        'source': currentVideo,
                                        'target': followingVideo,
                                        'value': frequenciesP[currentVideo][followingVideo],
                                        'status': 'passing'
                                    };
                                    links.push(link);
                                }
                            }
                            for (let followingVideo in frequenciesF[currentVideo]) {
                                if (frequenciesF[currentVideo][followingVideo] > 0) {
                                    let link = {
                                        'source': currentVideo,
                                        'target': followingVideo,
                                        'value': frequenciesF[currentVideo][followingVideo],
                                        'status': 'failing'
                                    };
                                    links.push(link);
                                }
                            }
                            let chapterName = '';
                            if (chapterMap[currentVideo]['chapterName'] !== currentChapter){
                                currentChapter =  chapterMap[currentVideo]['chapterName'];
                                chapterName = currentChapter;
                            } else {
                                chapterName = '';
                            }

                            i++;

                            let videoName = course_metadata_map.element_name_map["block-v1:" + courseId + "+type@video+block@" + currentVideo];
                            if (!videoName){
                                videoName = 'Video ' + i
                            }

                            nodes.push({
                                'name': videoName,
                                'info': percentages,
                                'n': (videoIds[currentVideo].length / maxViewers) * 20,
                                'grp': chapterMap[currentVideo]['chapter'],
                                'chapter': chapterName,
                                'id': currentVideo
                            });
                        }

                        arcData['nodes'] = nodes;
                        arcData['links'] = links;
                        let arcElements = [{'name': 'arcElements', 'object': arcData}];
                        // connection.runSql("DELETE FROM webdata WHERE name = 'arcElements'").then(function (success) {
                            sqlInsert('webdata', arcElements, connection);
                            drawVideoArc();
                        // });
                    }
                });
            }
        }
    });
}


function drawVideoArc(linkNumber){ // https://www.d3-graph-gallery.com/graph/arc_template.html
    connection.runSql("SELECT * FROM webdata WHERE name = 'arcElements' ").then(function(result) {
        if (result.length !== 1) {
            videoTransitions()
        } else {
            let nodeData = result[0]['object'];
            nodeData.links.sort(function(a, b) {
                return b.value - a.value;
            });

            if (linkNumber == null){
                linkNumber = nodeData.nodes.length
            }

            let linkSlider = d3.select('#links');
            linkSlider.on('change', function() {
                drawVideoArc(this.value);
            });

            let typeDropdown = d3.select('#arcType');
            typeDropdown.on('change', function () {
                drawVideoArc()
            });

            // let arcTileDiv = document.getElementById("arcTile");
            // arcTileDiv.addEventListener("resize", drawVideoArc);

            $("#arcChart").empty();
            let arcDiv = document.getElementById("arcChart");

            let margin = {top: 100, right: 70, bottom: 120, left: 70},
                width = nodeData.nodes.length * 35,
                height = 200;

            let svg = d3.select(arcDiv)
                .append("svg")
                .attr(':xmlns:xlink','http://www.w3.org/1999/xlink')
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform",
                    "translate(" + margin.left + "," + margin.top + ")");

                svg.append("text")
                .attr("x", (width / 2))
                .attr("y", 20 - (margin.top / 2))
                .attr("text-anchor", "middle")
                .style("font-size", "16px")
                .style("font-family", "Helvetica")
                .text("Video Transitions");

            let allNodes = nodeData.nodes.map(function (d) {
                return d.name
            });

            let allGroups = nodeData.nodes.map(function (d) {
                return d.grp
            });

            allGroups = [...new Set(allGroups)];

            let color = d3.scaleOrdinal()
                .domain(allGroups)
                .range(d3.schemeSet3);

            let size = d3.scaleLinear()
                .domain([1, 10])
                .range([2, 10]);

            let x = d3.scalePoint()
                .range([0, width])
                .domain(allNodes);

            let idToNode = {};
            nodeData.nodes.forEach(function (n) {
                idToNode[n.id] = n;
            });

            let arcType = typeDropdown.node().value;

            let links = svg
                .selectAll('mylinks')
                .data(nodeData.links.slice(0,linkNumber))
                .enter()
                .append('path')
                .attr('d', function (d) {
                    let start = x(idToNode[d.source].name);
                    let end = x(idToNode[d.target].name);
                    if (arcType === 'general'){
                        if (d.status === 'general') {
                            return calculateArc(start, end, height)
                        }
                    } else if (arcType === 'passing'){
                        if (d.status === 'passing') {
                            return calculateArc(start, end, height)
                        }
                    } else {
                        if (d.status === 'failing') {
                            return calculateArc(start, end, height)
                        }
                    }
                })
                .style("fill", "none")
                .style('stroke', function (link_d) {
                    if (link_d.status === 'general') {
                        return '#0006b8';
                    } else if (link_d.status === 'passing') {
                        return  '#138d00';
                    } else if (link_d.status === 'failing') {
                        return  '#fe1100';
                    }
                })
                .style('stroke-opacity', .5)
                .style("stroke-width", function (d) {
                    return 10 * (d.value)
                });

            let nodes = svg
                .selectAll("mynodes")
                .data(nodeData.nodes.sort(function (a, b) {
                    return +b.n - +a.n
                }))
                .enter()
                .append("circle")
                .attr("cx", function (d) {
                    return (x(d.name))
                })
                .attr("cy", height - 30)
                .attr("r", function (d) {
                    return (size(d.n))
                })
                .style("fill", function (d) {
                    return color(d.grp)
                })
                .attr("stroke", "transparent")
                .attr("stroke-width", function (d) {
                    return (25 - d.n)
                });

            let labels = svg
                .selectAll("mylabels")
                .data(nodeData.nodes)
                .enter()
                .append("text")
                .attr("x", 0)
                .attr("y", 0)
                .text(function (d) {
                    // return (d.name)
                    return d.chapter;
                })
                .style("text-anchor", "end")
                .attr("transform", function (d) {
                    return ("translate(" + (x(d.name) + 20) + "," + (height - 15) + ")rotate(-20)")
                })
                .style("font-size", 10);

            let tooltip = d3.select("body")
                .append("div")
                .data(nodeData.nodes)
                .text(function (d) {
                    return d.info
                })
                .style("position", "absolute")
                .style("z-index", "10")
                .style("visibility", "hidden");

            nodes
                .on('mouseover', function (d) {
                    nodes
                        .style('opacity', 0.15);
                    d3.select(this)
                        .style('opacity', 0.7);
                    links
                        .style('stroke', function (link_d) {
                            if (link_d.status === 'general') {
                                return link_d.source === d.id ? '#0006b8' : '#b8b8b8';
                            } else if (link_d.status === 'passing') {
                                return link_d.source === d.id ? '#138d00' : '#b8b8b8';
                            } else if (link_d.status === 'failing') {
                                return link_d.source === d.id ? '#fe1100' : '#b8b8b8';
                            }
                        })
                        .style('stroke-opacity', function (link_d) {
                            return link_d.source === d.id || link_d.target === d.id ? 1 : .2;
                        })
                        .style('stroke-width', function (link_d) {
                            return link_d.source === d.id || link_d.target === d.id ? 10 * (d.value) : 5;
                        });
                    labels
                        .text(function (d) {
                            return d.name;
                        })
                        .style("font-size", function (label_d) {
                            return label_d.name === d.name ? 12 : 2
                        })
                        .attr("y", function (label_d) {
                            return label_d.name === d.name ? 10 : 0
                        });
                    tooltip
                        .style("top", (event.pageY - 150) + "px")
                        .style("left", (event.pageX - 50) + "px")
                        .html(d.info)
                        .style("visibility", "visible");

                })
                .on('mouseout', function (d) {
                    nodes.style('opacity', 1);
                    links
                        .style('stroke', function (link_d) {
                            if (link_d.status === 'general') {
                                return '#0006b8';
                            } else if (link_d.status === 'passing') {
                                return  '#138d00';
                            } else if (link_d.status === 'failing') {
                                return  '#fe1100';
                            }
                        })
                        .style('stroke-opacity', .5)
                        .style("stroke-width", function (d) {
                            return 10 * (d.value)
                        });
                    labels
                        .text(function (d) {
                            return (d.chapter)
                        })
                        .attr("y", 0)
                        .style("font-size", 10);
                    tooltip
                        .style("visibility", "hidden");
                })
        }
    })
}


function calculateArc(start, end, height) {
    return ['M', start, height - 30,
        'A',
        Math.abs(end - start) / 2.3, ',',
        Math.abs(end - start) / 2, 0, 0, ',',
        start < end ? 1 : 1, end, ',', height - 30]
        .join(' ');
}

function moduleTransitions() {
    let learnerIds = [];
    let learnerStatus = {};
    let elementIds = {};
    let elementIdsD = {};
    let unorderedElements = [];
    connection.runSql("SELECT * FROM metadata WHERE name = 'metadata_map' ").then(async function (result) {
        if (result.length !== 1) {
            console.log('Metadata empty');
            loader(false);
        } else {
            const course_metadata_map = result[0]['object'];
            let courseId = course_metadata_map.course_id;
            courseId = courseId.slice(courseId.indexOf(':') + 1,);
            let startingWeek = course_metadata_map.start_date.getWeek();
            await connection.runSql("SELECT * FROM course_learner").then(function (learners) {
                learners.forEach(function (learner) {
                    learnerIds.push(learner.course_learner_id);
                    learnerStatus[learner.course_learner_id] = learner.certificate_status;
                });
            });
            for (let elementId in course_metadata_map.child_parent_map) {
                if (elementId.includes('video+') ||
                    elementId.includes('problem+') ||
                    elementId.includes('discussion+')) {
                    let parentId = course_metadata_map.child_parent_map[elementId];
                    let parent2Id = course_metadata_map.child_parent_map[parentId];
                    let parent3Id = course_metadata_map.child_parent_map[parent2Id];
                    unorderedElements.push({
                        'elementId': elementId,
                        'chapter': course_metadata_map.order_map[parent3Id],
                        'section': course_metadata_map.order_map[parent2Id],
                        'block': course_metadata_map.order_map[parentId],
                        'type': course_metadata_map.element_type_map[elementId],
                        'name': course_metadata_map.element_name_map[elementId]
                    })
                }
            }
            let orderedElements = unorderedElements.sort(function (a, b) {
                return a.block - b.block
            });
            orderedElements.sort(function (a, b) {
                return a.section - b.section
            });
            orderedElements.sort(function (a, b) {
                return a.chapter - b.chapter
            });

            for (let element of orderedElements) {
                let elementId = element.elementId;
                elementIdsD[elementId] = []; //Designed
            }

            let learningPaths = {};
            let passingPaths = {};
            let failingPaths = {};
            let counter = 0;

            let designedPath = [];
            let currentElement = '';

            for (let element of orderedElements) {
                if (element.chapter === 1 || element.chapter === 2) {
                    if (element.elementId !== currentElement) {
                        currentElement = element.elementId;
                        let elementId = element.elementId;
                        designedPath.push(elementId);
                    }
                }
            }
            learningPaths['designed'] = designedPath;
            for (let learner in learningPaths) {
                for (let i = 0; i < learningPaths[learner].length - 1; i++) {
                    let currentElement = learningPaths[learner][i];
                    let followingElement = learningPaths[learner][i + 1];
                    elementIdsD[currentElement].push(followingElement);
                }
            }
            let frequenciesDesigned = {};
            for (let element in elementIdsD) {
                let frequency = _.countBy(elementIdsD[element]);
                for (let nextElement in elementIdsD) {
                    if (frequency.hasOwnProperty(nextElement)) {
                        frequency[nextElement] = 1;
                    }
                }
                frequenciesDesigned[element] = frequency
            }
            let linksDesigned = [];
            let l = 0;
            for (let currentElement in frequenciesDesigned) {
                for (let followingElement in frequenciesDesigned[currentElement]) {
                    let nodeMap = {
                        'discussion': 'FORUM START',
                        'problem': 'QUIZ START',
                        'video': 'VIDEO'
                    };
                    let sourceType = course_metadata_map.element_type_map[currentElement];
                    let targetType = course_metadata_map.element_type_map[followingElement];
                    let sourceNode = nodeMap[sourceType];
                    let targetNode = nodeMap[targetType];

                    let link = {
                        'sourceElement': currentElement,
                        'sourceType': sourceType,
                        'sourceNode': sourceNode,
                        'targetElement': followingElement,
                        'targetType': targetType,
                        'targetNode': targetNode,
                        'value': frequenciesDesigned[currentElement][followingElement],
                        'status': 'designed',
                        'id': ' ' + l
                    };
                    linksDesigned.push(link);
                    l++;
                }
            }

            toastr.info('Calculating element transitions');
            learningPaths = {};
            let totalLearners = 0,
                passingLearners = 0,
                failingLearners = 0;
            let allSessions = {};
            for (let learnerId of learnerIds) {
                totalLearners++;
                allSessions[learnerId] = [];
                let status = learnerStatus[learnerId];
                if (status==='downloadable'){passingLearners++}else{failingLearners++}
                await connection.runSql("SELECT * FROM forum_sessions WHERE course_learner_id = '" + learnerId + "' ").then(function (sessions) {
                    sessions.forEach(function(session) {
                        let forumStartSession = $.extend({}, session);
                        forumStartSession['type'] = 'forum';
                        forumStartSession['time'] = forumStartSession.start_time;
                        let elementId = forumStartSession.relevent_element_id;
                        forumStartSession['elementId'] = elementId.slice(elementId.lastIndexOf('@') + 1,);
                        forumStartSession['status'] = status;
                        allSessions[learnerId].push(forumStartSession);

                        let forumEndSession = $.extend({}, session);
                        forumEndSession['type'] = 'forum-end';
                        forumEndSession['time'] = forumEndSession.end_time;
                        forumEndSession['elementId'] = elementId.slice(elementId.lastIndexOf('@') + 1,);
                        forumEndSession['status'] = status;
                        allSessions[learnerId].push(forumEndSession)
                    })
                });
                await connection.runSql("SELECT * FROM forum_interaction WHERE course_learner_id = '" + learnerId + "' ").then(function (sessions) {
                    sessions.forEach(function(session) {
                        session['type'] = 'forum-post';
                        session['time'] = session.post_timestamp;
                        session['elementId'] = session.post_id;
                        session['postDetails'] = {'id': session.post_id, 'thread': session.post_thread_id, 'parent': session.post_parent_id};
                        session['status'] = status;
                        allSessions[learnerId].push(session)
                    })
                });
                await connection.runSql("SELECT * FROM quiz_sessions WHERE course_learner_id = '" + learnerId + "' ").then(function (sessions) {
                    sessions.forEach(function(session) {
                        let quizStartSession = $.extend({}, session);
                        quizStartSession['type'] = 'quiz-start';
                        quizStartSession['time'] = session.start_time;
                        let elementId = session.session_id;
                        quizStartSession['elementId'] = elementId.slice(elementId.lastIndexOf('@') + 1, elementId.indexOf('_course'));
                        quizStartSession['status'] = status;
                        allSessions[learnerId].push(quizStartSession);

                        let quizEndSession = $.extend({}, session);
                        quizEndSession['type'] = 'quiz-end';
                        quizEndSession['time'] = session.end_time;
                        quizEndSession['elementId'] = elementId.slice(elementId.lastIndexOf('@') + 1, elementId.indexOf('_course'));
                        quizEndSession['status'] = status;
                        allSessions[learnerId].push(quizEndSession)
                    })
                });
                await connection.runSql("SELECT * FROM submissions WHERE course_learner_id = '" + learnerId + "' ").then(function (sessions) {
                    sessions.forEach(function(session) {
                        session['type'] = 'submission';
                        session['time'] = session.submission_timestamp;
                        let elementId = session.question_id;
                        session['elementId'] = elementId.slice(elementId.lastIndexOf('@') + 1,);
                        session['status'] = status;
                        allSessions[learnerId].push(session)
                    })
                });
                await connection.runSql("SELECT * FROM video_interaction WHERE course_learner_id = '" + learnerId + "' ").then(function (sessions) {
                    sessions.forEach(function(session) {
                        session['type'] = 'video';
                        session['time'] = session.start_time;
                        let elementId = session.video_id;
                        session['elementId'] = elementId.slice(elementId.lastIndexOf('@') + 1,);
                        session['status'] = status;
                        allSessions[learnerId].push(session)
                    })
                });
                allSessions[learnerId].sort(function (a, b) {
                    return new Date(a.time) - new Date(b.time)
                });

                if (learnerIds.length / totalLearners === 4 ){toastr.info('25% done');}
                if (learnerIds.length / totalLearners === 2 ){toastr.info('Halfway there...');}
            }

            let week = 0;
            let weekStart = new Date(course_metadata_map.start_date.toDateString());
            let weekEnd = new Date();
            let weeklyData = {};
            do {
                learningPaths = {
                    'downloadable': {},
                    'notpassing': {},
                    'audit_passing': {},
                    'unverified': {}
                };
                weekEnd = new Date(weekStart.toDateString());
                weekEnd = new Date(weekEnd.setDate(weekEnd.getDate() + 7));
                for (let learnerId in allSessions) {
                    let learningPath = [];
                    for (let session of allSessions[learnerId]){
                        if (new Date(session.time) > weekStart &&
                            new Date(session.time) < weekEnd ){
                            learningPath.push(session.type + '_')// + session.elementId);
                        }
                    }
                    if (learningPath.length > 1) {
                        learningPaths[learnerStatus[learnerId]][learnerId] = learningPath;
                    }
                }
                weekStart = new Date(weekEnd);
                week++;

                for (let status in learningPaths) {
                    elementIds[status] = {};
                    for (let learnerId in learningPaths[status]) {
                        for (let i = 0; i < learningPaths[status][learnerId].length - 1; i++) {
                            let currentElement = learningPaths[status][learnerId][i];
                            let followingElement = learningPaths[status][learnerId][i + 1];
                            // if (currentElement === followingElement) {
                            //     continue
                            // }
                            if (elementIds[status].hasOwnProperty(currentElement)) {
                                elementIds[status][currentElement].push(followingElement);
                            } else {
                                elementIds[status][currentElement] = [followingElement]
                            }
                        }
                    }
                }
                let frequencies = {};
                for (let status in elementIds) {
                    frequencies[status] = {};
                    let learners = passingLearners;
                    if (status === 'notpassing'){learners = failingLearners}
                    for (let element in elementIds[status]) {
                        let frequency = _.countBy(elementIds[status][element]);
                        for (let nextElement in elementIds[status]) {
                            if (frequency.hasOwnProperty(nextElement)) {
                                frequency[nextElement] = frequency[nextElement] / elementIds[status][element].length
                            }
                        }
                        frequencies[status][element] = frequency
                    }
                }
                weeklyData[week] = frequencies;
            } while (weekStart < new Date(course_metadata_map.end_date.toDateString()));

            let nodeMap = {
                'forum': 'FORUM START',
                'forum-end': 'FORUM END',
                'forum-post': 'FORUM SUBMIT',
                'quiz-start': 'QUIZ START',
                'quiz-end': 'QUIZ END',
                'submission': 'QUIZ SUBMIT',
                'video': 'VIDEO'
            };

            let weeklyLinks = {};
            for (let week in weeklyData) {
                let links = JSON.parse(JSON.stringify(linksDesigned));
                let frequencies = weeklyData[week];
                for (let status in frequencies) {
                    for (let currentElement in frequencies[status]) {
                        for (let followingElement in frequencies[status][currentElement]) {
                            let sourceType = currentElement.slice(0, currentElement.indexOf('_'));
                            let targetType = followingElement.slice(0, followingElement.indexOf('_'));
                            let sourceNode = nodeMap[sourceType];
                            let targetNode = nodeMap[targetType];
                            let link = {
                                'sourceElement': currentElement,
                                'sourceType': sourceType,
                                'sourceNode': sourceNode,
                                'targetElement': followingElement,
                                'targetType': targetType,
                                'targetNode': targetNode,
                                'value': frequencies[status][currentElement][followingElement],
                                'status': status,
                                'id': ' ' + l
                            };
                            links.push(link);
                            l++;
                        }
                    }
                }
                weeklyLinks[week] = links;
            }
            let cycleData = {};
            cycleData['links'] = weeklyLinks;
            let cycleElements = [{'name': 'cycleElements', 'object': cycleData}];
            // connection.runSql("DELETE FROM webdata WHERE name = 'cycleElements'").then(function (success) {
                sqlInsert('webdata', cycleElements, connection);
                drawCycles();
                loader(false);
            // });
        }
    })
}

function drawCycles(){
    connection.runSql("SELECT * FROM webdata WHERE name = 'cycleElements' ").then(function(result) {
        if (result.length !== 1) {
            console.log('Start transition calculation');
            moduleTransitions();
        } else {
            let linkData = result[0]['object'];

            let cycleTileDiv = document.getElementById("cycleTile");
            cycleTileDiv.addEventListener("resize", drawCycles);

            $("#cycleChart").empty();
            let cycleDiv = document.getElementById("cycleChart");

            let margin = {top: 20, right: 20, bottom: 20, left: 20},
                width = cycleDiv.clientWidth - margin.left - margin.right,
                height = cycleDiv.clientWidth / 2 - margin.top - margin.bottom;

            let xUnit = width/6;
            let yUnit = height/7;
            let r = 10;
            linkData['nodes'] = [{ "name": "PROGRESS", 'cx': xUnit, 'cy':yUnit*2, 'r':r },
                { "name": "FORUM START", 'cx': xUnit*3, 'cy':yUnit, 'r':r }, { "name": "FORUM SUBMIT", 'cx': xUnit*5, 'cy':yUnit*2, 'r':r }, { "name": "FORUM END", 'cx': xUnit*5, 'cy':yUnit*5, 'r':r },
                { "name": "QUIZ START", 'cx': xUnit*3, 'cy':yUnit*6, 'r':r }, { "name": "QUIZ SUBMIT", 'cx': xUnit*2, 'cy':yUnit*5, 'r':r }, { "name": "QUIZ END", 'cx': xUnit, 'cy':yUnit*5, 'r':r },
                { "name": "VIDEO", 'cx': xUnit*2, 'cy':yUnit, 'r':r }];

            let linkWeek = d3.select('#cycleWeek');
            linkWeek.on('change', function() {
                drawCycles();
            });
            let week = linkWeek.node().value;
            let weekLinks = linkData['links'][week];

            weekLinks.sort(function(a, b) {
                return b.value - a.value;
            });

            let linkSlider = d3.select('#linksCycle');
            linkSlider.on('change', function() {
                drawCycles();
            });
            let linkNumber = linkSlider.node().value;

            weekLinks = weekLinks.slice(0,linkNumber);

            let typeDropdown = d3.select('#cycleType');
            typeDropdown.on('change', function () {
                drawCycles()
            });
            // https://www.d3-graph-gallery.com/graph/network_basic.html
            let svg = d3.select(cycleDiv)
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr(':xmlns:xlink','http://www.w3.org/1999/xlink')
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform",
                    "translate(" + margin.left + "," + margin.top + ")");
            svg.append("text")
                .attr("x", (width / 2))
                .attr("y", 20 - (margin.top / 2))
                .attr("text-anchor", "middle")
                .style("font-size", "16px")
                .style("font-family", "Helvetica")
                .text("Learning Path");

            let defs = svg.append("svg:defs");

            let marker = function(color) {
                defs.append("svg:marker")
                    .attr("id", color.replace("#", ""))
                    .attr("refX", 6)
                    .attr("refY", 6)
                    .attr("markerWidth", 15)
                    .attr("markerHeight", 10)
                    .attr("markerUnits","userSpaceOnUse")
                    .attr("orient", "auto")
                    .append("path")
                    .attr("d", "M 0 0 12 6 0 12 3 6")
                    .style("fill", color.replace("#", ""));
                return "url(" + color + ")";
            };

            let idToNode = {};
            linkData.nodes.forEach(function (n) {
                idToNode[n.name] = n;
            });

            let cycleType = typeDropdown.node().value;

            let link = svg.append("g")
                .selectAll("links")
                .data(weekLinks)
                .enter()
                .append("path")
                .attr('id', function(d){return d.id});

            let edgelabels = svg.append("g")
                .selectAll(".edgelabel")
                .data(weekLinks)
                .enter()
                .append('text')
                .attr('class', 'edgelabel')
                .attr('id', function(d){ return d.id})
                .attr('dx', 60)
                .attr('dy', 0)
                .attr('font-size',13)
                .attr("fill", "blue")
                .attr("stroke", "white")
                .attr("stroke-width", ".5px").attr("vector-effect", "non-scaling-stroke") ;

            edgelabels.append('textPath')
                .attr('xlink:href',function(d) {return '#' + d.id})
                .style("pointer-events", "none")
                .text(function(d){
                    if (d.status === cycleType) {
                        return (d.value).toFixed(2)
                    }
                });

            let g = svg.selectAll(null)
                .data(linkData.nodes)
                .enter()
                .append("g")
                .attr("transform", function(d) {
                    return "translate(" + d.cx +','+ d.cy + ")" ;
                });

            g.append("circle")
                .attr("r", function(d) { return d.r; })
                .style("fill", "#69b3a2")
                .style("fill-opacity", 0.9)
                .attr("stroke", "#69a2b2")
                .style("stroke-width", 4);

            g.append("text")
                .text(function(d) { return d.name; })
                .attr("x", 10)
                .attr("y", -10)
                .style("font-size", "10px")
                .style("font-family", "Helvetica");


            // function ticked() {
            let i = 0;
            link.attr("d", function(d) { // https://stackoverflow.com/a/17687907/8331561
                i++;
                let startX = idToNode[d.sourceNode].cx;
                let startY = idToNode[d.sourceNode].cy;
                let endX = idToNode[d.targetNode].cx;
                let endY = idToNode[d.targetNode].cy;
                let dx = endX - startX,
                    dy = endY - startY,
                    drx = Math.sqrt(dx * dx + dy * dy),
                    dry = Math.sqrt(dx * dx + dy * dy),
                    xRotation = 0,
                    largeArc = 0,
                    sweep = 1;
                if ( startX === endX && startY === endY ) {
                    xRotation = -55;// Fiddle with this angle to get loop oriented.
                    largeArc = 1; // Needs to be 1.
                    // sweep = 0; // Change sweep to change orientation of loop.
                    drx = 10; // Make drx and dry different to get an ellipse instead of a circle.
                    dry = 15;
                    endX = endX + 0.1; // The arc collapses to a point if the beginning and ending points of the arc are the same, so kludge it.
                    endY = endY + 0.1;
                }
                if (d.status === 'notpassing'){drx =drx*0.6}
                return "M" + startX + "," + startY + "A" + drx + "," + dry + " " +
                    xRotation + " " +  largeArc + "," + sweep + " " + endX + "," + endY;
            }).style("fill", "none")
                .attr("stroke", function (d) {
                    if ((d.status === 'designed' && cycleType === 'designed')) {
                        return  "purple"
                    } else if ((d.status === 'notpassing' && cycleType === 'notpassing') ||
                        (d.status === 'notpassing' && cycleType === 'general')) {
                        return  "red"
                    } else if ((d.status === 'downloadable' && cycleType === 'downloadable') ||
                        (d.status === 'downloadable' && cycleType === 'general')) {
                        return "green"
                    } else if (d.status === 'general' && cycleType === 'general') {
                        return "blue"
                    }
                })
                .style("stroke-width", function (d) {
                    return d.value * 5
                })
                .attr("marker-end", function (d) {
                    if ((d.status === 'designed' && cycleType === 'designed')) {
                        return  marker('#purple')
                    } else if ((d.status === 'notpassing' && cycleType === 'notpassing') ||
                        (d.status === 'notpassing' && cycleType === 'general')) {
                        return  marker('#red')
                    } else if ((d.status === 'downloadable' && cycleType === 'downloadable') ||
                        (d.status === 'downloadable' && cycleType === 'general')) {
                        return  marker('#green')
                    } else if (d.status === 'general' && cycleType === 'general' ) {
                        return marker("#blue")
                    }
                });

            i = 0;
            link.attr("d", function(d) {
                i++;
                let startX = idToNode[d.sourceNode].cx,
                    startY = idToNode[d.sourceNode].cy,
                    endX = idToNode[d.targetNode].cx,
                    endY = idToNode[d.targetNode].cy;

                let pl = this.getTotalLength(),
                    r = (idToNode[d.targetNode].r) + 8.5, // 8.5 is the "size" of the marker Math.sqrt(6**2 + 6**2)
                    m = this.getPointAtLength(pl - r);

                let dx = m.x - idToNode[d.sourceNode].cx,
                    dy = m.y - idToNode[d.sourceNode].cy,
                    drx = Math.sqrt(dx * dx + dy * dy),// * 0.8 + i,
                    dry = Math.sqrt(dx * dx + dy * dy),// + i,
                    xRotation = 0,
                    largeArc = 0,
                    sweep = 1;

                if ( startX === endX && startY === endY ) {
                    xRotation = -45;
                    largeArc = 1;
                    sweep = 0;
                    drx = 20;
                    dry = 30;
                    endX = m.x + 0.1;
                    endY = m.y + 0.1;
                } else {
                    endX = m.x;
                    endY = m.y;
                }
                return "M" + startX + "," + startY + "A" + drx + "," + dry + " " +
                    xRotation + " " +  largeArc + "," + sweep + " " + endX + "," + endY;
            });

            edgelabels.attr('transform',function(d){
                if (idToNode[d.targetNode].cx < idToNode[d.sourceNode].cx) {
                    let bbox = this.getBBox(),
                        rx = bbox.x + bbox.width / 2,
                        ry = bbox.y + bbox.height / 2;
                    return 'rotate(180 ' + rx + ' ' + ry + ')';
                } else {
                    return 'rotate(0)';
                }})
        }
    })
}


import {groupWeeklyMapped, trimByDates, zeroIfEmptyArray, calculateArc,
    getGraphElementMap, groupWeekly } from "./graphHelpers.js";
import {sqlInsert} from "./databaseHelpers.js";
import {loader} from "./helpers.js";

export async function drawCharts(connection, start, end) {

    let graphElementMap = await getGraphElementMap(connection);

    let startDate = new Date(start);
    let endDate = new Date(end);
    let weekly = true;

    let radioValue = $("input[name='processedOrInRange']:checked").val();
    if (radioValue){
        if (radioValue === 'allDates'){
            startDate = new Date(graphElementMap['dateListChart'][0]);
            endDate = new Date(graphElementMap['dateListChart'][graphElementMap['dateListChart'].length - 1]);
        } else if (radioValue === 'courseDates') {
            endDate = new Date(graphElementMap['end_date']);
            startDate = new Date(graphElementMap['start_date']);
        }
    }

    let radioValueWeekly = $("input[name='dailyOrWeekly']:checked").val();
    if (radioValueWeekly){
        if (radioValueWeekly === 'weekly'){
            weekly = true
        } else if (radioValueWeekly === 'daily') {
            weekly = false
        }
    }

    drawApexCharts(graphElementMap, startDate, endDate, weekly);

    drawChartJS(graphElementMap, startDate, endDate, weekly);

    drawCycles(connection);

    drawVideoTransitionArcChart(connection);

    drawAreaDropoutChart(graphElementMap, connection, startDate, endDate, weekly);
}

export async function updateCharts(connection, start, end) {
    let graphElementMap = await getGraphElementMap(connection);

    let startDate = new Date(start);
    let endDate = new Date(end);
    let weekly = true;

    let radioValue = $("input[name='processedOrInRange']:checked").val();
    if (radioValue){
        if (radioValue === 'allDates'){
            startDate = new Date(graphElementMap['dateListChart'][0]);
            endDate = new Date(graphElementMap['dateListChart'][graphElementMap['dateListChart'].length - 1]);
        } else if (radioValue === 'courseDates') {
            endDate = new Date(graphElementMap['end_date']);
            startDate = new Date(graphElementMap['start_date']);
        }
    }

    let radioValueWeekly = $("input[name='dailyOrWeekly']:checked").val();
    if (radioValueWeekly){
        if (radioValueWeekly === 'weekly'){
            weekly = true
        } else if (radioValueWeekly === 'daily') {
            weekly = false
        }
    }
    drawBoxChart(graphElementMap, startDate, endDate, weekly);
    drawLineChart(graphElementMap, startDate, endDate, weekly);
    drawAreaChart(graphElementMap, startDate, endDate, weekly);
    drawMixedChart(graphElementMap, startDate, endDate, weekly);

    drawAreaDropoutChart(graphElementMap, connection, startDate, endDate, weekly);
}


function drawChartJS(graphElementMap, startDate, endDate, weekly) {
    drawLineChart(graphElementMap, startDate, endDate, weekly);
    drawAreaChart(graphElementMap, startDate, endDate, weekly);
    drawBoxChart(graphElementMap, startDate, endDate, weekly);
    drawMixedChart(graphElementMap, startDate, endDate, weekly);
}


function drawApexCharts(graphElementMap, startDate, endDate, weekly){
    drawMixedChart(graphElementMap, startDate, endDate, weekly);
    drawHeatChart(graphElementMap)
}


function drawLineChart(graphElementMap, startDate, endDate, weekly){
    let canvas = document.getElementById('lineChart'),
        lineCtx = canvas.getContext('2d');
    lineCtx.clearRect(0, 0, canvas.width, canvas.height);

    let weeklySessions = groupWeeklyMapped(graphElementMap, 'orderedSessions'),
        weeklyStudents = groupWeeklyMapped(graphElementMap, 'orderedStudents');

    let studentData = [],
        sessionData = [],
        dateLabels = [];

    if (weekly === true) {
        for (let date in weeklySessions['weeklySum']){
            dateLabels.push(new Date(date))
        }
        studentData = Object.values(weeklyStudents['weeklySum']);
        sessionData = Object.values(weeklySessions['weeklySum']);
    } else {
        for (let date of graphElementMap["dateListChart"]){
            dateLabels.push(date)
        }
        studentData = Object.values(graphElementMap['orderedStudents']);
        sessionData = Object.values(graphElementMap['orderedSessions']);
    }

    let lineData = {
        labels: dateLabels,
        datasets: [{
            fill: false,
            label: 'Total Students',
            yAxisID: 'A',
            data: studentData,
            borderColor: '#FAB930',
            backgroundColor: '#FAB930',
            lineTension: 0.2,
        }, {
            fill: false,
            label: 'Total Sessions',
            yAxisID: 'B',
            data: sessionData,
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
                    }
                }],
                yAxes: [{
                    id: 'A',
                    ticks: {
                        beginAtZero: true,
                        callback: function(value) {
                            return value.toLocaleString();
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
                        callback: function(value) {
                            return value.toLocaleString();
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
}


function drawAreaChart(graphElementMap, startDate, endDate, weekly){
    let canvas = document.getElementById('areaChart'),
        areaCtx = canvas.getContext('2d');
    areaCtx.clearRect(0, 0, canvas.width, canvas.height);

    let weeklyDurations = groupWeeklyMapped(graphElementMap, 'orderedAvgDurations'),
        weeklyVideoSessions = groupWeeklyMapped(graphElementMap, 'orderedVideoSessions'),
        weeklyQuizSessions = groupWeeklyMapped(graphElementMap, 'orderedQuizSessions'),
        weeklyForumSessions = groupWeeklyMapped(graphElementMap, 'orderedForumSessions');

    let sessionData = [],
        videoData = [],
        quizData = [],
        forumData = [],
        dateLabels = [];

    if (weekly === true) {
        for (let date in weeklyDurations['weeklySum']){
            dateLabels.push(new Date(date))
        }
        sessionData = Object.values(weeklyDurations['weeklyAvg']);
        videoData = Object.values(weeklyVideoSessions['weeklySum']);
        quizData = Object.values(weeklyQuizSessions['weeklySum']);
        forumData = Object.values(weeklyForumSessions['weeklySum']);
    } else {
        for (let date of graphElementMap["dateListChart"]){
            dateLabels.push(date)
        }
        sessionData =  Object.values(graphElementMap['orderedAvgDurations']);
        videoData = Object.values(graphElementMap['orderedVideoSessions']);
        quizData = Object.values(graphElementMap['orderedQuizSessions']);
        forumData = Object.values(graphElementMap['orderedForumSessions']);
    }

    let areaData = {
        labels: dateLabels,
        datasets: [{
            fill: false,
            label: 'Avg. Session Duration',
            yAxisID: 'A',
            data: sessionData,
            borderColor: '#6EC5FB',
            backgroundColor: '#6EC5FB',
            lineTension: 0,
        }, {
            fill: true,
            label: 'Video Sessions',
            yAxisID: 'B',
            data: videoData,
            borderColor: '#753599',
            backgroundColor: '#753599',
            lineTension: 0,
        }, {
            fill: true,
            label: 'Quiz Sessions',
            yAxisID: 'B',
            data: quizData,
            borderColor: '#13c70e',
            backgroundColor: '#13c70e',
            lineTension: 0,
        }, {
            fill: true,
            label: 'Forum Sessions',
            yAxisID: 'B',
            data: forumData,
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
                        callback: function(value) {
                            return value.toLocaleString();
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
                        callback: function(value) {
                            return value.toLocaleString();
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
}


function calculateDropoutValues(courseMetadataMap, lastSessions, lastElements, connection){
    let dropoutFreq = _.countBy(lastElements);

    let elements = Object.keys(dropoutFreq);
    elements.sort(function (a, b) { return dropoutFreq[b] - dropoutFreq[a] });

    let topElements = {};
    for (let element of elements.slice(0,11)){
        if (element.includes('forum')){
            topElements['elementName'] = 'forum_visit'
        } else {
            for (let fullElement in courseMetadataMap.child_parent_map) {
                if (fullElement.includes(element)) {
                    let parentId = courseMetadataMap.child_parent_map[fullElement],
                        elementName = courseMetadataMap.element_name_map[fullElement],
                        parentName = courseMetadataMap.element_name_map[parentId];
                    topElements[element] = {'elementName': elementName, 'parentName': parentName};
                    if (courseMetadataMap.child_parent_map.hasOwnProperty(parentId)) {
                        let parent2Id = courseMetadataMap.child_parent_map[parentId],
                            parent2Name = courseMetadataMap.element_name_map[parent2Id];
                        topElements[element]['parent2Name'] = parent2Name;
                    }
                }
            }
        }
    }

    lastSessions.sort(function (a, b) {
        return new Date(a.time) - new Date(b.time)
    });

    const orderedDropouts = {},
        orderedDropoutsByType = {},
        dateLabelsSet = new Set();

    for (let session of lastSessions){
        let sessionTime = session['time'].toDateString();
        dateLabelsSet.add(sessionTime);
        if (orderedDropouts.hasOwnProperty(sessionTime)){
            orderedDropouts[sessionTime].push(session.elementId);
            orderedDropoutsByType[sessionTime].push(session.type);
        } else {
            orderedDropouts[sessionTime] = [session.elementId];
            orderedDropoutsByType[sessionTime] = [session.type];
        }
    }

    let topN = 5;
    let slicedTopElements = {};
    for (let element of Object.keys(topElements).slice(0, topN)){
        slicedTopElements[element] = topElements[element]
    }
    slicedTopElements['Others'] = {'elementName': 'Other course elements'};

    let orderedDropoutsByElement = {};
    for (let topElement in slicedTopElements){
        let stringId = topElement.toString();
        let dropoutsByCurrentElement = {};
        for (let session of lastSessions){
            let sessionTime = session['time'].toDateString();
            if (session.elementId === topElement) {
                if (dropoutsByCurrentElement.hasOwnProperty(sessionTime)) {
                    dropoutsByCurrentElement[sessionTime].push(session.elementId);
                } else {
                    dropoutsByCurrentElement[sessionTime] = [session.elementId];
                }
            }
            if (topElement === 'Others'){
                if (!Object.keys(slicedTopElements).includes(session.elementId)){
                    if (dropoutsByCurrentElement.hasOwnProperty(sessionTime)) {
                        dropoutsByCurrentElement[sessionTime].push(session.elementId);
                    } else {
                        dropoutsByCurrentElement[sessionTime] = [session.elementId];
                    }
                }
            }
        }
        orderedDropoutsByElement[stringId] = dropoutsByCurrentElement;
    }

    let orderedDropoutsByElementValue = {},
        orderedDropoutsByElementWeeklyValue = {};
    let dateList = Array.from(dateLabelsSet);
    for (let topElement in slicedTopElements){
        orderedDropoutsByElementValue[topElement] = {};
        for (let dateString of dateList){
            let date = new Date(dateString);
            if (dateString in orderedDropoutsByElement[topElement]) {
                orderedDropoutsByElementValue[topElement][date] = orderedDropoutsByElement[topElement][dateString].length;
            } else {
                orderedDropoutsByElementValue[topElement][date] = 0;
            }
        }
        orderedDropoutsByElementWeeklyValue[topElement] = groupWeekly(orderedDropoutsByElementValue[topElement])
    }


    let dropoutElements = [{'name': 'dropoutElements', 'object': {
            'orderedDropoutsByElementValue': orderedDropoutsByElementValue,
            'orderedDropoutsByElementWeeklyValue': orderedDropoutsByElementWeeklyValue,
            'slicedTopElements': slicedTopElements}}];

    connection.runSql("DELETE FROM webdata WHERE name = 'dropoutElements'").then(function (success) {
        sqlInsert('webdata', dropoutElements, connection);
    });

}


function drawAreaDropoutChart(graphElementMap, connection, startDate, endDate, weekly){
    let areaDropoutCanvas = document.getElementById('areaDropoutChart'),
        areaDropoutCtx = areaDropoutCanvas.getContext('2d');
    areaDropoutCtx.clearRect(0, 0, areaDropoutCanvas.width, areaDropoutCanvas.height);

    connection.runSql("SELECT * FROM webdata WHERE name = 'dropoutElements' ").then(function (result) {
        if (result.length !== 1) {
            calculateModuleCycles(connection);
        } else {
            let dropoutValues = result[0]['object'],
                orderedDropoutsByElementValue = dropoutValues.orderedDropoutsByElementValue,
                orderedDropoutsByElementWeeklyValue = dropoutValues.orderedDropoutsByElementWeeklyValue,
                slicedTopElements = dropoutValues.slicedTopElements;

            let datasets = [];
            let dateLabels = [];
            for (let element in orderedDropoutsByElementValue) {
                let label = '';
                if (slicedTopElements[element]['parent2Name']) {
                    label = label + slicedTopElements[element]['parent2Name'] + ' - '
                } if (slicedTopElements[element]['parentName']){
                    label = label + slicedTopElements[element]['parentName'] + ' - '
                }
                label = label + slicedTopElements[element]['elementName'];
                let data = [];
                if (weekly === true) {
                    data = Object.values(orderedDropoutsByElementWeeklyValue[element]);
                    dateLabels = Object.keys(orderedDropoutsByElementWeeklyValue[element]);
                } else {
                    data = Object.values(orderedDropoutsByElementValue[element]);
                    dateLabels = Object.keys(orderedDropoutsByElementValue[element]);
                }
                let color = "#000000".replace(/0/g,function(){return (~~(Math.random()*16)).toString(16);});
                datasets.push({
                    fill: true,
                    label: label,
                    yAxisID: 'A',
                    data: data,
                    borderColor: color,
                    backgroundColor: color,
                    lineTension: 0
                });
            }

            let graphLabels = [];
            for (let date of dateLabels) {
                graphLabels.push(new Date(date))
            }

            let areaData = {
                labels: graphLabels,
                datasets: datasets
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
                        text: 'Dropout by Main Component (last student interaction)',
                        position: 'top',
                        fontSize:  16,
                        color:  '#263238',
                        fontFamily: 'Helvetica'
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
                            stacked: true,
                            ticks: {
                                beginAtZero: true,
                                callback: function(value) {
                                    return value.toLocaleString();
                                },
                                fontColor: '#6EC5FB',
                            },
                            position: 'left',
                            display: true,
                            scaleLabel: {
                                display: true,
                                labelString: "Dropouts",
                                fontColor: '#6EC5FB',
                                fontStyle: 'bold'
                            }
                        // }, {
                        //     id: 'B',
                        //     stacked: true,
                        //     ticks: {
                        //         beginAtZero: true,
                        //         callback: function(value) {
                        //             return value.toLocaleString();
                        //         },
                        //     },
                        //     position: 'right',
                        //     display: true,
                        //     scaleLabel: {
                        //         display: true,
                        //         labelString: "Total Sessions",
                        //         fontStyle: 'bold'
                        //     }
                        }]
                    }
                }
            };
            if (areaDropoutChart !== null) {
                areaDropoutChart.destroy();
            }
            areaDropoutChart = new Chart(areaDropoutCtx, areaOptions);
        }
    })
}


function drawBoxChart(graphElementMap, startDate, endDate, weekly){
    // BOXPLOT https://codepen.io/sgratzl/pen/QxoLoY
    let boxCtx = document.getElementById("boxChart").getContext("2d");

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
        // postContentData = Object.values(weeklyPostContents['weeklySum']);
        regPostContentData = Object.values(weeklyRegPostContents['weeklySum']);
        occPostContentData = Object.values(weeklyOccPostContents['weeklySum']);
    } else {
        for (let date of graphElementMap["dateListChart"]){
            dateLabels.push(date)
        }
        // postContentData = Object.values(graphElementMap['orderedForumPostContent']);
        regPostContentData = Object.values(graphElementMap['orderedForumPostContentRegulars']);
        occPostContentData = Object.values(graphElementMap['orderedForumPostContentOccasionals']);
    }

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
                    callback: function(value) {
                        return value.toLocaleString();
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


function drawMixedChart(graphElementMap, startDate, endDate, weekly){
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
            if (new Date(date) >= new Date(startDate) && new Date(date) <= new Date(endDate)) {
                dateLabels.push(new Date(date).toUTCString())
            }
        }
        // forumData = trimByDates(weeklyPosts['weeklySum'],startDate, endDate);
        forumRegData = trimByDates(weeklyRegPosts['weeklySum'], startDate, endDate);
        forumRegPosters = trimByDates(weeklyRegPosters['weeklySum'], startDate, endDate);
        forumOccData = trimByDates(weeklyOccPosts['weeklySum'], startDate, endDate);
        forumOccPosters = trimByDates(weeklyOccPosters['weeklySum'], startDate, endDate);
        // forumDurations = trimByDates(weeklyForumSessions['weeklyAvg'], startDate, endDate);
        // forumStudents = trimByDates(weeklyForumStudents['weeklySum'], startDate, endDate);
        forumStudentsRegulars = trimByDates(weeklyForumRegulars['weeklySum'], startDate, endDate);
        forumStudentsOccasionals = trimByDates(weeklyForumOccasionals['weeklySum'], startDate, endDate);
    } else {
        for (let date of graphElementMap["dateListChart"]){
            if (new Date(date) >= new Date(startDate) && new Date(date) <= new Date(endDate)) {
                // dateLabels.push(date.toLocaleString())
                dateLabels.push(new Date(date).toUTCString())
            }
        }
        // forumData = trimByDates(graphElementMap["orderedForumPosts"], startDate, endDate);
        forumRegData = trimByDates(graphElementMap["orderedForumPostsByRegulars"], startDate, endDate);
        forumRegPosters = trimByDates(graphElementMap["orderedForumPostersRegulars"], startDate, endDate);
        forumOccData = trimByDates(graphElementMap["orderedForumPostsByOccasionals"], startDate, endDate);
        forumOccPosters = trimByDates(graphElementMap["orderedForumPostersOccasionals"], startDate, endDate);
        // forumDurations = trimByDates(graphElementMap['orderedForumAvgDurations'], startDate, endDate);
        // forumStudents = trimByDates(graphElementMap['orderedForumStudents'], startDate, endDate);
        forumStudentsRegulars = trimByDates(graphElementMap['orderedForumRegulars'], startDate, endDate);
        forumStudentsOccasionals = trimByDates(graphElementMap['orderedForumOccasionals'], startDate, endDate);
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
            min: new Date(startDate).getTime(),
            max: new Date(endDate).getTime(),
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
}


function drawHeatChart(graphElementMap){
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


function calculateVideoTransitions(connection) {
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
                if (elementId.includes('video')) {
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
                        connection.runSql("DELETE FROM webdata WHERE name = 'arcElements'").then(function () {
                            sqlInsert('webdata', arcElements, connection);
                            drawVideoTransitionArcChart(connection);
                        });
                    }
                });
            }
        }
    });
}


function drawVideoTransitionArcChart(connection){ // https://www.d3-graph-gallery.com/graph/arc_template.html
    connection.runSql("SELECT * FROM webdata WHERE name = 'arcElements' ").then(function(result) {
        if (result.length !== 1) {
            calculateVideoTransitions(connection)
        } else {
            let nodeData = result[0]['object'];
            nodeData.links.sort(function(a, b) {
                return b.value - a.value;
            });

            // if (linkNumber == null){
            //     linkNumber = nodeData.nodes.length
            // }

            let linkSlider = d3.select('#links');
            linkSlider.on('change', function() {
                drawVideoTransitionArcChart(connection);
            });
            let linkNumber = linkSlider.node().value;

            let typeDropdown = d3.select('#arcType');
            typeDropdown.on('change', function () {
                drawVideoTransitionArcChart(connection)
            });

            // let arcTileDiv = document.getElementById("arcTile");
            // arcTileDiv.addEventListener("resize", drawVideoTransitionArcChart);

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


function calculateModuleCycles(connection) {
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
            loader(true);
            const course_metadata_map = result[0]['object'];
            let courseId = course_metadata_map.course_id;
            courseId = courseId.slice(courseId.indexOf(':') + 1,);
            let startingWeek = course_metadata_map.start_date.getWeek();
            await connection.runSql("SELECT * FROM course_learner").then(function (learners) {
                learners.forEach(function (learner) {
                    learnerIds.push(learner.course_learner_id);
                    if (learner.certificate_status !== null) {
                        learnerStatus[learner.course_learner_id] = learner.certificate_status;
                    } else {
                        learnerStatus[learner.course_learner_id] = 'unfinished'
                    }

                });
            });
            for (let elementId in course_metadata_map.child_parent_map) {
                if (elementId.includes('video+') ||
                    elementId.includes('problem+') ||
                    elementId.includes('discussion+')) {
                    const parentId = course_metadata_map.child_parent_map[elementId],
                        parent2Id = course_metadata_map.child_parent_map[parentId],
                        parent3Id = course_metadata_map.child_parent_map[parent2Id];
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

            let learningPaths = {},
                designedPath = [],
                currentElement = '';

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
                    let currentElement = learningPaths[learner][i],
                        followingElement = learningPaths[learner][i + 1];
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
                    const sourceType = course_metadata_map.element_type_map[currentElement],
                        targetType = course_metadata_map.element_type_map[followingElement],
                        sourceNode = nodeMap[sourceType],
                        targetNode = nodeMap[targetType];

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
            const allSessions = {},
                lastElements = [],
                lastSessions = [];
            for (let learnerId of learnerIds) {
                totalLearners++;
                allSessions[learnerId] = [];
                let status = learnerStatus[learnerId];
                if (status === 'downloadable'){passingLearners++} else {failingLearners++}
                await connection.runSql("SELECT * FROM forum_sessions WHERE course_learner_id = '" + learnerId + "' ").then(function (sessions) {
                    sessions.forEach(function(session) {
                        let forumStartSession = $.extend({}, session);
                        forumStartSession['type'] = 'forum';
                        forumStartSession['time'] = forumStartSession.start_time;
                        let elementId = forumStartSession.relevent_element_id;
                        if (elementId.length < 10) {
                            forumStartSession['elementId'] = 'forum_visit'
                        } else {
                            forumStartSession['elementId'] = elementId.slice(elementId.lastIndexOf('@') + 1,);
                        }
                        forumStartSession['status'] = status;
                        allSessions[learnerId].push(forumStartSession);

                        let forumEndSession = $.extend({}, session);
                        forumEndSession['type'] = 'forum-end';
                        forumEndSession['time'] = forumEndSession.end_time;
                        if (elementId.length < 10) {
                            forumEndSession['elementId'] = 'forum_visit'
                        } else {
                            forumEndSession['elementId'] = elementId.slice(elementId.lastIndexOf('@') + 1,);
                        }
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

                // FOR DROPOUT VALUES
                if (allSessions[learnerId].length > 2) {
                    lastElements.push(allSessions[learnerId][allSessions[learnerId].length - 1]['elementId']);
                    lastSessions.push(allSessions[learnerId][allSessions[learnerId].length - 1])
                }
            }

            calculateDropoutValues(course_metadata_map, lastSessions, lastElements, connection);


            let weekStart = new Date(course_metadata_map.start_date.toDateString()),
                weekEnd = new Date(),
                week = 0,
                weeklyData = {};
            do {
                learningPaths = {
                    'downloadable': {},
                    'notpassing': {},
                    'audit_passing': {},
                    'unverified': {},
                    'unfinished': {}
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
                    if (status ===! 'downloadable'){learners = failingLearners}
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
            connection.runSql("DELETE FROM webdata WHERE name = 'cycleElements'").then(function (success) {
                sqlInsert('webdata', cycleElements, connection);
                drawCycles(connection);
            });
        }
    })
}


function drawCycles(connection){
    connection.runSql("SELECT * FROM webdata WHERE name = 'cycleElements' ").then(function(result) {
        if (result.length !== 1) {
            console.log('Start transition calculation');
            calculateModuleCycles(connection);
        } else {
            let linkData = result[0]['object'];

            // let cycleTileDiv = document.getElementById("cycleTile");
            // cycleTileDiv.addEventListener("resize", drawCycles(connection));

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
                drawCycles(connection);
            });
            let week = linkWeek.node().value;
            let weekLinks = linkData['links'][week];

            weekLinks.sort(function(a, b) {
                return b.value - a.value;
            });

            let linkSlider = d3.select('#linksCycle');
            linkSlider.on('change', function() {
                drawCycles(connection);
            });
            let linkNumber = linkSlider.node().value;

            weekLinks = weekLinks.slice(0,linkNumber);

            let typeDropdown = d3.select('#cycleType');
            typeDropdown.on('change', function () {
                drawCycles(connection)
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
                if (d.status ===! 'downloadable'){drx = drx*0.6}
                return "M" + startX + "," + startY + "A" + drx + "," + dry + " " +
                    xRotation + " " +  largeArc + "," + sweep + " " + endX + "," + endY;
            }).style("fill", "none")
                .attr("stroke", function (d) {
                    if ((d.status === 'designed' && cycleType === 'designed')) {
                        return  "purple"
                    } else if ((d.status !== 'downloadable' && cycleType === 'notpassing') ||
                        (d.status !== 'downloadable' && cycleType === 'general')) {
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
                    } else if ((d.status !== 'downloadable' && cycleType === 'notpassing') ||
                        (d.status !== 'downloadable' && cycleType === 'general')) {
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
        loader(false);
    })
}
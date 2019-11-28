import {sqlInsert} from "./databaseHelpers.js";
import {loader, learnerSegmentation} from "./helpers.js";

/**
 * Main processing function for all graph related data
 * @param {JsStoreWorker} connection Main JsStore worker that handles the connection to SqlWeb
 * @returns {Promise<Object>} When resolved, it returns the graph data object
 */
export async function getGraphElementMap(connection, segment) {
    let graphElementMap = {};
    let promise = new Promise((resolve, reject) => {
        if (! segment) {segment = 'none'};
        connection.runSql("SELECT * FROM webdata WHERE name = 'graphElements_" + segment + "' ").then(function (result) {
            if (result.length === 1) {
                graphElementMap = result[0]['object'];
                resolve(graphElementMap);
            } else {
                loader(true);
                connection.runSql("SELECT * FROM metadata WHERE name = 'metadata_map' ").then(function (result) {
                    if (result.length !== 1) {
                        reject('Metadata empty')
                    } else {
                        let course_metadata_map = result[0]['object'];

                        let start_date = '';
                        let end_date = '';
                        let course_name = '';

                        connection.runSql("SELECT * FROM courses").then(function (courses) {
                            courses.forEach(async function (course) {
                                loader(true);
                                course_name = course['course_name'];
                                start_date = course['start_time'].toDateString();
                                end_date = course['end_time'].toDateString();

                                let query = "SELECT * FROM webdata WHERE name = 'segmentation' ";
                                let segmentation = '';
                                await connection.runSql(query).then(function (result) {
                                    segmentation = result[0]['object']['type'];
                                });
                                let segmentMap = {'none': ['none'],
                                    'ab': ['none', 'A', 'B'],
                                    'abc': ['none', 'A', 'B', 'C']};

                                for (let segment of segmentMap[segmentation]) {

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

                                    let start = new Date(),
                                        start_str = '',
                                        gradeMap = {},
                                        idSet = new Set(),
                                        posterPostMap = {},
                                        query = "SELECT * FROM sessions";

                                    await connection.runSql(query).then(function (sessions) {
                                        toastr.info('Processing indicators');
                                        sessions.forEach(function (session) {
                                            if (segment === 'none' || learnerSegmentation(session['course_learner_id'], segmentation) === segment) {
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
                                            }
                                        });
                                    });
                                    query = "SELECT * FROM course_learner";
                                    if (segment !== 'none') {query += " WHERE segment = '" + segment + "' "}
                                    await connection.runSql(query).then(function (learners) {
                                        learners.forEach(function (learner) {
                                            idSet.add(learner.course_learner_id);
                                            gradeMap[learner.course_learner_id] = learner;
                                        });
                                    });


                                    query = "SELECT * FROM quiz_sessions";
                                    await connection.runSql(query).then(function (q_sessions) {
                                        q_sessions.forEach(function (session) {
                                            if (segment === 'none' || learnerSegmentation(session['course_learner_id'], segmentation) === segment) {
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
                                            }
                                        });
                                    });
                                    toastr.info('Crunching quiz data');
                                    query = "SELECT * FROM video_interactions";
                                    await connection.runSql(query).then(function (v_sessions) {
                                        v_sessions.forEach(function (session) {
                                            if (segment === 'none' || learnerSegmentation(session['course_learner_id'], segmentation) === segment) {
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

                                    query = "SELECT * FROM forum_sessions";
                                    await connection.runSql(query).then(function (f_sessions) {
                                        f_sessions.forEach(function (session) {
                                            if (segment === 'none' || learnerSegmentation(session['course_learner_id'], segmentation) === segment) {
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
                                            }
                                        });
                                    });

                                    query = "SELECT * FROM forum_interaction";
                                    await connection.runSql(query).then(function (f_interactions) {
                                        f_interactions.forEach(function (interaction) {
                                            if (segment === 'none' || learnerSegmentation(interaction['course_learner_id'], segmentation) === segment) {
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
                                            }
                                        });
                                    });
                                    toastr.info('Almost there!');

                                    // FORUM SEGMENTATION /////////////////////////////////////////
                                    let weeklyPosters = groupWeekly(forumPosters);
                                    let weeklyFViewers = groupWeekly(forumSessions);
                                    let forumSegmentation = getForumSegmentation(weeklyPosters, weeklyFViewers, connection);

                                    let regularPosters = forumSegmentation.regularPosters,
                                        regularViewers = forumSegmentation.regularViewers,
                                        occasionalPosters = forumSegmentation.occasionalPosters,
                                        occasionalViewers = forumSegmentation.occasionalViewers;

                                    let forumSegmentationAggregate = {
                                        'regularPosters': new Set(regularPosters).size,
                                        'regularViewers': new Set(regularViewers).size,
                                        'occasionalPosters': new Set(occasionalPosters).size,
                                        'occasionalViewers': new Set(occasionalViewers).size
                                    };

                                    let regPostersRegViewers = intersection(new Set(regularPosters), new Set(regularViewers)),
                                        regPostersOccViewers = intersection(new Set(regularPosters), new Set(occasionalViewers)),
                                        regPostersNonViewers = difference(new Set(regularPosters), new Set([...regularViewers, ...occasionalViewers])),
                                        occPostersRegViewers = intersection(new Set(occasionalPosters), new Set(regularViewers)),
                                        occPostersOccViewers = intersection(new Set(occasionalPosters), new Set(occasionalViewers)),
                                        occPostersNonViewers = difference(new Set(occasionalPosters), new Set([...regularViewers, ...occasionalViewers])),
                                        nonPostersRegViewers = difference(new Set([...regularPosters, ...occasionalPosters]), new Set(regularViewers)),
                                        nonPostersOccViewers = difference(new Set([...regularPosters, ...occasionalPosters]), new Set(occasionalViewers)),
                                        nonPostersNonViewers = difference(idSet, new Set([...regularPosters, ...occasionalPosters, ...regularViewers, ...occasionalViewers]));

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
                                        for (let student of forumMatrixGroups[group]) {
                                            if (gradeMap.hasOwnProperty(student)) {
                                                if (gradeMap[student]["certificate_status"] === "downloadable") {
                                                    gradeLists[group].push(gradeMap[student]["final_grade"]);
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
                                                if (regularViewers.includes(student)) {
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
                                        orderedAvgDurations[date] = parseFloat(total / dailyDurations[date].length).toFixed(2);

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

                                        'forumSegmentation': forumSegmentationAggregate,
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
                                        'name': 'graphElements_' + segment,
                                        'object': graphElementMap
                                    }];
                                    toastr.info('Processing graph data');
                                    sqlInsert('webdata', graphElements, connection);
                                    resolve(graphElementMap);
                                }
                            });
                        });
                    }
                })
            }
        })
    });
    return await promise
}


/**
 * Finds the intersecting elements between two sets
 * @param set1
 * @param set2
 * @returns {Set} Set with intersecting elements
 */
export function intersection(set1, set2){
    return new Set([...set1].filter(x => set2.has(x)));
}


/**
 * Finds the difference elements between two sets
 * @param set1
 * @param set2
 * @returns {Set} set with difference elements
 */
export function difference(set1, set2){
    return new Set([...set1].filter(x => !set2.has(x)));
}

/**
 * Process the div where a chart was drawn. If it was drawn using chart.js, it will transform to PNG and download,
 * if it was drawn with d3.js, it will call the SVG2PNG function to process the svg object
 * @param {string} chartId Corresponding chart identifier
 */
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
            generateImageLink(filename + '.png', base64).click(); // Trigger the Link is made by Link Generator and download.
        });
    }
}

/**
 * Converts SVG object from a canvas into PNG image using canvg
 * @param {Element} svg Page element with svg code
 * @param callback
 */
export function SVG2PNG(svg, callback) {
    let canvas = document.createElement('canvas'); // Create a Canvas element.
    let data = svg.outerHTML; // Get SVG element as HTML code.
    canvg(canvas, data); // Render SVG on Canvas.
    callback(canvas); // Execute callback function.
}

/**
 * Creates generic anchor element with href to object to prepare image for download
 * @param {string} fileName Name for the generated file
 * @param {string} data HTML code from chart SVG
 * @returns {HTMLElement} link Generated link for download
 */
export function generateImageLink(fileName, data) {
    let link = document.createElement('a');
    link.download = fileName;
    link.href = data;
    return link;
}

/**
 * Trims objects with graph data between dates
 * @param {Object} values Ordered graph values to be trimmed
 * @param {Date} start Start date to trim
 * @param {Date} end Final date to trim
 * @returns {Array} trimmed Trimmed array of values within required dates
 */
export function trimByDates(values, start, end){
    let trimmed = [];
    for (let date in values){
        if (new Date(date) >= new Date(start) && new Date(date) <= new Date(end)) {
            trimmed.push(values[date])
        }
    }
    return trimmed
}

/**
 * Processing of regular vs occasional forum posters and regular vs occasional forum viewers
 * @param {Object} weeklyPosters Object with array of ids of learners that posted by week
 * @param {Object} weeklyViewers Object with array of ids of learners that visited forums by week
 * @param {JsStoreWorker} connection Main JsStore worker that handles the connection to SqlWeb
 */
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

// /**
//  *
//  * @param forumSegmentation
//  * @param {JsStoreWorker} connection Main JsStore worker that handles the connection to SqlWeb
//  */
// export function generateForumBehaviorTable(forumSegmentation, connection) {
//     let resultMatrix = {};
//     for (let group in forumSegmentation){
//         for (let studentId of forumSegmentation[group]) {
//             if (studentId in resultMatrix) {
//                 resultMatrix[studentId].push(group)
//             } else {
//                 resultMatrix[studentId] = [group]
//             }
//         }
//     }
//     let studentsForumBehavior = [{
//         'name': 'studentsForumBehavior',
//         'object': resultMatrix
//     }];
//     sqlInsert('webdata', studentsForumBehavior, connection)
// }

/**
 * Groups the values of a graph series by week. If the daily values are numbers, it returns the total sum/average for each week. If they're an array, it returns a concatenated array for each week's sum.
 * @param {Object} graphElementMap Object with all graph series
 * @param {string} orderedSeriesName Name of the series to group
 * @returns {{weeklySum: *, weeklyAvg: *}} Weekly aggregated graph series object
 */
export function groupWeeklyMapped(graphElementMap, orderedSeriesName) {
    let grouped = _.groupBy(graphElementMap['dateListChart'], (result) => moment(result, 'DD/MM/YYYY').startOf('isoWeek'));
    let weeklySum = {};
    let weeklyAvg = {};
    let weekType = 'number';
    for (let week in grouped) {
        let weekDays = grouped[week];
        let weekTotal = 0;
        let weekList = [];
        for (let day of weekDays) {
            if (graphElementMap[orderedSeriesName].hasOwnProperty(day)) {
                if (! isNaN(Number(graphElementMap[orderedSeriesName][day]))) {
                    weekTotal += Number(graphElementMap[orderedSeriesName][day]);
                } else {
                    weekType = 'list';
                    let weekValues = [];
                    if (graphElementMap[orderedSeriesName].hasOwnProperty(day)) {
                        weekValues = graphElementMap[orderedSeriesName][day];
                    }
                    for (let element of weekValues) {
                        weekList.push(element);
                    }
                }
            }
        }
        if (weekType === "number") {
            weeklySum[week] = weekTotal;
            weeklyAvg[week] = (weekTotal / 7).toFixed(2);
        } else {
            weeklySum[week] = weekList;
            weeklyAvg[week] = 'noAvg'
        }
    }
    return {'weeklySum': weeklySum, 'weeklyAvg': weeklyAvg}
}

/**
 * Groups the values of a graph series by week. If the daily values are numbers, it returns the total sum for each week. If they're an array, it returns a concatenated array for each week. Only for forum behavior series.
 * @param {Object} elementObject Graph series object
 * @returns {Object} weeklySum Weekly aggregated graph series object
 */
export function groupWeekly(elementObject) {
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

/**
 * Check if an array is empty to return an array with a zero to avoid graph processing errors
 * @param {Array} array Graph array to be checked
 * @returns {Array} Original array or array with a zero if empty
 */
export function zeroIfEmptyArray(array){
    if (array.length === 0){
        return [0]
    }
    return array
}

/**
 * Function to calculate the arc for the video transitions
 * @param {number} start Origin point of the arc
 * @param {number} end Target point of the arc
 * @param {number} height Height of the arc
 * @returns {string} String with svg arc info
 */
export function calculateArc(start, end, height) {
    return ['M', start, height - 30,
        'A',
        Math.abs(end - start) / 2.3, ',',
        Math.abs(end - start) / 2, 0, 0, ',',
        start < end ? 1 : 1, end, ',', height - 30]
        .join(' ');
}

/**
 * Prototype function added to Date type to calculate the week number of a given date
 * @returns {number} Week number of a date
 */
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

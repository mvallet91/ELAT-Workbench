import {sqlInsert} from "./databaseHelpers.js";
import {loader, learnerSegmentation} from "./helpers.js";


/**
 * Handles the 3 main tables that are displayed on the ELAT dashboard
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
export function prepareTables(connection){
    showCourseTable(connection);
    showDetailsTable(connection);
    showMainIndicatorsTable(connection);
}

/**
 * Function to generate, or obtain the data from the database when available, and display it on the Course Details table
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
function showCourseTable(connection) {
    let HtmlString = "";
    connection.runSql("SELECT * FROM webdata WHERE name = 'courseDetails_none' ").then(function(result) {
        if (result.length === 1) {
            HtmlString = result[0]['object']['details'];
            document.getElementById("loading").style.display = "none";
            $('#tblGrid tbody').html(HtmlString);
        } else {
            loader(true);
            connection.runSql('select * from courses').then(function (courses) {
                let dateFormat = {weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'};
                let query = "";
                courses.forEach(async function (course) {
                    let courseMetadataMap = {};
                    await connection.runSql("SELECT * FROM metadata WHERE name = 'metadata_map' ").then(function(result) {
                        if (result.length === 0) {
                            loader(false);
                            toastr.error('Metadata has not been processed! Please upload all metadata files first');
                        } else {
                            courseMetadataMap = result[0]['object'];
                        }
                    });
                    query = "SELECT * FROM webdata WHERE name = 'segmentation' ";
                    let segmentation = '';
                    await connection.runSql(query).then(function (result) {
                        segmentation = result[0]['object']['type'];
                    });
                    let segmentMap = {'none': ['none'],
                        'ab': ['none', 'A', 'B'],
                        'abc': ['none', 'A', 'B', 'C']};

                    for (let segment of segmentMap[segmentation]) {
                        HtmlString = "";
                        let questionCounter = 0;
                        let forumInteractionCounter = 0;
                        HtmlString += "<tr ItemId=" + course.course_id + "><td>" +
                            course.course_name + "</td><td>" +
                            course.start_time.toLocaleDateString('en-EN', dateFormat) + "</td><td>" +
                            course.end_time.toLocaleDateString('en-EN', dateFormat) + "</td><td>";
                        // query = "count from course_elements where course_id = '" + course.course_id + "'";
                        // await connection.runSql(query).then(function (result) {
                        //     HtmlString += result.toLocaleString('en-US') + "</td><td>";
                        // });
                        if (segment === 'none') {query = "count * from learner_demographic";}
                            else { query = "count from learner_demographic where segment = '" + segment + "'"; }
                        await connection.runSql(query).then(function (result) {
                            HtmlString += result.toLocaleString('en-US') + "</td><td>";
                        });
                        query = "SELECT * FROM quiz_questions";
                        let problemBlockSet = new Set();

                        for (let component in courseMetadataMap.element_type_map){
                            if (courseMetadataMap.element_type_map[component] === 'problem') {
                                let problemBlockId = courseMetadataMap.child_parent_map[component];
                                problemBlockSet.add(problemBlockId);
                            }
                        }
                        HtmlString += problemBlockSet.size.toLocaleString('en-US') + "</td><td>";

                        // await connection.runSql(query).then(function (results) {
                        //     results.forEach(function (result) {
                        //         let problemBlockId = courseMetadataMap.child_parent_map[result['question_id']];
                        //         problemBlockSet.add(problemBlockId);
                        //         if (result['question_id'].includes(course.course_id.slice(10,))) {
                        //             questionCounter++;
                        //         }
                        //         console.log(result['question_id'], problemBlockId, courseMetadataMap.child_parent_map[problemBlockId])
                        //     });
                        //     // HtmlString += questionCounter.toLocaleString('en-US') + "</td><td>";
                        //     HtmlString += problemBlockSet.size.toLocaleString('en-US') + "</td><td>";
                        // });

                        let videoCounter = 0;
                        for (let component in courseMetadataMap.element_type_map){
                            if (courseMetadataMap.element_type_map[component] === 'video') {
                                videoCounter++
                            }
                        }
                        HtmlString += videoCounter.toLocaleString('en-US');

                        if (segment === 'none') {
                            $('#tblGrid tbody').html(HtmlString);
                        }

                        let courseDetails = [{'name': 'courseDetails_' + segment, 'object': {'details': HtmlString}}];
                        sqlInsert('webdata', courseDetails, connection);
                    }
                    loader(false);
                })
            }).catch(function (error) {
                console.log(error);
                loader(false)
            })
        }
    })
}

/**
 * Function to generate, or obtain the data from the database if available, and display it on the Database Details table
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
function showDetailsTable(connection) {
    connection.runSql("SELECT * FROM webdata WHERE name = 'databaseDetails_none' ").then(function(result) {
        if (result.length === 1) {
            let HtmlString = result[0]['object']['details'];
            document.getElementById("loading").style.display = "none";
            $('#dbGrid tbody').html(HtmlString);
        } else {
            loader(true);
            connection.runSql('select * from courses').then(function (courses) {
                courses.forEach(async function (course) {
                    let courseMetadataMap = {};
                    await connection.runSql("SELECT * FROM metadata WHERE name = 'metadata_map' ").then(function(result) {
                        if (result.length === 0) {
                            loader(false);
                            toastr.error('Metadata has not been processed! Please upload all metadata files first');
                        } else {
                            courseMetadataMap = result[0]['object'];
                        }
                    });
                    let query = "SELECT * FROM webdata WHERE name = 'segmentation' ";
                    let segmentation = '';
                    await connection.runSql(query).then(function (result) {
                        segmentation = result[0]['object']['type'];
                    });
                    let segmentMap = {'none': ['none'],
                        'ab': ['none', 'A', 'B'],
                        'abc': ['none', 'A', 'B', 'C']};

                    for (let segment of segmentMap[segmentation]) {
                        let HtmlString = "";
                        let totalHtmlString = "";
                        let totalSessionCounter = 0;
                        let totalForumSessionCounter = 0;
                        let totalVideoInteractionCounter = 0;
                        let totalSubmissionCounter = 0;
                        let totalAssessmentCounter = 0;
                        let totalQuizSessionCounter = 0;
                        let sessionCounter = 0;
                        let forumSessionCounter = 0;
                        let forumInteractionCounter = 0;
                        let videoInteractionCounter = 0;
                        let submissionCounter = 0;
                        let assessmentCounter = 0;
                        let quizSessionCounter = 0;
                        totalHtmlString += "<tr ItemId=" + 'total' + "><td>" +
                            "Total" + "</td><td>";
                        HtmlString += "<tr ItemId=" + course.course_id + "><td>" +
                            course.course_name + "</td><td>";
                        query = "SELECT * FROM sessions";
                        await connection.runSql(query).then(function (sessions) {
                            sessions.forEach(function (session) {
                                totalSessionCounter++;
                                if (session['course_learner_id'].includes(course.course_id) &&
                                    (segment === 'none' || learnerSegmentation(session['course_learner_id'], segmentation) === segment)) {
                                    sessionCounter++;
                                }
                            });
                        });
                        query = "SELECT * FROM forum_sessions";
                        await connection.runSql(query).then(function (sessions) {
                            sessions.forEach(function (session) {
                                totalForumSessionCounter++;
                                if (session['course_learner_id'].includes(course.course_id) &&
                                    (segment === 'none' || learnerSegmentation(session['course_learner_id'], segmentation) === segment)) {
                                    forumSessionCounter++;
                                }
                            });
                        });
                        query = "SELECT * FROM forum_interaction";
                        await connection.runSql(query).then(function (sessions) {
                            sessions.forEach(function (session) {
                                if (session['course_learner_id'].includes(course.course_id) &&
                                    (segment === 'none' || learnerSegmentation(session['course_learner_id'], segmentation) === segment)) {
                                    forumInteractionCounter++;
                                }
                            });
                        });
                        query = "SELECT * FROM video_interactions";
                        await connection.runSql(query).then(function (sessions) {
                            sessions.forEach(function (session) {
                                totalVideoInteractionCounter++;
                                if (session['course_learner_id'].includes(course.course_id) &&
                                    (segment === 'none' || learnerSegmentation(session['course_learner_id'], segmentation) === segment)) {
                                    videoInteractionCounter++;
                                }
                            });
                        });
                        query = "SELECT * FROM submissions";
                        await connection.runSql(query).then(function (sessions) {
                            sessions.forEach(function (session) {
                                totalSubmissionCounter++;
                                if (session['course_learner_id'].includes(course.course_id) &&
                                    (segment === 'none' || learnerSegmentation(session['course_learner_id'], segmentation) === segment)) {
                                    submissionCounter++;
                                }
                            });
                        });
                        query = "SELECT * FROM assessments";
                        await connection.runSql(query).then(function (sessions) {
                            sessions.forEach(function (session) {
                                totalAssessmentCounter++;
                                if (session['course_learner_id'].includes(course.course_id) &&
                                    (segment === 'none' || learnerSegmentation(session['course_learner_id'], segmentation) === segment)) {
                                    assessmentCounter++;
                                }
                            });
                        });
                        query = "SELECT * FROM quiz_sessions";
                        await connection.runSql(query).then(function (sessions) {
                            sessions.forEach(function (session) {
                                totalQuizSessionCounter++;
                                if (session['course_learner_id'].includes(course.course_id) &&
                                    (segment === 'none' || learnerSegmentation(session['course_learner_id'], segmentation) === segment)) {
                                    quizSessionCounter++;
                                }
                            });
                        });
                        totalHtmlString += totalSessionCounter.toLocaleString('en-US') + "</td><td>" +
                            totalForumSessionCounter.toLocaleString('en-US') + "</td><td>" +
                            totalVideoInteractionCounter.toLocaleString('en-US') + "</td><td>" +
                            totalSubmissionCounter.toLocaleString('en-US') + "</td><td>" +
                            totalAssessmentCounter.toLocaleString('en-US') + "</td><td>" +
                            totalQuizSessionCounter.toLocaleString('en-US');
                        HtmlString += sessionCounter.toLocaleString('en-US') + "</td><td>" +
                            forumSessionCounter.toLocaleString('en-US') + "</td><td>" +
                            forumInteractionCounter.toLocaleString('en-US') + "</td><td>" +
                            videoInteractionCounter.toLocaleString('en-US') + "</td><td>" +
                            submissionCounter.toLocaleString('en-US') + "</td><td>" +
                            assessmentCounter.toLocaleString('en-US') + "</td><td>" +
                            quizSessionCounter.toLocaleString('en-US');
                        document.getElementById("loading").style.display = "none";
                        if (segment === 'none') {
                            $('#dbGrid tbody').html(HtmlString);
                        }
                        let databaseDetails = [{'name': 'databaseDetails_' + segment, 'object': {'details': HtmlString}}];
                        sqlInsert('webdata', databaseDetails, connection);
                    }
                    loader(false)
                });
            }).catch(function (error) {
                console.log(error);
            });
        }
    })
}

/**
 * Function to generate, or obtain the data from the database if available, and display it on the Main Indicators table
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
function showMainIndicatorsTable(connection) {
    connection.runSql("SELECT * FROM webdata WHERE name = 'mainIndicators_none' ").then(function(result) {
        if (result.length === 1) {
            let HtmlString = result[0]['object']['details'];
            $('#indicatorGrid tbody').html(HtmlString);
        } else {
            loader(true);
            connection.runSql('select * from courses').then(function (courses) {
                courses.forEach(async function (course) {
                    let query = "SELECT * FROM webdata WHERE name = 'segmentation' ";
                    let segmentation = '';
                    await connection.runSql(query).then(function (result) {
                        segmentation = result[0]['object']['type'];
                    });
                    let segmentMap = {'none': ['none'],
                        'ab': ['none', 'A', 'B'],
                        'abc': ['none', 'A', 'B', 'C']};

                    for (let segment of segmentMap[segmentation]) {
                        let course_id = course.course_id,
                            completed = 0,
                            completionRate = 0,
                            avgGrade = 0,
                            verifiedLearners = 0,
                            honorLearners = 0,
                            auditLearners = 0,
                            videoWatchers = 0,
                            videoDuration = 0,
                            avgGrades = {};
                        let HtmlString = "";
                        HtmlString += "<tr ItemId=" + course_id + "><td>";
                        query = "COUNT * from course_learner WHERE certificate_status = 'downloadable' ";
                        if (segment !== 'none') {query += " && segment = '" + segment + "' "}
                        await connection.runSql(query).then(function (result) {
                            completed = result;
                        });
                        query = "COUNT * from learner_demographic";
                        if (segment !== 'none') {query += " WHERE segment = '" + segment + "' "}
                        await connection.runSql(query).then(function (result) {
                            completionRate = completed / result;
                        });
                        query = "SELECT [avg(final_grade)] from course_learner WHERE certificate_status = 'downloadable' ";
                        if (segment !== 'none') {query += " && segment = '" + segment + "' "}
                        await connection.runSql(query).then(function (result) {
                            avgGrade = result[0]['avg(final_grade)'] * 100;
                        });
                        query = "COUNT * from course_learner WHERE enrollment_mode = 'verified' ";
                        if (segment !== 'none') {query += " && segment = '" + segment + "' "}
                        await connection.runSql(query).then(function (result) {
                            verifiedLearners = result;
                        });
                        query = "COUNT * from course_learner WHERE enrollment_mode = 'honor' ";
                        if (segment !== 'none') {query += " && segment = '" + segment + "' "}
                        await connection.runSql(query).then(function (result) {
                            honorLearners = result;
                        });
                        query = "COUNT * from course_learner WHERE enrollment_mode = 'audit' ";
                        if (segment !== 'none') {query += " && segment = '" + segment + "' "}
                        await connection.runSql(query).then(function (result) {
                            auditLearners = result;
                        });
                        query = "SELECT [avg(final_grade)] from course_learner WHERE certificate_status = 'downloadable' ";
                        if (segment !== 'none') {query += " && segment = '" + segment + "' "}
                        query += "GROUP BY enrollment_mode";
                        await connection.runSql(query).then(function (results) {
                            results.forEach(function (result) {
                                avgGrades[result.enrollment_mode] = (result['avg(final_grade)'] * 100).toFixed(1);
                            });
                        });
                        query = "SELECT [sum(duration)] from video_interactions GROUP BY course_learner_id";
                        await connection.runSql(query).then(function (watchers) {
                            videoDuration = 0;
                            videoWatchers = 0;
                            watchers.forEach(function (watcher) {
                            if (segment === 'none' || learnerSegmentation(watcher['course_learner_id'], segmentation) === segment) {
                                videoDuration += watcher['sum(duration)'];
                                videoWatchers += 1;
                            }
                            });
                        });
                        let avgDuration = videoDuration / videoWatchers;
                        HtmlString += completionRate.toFixed(2).toLocaleString('en-US')  + "</td><td>" +
                            avgGrade.toFixed(2).toLocaleString('en-US')  + "</td><td>" +
                            "Verified: " + verifiedLearners.toLocaleString('en-US') + "<br>" +
                            "Honor: " + honorLearners.toLocaleString('en-US') + "<br>" +
                            "Audit: " + auditLearners.toLocaleString('en-US') + "<br>" +
                            "</td><td>" +
                            "Verified: " + avgGrades['verified'] + "<br>" +
                            "Honor: " + avgGrades['honor'] + "<br>" +
                            "Audit: " + avgGrades['audit'] + "<br>" +
                            "</td><td>" +
                            (avgDuration/60).toFixed(2).toLocaleString('en-US') + " minutes" + "</td><td>" +
                            videoWatchers.toLocaleString('en-US');
                        if (segment === 'none') {
                            $('#indicatorGrid tbody').html(HtmlString);
                        }
                        let indicators = [{'name': 'mainIndicators_' + segment, 'object': {'details': HtmlString}}];
                        sqlInsert('webdata', indicators, connection);
                    }
                    loader(false)
                });
            }).catch(function (error) {
                console.log(error);
                loader(false)
            });
        }
    })
}

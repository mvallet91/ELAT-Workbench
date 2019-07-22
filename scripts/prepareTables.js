import {sqlInsert} from "./databaseHelpers.js";
import {loader} from "./helpers.js";

export function showCourseTable(connection) {
    let HtmlString = "";
    connection.runSql("SELECT * FROM webdata WHERE name = 'courseDetails' ").then(function(result) {
        if (result.length === 1) {
            HtmlString = result[0]['object']['details'];
            document.getElementById("loading").style.display = "none";
            $('#tblGrid tbody').html(HtmlString);
        } else {
            connection.runSql('select * from courses').then(function (courses) {
                let questionCounter = 0;
                let forumInteractionCounter = 0;
                let dateFormat = {weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'};
                courses.forEach(async function (course) {
                    HtmlString += "<tr ItemId=" + course.course_id + "><td>" +
                        course.course_name + "</td><td>" +
                        course.start_time.toLocaleDateString('en-EN', dateFormat) + "</td><td>" +
                        course.end_time.toLocaleDateString('en-EN', dateFormat) + "</td><td>";
                    let query = "count from course_elements where course_id = '" + course.course_id + "'";
                    await connection.runSql(query).then(function (result) {
                        HtmlString += result.toLocaleString('en-US') + "</td><td>";
                    });
                    query = "count from learner_index where course_id = '" + course.course_id + "'";
                    await connection.runSql(query).then(function (result) {
                        HtmlString += result.toLocaleString('en-US') + "</td><td>";
                    });
                    query = "SELECT * FROM quiz_questions";
                    await connection.runSql(query).then(function (results) {
                        results.forEach(function (result) {
                            if (result['question_id'].includes(course.course_id.slice(10,))) {
                                questionCounter++;
                            }
                        });
                        HtmlString += questionCounter.toLocaleString('en-US') + "</td><td>";
                    });
                    query = "SELECT * FROM forum_interaction";
                    await connection.runSql(query).then(function (sessions) {
                        sessions.forEach(function (session) {
                            if (session['course_learner_id'].includes(course.course_id)) {
                                forumInteractionCounter++;
                            }
                        });
                    });
                    HtmlString += forumInteractionCounter.toLocaleString('en-US');
                    $('#tblGrid tbody').html(HtmlString);
                    let courseDetails = [{'name': 'courseDetails', 'object': {'details': HtmlString}}];
                    sqlInsert('webdata', courseDetails, connection);
                })
            }).catch(function (error) {
                console.log(error);
                loader(false)
            })
        }
    })
}


export function showDetailsTable(connection) {
    let HtmlString = "";
    let totalHtmlString = "";
    connection.runSql("SELECT * FROM webdata WHERE name = 'databaseDetails' ").then(function(result) {
        if (result.length === 1) {
            HtmlString = result[0]['object']['details'];
            document.getElementById("loading").style.display = "none";
            $('#dbGrid tbody').html(HtmlString);
        } else {
            connection.runSql('select * from courses').then(function (courses) {
                courses.forEach(async function (course) {
                    let tsessionCounter = 0;
                    let tforumSessionCounter = 0;
                    let tvideoInteractionCounter = 0;
                    let tsubmissionCounter = 0;
                    let tassessmentCounter = 0;
                    let tquizSessionCounter = 0;
                    let sessionCounter = 0;
                    let forumSessionCounter = 0;
                    let videoInteractionCounter = 0;
                    let submissionCounter = 0;
                    let assessmentCounter = 0;
                    let quizSessionCounter = 0;
                    totalHtmlString += "<tr ItemId=" + 'total' + "><td>" +
                        "Total" + "</td><td>";
                    HtmlString += "<tr ItemId=" + course.course_id + "><td>" +
                        course.course_name + "</td><td>";
                    let query = "SELECT * FROM sessions";
                    await connection.runSql(query).then(function (sessions) {
                        sessions.forEach(function (session) {
                            tsessionCounter++;
                            if (session['course_learner_id'].includes(course.course_id)) {
                                sessionCounter++;
                            }
                        });
                    });
                    query = "SELECT * FROM forum_sessions";
                    await connection.runSql(query).then(function (sessions) {
                        sessions.forEach(function (session) {
                            tforumSessionCounter++;
                            if (session['course_learner_id'].includes(course.course_id)) {
                                forumSessionCounter++;
                            }
                        });
                    });
                    query = "SELECT * FROM video_interaction";
                    await connection.runSql(query).then(function (sessions) {
                        sessions.forEach(function (session) {
                            tvideoInteractionCounter++;
                            if (session['course_learner_id'].includes(course.course_id)) {
                                videoInteractionCounter++;
                            }
                        });
                    });
                    query = "SELECT * FROM submissions";
                    await connection.runSql(query).then(function (sessions) {
                        sessions.forEach(function (session) {
                            tsubmissionCounter++;
                            if (session['course_learner_id'].includes(course.course_id)) {
                                submissionCounter++;
                            }
                        });
                    });
                    query = "SELECT * FROM assessments";
                    await connection.runSql(query).then(function (sessions) {
                        sessions.forEach(function (session) {
                            tassessmentCounter++;
                            if (session['course_learner_id'].includes(course.course_id)) {
                                assessmentCounter++;
                            }
                        });
                    });
                    query = "SELECT * FROM quiz_sessions";
                    await connection.runSql(query).then(function (sessions) {
                        sessions.forEach(function (session) {
                            tquizSessionCounter++;
                            if (session['course_learner_id'].includes(course.course_id)) {
                                quizSessionCounter++;
                            }
                        });
                    });
                    totalHtmlString += tsessionCounter.toLocaleString('en-US') + "</td><td>" +
                        tforumSessionCounter.toLocaleString('en-US') + "</td><td>" +
                        tvideoInteractionCounter.toLocaleString('en-US') + "</td><td>" +
                        tsubmissionCounter.toLocaleString('en-US') + "</td><td>" +
                        tassessmentCounter.toLocaleString('en-US') + "</td><td>" +
                        tquizSessionCounter.toLocaleString('en-US');
                    HtmlString += sessionCounter.toLocaleString('en-US') + "</td><td>" +
                        forumSessionCounter.toLocaleString('en-US') + "</td><td>" +
                        videoInteractionCounter.toLocaleString('en-US') + "</td><td>" +
                        submissionCounter.toLocaleString('en-US') + "</td><td>" +
                        assessmentCounter.toLocaleString('en-US') + "</td><td>" +
                        quizSessionCounter.toLocaleString('en-US');
                    document.getElementById("loading").style.display = "none";
                    $('#dbGrid tbody').html(HtmlString);
                    let databaseDetails = [{'name': 'databaseDetails', 'object': {'details':HtmlString}}];
                    sqlInsert('webdata', databaseDetails, connection);
                });
            }).catch(function (error) {
                console.log(error);
            });
        }
    })
}


export function showMainIndicators(connection) {
    let HtmlString = "";
    connection.runSql("SELECT * FROM webdata WHERE name = 'mainIndicators' ").then(function(result) {
        if (result.length === 1) {
            HtmlString = result[0]['object']['details'];
            $('#indicatorGrid tbody').html(HtmlString);
        } else {
            connection.runSql('select * from courses').then(function (courses) {
                courses.forEach(async function (course) {
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

                    HtmlString += "<tr ItemId=" + course_id + "><td>";
                    await connection.runSql("COUNT * from course_learner WHERE certificate_status = 'downloadable' ").then(function (result) {
                        completed = result;
                    });
                    await connection.runSql("COUNT * from learner_index").then(function (result) {
                        completionRate = completed / result;
                    });
                    await connection.runSql("SELECT [avg(final_grade)] from course_learner WHERE certificate_status = 'downloadable' ").then(function (result) {
                        avgGrade = result[0]['avg(final_grade)'] * 100;
                    });
                    await connection.runSql("COUNT * from course_learner WHERE enrollment_mode = 'verified' ").then(function (result) {
                        verifiedLearners = result;
                    });
                    await connection.runSql("COUNT * from course_learner WHERE enrollment_mode = 'honor' ").then(function (result) {
                        honorLearners = result;
                    });
                    await connection.runSql("COUNT * from course_learner WHERE enrollment_mode = 'audit' ").then(function (result) {
                        auditLearners = result;
                    });
                    await connection.runSql("SELECT [avg(final_grade)] from course_learner WHERE certificate_status = 'downloadable' GROUP BY enrollment_mode").then(function (results) {
                        results.forEach(function (result) {
                            avgGrades[result.enrollment_mode] = result.final_grade * 100;
                        });
                    });
                    await connection.runSql("SELECT [sum(duration)] from video_interaction GROUP BY course_learner_id").then(function (watchers) {
                        videoWatchers = watchers.length;
                        videoDuration = 0;
                        watchers.forEach(function (watcher) {
                            videoDuration += watcher['sum(duration)'];
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
                    $('#indicatorGrid tbody').html(HtmlString);
                    let indicators = [{'name': 'mainIndicators', 'object': {'details': HtmlString}}];
                    sqlInsert('webdata', indicators, connection);
                });
            }).catch(function (error) {
                console.log(error);
                loader(false)
            });
        }
    })
}
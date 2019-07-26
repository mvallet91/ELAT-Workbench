import {downloadCsv, loader} from "./helpers.js";

let testing = false;
/**
 * Database helper to insert values into IndexedDB in an SQL fashion, using the SqlWeb library
 * @param {string} table
 * @param {array} dataObject
 * @param {JsStoreWorker} connection
 */
export function sqlInsert(table, dataObject, connection) {
    if (!(['forum_interaction', 'webdata'].includes(table))){
        connection.runSql('DELETE FROM ' + table);
    }
    let query = new SqlWeb.Query("INSERT INTO " + table + " values='@val'");
    for (let v of dataObject) {
        for (let field of Object.keys(v)) {
            if (field.includes('time')){
                let date = v[field];
                v[field] = new Date(date);
            }
        }
    }
    query.map("@val", dataObject);
    connection.runSql(query).then(function (rowsAdded) {
        if (rowsAdded > 0 && table !== 'forum_interaction') {
            let today = new Date();
            let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();
            console.log('Successfully added to' , table, ' at ', time);
            if (table === 'metadata'){
                loader(false);
                toastr.success('Please reload the page now', 'Metadata ready', {timeOut: 0})
            }
        }
    }).catch(function (err) {
        console.log(err);
    });
}

export function sqlLogInsert(table, rowsArray, connection) {
    if (!testing) {
        let query = new SqlWeb.Query("INSERT INTO " + table + " values='@val'");
        for (let row of rowsArray) {
            for (let field of Object.keys(row)) {
                if (field.includes('_time')) {
                    let date = row[field];
                    row[field] = new Date(date);
                }
            }
        }
        query.map("@val", rowsArray);
        connection.runSql(query)
            .then(function (rowsAdded) {
                if (rowsAdded > 0) {
                    let today = new Date();
                    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();
                    console.log('Successfully added: ', table, ' at ', time);
                }
            })
            .catch(function (err) {
                console.log(err);
            });
    }
}

export function populateSamples(courseId, connection){
    let courseMap = {'FP101x': "DelftX+FP101x+3T2015.json",
        'TW3421x': "DelftX+TW3421x+3T2016.json",
        'AE1110x':"DelftX+AE1110x+2T2017.json",
        "Visual101x":"DelftX+Visual101x+1T2016",
        "Mind101x":"DelftX+MIND101x+1T2018.json"
    };
    let courseFile = 'samples/' + courseMap[courseId];
    connection.runSql("SELECT * FROM webdata").then(function(metadata) {
        if (metadata.length > 1){
            toastr.error('The database has to be clear first!');
        } else {
            toastr.info('Reading sample');
            $.getJSON(courseFile, function(json) {
                sqlInsert('webdata', json, connection);
                toastr.success('Please reload the page now', 'Sample data ready', {timeOut: 0})
            })
        }
    })
}

export function clearStoredWebdata(connection) {
    if (!testing) {
        connection.runSql("DELETE FROM webdata WHERE name = 'graphElements'");
        connection.runSql("DELETE FROM webdata WHERE name = 'databaseDetails'");
        connection.runSql("DELETE FROM webdata WHERE name = 'mainIndicators'");
        connection.runSql("DELETE FROM webdata WHERE name = 'arcElements'");
        connection.runSql("DELETE FROM webdata WHERE name = 'cycleElements'");
    }
}

export function updateChart(connection) {
    loader(true);
    // connection.runSql("DELETE FROM webdata WHERE name = 'mainIndicators'");
    // connection.runSql("DELETE FROM webdata WHERE name = 'databaseDetails'");
    // connection.runSql("DELETE FROM webdata WHERE name = 'arcElements'");
    // connection.runSql("DELETE FROM webdata WHERE name = 'cycleElements'");
    // connection.runSql("DELETE FROM webdata WHERE name = 'databaseDetails'");
    connection.runSql("DELETE FROM webdata WHERE name = 'graphElements'").then(function (e) {
        loader(false);
        toastr.success('Please reload the page now', 'Updating Indicators and Charts', {timeOut: 0})
    });
}


export async function deleteEverything(connection) {
    let query = 'DELETE FROM sessions';
    let r = confirm("WARNING!\nTHIS WILL DELETE EVERYTHING IN THE DATABASE");
    if (r === false) {
        alert('Nothing was deleted')
    } else {
        loader(true);
        await connection.clear('sessions').then(function () {
            console.log('Cleared sessions table');
        }).catch(function (err) {
            console.log(err);
            alert('The deletion process started but did not finish,\n please refresh and try again');
        });
        await connection.clear('video_interaction').then(function () {
            console.log('Cleared video_interaction table');
        }).catch(function (err) {
            console.log(err);
            alert('The deletion process started but did not finish,\n please refresh and try again');
        });
        await connection.clear('submissions').then(function () {
            console.log('Cleared submissions ');
        }).catch(function (err) {
            console.log(err);
            alert('The deletion process started but did not finish,\n please refresh and try again');
        });
        await connection.runSql(query).then(function () {
            console.log('Cleared quiz_sessions ');
        }).catch(function (err) {
            console.log(err);
            alert('The deletion process started but did not finish,\n please refresh and try again');
        });
        await connection.clear('course_learner').then(function () {
            console.log('Cleared course_learner ');
        }).catch(function (err) {
            console.log(err);
            alert('The deletion process started but did not finish,\n please refresh and try again');
        });
        await connection.clear('forum_sessions').then(function () {
            console.log('Cleared forum_sessions ');
        }).catch(function (err) {
            console.log(err);
            alert('The deletion process started but did not finish,\n please refresh and try again');
        });
        await connection.dropDb().then(function () {
            loader(false);
            toastr.success('Database has been deleted!')
        }).catch(function (err) {
            console.log(err);
            alert('The deletion process started but did not finish,\n please refresh and try again');
        });
    }
}

export function processTablesForDownload(tablename, headers, connection) {
    connection.runSql('select * from courses').then(function (courses) {
        courses.forEach(function(course){
            const course_id = course.course_id;
            let total_count = 0,
                counter = 0;
            connection.runSql("COUNT * FROM " + tablename).then(function(count) {
                total_count = count;
            });
            connection.runSql("SELECT * FROM " + tablename).then(function(sessions) {
                let data = [headers];
                sessions.forEach(function (session) {
                    counter++;
                    if (session['course_learner_id'].includes(course_id)){
                        let array = [];
                        for (let key in session){
                            array.push(session[key]);
                        }
                        data.push(array)
                    }
                    if (counter === total_count){
                        downloadCsv(tablename + course_id + '.csv', data);
                    }
                });
            });
        });
    })
}


export let schemaMap = {'sessions': ['session_id', 'course_learner_id', 'start_time', 'end_time', 'duration'],
    'forum_sessions': ['session_id', 'course_learner_id', 'times_search', 'start_time',
        'end_time', 'duration', 'relevent_element_id'],
    'video_interaction':['interaction_id', 'course_learner_id', 'video_id','duration',
        'times_forward_seek','duration_forward_seek','times_backward_seek','duration_backward_seek',
        'times_speed_up','times_speed_down','times_pause','duration_pause','start_time','end_time'],
    'submissions': ['submission_id', 'course_learner_id', 'question_id', 'submission_timestamp'],
    'assessments': ['assessment_id', 'course_learner_id', 'max_grade', 'grade'],
    'quiz_sessions': ['session_id', 'course_learner_id', 'start_time', 'end_time', 'duration']};

export function getEdxDbQuery() {
    let db = "DEFINE DB edxdb;";

    let courses = `DEFINE TABLE courses(        
        course_id PRIMARYKEY STRING,
        course_name STRING,
        start_time date_time,
        end_time date_time
        )
    `;

    let learners = `DEFINE TABLE course_learner ( 
        course_learner_id PRIMARYKEY STRING,
        final_grade NUMBER,
        enrollment_mode STRING,
        certificate_status STRING,
        register_time date_time
        )
    `;

    let demographic = `DEFINE TABLE learner_demographic (
        course_learner_id PRIMARYKEY STRING,
        gender STRING,
        year_of_birth NUMBER,
        level_of_education STRING,
        country STRING,
        email STRING
        )
    `;

    let elements = `DEFINE TABLE course_elements (
        element_id PRIMARYKEY STRING,
        element_type STRING,
        week NUMBER,
        course_id STRING
        )
    `;

    let learner_index = `DEFINE TABLE learner_index (
        global_learner_id PRIMARYKEY STRING,
        course_id NOTNULL STRING,
        course_learner_id NOTNULL STRING
        )
    `;

    let sessions = `DEFINE TABLE sessions (
        session_id PRIMARYKEY STRING,
        course_learner_id NOTNULL STRING,
        start_time date_time,
        end_time date_time,
        duration NUMBER
        )
    `;

    let metadata = `DEFINE TABLE metadata (
        name PRIMARYKEY STRING,
        object OBJECT
        )
    `;

    let webdata = `DEFINE TABLE webdata (
        name PRIMARYKEY STRING,
        object OBJECT
        )
    `;

    let quiz_questions = `DEFINE TABLE quiz_questions (
        question_id PRIMARYKEY STRING,
        question_type STRING,
        question_weight NUMBER,
        question_due date_time
        ) 
    `;

    let submissions = `DEFINE TABLE submissions (
        submission_id PRIMARYKEY STRING ,
        course_learner_id NOTNULL STRING,
        question_id NOTNULL STRING,
        submission_timestamp date_time
        )
    `;

    let assessments = `DEFINE TABLE assessments (
        assessment_id PRIMARYKEY STRING ,
        course_learner_id STRING,
        max_grade NUMBER,
        grade NUMBER
        )
    `;

    let quiz_sessions = `DEFINE TABLE quiz_sessions (
        session_id PRIMARYKEY STRING ,
        course_learner_id NOTNULL STRING,
        start_time date_time,
        end_time date_time,
        duration NUMBER
        )
    `;

    let video_interaction = `DEFINE TABLE video_interaction (
        interaction_id PRIMARYKEY STRING,
        course_learner_id NOTNULL STRING,
        video_id NOTNULL STRING,
        duration NUMBER,
        times_forward_seek NUMBER,
        duration_forward_seek NUMBER,
        times_backward_seek NUMBER,
        duration_backward_seek NUMBER,
        times_speed_up NUMBER,
        times_speed_down NUMBER,
        times_pause NUMBER,
        duration_pause NUMBER,
        start_time date_time,
        end_time date_time
        )
    `;

    let forum_interaction = `DEFINE TABLE forum_interaction (
        post_id PRIMARYKEY STRING,
        course_learner_id STRING,
        post_type STRING,
        post_title STRING,
        post_content STRING,
        post_timestamp date_time,
        post_parent_id STRING,
        post_thread_id STRING
        )
    `;

    let forum_sessions = `DEFINE TABLE forum_sessions (
        session_id PRIMARYKEY STRING,
        course_learner_id NOTNULL STRING,
        times_search NUMBER,
        start_time date_time,
        end_time date_time,
        duration NUMBER,
        relevent_element_id STRING
        )
    `;

    let survey_descriptions = `DEFINE TABLE survey_descriptions (
        question_id PRIMARYKEY STRING,
        course_id STRING,
        question_type STRING,
        question_description STRING
        )
    `;

    let survey_responses = `DEFINE TABLE survey_responses (
        response_id PRIMARYKEY STRING,
        course_learner_id STRING,
        question_id STRING,
        answer STRING
        )  
    `;

    return (db + metadata + courses + demographic + elements + learners + learner_index +
        sessions + quiz_questions + submissions + assessments + quiz_sessions + video_interaction +
        forum_interaction + forum_sessions + survey_descriptions + survey_responses + webdata )
        ;
}

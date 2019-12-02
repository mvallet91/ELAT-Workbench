import {downloadCsv, loader} from "./helpers.js";
import {prepareTables} from "./prepareTables.js";

let testing = false;

/**
 * Function to verify if the edx database exists and start the dashboard, or generate it otherwise
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
export function initiateEdxDb(connection) {
    let dbName = "edxdb";
    connection.runSql('ISDBEXIST ' + dbName).then(function (isExist) {
        if (isExist) {
            connection.runSql('OPENDB ' + dbName).then(function () {
                loader(false);
                toastr.success('Database ready', 'ELAT',  {timeOut: 1500});
                prepareTables(connection);
            });
        } else {
            toastr.info("Welcome! If this is your first time here, visit <a href='https://mvallet91.github.io/ELAT'>ELAT Home</a> to learn more", "ELAT",  {timeOut: 7000});
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


/**
 * Handles the SQL-style query to insert values into IndexedDB, using the SqlWeb interpreter
 * @param {string} table String with the name of the table to insert
 * @param {array} dataRows Array of objects (rows) to be inserted into the table
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
export function sqlInsert(table, dataRows, connection) {
    if (!(['forum_interaction', 'webdata'].includes(table))){
        connection.runSql('DELETE FROM ' + table);
    }
    let query = new SqlWeb.Query("INSERT INTO " + table + " values='@val'");
    for (let v of dataRows) {
        for (let field of Object.keys(v)) {
            if (field.includes('time')){
                let date = v[field];
                v[field] = new Date(date);
            }
        }
    }
    let info = '';
    if (table === 'webdata' || table === 'metadata') {info = dataRows[0]['name']} else {info = dataRows.length}
    query.map("@val", dataRows);
    connection.runSql(query).then(function (rowsAdded) {
        if (rowsAdded > 0 && table !== 'forum_interaction') {
            let today = new Date();
            let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();
            console.log('Successfully added', info, 'to' , table, ' at ', time);
            if (table === 'metadata'){
                loader(false);
                toastr.success('Please reload the page now', 'Metadata ready', {timeOut: 0})
            }
        }
    }).catch(function (err) {
        loader(false);
        console.log(err, info, 'in', table);
    });
}

/**
 * Handles the SQL-style query to insert values from the logs into IndexedDB, using the SqlWeb interpreter
 * @param {string} table String with the name of the table to insert
 * @param {array} rowsArray Array of objects (rows) to be inserted into the table
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
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

/**
 * Reads JSON stored values, and populates the sample data into dashboard tables and graphs
 * @param {string} courseId String with the course id, embedded in the button
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
export function populateSamples(courseId, connection){
    loader(true);
    let courseMap = {'FP101x': "DelftX+FP101x+3T2015.json",
        'FP101x_All': "DelftX+FP101x_All+3T2015.json",
        'TW3421x': "DelftX+TW3421x+3T2016.json",
        'AE1110x':"DelftX+AE1110x+2T2017.json",
        "Visual101x":"DelftX+Visual101x+1T2016",
        "Mind101x":"DelftX+MIND101x+1T2018.json",
        "Frame101x": "DelftX+Frame101x+1T2016.json",
        "RI101x": "DelftX+RI101x+1T2016.json"
    };
    let courseFile = 'samples/' + courseMap[courseId];
    connection.runSql("SELECT * FROM webdata").then(function(metadata) {
        if (metadata.length > 1){
            toastr.error('The database has to be clear first!');
            loader(false);
        } else {
            toastr.info('Reading sample');
            $.getJSON(courseFile, function(json) {
                sqlInsert('webdata', json, connection);
                toastr.success('Please reload the page now', 'Sample data ready', {timeOut: 0})
                loader(false)
            })
        }
    })
}

/**
 * Deletes the processed Webdata used for dashboard tables and graphs after new log files are added
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
export function clearStoredWebdata(connection) {
    if (!testing) {
        let query = "SELECT * FROM webdata WHERE name = 'segmentation' ";
        let segmentation = '';
        connection.runSql(query).then(function (result) {
            segmentation = result[0]['object']['type'];

            let segmentMap = {'none': ['none'],
                'ab': ['none', 'A', 'B'],
                'abc': ['none', 'A', 'B', 'C']};

            for (let segment of segmentMap[segmentation]) {
                connection.runSql("DELETE FROM webdata WHERE name = 'graphElements_" + segment + "'");
                connection.runSql("DELETE FROM webdata WHERE name = 'databaseDetails_" + segment + "'");
                connection.runSql("DELETE FROM webdata WHERE name = 'mainIndicators_" + segment + "'");
                connection.runSql("DELETE FROM webdata WHERE name = 'arcElements_" + segment + "'");
                connection.runSql("DELETE FROM webdata WHERE name = 'cycleElements_" + segment + "'");
                connection.runSql("DELETE FROM webdata WHERE name = 'dropoutElements_" + segment + "'");
            }
        });
    }
}

/**
 * Deletes the processed Webdata used for dashboard tables only, when metadata is updated
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
export function clearDashboardTablesWebdata(connection){
    loader(true);
    let query = "SELECT * FROM webdata WHERE name = 'segmentation' ";
    let segmentation = 'none';
    let segmentMap = {
        'none': ['none'],
        'ab': ['none', 'A', 'B'],
        'abc': ['none', 'A', 'B', 'C']
    };
    connection.runSql("DELETE FROM webdata WHERE name = 'segmentation'");
    connection.runSql(query).then(function (result) {
        if (result.length === 1) {
            segmentation = result[0]['object']['type'];
            for (let segment of segmentMap[segmentation]) {
                connection.runSql("DELETE FROM webdata WHERE name = 'courseDetails_" + segment + "'");
                connection.runSql("DELETE FROM webdata WHERE name = 'mainIndicators_" + segment + "'");
                connection.runSql("DELETE FROM webdata WHERE name = 'databaseDetails_" + segment + "'").then(function () {
                    loader(false);
                    toastr.success('Please reload the page now', 'Updating Indicators and Charts', {timeOut: 0})
                });
            }
        }
    });
}

/**
 * Deletes the processed Webdata used for dashboard tables and graphs, executed by the user via button
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
export function clearWebdataForUpdate(connection) {
    loader(true);
    let query = "SELECT * FROM webdata WHERE name = 'segmentation' ";
    let segmentation = '';
    let segmentMap = {
        'none': ['none'],
        'ab': ['none', 'A', 'B'],
        'abc': ['none', 'A', 'B', 'C']
    };
    connection.runSql(query).then(function (result) {
        segmentation = result[0]['object']['type'];
        for (let segment of segmentMap[segmentation]) {
            connection.runSql("DELETE FROM webdata WHERE name = 'courseDetails_" + segment + "'");
            connection.runSql("DELETE FROM webdata WHERE name = 'mainIndicators_" + segment + "'");
            connection.runSql("DELETE FROM webdata WHERE name = 'databaseDetails_" + segment + "'");
            connection.runSql("DELETE FROM webdata WHERE name = 'arcElements_" + segment + "'");
            connection.runSql("DELETE FROM webdata WHERE name = 'cycleElements_" + segment + "'");
            connection.runSql("DELETE FROM webdata WHERE name = 'databaseDetails_" + segment + "'");
            connection.runSql("DELETE FROM webdata WHERE name = 'dropoutElements_" + segment + "'");
            connection.runSql("DELETE FROM webdata WHERE name = 'graphElements_" + segment + "'").then(function () {
                loader(false);
                toastr.success('Please reload the page now', 'Updating Indicators and Charts', {timeOut: 0})
            });
        }
    })
}

/**
 * Deletes all tables, and then the full database
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 * @returns {Promise<void>}
 */
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
        await connection.clear('video_interactions').then(function () {
            console.log('Cleared video_interactions table');
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

        localStorage.clear();

        let DBDeleteRequest  = window.indexedDB.deleteDatabase('edxdb');
        DBDeleteRequest.onerror = function(event) {
            loader(false);
            alert('The deletion process started but did not finish,\n please refresh and try again');
            console.log(event.result); // should be undefined
        };
        DBDeleteRequest.onsuccess = function(event) {
            loader(false);
            toastr.success('Database has been deleted!');
            console.log(event.result); // should be undefined
        };

        // await connection.dropDb().then(function () {
        //     toastr.success('Database has been deleted!');
        //     loader(false);
        //     return true
        // }).catch(function (err) {
        //     console.log(err);
        //     alert('The deletion process started but did not finish,\n please refresh and try again');
        //     loader(false);
        // });
    }
}

/**
 * Processes the data from a table to be downloaded, converting from the IndexedDB key-value format to a csv
 * @param {string} tablename Name of the table to be downloaded
 * @param {array} headers Headers of the table
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
export function processTablesForDownload(tablename, connection) {
    let schemaMap = {
        'sessions': ['session_id', 'course_learner_id', 'start_time', 'end_time', 'duration'],
        'forum_sessions': ['session_id', 'course_learner_id', 'times_search', 'start_time',
            'end_time', 'duration', 'relevent_element_id'],
        'video_interactions': ['interaction_id', 'course_learner_id', 'video_id', 'duration',
            'times_forward_seek', 'duration_forward_seek', 'times_backward_seek', 'duration_backward_seek',
            'times_speed_up', 'times_speed_down', 'times_pause', 'duration_pause', 'start_time', 'end_time'],
        'submissions': ['submission_id', 'course_learner_id', 'question_id', 'submission_timestamp'],
        'assessments': ['assessment_id', 'course_learner_id', 'max_grade', 'grade'],
        'quiz_sessions': ['session_id', 'course_learner_id', 'start_time', 'end_time', 'duration'],
        'forum_interaction': ['post_id', 'course_learner_id', 'post_type', 'post_title', 'post_content',
            'post_timestamp', 'post_parent_id', 'post_thread_id'],
        'course_learner': ['course_learner_id', 'final_grade', 'enrollment_mode', 'certificate_status',
            'register_time', 'group_type', 'group_name', 'segment'],
        'learner_demographic': ['course_learner_id', 'gender', 'year_of_birth', 'level_of_education',
            'country', 'email','segment']
    };

    let headers = schemaMap[tablename];

    connection.runSql('select * from courses').then(function (courses) {
        courses.forEach(function(course){
            const course_id = course.course_id;
            let total_count = 0,
                counter = 0;
            if (tablename === 'all') {
                for (let table in schemaMap) {
                    processTablesForDownload(table, connection);
                }
            } else if (tablename === 'metadata') {
                for (let table of ['course_learner', 'learner_demographic']) {
                    processTablesForDownload(table, connection);
                }
            } else {
                connection.runSql("COUNT * FROM " + tablename).then(function (count) {
                    total_count = count;
                });
                connection.runSql("SELECT * FROM " + tablename).then(function (sessions) {
                    let data = [headers];
                    sessions.forEach(function (session) {
                        counter++;
                        if (session['course_learner_id'].includes(course_id)) {
                            let array = [];
                            for (let key in session) {
                                array.push(session[key]);
                            }
                            data.push(array)
                        }
                        if (counter === total_count) {
                            downloadCsv(tablename + '_' + course_id + '.csv', data);
                        }
                    });
                });
            }
        });
    })
}

/**
 * Generates the schema for the edX database
 * @returns {string} SQL-style query to be processed by the SqlWeb library
 */
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
        register_time date_time,
        group_type STRING,
        group_name STRING,
        segment STRING
        )
    `;

    let demographic = `DEFINE TABLE learner_demographic (
        course_learner_id PRIMARYKEY STRING,
        gender STRING,
        year_of_birth NUMBER,
        level_of_education STRING,
        country STRING,
        email STRING,
        segment STRING
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

    let video_interaction = `DEFINE TABLE video_interactions (
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

    let ora_sessions = `DEFINE TABLE ora_sessions (
        session_id PRIMARYKEY STRING,
        course_learner_id NOTNULL STRING,
        times_save NUMBER,
        times_peer_assess NUMBER,
        submitted BOOLEAN,
        self_assessed BOOLEAN,
        start_time date_time,
        end_time date_time,
        duration NUMBER,
        assessment_id STRING
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
        forum_interaction + forum_sessions + survey_descriptions + survey_responses + webdata + ora_sessions)
        ;
}

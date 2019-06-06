// let connection = new JsStore.Instance(new Worker('scripts/jsstore.worker.js'));
let connection = new JsStore.Instance();

// let define function (require) {
//     pako = require('pako');
// };

window.onload = function () {

    //// PAGE INITIALIZATION  //////////////////////////////////////////////////////////////////////////////
    initiateEdxDb();
    getGraphElementMap(drawCharts);
    drawVideoArc();
    //// MULTI FILE SYSTEM  ///////////////////////////////////////////////////////////////////////////
    let  multiFileInput = document.getElementById('filesInput');
    multiFileInput.value = '';
    multiFileInput.addEventListener('change', function () {
        $('#loading').show();
        $.blockUI();
        let files = multiFileInput.files;
        readMetaFiles(files, passFiles);
    });

    let  multiFileInputLogs = document.getElementById('logFilesInput');
    multiFileInputLogs.value = '';
    multiFileInputLogs.addEventListener('change', function () {
        $('#loading').show();
        $.blockUI();
        processLogFiles(0, 0)
    });

    let pairs = {'sessions': ['session_id', 'course_learner_id', 'start_time', 'end_time', 'duration'],
                 'forum_sessions': ['session_id', 'course_learner_id', 'times_search', 'start_time',
                      'end_time', 'duration', 'relevent_element_id'],
                 'video_interaction':['interaction_id', 'course_learner_id', 'video_id','duration',
                     'times_forward_seek','duration_forward_seek','times_backward_seek','duration_backward_seek',
                     'times_speed_up','times_speed_down','times_pause','duration_pause','start_time','end_time'],
                 'submissions': ['submission_id', 'course_learner_id', 'question_id', 'submission_timestamp'],
                 'assessments': ['assessment_id', 'course_learner_id', 'max_grade', 'grade'],
                 'quiz_sessions': ['session_id', 'course_learner_id', 'start_time', 'end_time', 'duration']};

    let dlAllButton = document.getElementById('dl_all');
    dlAllButton.addEventListener('click', function() {
        for (let table in pairs){
            processSessions(table, pairs[table]);
        }
    });

    let dlSessionButton = document.getElementById('dl_sessions');
    dlSessionButton.addEventListener('click', function() {
        processSessions('sessions', pairs['sessions']);
    });

    let dlForumSesButton = document.getElementById('dl_forum');
    dlForumSesButton.addEventListener('click', function() {
        processSessions('forum_sessions', pairs['forum_sessions']);
    });

    let dlVidButton = document.getElementById('dl_vid_sessions');
    dlVidButton.addEventListener('click', function() {
        processSessions('video_interaction', pairs['video_interaction']);
    });

    let dlSubButton = document.getElementById('dl_submissions');
    dlSubButton.addEventListener('click', function() {
        processSessions('submissions', pairs['submissions']);
    });

    let dlAssButton = document.getElementById('dl_assessments');
    dlAssButton.addEventListener('click', function() {
        processSessions('assessments', pairs['assessments']);
    });

    let dlQuizButton = document.getElementById('dl_quiz');
    dlQuizButton.addEventListener('click', function() {
        processSessions('quiz_sessions', pairs['quiz_sessions']);
    });
};

let reader = new FileReader();

function readMetaFiles(files, callback){
    let output = [];
    let checkedFiles = {};
    let processedFiles = [];
    let fileNames = 'Names: ';
    let counter = 1;
    let sqlType = 'sql';
    let jsonType = 'json';
    let mongoType = 'mongo';

    for (const f of files) {
        output.push('<li><strong>', f.name, '</strong> (', f.type || 'n/a', ') - ',
            f.size, ' bytes', '</li>');

        if (f.name.includes('zip')) {
            $('#loading').hide();
            $.unblockUI();
            toastr.error('Metadata files cannot be zipped!');
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

let chunk_size = 750 * 1024 * 1024;

function processLogFiles(index, chunk){
    let  multiFileInputLogs = document.getElementById('logFilesInput');
    let files = multiFileInputLogs.files;
    let counter = 0;
    let total = files.length;
    for (const f of files) {
        if (counter === index){
            let today = new Date();
            console.log('Starting with file ' + index + ' at ' + today);
            readAndPassLog(f, reader, index, total, chunk, passLogFiles)
        }
        counter += 1;
    }
}


function readAndPassLog(f, reader, index, total, chunk, callback){
    let output = [];
    let processedFiles = [];
    let gzipType = /gzip/;
    let total_chunks = 1;
    output.push('<li><strong>', f.name, '</strong> (', f.type || 'n/a', ') - ',
                f.size, ' bytes', '</li>');

    if (f.type.match(gzipType)) {

        reader.onload = function (event) {
            let content = pako.inflate(event.target.result, {to: 'array'});
            let string_content = new TextDecoder("utf-8").decode(content.slice(chunk * chunk_size, (chunk + 1) * chunk_size));
            processedFiles.push({
                key: f.name,
                value: string_content.slice(string_content.indexOf('{"username":'),
                                            string_content.lastIndexOf('\n{'))
            });
            if (string_content.lastIndexOf('\n') + 2 < string_content.length ){
                total_chunks++;
            }
            callback([processedFiles, output, index, total, chunk, total_chunks]);
            reader.abort();
        };
        reader.readAsArrayBuffer(f);
    } else {
        $('#loading').hide();
        $.unblockUI();
        toastr.error(f.name + ' is not a log file (should end with: .log.gz)');
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////

function passFiles(result){
    let names = result[0];
    let output = result[1];
    document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
    $('#loading').hide();
    $.unblockUI();
    learner_mode(names);
}

function passLogFiles(result){
    let files = result[0];
    let output = result[1];
    let index = result[2];
    let total = result[3];
    let chunk = result[4];
    let total_chunks = result[5];
    // let list = document.getElementById('listLogs').innerHTML;
    // document.getElementById('listLogs').innerHTML = list +'<ul>' + output.join('') + '</ul>';
    connection.runSql("SELECT * FROM metadata WHERE name = 'metadata_map' ").then(function(result) {
        if (result.length > 0) {
            let course_metadata_map = result[0]['object'];
            if (chunk === 0) {
                let table = document.getElementById("progress_tab");
                let row = table.insertRow();
                let cell1 = row.insertCell();
                cell1.innerHTML = ('Processing file ' + (index + 1) + '/' + total +
                    '\n at ' + new Date().toLocaleString('en-GB'));
            }

            // weirdDateFinder(course_metadata_map, files, index, total, chunk, total_chunks)

            session_mode(course_metadata_map, files, index, total, chunk);
            forum_sessions(course_metadata_map, files, index, total, chunk);
            video_interaction(course_metadata_map, files, index, total, chunk);
            quiz_mode(course_metadata_map, files, index, total, chunk);
            quiz_sessions(course_metadata_map, files, index, total, chunk, total_chunks);
        } else {
            $('#loading').hide();
            $.unblockUI();
            toastr.error('Metadata has not been processed! Please upload all metadata files first');
        }
    });
}


function sqlInsert(table, data) {
    if (!(['forum_interaction', 'webdata'].includes(table))){
        connection.runSql('DELETE FROM ' + table);
    }
    let query = new SqlWeb.Query("INSERT INTO " + table + " values='@val'");
    for (let v of data) {
        for (let field of Object.keys(v)) {
            if (field.includes('time')){
                let date = v[field];
                v[field] = new Date(date);
            }
        }
    }
    query.map("@val", data);
    connection.runSql(query).then(function (rowsAdded) {
        if (rowsAdded > 0 && table !== 'forum_interaction') {
            let today = new Date();
            let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();
            console.log('Successfully added to' , table, ' at ', time);
            if (table === 'metadata'){
                $('#loading').hide();
                $.unblockUI();
                toastr.success('Please reload the page now', 'Metadata ready', {timeOut: 0})
            }
            if (table === 'webdata'){
                $('#loading').hide();
                $.unblockUI();
            }
        }
    }).catch(function (err) {
        console.log(err);
    });
}


function sqlLogInsert(table, data) {
    // console.log('Not saving ', data.length, ' for ', table);

    let query = new SqlWeb.Query("INSERT INTO " + table + " values='@val'");
    for (let v of data) {
        for (let field of Object.keys(v)) {
            if (field.includes('_time')){
                let date = v[field];
                v[field] = new Date(date);
            }
        }
    }
    query.map("@val", data);
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


function download(filename, content) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}


function downloadCsv(filename, content) {
    let a = document.createElement('a');
    let joinedContent = content.map(e=>e.join(",")).join("\n");
    let t = new Blob([joinedContent], {type : 'application/csv'});
    a.href = URL.createObjectURL(t);
    a.download = filename;
    a.click();
}


function progress_display(content, index){
    let table = document.getElementById("progress_tab");
    let row = table.rows[index];
    let cell1 = row.insertCell();
    cell1.innerHTML = '  ' + content + '  ';
}

////////////////////////////////////////////////////////////////////////////////////////////////
// DATABASE FUNCTIONS
function initiateEdxDb() {
    let dbName = "edxdb";
    connection.runSql('ISDBEXIST ' + dbName).then(function (isExist) {
        if (isExist) {
            connection.runSql('OPENDB ' + dbName).then(function () {
                console.log('edx db ready');
                $('#loading').hide();
                $.unblockUI();
                toastr.success('Database ready', 'ELAT',  {timeOut: 1500});
                showCoursesTableDataExtra();
                showSessionTable();
                showMainIndicators();
            });
        } else {
            console.log('Generating edx database');
            toastr.info('Welcome! If this is your first time here, visit ELAT Home for more info', 'ELAT',  {timeOut: 7000});
            let dbQuery = getEdxDbQuery();
            connection.runSql(dbQuery).then(function (tables) {
                console.log(tables);
                toastr.success('Database generated, please reload the page', 'ELAT',  {timeOut: 5000});
                $('#loading').hide();
                $.unblockUI();
            });
        }
    }).catch(function (err) {
        console.log(err);
        alert(err.message);
    });
}


function showCoursesTableDataExtra() {
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
                let options = {weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'};
                courses.forEach(function (course) {
                    HtmlString += "<tr ItemId=" + course.course_id + "><td>" +
                        course.course_name + "</td><td>" +
                        course.start_time.toLocaleDateString('en-EN', options) + "</td><td>" +
                        course.end_time.toLocaleDateString('en-EN', options) + "</td><td>";
                    let query = "count from course_elements where course_id = '" + course.course_id + "'";
                    connection.runSql(query).then(function (result) {
                        HtmlString += result + "</td><td>";
                        let query = "count from learner_index where course_id = '" + course.course_id + "'";
                        connection.runSql(query).then(function (result) {
                            HtmlString += result + "</td><td>";
                            let query = "SELECT * FROM quiz_questions";
                            connection.runSql(query).then(function (results) {
                                results.forEach(function (result) {
                                    if (result['question_id'].includes(course.course_id.slice(10,))) {
                                        questionCounter++;
                                    }
                                });
                                HtmlString += questionCounter + "</td><td>";
                                query = "SELECT * FROM forum_interaction";
                                connection.runSql(query).then(function (sessions) {
                                    sessions.forEach(function (session) {
                                        if (session['course_learner_id'].includes(course.course_id)) {
                                            forumInteractionCounter++;
                                        }
                                    });
                                    HtmlString += forumInteractionCounter;
                                    $('#tblGrid tbody').html(HtmlString);
                                    let courseDetails = [{'name': 'courseDetails', 'object': {'details': HtmlString}}];
                                    sqlInsert('webdata', courseDetails);
                                })
                            })
                        })
                    })
                });
            }).catch(function (error) {
                console.log(error);
                $('#loading').hide();
                $.unblockUI();
            });
        }
    })
}


function showSessionTable() {
    let HtmlString = "";
    let totalHtmlString = "";
    connection.runSql("SELECT * FROM webdata WHERE name = 'databaseDetails' ").then(function(result) {
        if (result.length === 1) {
            HtmlString = result[0]['object']['details'];
            document.getElementById("loading").style.display = "none";
            $('#dbGrid tbody').html(HtmlString);
        } else {
            connection.runSql('select * from courses').then(function (courses) {
                courses.forEach(function (course) {
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
                    connection.runSql(query).then(function (sessions) {
                        sessions.forEach(function (session) {
                            tsessionCounter++;
                            if (session['course_learner_id'].includes(course.course_id)) {
                                sessionCounter++;
                            }
                        });
                        query = "SELECT * FROM forum_sessions";
                        connection.runSql(query).then(function (sessions) {
                            sessions.forEach(function (session) {
                                tforumSessionCounter++;
                                if (session['course_learner_id'].includes(course.course_id)) {
                                    forumSessionCounter++;
                                }
                            });
                            query = "SELECT * FROM video_interaction";
                            connection.runSql(query).then(function (sessions) {
                                sessions.forEach(function (session) {
                                    tvideoInteractionCounter++;
                                    if (session['course_learner_id'].includes(course.course_id)) {
                                        videoInteractionCounter++;
                                    }
                                });
                                query = "SELECT * FROM submissions";
                                connection.runSql(query).then(function (sessions) {
                                    sessions.forEach(function (session) {
                                        tsubmissionCounter++;
                                        if (session['course_learner_id'].includes(course.course_id)) {
                                            submissionCounter++;
                                        }
                                    });
                                    query = "SELECT * FROM assessments";
                                    connection.runSql(query).then(function (sessions) {
                                        sessions.forEach(function (session) {
                                            tassessmentCounter++;
                                            if (session['course_learner_id'].includes(course.course_id)) {
                                                assessmentCounter++;
                                            }
                                        });
                                        query = "SELECT * FROM quiz_sessions";
                                        connection.runSql(query).then(function (sessions) {
                                            sessions.forEach(function (session) {
                                                tquizSessionCounter++;
                                                if (session['course_learner_id'].includes(course.course_id)) {
                                                    quizSessionCounter++;
                                                }
                                            });
                                            totalHtmlString += tsessionCounter + "</td><td>" +
                                                tforumSessionCounter + "</td><td>" +
                                                tvideoInteractionCounter + "</td><td>" +
                                                tsubmissionCounter + "</td><td>" +
                                                tassessmentCounter + "</td><td>" +
                                                tquizSessionCounter;
                                            HtmlString += sessionCounter + "</td><td>" +
                                                forumSessionCounter + "</td><td>" +
                                                videoInteractionCounter + "</td><td>" +
                                                submissionCounter + "</td><td>" +
                                                assessmentCounter + "</td><td>" +
                                                quizSessionCounter;
                                            document.getElementById("loading").style.display = "none";
                                            $('#dbGrid tbody').html(HtmlString);
                                            let databaseDetails = [{'name': 'databaseDetails', 'object': {'details':HtmlString}}];
                                            sqlInsert('webdata', databaseDetails);
                                        });
                                    });
                                });
                            });
                        });
                    })
                });
            }).catch(function (error) {
                console.log(error);
            });
        }
    })
}


function showMainIndicators() {
    let HtmlString = "";
    connection.runSql("SELECT * FROM webdata WHERE name = 'mainIndicators' ").then(function(result) {
        if (result.length === 1) {
            HtmlString = result[0]['object']['details'];
            $('#indicatorGrid tbody').html(HtmlString);
        } else {
            connection.runSql('select * from courses').then(function (courses) {
                courses.forEach(function (course) {
                    let course_id = course.course_id;
                    HtmlString += "<tr ItemId=" + course.course_id + "><td>";
                    connection.runSql("COUNT * from course_learner WHERE certificate_status = 'downloadable' ").then(function (result) {
                        let completed = result;

                        connection.runSql("COUNT * from learner_index").then(function (result) {
                            let completionRate = completed/result;

                            connection.runSql("SELECT [avg(final_grade)] from course_learner WHERE certificate_status = 'downloadable' ").then(function (result) {
                                let avgGrade = result[0]['avg(final_grade)'];

                                connection.runSql("COUNT * from course_learner WHERE enrollment_mode = 'verified' ").then(function (result) {
                                    let verifiedLearners = result;

                                    connection.runSql("COUNT * from course_learner WHERE enrollment_mode = 'honor' ").then(function (result) {
                                        let honorLearners = result;

                                        connection.runSql("COUNT * from course_learner WHERE enrollment_mode = 'audit' ").then(function (result) {
                                            let auditLearners = result;

                                            connection.runSql("SELECT [avg(final_grade)] from course_learner WHERE certificate_status = 'downloadable' GROUP BY enrollment_mode").then(function (results) {
                                                let avgGrades = {};
                                                results.forEach(function (result) {
                                                    avgGrades[result.enrollment_mode] =result.final_grade;
                                                });

                                                connection.runSql("SELECT [sum(duration)] from video_interaction GROUP BY course_learner_id").then(function (watchers) {
                                                    let videoWatchers = watchers.length;
                                                    let videoDuration = 0;
                                                    watchers.forEach(function (watcher) {
                                                        videoDuration += watcher['sum(duration)'];
                                                    });

                                                    let avgDuration = videoDuration / videoWatchers;

                                                    HtmlString += completionRate.toFixed(2)  + "</td><td>" +
                                                        avgGrade.toFixed(2)  + "</td><td>" +
                                                            "Verified: " + verifiedLearners + "<br>" +
                                                            "Honor: " + honorLearners + "<br>" +
                                                            "Audit: " + auditLearners + "<br>" +
                                                        "</td><td>" +
                                                            "Verified: " + avgGrades['verified'] + "<br>" +
                                                            "Honor: " + avgGrades['honor'] + "<br>" +
                                                            "Audit: " + avgGrades['audit'] + "<br>" +
                                                        "</td><td>" +
                                                        (avgDuration/60).toFixed(2) + " minutes" + "</td><td>" +
                                                        videoWatchers;

                                                    $('#indicatorGrid tbody').html(HtmlString);
                                                    let indicators = [{'name': 'mainIndicators', 'object': {'details': HtmlString}}];
                                                    sqlInsert('webdata', indicators);
                                                })

                                                // let joinLogic = {
                                                //     table1: {
                                                //         table: 'quiz_questions',
                                                //         column: 'question_id'
                                                //     },
                                                //     join: 'inner',
                                                //     table2: {
                                                //         table: 'submissions',
                                                //         column: 'question_id'
                                                //     }
                                                // };
                                                // connection.select({
                                                //     from: joinLogic
                                                // }).then(function (results) {
                                                //     results.forEach(function (row) {
                                                //         console.log(row)
                                                //     })
                                                // }).catch(function (error) {
                                                //     alert(error.message);
                                                // });

                                            })
                                        })
                                    })
                                })
                            })
                        })
                    });
                });
            }).catch(function (error) {
                console.log(error);
                $('#loading').hide();
                $.unblockUI();
            });
        }
    })
}

// METADATA MODULES ////////////////////////////////////////////////////////////////////
function ExtractCourseInformation(files) {
    let course_metadata_map = {};
    for (let file of files) {
        let file_name = file['key'];
        if (file_name.includes('course_structure')) {
            let child_parent_map = {};
            let element_time_map = {};

            let element_time_map_due = {};
            let element_type_map = {};
            let element_without_time = [];

            let quiz_question_map = {};
            let block_type_map = {};

            let order_map = {};
            let element_name_map = {};

            let jsonObject = JSON.parse(file['value']);
            for (let record in jsonObject) {
                if (jsonObject[record]['category'] === 'course') {
                    let course_id = record;
                    if (course_id.startsWith('block-')) {
                        course_id = course_id.replace('block-', 'course-');
                        course_id = course_id.replace('+type@course+block@course', '');
                    }
                    if (course_id.startsWith('i4x://')) {
                        course_id = course_id.replace('i4x://', '');
                        course_id = course_id.replace('course/', '');
                    }
                    course_metadata_map['course_id'] = course_id;
                    course_metadata_map['course_name'] = jsonObject[record]['metadata']['display_name'];

                    course_metadata_map['start_date'] = new Date(jsonObject[record]['metadata']['start']);
                    course_metadata_map['end_date'] = new Date(jsonObject[record]['metadata']['end']);

                    course_metadata_map['start_time'] = new Date(course_metadata_map['start_date']);
                    course_metadata_map['end_time'] = new Date(course_metadata_map['end_date']);

                    let i = 0; // Feature Testing

                    for (let child of jsonObject[record]['children']) {
                        i++;
                        child_parent_map[child] = record;
                        order_map[child] = i; // Feature Testing
                    }
                    element_time_map[record] = new Date(jsonObject[record]['metadata']['start']);
                    element_type_map[record] = jsonObject[record]['category'];
                } else {
                    let element_id = record;
                    element_name_map[element_id] = jsonObject[element_id]['metadata']['display_name'];
                    let i = 0; // Feature Testing

                    for (let child of jsonObject[element_id]['children']) {
                        i++;
                        child_parent_map[child] = element_id;
                        order_map[child] = i; // Feature Testing
                    }

                    if ('start' in jsonObject[element_id]['metadata']) {
                        element_time_map[element_id] = new Date(jsonObject[element_id]['metadata']['start']);
                    } else {
                        element_without_time.push(element_id);
                    }

                    if ('due' in jsonObject[element_id]['metadata']) {
                        element_time_map_due[element_id] = new Date(jsonObject[element_id]['metadata']['due']);
                    }

                    element_type_map[element_id] = jsonObject[element_id]['category'];
                    if (jsonObject[element_id]['category'] === 'problem') {
                        if ('weight' in jsonObject[element_id]['metadata']) {
                            quiz_question_map[element_id] = jsonObject[element_id]['metadata']['weight'];
                        } else {
                            quiz_question_map[element_id] = 1.0;
                        }
                    }
                    if (jsonObject[element_id]['category'] === 'sequential') {
                        if ('display_name' in jsonObject[element_id]['metadata']) {
                            block_type_map[element_id] = jsonObject[element_id]['metadata']['display_name'];
                        }
                    }
                }
            }
            for (let element_id of element_without_time) {
                let element_start_time = '';
                while (element_start_time === '') {
                    let element_parent = child_parent_map[element_id];
                    while (!(element_time_map.hasOwnProperty(element_parent))) {
                        element_parent = child_parent_map[element_parent];
                    }
                    element_start_time = element_time_map[element_parent];
                }
                element_time_map[element_id] = element_start_time;
            }
            course_metadata_map['element_time_map'] = element_time_map;
            course_metadata_map['element_time_map_due'] = element_time_map_due;
            course_metadata_map['element_type_map'] = element_type_map;
            course_metadata_map['quiz_question_map'] = quiz_question_map;
            course_metadata_map['child_parent_map'] = child_parent_map;
            course_metadata_map['block_type_map'] = block_type_map;
            course_metadata_map['order_map'] = order_map;
            course_metadata_map['element_name_map'] = element_name_map;
            console.log('Metadata map ready');
            return course_metadata_map;
        }
    }
}


function learner_mode(files) {
    $('#loading').show();
    $.blockUI();
    let course_record = [];
    let course_element_record = [];
    let learner_index_record = [];
    let course_learner_record = [];
    let learner_demographic_record = [];
    let course_metadata_map = ExtractCourseInformation(files);

    if (Object.keys(course_metadata_map).length > 1) {
        course_record.push([course_metadata_map['course_id'], course_metadata_map['course_name'], course_metadata_map['start_time'], course_metadata_map['end_time']]);
        for (let element_id in course_metadata_map['element_time_map']) {
            let element_start_time = new Date(course_metadata_map['element_time_map'][element_id]);
            let week = getDayDiff(course_metadata_map['start_time'], element_start_time) / 7 + 1;
            let array = [element_id, course_metadata_map['element_type_map'][element_id], week, course_metadata_map['course_id']];
            course_element_record.push(array);
        }
        console.log('Finished processing ' + course_element_record.length + ' elements in metadata map');
        let learner_mail_map = {};
        let course_learner_map = {};
        let learner_enrollment_time_map = {};
        let enrolled_learner_set = new Set();
        let course_id = '';
        for (let file of files) {
            let file_name = file['key'];
            if (file_name.includes('student_courseenrollment')){
                let input_file = file['value'];
                let lines = input_file.split('\n');
                for (let line of lines.slice(1, )) {
                    let record = line.split('\t');
                    if (record.length < 2) { continue; }
                    let global_learner_id = record[1];
                    course_id = record[2];
                    let time = new Date(record[3]);
                    let course_learner_id = course_id + '_' + global_learner_id;
                    if (cmp_datetime(course_metadata_map['end_time'], new Date(time)) === 1) {
                        enrolled_learner_set.add(global_learner_id);
                        let array = [global_learner_id, course_id, course_learner_id];
                        learner_index_record.push(array);
                        course_learner_map[global_learner_id] = course_learner_id;
                        learner_enrollment_time_map[global_learner_id] = time;
                    }
                }
            }
        }
        for (let file of files) {
            let file_name = file['key'];
            if (file_name.includes('auth_user-')) {
                let input_file = file['value'];
                let lines = input_file.split('\n');
                for (let line of lines) {
                    let record = line.split('\t');
                    if (enrolled_learner_set.has(record[0])) {
                        learner_mail_map[record[0]] = record[4];
                    }
                }
            }
        }
        for (let file of files) {
            let file_name = file['key'];
            let num_uncertifiedLearners = 0;
            let num_certifiedLearners = 0;
            if (file_name.includes('certificates_generatedcertificate')) {
                let input_file = file['value'];
                let lines = input_file.split('\n');
                for (let line of lines) {
                    let record = line.split('\t');
                    if (record.length < 10) { continue; }
                    let global_learner_id = record[1];
                    let final_grade = record[3];
                    let enrollment_mode = record[14].replace(/\n/g, '');
                    let certificate_status = record[7];
                    let register_time = '';
                    if (global_learner_id in course_learner_map) {
                        register_time = learner_enrollment_time_map[global_learner_id];
                    }
                    if (global_learner_id in course_learner_map) {
                        num_certifiedLearners++;
                        let array = [course_learner_map[global_learner_id], final_grade, enrollment_mode, certificate_status, register_time];
                        course_learner_record.push(array);
                    }
                    else {
                        num_uncertifiedLearners++;
                    }
                }
            }
        }
        for (let file of files) {
            let file_name = file['key'];
            if (file_name.includes('auth_userprofile')) {
                let input_file = file['value'];
                let lines = input_file.split('\n');
                for (let line of lines) {
                    let record = line.split('\t');
                    if (record.length < 10) { continue; }
                    let global_learner_id = record[1];
                    let gender = record[7];
                    let year_of_birth = record[9];
                    let level_of_education = record[10];
                    let country = record[13];
                    let course_learner_id = course_id + '_' + global_learner_id;
                    if (enrolled_learner_set.has(global_learner_id)) {
                        let array = [course_learner_id, gender, year_of_birth, level_of_education, country, learner_mail_map[global_learner_id]];
                        learner_demographic_record.push(array);
                    }
                }
            }
        }

        let forum_interaction_records = [];
        for (let file of files) {
            let file_name = file['key'];
            if (file_name.includes(".mongo")) {
                forum_interaction_records = forum_interaction(file['value'], course_metadata_map);
            }
        }

        console.log('All metadata ready');
        if (course_record.length > 0) {
            let data = [];
            for (let array of course_record) {
                let course_id = course_metadata_map['course_id'];
                let course_name = course_metadata_map['course_name'];
                let start_time = course_metadata_map['start_time'];
                let end_time = course_metadata_map['end_time'];
                let py_values = {'course_id': course_id, 'course_name': course_name,
                    'start_time': start_time, 'end_time': end_time};
                data.push(py_values);
            }
            sqlInsert('courses', data);
        } else {
            console.log('no courses info');
        }
        if (course_element_record.length > 0) {
            let data = [];
            for (let array of course_element_record) {
                let element_id = array[0];
                let element_type = array[1];
                let week = process_null(array[2]);
                let course_id = array[3];
                let py_values = {'element_id': element_id, 'element_type': element_type,
                    'week': week, 'course_id': course_id};
                data.push(py_values);
            }
            sqlInsert ('course_elements', data);
        }
        else {
            console.log('no course element info');
        }
        if (learner_index_record.length > 0) {
            let data = [];
            for (let array of learner_index_record) {
                let global_learner_id = array[0];
                let course_id = array[1];
                let course_learner_id = array[2];
                let py_values = {'global_learner_id': global_learner_id.toString(), 'course_id': course_id,
                    'course_learner_id': course_learner_id};
                data.push(py_values);
            }
            sqlInsert ('learner_index', data);
        }
        else {
            console.log('no learner index info');
        }
        if (course_learner_record.length > 0) {
            let data = [];
            for (let array of course_learner_record) {
                let course_learner_id = array[0];
                let final_grade = parseFloat(process_null(array[1]));
                let enrollment_mode = array[2];
                let certificate_status = array[3];
                let register_time = new Date(process_null(array[4]));
                let py_values = {'course_learner_id': course_learner_id, 'final_grade': final_grade,
                    'enrollment_mode': enrollment_mode, 'certificate_status': certificate_status,
                    'register_time': register_time};
                data.push(py_values);
            }
            sqlInsert('course_learner', data);
        }
        else {
            console.log('no enrolled students info');
        }
        if (learner_demographic_record.length > 0) {
            let data = [];
            for (let array of learner_demographic_record) {
                let course_learner_id = process_null(array[0]);
                let gender = array[1];
                let year_of_birth = parseInt(process_null(array[2]));
                let level_of_education = array[3];
                let country = array[4];
                let email = array[5];
                email = email.replace(/"/g, '');
                let py_values = {'course_learner_id': course_learner_id, 'gender': gender, 'year_of_birth': year_of_birth,
                    'level_of_education': level_of_education, 'country': country, 'email': email};
                data.push(py_values);
            }
            sqlInsert('learner_demographic', data);
        }
        else {
            console.log('no learner demographic info');
        }
        if (forum_interaction_records.length > 0){
            let data = [];
            for (let array of forum_interaction_records) {
                let post_id = process_null(array[0]);
                let course_learner_id = array[1];
                let post_type = array[2];
                let post_title = cleanUnicode(array[3]);
                let post_content = cleanUnicode(array[4]);
                let post_timestamp = array[5];
                let post_parent_id = array[6];
                let post_thread_id = array[7];

                let py_values = {"post_id": post_id, "course_learner_id": course_learner_id, "post_type": post_type,
                    "post_title": post_title, "post_content": post_content, "post_timestamp":post_timestamp,
                    "post_parent_id": post_parent_id, "post_thread_id":post_thread_id};

                data.push(py_values);
            }

            connection.runSql('DELETE FROM forum_interaction');
            for (let array of data){
                try {
                    sqlInsert('forum_interaction', [array])
                } catch(error) {
                    console.log(array)
                }
            }
        } else {
            console.log('no forum interaction records')
        }

        let quiz_question_map = course_metadata_map['quiz_question_map']; //object
        let block_type_map = course_metadata_map['block_type_map']; //object
        let element_time_map_due = course_metadata_map['element_time_map_due']; //object
        let data = [];
        for (let question_id in quiz_question_map) {
            let question_due = '';
            let question_weight = quiz_question_map[question_id];
            let quiz_question_parent = course_metadata_map['child_parent_map'][question_id];
            if (question_due === '' && quiz_question_parent in element_time_map_due) {
                question_due = element_time_map_due[quiz_question_parent];
            }
            while (!(quiz_question_parent in block_type_map)) {
                quiz_question_parent = course_metadata_map['child_parent_map'][quiz_question_parent];
                if (question_due === '' && quiz_question_parent in element_time_map_due) {
                    question_due = element_time_map_due [quiz_question_parent];
                }
            }
            let quiz_question_type = block_type_map[quiz_question_parent];
            question_due = process_null(question_due);
            let values = {'question_id':question_id, 'question_type':quiz_question_type, 'question_weight':question_weight,
                'question_due': new Date(question_due)};
            data.push(values);
        }

        sqlInsert('quiz_questions', data);

        let store_map = [{'name': 'metadata_map', 'object': course_metadata_map}];
        sqlInsert('metadata', store_map);
    }
    else {
        console.log('Course structure file not found');
        $('#loading').hide();
        $.unblockUI();
    }
}

// HELPER FUNCTIONS
function cmp_datetime(a_datetime, b_datetime){
    if (a_datetime < b_datetime) {
        return -1;
    } else if (a_datetime > b_datetime){
        return 1;
    } else {
        return 0;
    }
}

function process_null(inputString){
    if (typeof inputString === 'string'){
        if (inputString.length === 0 || inputString === 'NULL'){
            return null;
        } else {
            return inputString;
        }
    } else {
        return inputString;
    }
}

function cleanUnicode(text) {
    if (typeof text === 'string'){
        return text.normalize('NFC');
    } else {
        return text;
    }
}

function escapeString(text) {
    return text
        .replace(/[\\]/g, '\\\\')
        .replace(/["]/g, '\\\"')
        .replace(/[\/]/g, '\\/')
        .replace(/[\b]/g, '\\b')
        .replace(/[\f]/g, '\\f')
        .replace(/[\n]/g, '\\n')
        .replace(/[\r]/g, '\\r')
        .replace(/[\t]/g, '\\t');
}


function getNextDay(current_day){
    current_day.setDate(current_day.getDate() + 1);
    return current_day;
}


function getDayDiff(beginDate, endDate) {
    let count = 0;
    while ((endDate.getDate() - beginDate.getDate()) >= 1){
        endDate.setDate(endDate.getDate() - 1);
        count += 1
    }
    return count
}

function courseElementsFinder(eventlog, course_id) {
    let elementsID = coucourseElementsFinder_string(eventlog['event_type'], course_id);
    if (elementsID === '') {
        elementsID = coucourseElementsFinder_string(eventlog['path'], course_id);
    }
    if (elementsID === '') {
        elementsID = coucourseElementsFinder_string(eventlog['page'], course_id);
    }
    if (elementsID === '') {
        elementsID = coucourseElementsFinder_string(eventlog['referer'], course_id);
    }
    return elementsID;
}

function coucourseElementsFinder_string(eventlog_item, course_id) {
    let elementsID = '';
    let courseId_filtered = course_id;
    if (course_id.split(":").length > 1){
        courseId_filtered = course_id.split(':')[1];
    }

    if (elementsID === '' && eventlog_item.includes('+type@') && eventlog_item.includes('block-v1:')) {
        let templist = eventlog_item.split('/');
        for (let tempstring of templist) {
            if (tempstring.includes('+type@') && tempstring.includes('block-v1:')) {
                elementsID = tempstring;
            }
        }
    }
    if (elementsID === '' && eventlog_item.includes('courseware/')) {
        let templist = eventlog_item.split('/');
        let tempflag = false;
        for (let tempstring of templist) {
            if (tempstring === 'courseware') {
                tempflag = true;
            } else {
                if (tempflag === true && tempstring !== '') {
                    elementsID = 'block-v1:' + courseId_filtered + '+type@chapter+block@' + tempstring;
                    break;
                }
            }
        }
    }
    return elementsID;
}

function weirdDateFinder(course_metadata_map, log_files, index, total, chunk, total_chunks){
    let current_course_id = course_metadata_map["course_id"];
    current_course_id = current_course_id.slice(current_course_id.indexOf('+') + 1, current_course_id.lastIndexOf('+') + 7);

    let learner_all_event_logs = [];
    let updated_learner_all_event_logs = {};
    let session_record = [];

    for (let f in log_files) {
        let file_name = log_files[f]['key'];
        let input_file = log_files[f]['value'];
        if (file_name.includes('log')) {

            let today = new Date();
            let start = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();
            console.log('Starting at', start);
            learner_all_event_logs = [];
            learner_all_event_logs = JSON.parse(JSON.stringify(updated_learner_all_event_logs));
            updated_learner_all_event_logs = [];

            let course_learner_id_set = new Set();
            for (const course_learner_id in learner_all_event_logs) {
                course_learner_id_set.add(course_learner_id)
            }
            let lines = input_file.split('\n');
            for (let line of lines) {
                if (line.length < 10 || !(line.includes(current_course_id))) { //
                    continue;
                }
                let jsonObject = JSON.parse(line);
                if (jsonObject['context'].hasOwnProperty('user_id') === false) {
                    continue;
                }
                let global_learner_id = jsonObject["context"]["user_id"];
                let event_type = jsonObject["event_type"];
                if (global_learner_id == 4002686 || global_learner_id == '4002686'){
                    console.log(jsonObject)
                }
            }
        }
    }
    chunk++;

    if (chunk < total_chunks){
        progress_display('Part\n' + (chunk+1) + ' of ' + total_chunks, index);
        toastr.info('Processing a new chunk of file number ' + (index + 1));
        processLogFiles(index, chunk);
    } else {
        index++;
        if (index < total){
            chunk = 0;
            toastr.info('Starting with file number ' + (index + 1));
            processLogFiles(index, chunk);
        } else {
            let table = document.getElementById("progress_tab");
            let row = table.insertRow();
            let cell1 = row.insertCell();
            setTimeout(function(){
                toastr.success('Please reload the page now', 'Logfiles ready', {timeOut: 0});
                cell1.innerHTML = ('Done! at ' + new Date().toLocaleString('en-GB'));
                $('#loading').hide();
                $.unblockUI();
            }, 10000);
        }
    }
}


// TRANSLATION MODULES
function session_mode(course_metadata_map, log_files, index, total, chunk){
    // This is only for one course! It has to be changed to allow for more courses
    let current_course_id = course_metadata_map["course_id"];
    current_course_id = current_course_id.slice(current_course_id.indexOf('+') + 1, current_course_id.lastIndexOf('+') + 7);

    let zero_start = performance.now();
    // let current_date = course_metadata_map["start_date"];
    // let end_next_date  = getNextDay(course_metadata_map["end_date"]);
    let learner_all_event_logs = [];
    let updated_learner_all_event_logs = {};
    let session_record = [];

    for (let f in log_files){
        let file_name = log_files[f]['key'];
        let input_file = log_files[f]['value'];
        if (file_name.includes('log')){

            let today = new Date();
            let start = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();
            console.log('Starting at', start);
            learner_all_event_logs = [];
            learner_all_event_logs = JSON.parse(JSON.stringify(updated_learner_all_event_logs));
            updated_learner_all_event_logs = [];

            let course_learner_id_set = new Set();
            for (const course_learner_id in learner_all_event_logs){
                course_learner_id_set.add(course_learner_id)
            }
            console.log(input_file.length);
            let lines = input_file.split('\n');
            console.log(lines.length + ' lines to process in file');

            for (let line of lines){
                if (line.length < 10 || !(line.includes(current_course_id)) ) { //
                    continue;
                }
                let jsonObject = JSON.parse(line);
                if (jsonObject['context'].hasOwnProperty('user_id') === false ){ continue; }
                let global_learner_id = jsonObject["context"]["user_id"];
                let event_type = jsonObject["event_type"];

                if (global_learner_id != ''){
                    let course_id = jsonObject["context"]["course_id"];

                    let course_learner_id = course_id + "_" + global_learner_id;

                    let event_time = new Date(jsonObject["time"]);

                    if (course_learner_id_set.has(course_learner_id)){
                        learner_all_event_logs[course_learner_id].push({"event_time":event_time, "event_type":event_type});
                    } else {
                        learner_all_event_logs[course_learner_id] = [{"event_time":event_time, "event_type":event_type}];
                        course_learner_id_set.add(course_learner_id);
                    }
                }
            }

            for (let course_learner_id in learner_all_event_logs){
                let event_logs = learner_all_event_logs[course_learner_id];

                event_logs.sort(function(a, b) {
                    return new Date(a.event_time) - new Date(b.event_time) ;
                });

                let session_id = "";
                let start_time = "";
                let end_time = "";
                let final_time = "";
                for (let i in event_logs){
                    if (start_time === ''){
                        start_time = new Date(event_logs[i]["event_time"]);
                        end_time = new Date(event_logs[i]["event_time"]);
                    } else {
                        let verification_time = new Date(end_time);
                        if (new Date(event_logs[i]["event_time"]) > verification_time.setMinutes(verification_time.getMinutes() + 30)){
                            let session_id = course_learner_id + '_' + start_time + '_' + end_time;
                            let duration = (end_time - start_time)/1000;

                            if (duration > 5){
                                let array = [session_id, course_learner_id, start_time, end_time, duration];
                                session_record.push(array);
                            }

                            final_time = new Date(event_logs[i]["event_time"]);

                            //Re-initialization
                            session_id = "";
                            start_time = new Date(event_logs[i]["event_time"]);
                            end_time = new Date(event_logs[i]["event_time"]);

                        } else {
                            if (event_logs[i]["event_type"] === "page_close"){
                                end_time = new Date(event_logs[i]["event_time"]);
                                session_id = course_learner_id + '_' + start_time + '_' + end_time;
                                let duration = (end_time - start_time)/1000;

                                if (duration > 5){
                                    let array = [session_id, course_learner_id, start_time, end_time, duration];
                                    session_record.push(array);
                                }
                                session_id = "";
                                start_time = "";
                                end_time = "";

                                final_time = new Date(event_logs[i]["event_time"]);

                            } else {
                                end_time = new Date(event_logs[i]["event_time"]);
                            }
                        }
                    }
                }
                if (final_time !== ""){
                    let new_logs = [];
                    for (let x in event_logs){
                        let log = event_logs[x];
                        if (new Date(log["event_time"]) >= final_time){
                            new_logs.push(log);
                        }
                    }
                    updated_learner_all_event_logs[course_learner_id] = new_logs;
                }
            }

            //current_date = getNextDay(current_date)

            // Filter duplicated records
            let updated_session_record = [];
            let session_id_set = new Set();
            for (let array of session_record){
                let session_id = array[0];
                if (!(session_id_set.has(session_id))){
                    session_id_set.add(session_id);
                    updated_session_record.push(array);
                }
            }
            console.log('Session record:', session_record.length, 'session_id_set', session_id_set.length);

            session_record = updated_session_record;
            if (session_record.length > 0){
                let data = [];
                for (let x in session_record){
                    let array = session_record[x];
                    let session_id = array[0];
                    if (chunk !== 0) {
                        session_id = session_id + '_' + chunk
                    }
                    if (index !== 0) {
                        session_id = session_id + '_' + index
                    }
                    let course_learner_id = array[1];
                    let start_time = array[2];
                    let end_time = array[3];
                    let duration = process_null(array[4]);
                    let values = {'session_id':session_id, 'course_learner_id':course_learner_id,
                        'start_time':start_time,
                        'end_time': end_time, 'duration':duration};
                    data.push(values);
                }
                console.log('Send to storage at ' + new Date());
                console.log(performance.now() - zero_start);

                sqlLogInsert('sessions', data);
                connection.runSql("DELETE FROM webdata WHERE name = 'graphElements'");
                connection.runSql("DELETE FROM webdata WHERE name = 'databaseDetails'");
                connection.runSql("DELETE FROM webdata WHERE name = 'mainIndicators'");
                progress_display(data.length + ' sessions', index);
            } else {
                console.log('no session info', index, total);
            }
        }
    }
}

function forum_interaction(forum_file, course_metadata_map){
    let forum_interaction_records = [];
    let lines = forum_file.split("\n");
    for (let line of lines) {
        if (line.length < 9) {continue;}
        let jsonObject = JSON.parse(line);

        let post_id = jsonObject["_id"]["$oid"];
        let course_learner_id = jsonObject["course_id"] + "_" + jsonObject["author_id"];

        let post_type = jsonObject["_type"];
        if (post_type === "CommentThread"){
            post_type += "_" + jsonObject["thread_type"];
        }
        if ("parent_id" in jsonObject &&  jsonObject["parent_id"] !== ""){
            post_type = "Comment_Reply"
        }

        let post_title = "";
        if (jsonObject.hasOwnProperty("title")){
            post_title = jsonObject["title"];
        }

        let post_content = jsonObject["body"];
        let post_timestamp = new Date(jsonObject["created_at"]["$date"]);

        let post_parent_id = "";
        if (jsonObject.hasOwnProperty("parent_id")) {
            post_parent_id = jsonObject["parent_id"]["$oid"]
        }

        let post_thread_id = "";
        if (jsonObject.hasOwnProperty("comment_thread_id" )) {
            post_thread_id = jsonObject["comment_thread_id"]["$oid"]
        }
        if (post_timestamp < new Date(course_metadata_map["end_time"])) {
            let array = [post_id, course_learner_id, post_type, post_title, escapeString(post_content),
                        post_timestamp, post_parent_id, post_thread_id];
            forum_interaction_records.push(array)
        }
    }
    return forum_interaction_records;
}


function forum_sessions(course_metadata_map, log_files, index, total, chunk) {
    // This is only for one course! It has to be changed to allow for more courses
    let current_course_id = course_metadata_map["course_id"];
    current_course_id = current_course_id.slice(current_course_id.indexOf('+') + 1, current_course_id.lastIndexOf('+') + 7);

    let start_date = new Date(course_metadata_map['start_date']);
    // let end_date = new Date(course_metadata_map['end_date']);
    let current_date = new Date(start_date);
    // let end_next_date = getNextDay(end_date);
    let forum_event_types = [];
    forum_event_types.push('edx.forum.comment.created');
    forum_event_types.push('edx.forum.response.created');
    forum_event_types.push('edx.forum.response.voted');
    forum_event_types.push('edx.forum.thread.created');
    forum_event_types.push('edx.forum.thread.voted');
    forum_event_types.push('edx.forum.searched');
    let learner_all_event_logs = {};
    let updated_learner_all_event_logs = {};
    let forum_sessions_record = [];
    console.log('Starting forum sessions');
    // while (true) {
    //     if (current_date === end_next_date) {
    //         break;
    //     }
        for (let log_file of log_files) {
            let file_name = log_file['key'];
            let input_file = log_file['value'];
            if (file_name.includes(current_date) || true) {
                console.log('   for file', file_name);
                learner_all_event_logs = {};
                learner_all_event_logs = updated_learner_all_event_logs;
                updated_learner_all_event_logs = {};
                let course_learner_id_set = new Set();
                if (learner_all_event_logs.length > 0){
                    for (let course_learner_id of learner_all_event_logs) {
                        course_learner_id_set.add(course_learner_id);
                    }
                }
                let lines = input_file.split('\n');
                console.log('    with ', lines.length, 'lines');
                for (let line of lines){
                    if (line.length < 10 || !(line.includes(current_course_id)) ) { continue; }
                    let jsonObject = JSON.parse(line);
                    if (!('user_id' in jsonObject['context'])) {
                        continue;
                    }
                    if (jsonObject['context']['user_id'] === '') {
                        continue;
                    }
                    let global_learner_id = jsonObject['context']['user_id'];
                    let event_type = jsonObject['event_type'];
                    if (event_type.includes('/discussion/') || forum_event_types.includes(event_type)) {
                        if (event_type !== 'edx.forum.searched') {
                            event_type = 'forum_activity';
                        }
                    }
                    if (global_learner_id !== '') {
                        let course_id = jsonObject['context']['course_id'];
                        let course_learner_id = course_id + '_' + global_learner_id;
                        let event_time = new Date(jsonObject['time']);

                        let event_page = '';
                        if ('page' in jsonObject) {
                            if (jsonObject['page'] === null){
                                event_page = '';
                            } else {
                                event_page = jsonObject['page'];
                            }
                        }
                        let event_path = '';
                        if ('path' in jsonObject) {
                            event_path = jsonObject['path'];
                        }
                        let event_referer = '';
                        if ('referer' in jsonObject) {
                            event_referer = jsonObject['referer'];
                        }
                        if (course_learner_id_set.has(course_learner_id)) {
                            learner_all_event_logs[course_learner_id].push({'event_time': event_time, 'event_type': event_type,
                                                             'page': event_page, 'path': event_path, 'referer': event_referer});
                        } else {
                            learner_all_event_logs[course_learner_id] = [{'event_time': event_time, 'event_type': event_type,
                                                             'page': event_page, 'path': event_path, 'referer': event_referer}];
                            course_learner_id_set.add(course_learner_id);
                        }
                    }
                }

                for (let learner in learner_all_event_logs) {
                    let course_learner_id = learner;
                    let event_logs = learner_all_event_logs[learner];
                    let course_id = course_learner_id.split('_')[0];
                    event_logs.sort(function(a, b) {
                        return b.event_type - a.event_type;
                    });
                    event_logs.sort(function(a, b) {
                        return new Date(a.event_time) - new Date(b.event_time) ;
                    });
                    let session_id = '';
                    let start_time = '';
                    let end_time = '';
                    let times_search = 0;
                    let final_time = '';
                    let session_rel_element_pre = '';
                    let session_rel_element_cur = '';

                    for (let i in event_logs) {
                        let rel_element_cur = courseElementsFinder(event_logs[i], course_id);

                        if (session_id === '') {
                            if (['forum_activity', 'edx.forum.searched'].includes(event_logs[i]['event_type'])) {
                                session_id = 'forum_session_' + course_learner_id;
                                start_time = new Date(event_logs[i]['event_time']);
                                end_time = new Date(event_logs[i]['event_time']);
                                if (event_logs[i]['event_type'] === 'edx.forum.searched') {
                                    times_search++;
                                }
                                session_rel_element_cur = rel_element_cur;
                            }
                        } else {
                            if (['forum_activity', 'edx.forum.searched'].includes(event_logs[i]['event_type'])) {
                                let verification_time = new Date(end_time);
                                if (new Date(event_logs[i]["event_time"]) > verification_time.setMinutes(verification_time.getMinutes() + 30)) {
                                    session_id = session_id + '_' + start_time + '_' + end_time;
                                    let duration = (end_time - start_time) / 1000;

                                    if (duration > 5) {
                                        let rel_element_id = '';
                                        if (session_rel_element_cur !== '') {
                                            rel_element_id = session_rel_element_cur;
                                        } else {
                                            rel_element_id = session_rel_element_pre;
                                        }
                                        let array = [session_id, course_learner_id, times_search, start_time, end_time, duration, rel_element_id];
                                        forum_sessions_record.push(array);
                                    }
                                    final_time = new Date(event_logs[i]['event_time']);

                                    session_id = 'forum_session_' + course_learner_id;
                                    start_time = new Date(event_logs[i]['event_time']);
                                    end_time = new Date(event_logs[i]['event_time']);
                                    if (event_logs[i]['event_type'] === 'edx.forum.searched') {
                                        times_search = 1;
                                    }
                                    session_rel_element_cur = rel_element_cur;
                                } else {
                                    end_time = new Date(event_logs[i]['event_time']);
                                    if (event_logs[i]['event_type'] === 'edx.forum.searched') {
                                        times_search++;
                                    }
                                    if (session_rel_element_cur === '') {
                                        session_rel_element_cur = rel_element_cur;
                                    }
                                }
                            } else {
                                let verification_time = new Date(end_time);
                                if (new Date(event_logs[i]["event_time"]) <= verification_time.setMinutes(verification_time.getMinutes() + 30)){
                                    end_time = new Date(event_logs[i]['event_time']);
                                }
                                session_id = session_id + '_' +  start_time + '_' + end_time;
                                let duration = (end_time - start_time) / 1000;

                                if (duration > 5) {
                                    let rel_element_id = '';
                                    if (session_rel_element_cur !== '') {
                                        rel_element_id = session_rel_element_cur;
                                    } else {
                                        rel_element_id = session_rel_element_pre;
                                    }
                                    let array = [session_id, course_learner_id, times_search, start_time, end_time, duration, rel_element_id];
                                    forum_sessions_record.push(array);
                                }
                                final_time = new Date(event_logs[i]['event_time']);
                                session_id = '';
                                start_time = '';
                                end_time = '';
                                times_search = 0;
                            }
                            if (rel_element_cur !== '') {
                                session_rel_element_pre = rel_element_cur;
                            }
                        }
                    }
                    if (final_time !== ""){
                        let new_logs = [];
                        for (let log of event_logs){
                            if (new Date(log["event_time"]) >= final_time){
                                new_logs.push(log);
                            }
                        }
                        updated_learner_all_event_logs[course_learner_id] = new_logs;
                    }
                }
            }
            current_date = getNextDay(current_date);
        }

    if (forum_sessions_record.length > 0){
        let data = [];
        for (let array of forum_sessions_record){
            let session_id = array[0];
            if (chunk !== 0) {
                session_id = session_id + '_' + chunk
            }
            if (index !== 0) {
                session_id = session_id + '_' + index
            }
            let course_learner_id = array[1];
            let times_search = process_null(array[2]);
            let start_time = array[3];
            let end_time = array[4];
            let duration = process_null(array[5]);
            let rel_element_id = array[6];
            let values = {'session_id':session_id, 'course_learner_id':course_learner_id,
                'times_search': times_search, 'start_time': start_time,
                'end_time': end_time, 'duration':duration, 'relevent_element_id': rel_element_id};
            data.push(values);
        }
        console.log('Send to storage at ' + new Date());
        sqlLogInsert('forum_sessions', data);
        progress_display(data.length + ' forum interaction sessions', index);
        // loader.hide();
    } else {
        console.log('no forum session info', index, total);
        // loader.hide()
    }
}


function video_interaction(course_metadata_map, log_files, index, total, chunk) {
    // loader.show();

    // This is only for one course! It has to be changed to allow for more courses
    let current_course_id = course_metadata_map["course_id"];
    current_course_id = current_course_id.slice(current_course_id.indexOf('+') + 1, current_course_id.lastIndexOf('+') + 7);

    console.log('Starting video session processing');
    let current_date = new Date(course_metadata_map['start_date']);
    // let end_next_date = getNextDay(course_metadata_map['end_date']);
    let video_interaction_map = {};
    let video_event_types = [];
    video_event_types.push('hide_transcript');
    video_event_types.push('edx.video.transcript.hidden');
    video_event_types.push('edx.video.closed_captions.hidden');
    video_event_types.push('edx.video.closed_captions.shown');
    video_event_types.push('load_video');
    video_event_types.push('edx.video.loaded');
    video_event_types.push('pause_video');
    video_event_types.push('edx.video.paused');
    video_event_types.push('play_video');
    video_event_types.push('edx.video.played');
    video_event_types.push('seek_video');
    video_event_types.push('edx.video.position.changed');
    video_event_types.push('show_transcript');
    video_event_types.push('edx.video.transcript.shown');
    video_event_types.push('speed_change_video');
    video_event_types.push('stop_video');
    video_event_types.push('edx.video.stopped');
    video_event_types.push('video_hide_cc_menu');
    video_event_types.push('edx.video.language_menu.hidden');
    video_event_types.push('video_show_cc_menu');
    video_event_types.push('edx.video.language_menu.shown');
    let learner_video_event_logs = {};
    let updated_learner_video_event_logs = {};

    // while (true) {
    //     if (current_date == end_next_date) {
    //         break;
    //     }

        for (let file of log_files) {
            let file_name = file['key'];
            let input_file = file['value'];
            if (file_name.includes(current_date) || true) {
                console.log('   for file', file_name);
                learner_video_event_logs = {};
                learner_video_event_logs = updated_learner_video_event_logs;
                updated_learner_video_event_logs = {};
                let course_learner_id_set = new Set();
                if (learner_video_event_logs.length > 0){
                    for (let course_learner_id of learner_video_event_logs) {
                        course_learner_id_set.add(course_learner_id);
                    }
                }
                let lines = input_file.split('\n');
                console.log('    with ', lines.length, 'lines');
                for (let line of lines){
                    if (line.length < 10 || !(line.includes(current_course_id)) ) { continue; }
                    let jsonObject = JSON.parse(line);
                    if (video_event_types.includes(jsonObject['event_type'])) {
                        if (!('user_id' in jsonObject['context'])) {continue; }
                        let global_learner_id = jsonObject['context']['user_id'];
                        if (global_learner_id !== '') {
                            let course_id = jsonObject['context']['course_id'];
                            let course_learner_id = (course_id + '_') + global_learner_id;
                            let video_id = '';
                            let event_time = new Date(jsonObject['time']);
                            let event_type = jsonObject['event_type'];
                            let new_time = 0;
                            let old_time = 0;
                            let new_speed = 0;
                            let old_speed = 0;

                            if (typeof jsonObject['event'] === "string") {
                                let event_jsonObject = JSON.parse(jsonObject['event']);
                                video_id = event_jsonObject['id'];
                                video_id = video_id.replace('-', '://');
                                video_id = video_id.replace(/-/g, '/');
                                if ('new_time' in event_jsonObject && 'old_time' in event_jsonObject) {
                                    new_time = event_jsonObject['new_time'];
                                    old_time = event_jsonObject['old_time'];
                                }
                                if ('new_speed' in event_jsonObject && 'old_speed' in event_jsonObject){
                                    new_speed = event_jsonObject['new_speed'];
                                    old_speed = event_jsonObject['old_speed'];
                                }
                            } else {
                                let event_jsonObject = jsonObject['event'];
                                video_id = event_jsonObject['id'];
                                video_id = video_id.replace('-', '://');
                                video_id = video_id.replace(/-/g, '/');
                                if ('new_time' in event_jsonObject && 'old_time' in event_jsonObject) {
                                    new_time = event_jsonObject['new_time'];
                                    old_time = event_jsonObject['old_time'];
                                }
                                if ('new_speed' in event_jsonObject && 'old_speed' in event_jsonObject){
                                    new_speed = event_jsonObject['new_speed'];
                                    old_speed = event_jsonObject['old_speed'];
                                }
                            }
                            if (['seek_video', 'edx.video.position.changed'].includes(event_type)){
                                if (new_time != null && old_time != null) {
                                    if (course_learner_id_set.has(course_learner_id)) {
                                        learner_video_event_logs[course_learner_id].push({'event_time': event_time,
                                            'event_type': event_type, 'video_id': video_id, 'new_time': new_time,
                                            'old_time': old_time});
                                    } else {
                                        learner_video_event_logs[course_learner_id] = [{'event_time': event_time,
                                            'event_type': event_type, 'video_id': video_id, 'new_time': new_time,
                                            'old_time': old_time}];
                                        course_learner_id_set.add(course_learner_id);
                                    }
                                }
                                continue;
                            }
                            if (['speed_change_video'].includes(event_type)) {
                                if (course_learner_id_set.has(course_learner_id)) {
                                    learner_video_event_logs[course_learner_id].push({'event_time': event_time,
                                        'event_type': event_type, 'video_id': video_id, 'new_speed': new_speed,
                                        'old_speed': old_speed});
                                } else {
                                    learner_video_event_logs[course_learner_id] = [{'event_time': event_time,
                                        'event_type': event_type, 'video_id': video_id, 'new_speed': new_speed,
                                        'old_speed': old_speed}];
                                    course_learner_id_set.add(course_learner_id);
                                }
                                continue;
                            }
                            if (course_learner_id_set.has(course_learner_id)) {
                                learner_video_event_logs [course_learner_id].push({'event_time': event_time,
                                    'event_type': event_type, 'video_id': video_id});
                            } else {
                                learner_video_event_logs[course_learner_id] = [{'event_time': event_time,
                                    'event_type': event_type, 'video_id': video_id}];
                                course_learner_id_set.add(course_learner_id);
                            }
                        }
                    }
                    if (! (video_event_types.includes(jsonObject['event_type']))) {
                        if (! ('user_id' in jsonObject['context'])){
                            continue;
                        }
                        let global_learner_id = jsonObject['context']['user_id'];
                        if (global_learner_id !== '') {
                            let course_id = jsonObject['context']['course_id'];
                            let course_learner_id = course_id + '_' + global_learner_id;
                            let event_time = new Date(jsonObject['time']);
                            let event_type = jsonObject['event_type'];
                            if (course_learner_id_set.has(course_learner_id)) {
                                learner_video_event_logs[course_learner_id].push({'event_time': event_time,
                                    'event_type': event_type});
                            }
                            else {
                                learner_video_event_logs[course_learner_id] = [{'event_time': event_time,
                                    'event_type': event_type}];
                                course_learner_id_set.add(course_learner_id);
                            }
                        }
                    }
                }
                for (let course_learner_id in learner_video_event_logs) {
                    let video_id = '';
                    let event_logs = learner_video_event_logs[course_learner_id];
                    event_logs.sort(function(a, b) {
                        return new Date(a.event_time) - new Date(b.event_time) ;
                    });
                    let video_start_time = '';
                    let final_time = '';
                    let times_forward_seek = 0;
                    let duration_forward_seek = 0;
                    let times_backward_seek = 0;
                    let duration_backward_seek = 0;
                    let speed_change_last_time = '';
                    let times_speed_up = 0;
                    let times_speed_down = 0;
                    let pause_check = false;
                    let pause_start_time = '';
                    let duration_pause = 0;
                    for (let log of event_logs) {
                        if (['play_video', 'edx.video.played'].includes(log['event_type'])){
                            video_start_time = new Date(log['event_time']);
                            video_id = log['video_id'];
                            if (pause_check) {
                                let duration_pause = (new Date(log['event_time']) - pause_start_time)/1000;
                                let video_interaction_id = (course_learner_id + '_' + video_id  + '_' + pause_start_time);
                                if (duration_pause > 2 && duration_pause < 600) {
                                    if (video_interaction_id in video_interaction_map) {
                                        video_interaction_map[video_interaction_id]['times_pause'] = 1;
                                        video_interaction_map[video_interaction_id]['duration_pause'] = duration_pause;
                                    }
                                }
                                let pause_check = false;
                            }
                            continue;
                        }
                        if (video_start_time !== '') {
                            let verification_time = new Date(video_start_time);
                            if (log["event_time"] > verification_time.setMinutes(verification_time.getMinutes() + 30)){
                                video_start_time = '';
                                video_id = '';
                                final_time = log['event_time'];
                            } else {
                                // Seek
                                if (['seek_video', 'edx.video.position.changed'].includes(log['event_type']) && video_id === log['video_id']) {
                                    if (log['new_time'] > log['old_time']) {
                                        times_forward_seek++;
                                        duration_forward_seek += log['new_time'] - log['old_time'];
                                    }
                                    if (log['new_time'] < log['old_time']) {
                                        times_backward_seek++;
                                        duration_backward_seek += log['old_time'] - log['new_time'];
                                    }
                                    continue;
                                }

                                // Speed Changes
                                if (log['event_type'] === 'speed_change_video' && video_id === log['video_id']) {
                                    if (speed_change_last_time === '') {
                                        speed_change_last_time = log['event_time'];
                                        let old_speed = log['old_speed'];
                                        let new_speed = log['new_speed'];
                                        if (old_speed < new_speed) {
                                            times_speed_up++;
                                        }
                                        if (old_speed > new_speed) {
                                            times_speed_down++;
                                        }
                                    } else {
                                        if ((log['event_time'] - speed_change_last_time)/1000 > 10) {
                                            let old_speed = log['old_speed'];
                                            let new_speed = log['new_speed'];
                                            if (old_speed < new_speed) {
                                                times_speed_up++;
                                            }
                                            if (old_speed > new_speed) {
                                                times_speed_down++;
                                            }
                                        }
                                        speed_change_last_time = log['event_time'];
                                    }
                                    continue;
                                }

                                // Pause/Stop Situation
                                if (['pause_video', 'edx.video.paused', 'stop_video', 'edx.video.stopped'].includes(log['event_type']) &&
                                         video_id === log['video_id']) {

                                    let watch_duration = (new Date(log['event_time']) - video_start_time)/1000;
                                    let video_end_time = new Date(log['event_time']);
                                    let video_interaction_id = (course_learner_id + '_' + video_id + '_' + video_end_time);
                                    if (watch_duration > 5) {
                                        video_interaction_map[video_interaction_id] = ({'course_learner_id': course_learner_id,
                                            'video_id': video_id, 'type': 'video', 'watch_duration': watch_duration,
                                            'times_forward_seek': times_forward_seek, 'duration_forward_seek': duration_forward_seek,
                                            'times_backward_seek': times_backward_seek, 'duration_backward_seek': duration_backward_seek,
                                            'times_speed_up': times_speed_up, 'times_speed_down': times_speed_down,
                                            'start_time': video_start_time, 'end_time': video_end_time});
                                    }
                                    if (['pause_video', 'edx.video.paused'].includes(log['event_type'])) {
                                        pause_check = true;
                                        pause_start_time = new Date(video_end_time);
                                    }
                                    times_forward_seek = 0;
                                    duration_forward_seek = 0;
                                    times_backward_seek = 0;
                                    duration_backward_seek = 0;
                                    speed_change_last_time = '';
                                    times_speed_up = 0;
                                    times_speed_down = 0;
                                    video_start_time = '';
                                    video_id = '';
                                    final_time = log['event_time'];
                                    continue;
                                }

                                // Page Changed/Session Closed
                                if (!(video_event_types.includes(log['event_type']))) {
                                    let video_end_time = new Date(log['event_time']);
                                    let watch_duration = (video_end_time - video_start_time)/1000;
                                    let video_interaction_id = (course_learner_id + '_' + video_id + '_' + video_end_time + '_' + chunk);
                                    if (watch_duration > 5) {
                                        video_interaction_map[video_interaction_id] = ({'course_learner_id': course_learner_id,
                                            'video_id': video_id, 'type': 'video', 'watch_duration': watch_duration,
                                            'times_forward_seek': times_forward_seek, 'duration_forward_seek': duration_forward_seek,
                                            'times_backward_seek': times_backward_seek,
                                            'duration_backward_seek': duration_backward_seek, 'times_speed_up': times_speed_up,
                                            'times_speed_down': times_speed_down, 'start_time': video_start_time,
                                            'end_time': video_end_time});
                                    }
                                    times_forward_seek = 0;
                                    duration_forward_seek = 0;
                                    times_backward_seek = 0;
                                    duration_backward_seek = 0;
                                    speed_change_last_time = '';
                                    times_speed_up = 0;
                                    times_speed_down = 0;
                                    video_start_time = '';
                                    video_id = '';
                                    final_time = log['event_time'];
                                    continue;
                                }
                            }
                        }
                    }
                    if (final_time !== '') {
                        let new_logs = [];
                        for (let log of event_logs) {
                            if (log['event_time'] > final_time) {
                                new_logs.push(log);
                            }
                        }
                        updated_learner_video_event_logs[course_learner_id] = new_logs;
                    }
                }
            }
        }
        // let current_date = getNextDay (current_date);
    let video_interaction_record = [];
    for (let interaction_id in video_interaction_map) {
        let video_interaction_id = interaction_id;
        let course_learner_id = video_interaction_map[interaction_id]['course_learner_id'];
        let video_id = video_interaction_map[interaction_id]['video_id'];
        let duration = video_interaction_map[interaction_id]['watch_duration'];
        let times_forward_seek = video_interaction_map[interaction_id]['times_forward_seek'];
        let duration_forward_seek = video_interaction_map[interaction_id]['duration_forward_seek'];
        let times_backward_seek = video_interaction_map[interaction_id]['times_backward_seek'];
        let duration_backward_seek = video_interaction_map[interaction_id]['duration_backward_seek'];
        let times_speed_up = video_interaction_map[interaction_id]['times_speed_up'];
        let times_speed_down = video_interaction_map[interaction_id]['times_speed_down'];
        let start_time = video_interaction_map[interaction_id]['start_time'];
        let end_time = video_interaction_map[interaction_id]['end_time'];

        let times_pause = 0;
        let duration_pause = 0;

        if (video_interaction_map[interaction_id].hasOwnProperty('times_pause')) {
            times_pause = video_interaction_map[interaction_id]['watch_duration'];
            duration_pause = video_interaction_map[interaction_id]['duration_pause'];
        }
        let array = [video_interaction_id, course_learner_id, video_id, duration, times_forward_seek,
            duration_forward_seek, times_backward_seek, duration_backward_seek, times_speed_up, times_speed_down,
            times_pause, duration_pause, start_time, end_time];
        array = array.map(function(value){
            if (typeof value === "number"){
                return Math.round(value);
            } else {
                return value;
            }
        });
        video_interaction_record.push(array);
    }

    if (video_interaction_record.length > 0) {
        let data = [];
        for (let array of video_interaction_record) {
            let interaction_id = array[0];
            if (index !== 0){
                interaction_id = interaction_id + '_' + index;
            }
            if (chunk !== 0) {
                interaction_id = interaction_id + '_' + chunk
            }
            let course_learner_id = array[1];
            let video_id = array[2];
            if (video_id.length < 3){
                console.log(array);
                // continue
            }
            let duration = process_null(array[3]);
            let times_forward_seek = process_null(array[4]);
            let duration_forward_seek = process_null(array[5]);
            let times_backward_seek = process_null(array[6]);
            let duration_backward_seek = process_null(array[7]);
            let times_speed_up = process_null(array[8]);
            let times_speed_down = process_null(array[9]);
            let times_pause = process_null(array[10]);
            let duration_pause = process_null(array[11]);
            let start_time = array[12];
            let end_time = array[13];
            let values = {'interaction_id': interaction_id, 'course_learner_id':course_learner_id, 'video_id': video_id,
                'duration':duration, 'times_forward_seek':times_forward_seek, 'duration_forward_seek':duration_forward_seek,
                'times_backward_seek': times_backward_seek, 'duration_backward_seek':duration_backward_seek,
                'times_speed_up':times_speed_up, 'times_speed_down':times_speed_down, 'times_pause':times_pause,
                'duration_pause':duration_pause, 'start_time':start_time, 'end_time':end_time};
            data.push(values);
        }
        console.log('Sending', data.length, ' values to storage at ' + new Date());
        sqlLogInsert('video_interaction', data);
        progress_display(data.length + ' video interaction sessions', index);
    } else {
        console.log('no forum session info', index, total);
    }
}


function quiz_mode(course_metadata_map, log_files, index, total, chunk) {
    // This is only for one course! It has to be changed to allow for more courses
    let current_course_id = course_metadata_map["course_id"];
    current_course_id = current_course_id.slice(current_course_id.indexOf('+') + 1, current_course_id.lastIndexOf('+') + 7);

    console.log('Starting quiz processing');
    let zero_start = performance.now();
    let submission_event_collection = [];
    submission_event_collection.push('problem_check');
    let current_date = course_metadata_map['start_date'];
    let end_next_date = getNextDay(new Date(course_metadata_map['end_date']));
    let submission_uni_index = chunk * 100;
    // while (true) {
    //     if (current_date == end_next_date) {
    //         break;
    //     }
        for (let file of log_files) {
            let file_name = file['key'];
            let input_file = file['value'];
            let submission_data =[];
            let assessment_data = [];
            if (file_name.includes(current_date) || true) {
                console.log('   for file', file_name);
                let lines = input_file.split('\n');

                for (let line of lines){
                    if (line.length < 10 || !(line.includes(current_course_id)) ) { continue; }
                    let jsonObject = JSON.parse(line);
                    if (submission_event_collection.includes(jsonObject['event_type'])) {
                        if (!('user_id' in jsonObject['context'])) {continue; }
                        let global_learner_id = jsonObject['context']['user_id'];
                        if (global_learner_id !== '') {
                            let course_id = jsonObject['context']['course_id'];
                            let course_learner_id = course_id + '_'+ global_learner_id;
                            let question_id = '';
                            let grade = '';
                            let max_grade = '';
                            let event_time = new Date(jsonObject['time']);
                            if (typeof jsonObject['event'] === 'object') {
                                question_id = jsonObject['event']['problem_id'];
                                if ('grade' in jsonObject['event'] && 'max_grade' in jsonObject['event']) {
                                    grade = jsonObject['event']['grade'];
                                    max_grade = jsonObject['event']['max_grade'];
                                }
                            }
                            if (question_id !== '') {
                                let submission_id = course_learner_id + '_' + question_id + '_' + submission_uni_index;
                                submission_uni_index = submission_uni_index + 1;

                                let values = {'submission_id': submission_id, 'course_learner_id': course_learner_id,
                                              'question_id': question_id, 'submission_timestamp': event_time};
                                submission_data.push(values);

                                if (grade !== '' && max_grade !== '') {
                                    let values = {'assessment_id': submission_id, 'course_learner_id': course_learner_id,
                                                  'max_grade': max_grade, 'grade': grade};
                                    assessment_data.push(values);
                                }
                            }
                        }
                    }
                }
            }
            if (assessment_data.length > 0){
                sqlLogInsert('assessments', assessment_data);
            } else {
                console.log('No assessment data', index, total)
            }
            if (submission_data.length > 0) {
                sqlLogInsert('submissions', submission_data);
            } else {
                console.log('No submission data', index, total)
            }
        }
        // current_date = getNextDay(current_date);
    // }
    console.log('Done with quiz questions ', performance.now()-zero_start, 'milliseconds');
}

function quiz_sessions(course_metadata_map, log_files, index, total, chunk, total_chunks) {
    // This is only for one course! It has to be changed to allow for more courses
    let current_course_id = course_metadata_map["course_id"];
    current_course_id = current_course_id.slice(current_course_id.indexOf('+') + 1, current_course_id.lastIndexOf('+') + 7);

    let submission_event_collection = [];
    submission_event_collection.push('problem_check');
    submission_event_collection.push('save_problem_check');
    submission_event_collection.push('problem_check_fail');
    submission_event_collection.push('save_problem_check_fail');
    submission_event_collection.push('problem_graded');
    submission_event_collection.push('problem_rescore');
    submission_event_collection.push('problem_rescore_fail');
    submission_event_collection.push('problem_reset');
    submission_event_collection.push('reset_problem');
    submission_event_collection.push('reset_problem_fail');
    submission_event_collection.push('problem_save');
    submission_event_collection.push('save_problem_fail');
    submission_event_collection.push('save_problem_success');
    submission_event_collection.push('problem_show');
    submission_event_collection.push('showanswer');

    let current_date = course_metadata_map['start_date'];
    let end_next_date = getNextDay(new Date(course_metadata_map['end_date']));

    let child_parent_map = course_metadata_map['child_parent_map'];
    let learner_all_event_logs = {};
    let updated_learner_all_event_logs = {};
    let quiz_sessions = {};

    // while (true) {
    //     if (current_date == end_next_date) {
    //         break;
    //     }

        for (let log_file of log_files) {
            let file_name = log_file['key'];
            let input_file = log_file['value'];
            if (file_name.includes(current_date) || true) {
                console.log('   for file', file_name);
                learner_all_event_logs = {};
                learner_all_event_logs = updated_learner_all_event_logs;
                updated_learner_all_event_logs = {};
                let course_learner_id_set = new Set();
                for (let course_learner_id in learner_all_event_logs) {
                    course_learner_id_set.add(course_learner_id);
                }
                let lines = input_file.split('\n');
                console.log('    with ', lines.length, 'lines');

                for (let line of lines){
                    if (line.length < 10 || !(line.includes(current_course_id)) ) { continue; }
                    let jsonObject = JSON.parse(line);
                    if (!('user_id' in jsonObject['context'])) {continue; }
                    let global_learner_id = jsonObject['context']['user_id'];
                    let event_type = jsonObject['event_type'];
                    if (global_learner_id !== '') {
                        let course_id = jsonObject['context']['course_id'];
                        let course_learner_id = course_id + '_' + global_learner_id;
                        let event_time = new Date(jsonObject['time']);
                        if (course_learner_id in learner_all_event_logs) {
                            learner_all_event_logs[course_learner_id].push({'event_time': event_time, 'event_type': event_type});
                        }
                        else {
                            learner_all_event_logs[course_learner_id] = [{'event_time': event_time, 'event_type': event_type}];
                        }
                    }
                }

                for (let course_learner_id in learner_all_event_logs) {
                    if (!(learner_all_event_logs.hasOwnProperty(course_learner_id))){ continue; }
                    let event_logs = learner_all_event_logs[course_learner_id];

                    event_logs.sort(function(a, b) {
                        return b.event_type - a.event_type;
                    });

                    event_logs.sort(function(a, b) {
                        return new Date(a.event_time) - new Date(b.event_time);
                    });

                    let session_id = '';
                    let start_time = '';
                    let end_time = '';

                    let final_time = '';
                    for (let i in event_logs) {
                        if (session_id === '') {
                            if (event_logs[i]['event_type'].includes('problem+block') || event_logs[i]['event_type'].includes("_problem;_") || submission_event_collection.includes(event_logs[i]['event_type'])) {
                                let event_type_array = event_logs[i]['event_type'].split('/');
                                let question_id = '';
                                if (event_logs[i]['event_type'].includes('problem+block')) {
                                    question_id = event_type_array[4];
                                }
                                if (event_logs[i]['event_type'].includes('_problem;_')) {
                                    question_id = event_type_array[6].replace(/;_/g, '/');
                                }
                                if (question_id in child_parent_map) {
                                    session_id = 'quiz_session_' + child_parent_map[question_id] + '_' + course_learner_id;
                                    start_time = new Date(event_logs[i]['event_time']);
                                    end_time = new Date(event_logs[i]['event_time']);
                                }
                            }
                        } else {
                            if (event_logs[i]['event_type'].includes('problem+block') || event_logs[i]['event_type'].includes('_problem;_') || submission_event_collection.includes(event_logs[i]['event_type'])) {
                                let verification_time = new Date(end_time);
                                if (new Date(event_logs[i]['event_time']) > verification_time.setMinutes(verification_time.getMinutes() + 30)) {
                                    if (session_id in quiz_sessions) {
                                        quiz_sessions[session_id]['time_array'].push({
                                            'start_time': start_time,
                                            'end_time': end_time
                                        });
                                    } else {
                                        quiz_sessions[session_id] = {
                                            'course_learner_id': course_learner_id,
                                            'time_array': [{'start_time': start_time, 'end_time': end_time}]
                                        };
                                    }
                                    final_time = event_logs[i]['event_time'];
                                    if (event_logs[i]['event_type'].includes('problem+block') || event_logs[i]['event_type'].includes('_problem;_') || submission_event_collection.includes(event_logs[i]['event_type'])) {
                                        let event_type_array = event_logs[i]['event_type'].split('/');
                                        let question_id = '';
                                        if (event_logs[i]['event_type'].includes('problem+block')) {
                                            question_id = event_type_array[4];
                                        }
                                        if (event_logs[i]['event_type'].includes('_problem;_')) {
                                            question_id = event_type_array[6].replace(/;_/g, '/');
                                        }
                                        if (question_id in child_parent_map) {
                                            session_id = 'quiz_session_' + child_parent_map[question_id] + '_' + course_learner_id;
                                            start_time = new Date(event_logs[i]['event_time']);
                                            end_time = new Date(event_logs[i]['event_time']);
                                        } else {
                                            session_id = '';
                                            start_time = '';
                                            end_time = '';
                                        }
                                    }
                                } else {
                                    end_time = new Date(event_logs[i]['event_time']);
                                }
                            } else {
                                let verification_time = new Date(end_time);
                                if (event_logs[i]['event_time'] <= verification_time.setMinutes(verification_time.getMinutes() + 30)) {
                                    end_time = new Date(event_logs[i]['event_time']);
                                }
                                if (session_id in quiz_sessions) {
                                    quiz_sessions[session_id]['time_array'].push({
                                        'start_time': start_time,
                                        'end_time': end_time
                                    });
                                } else {
                                    quiz_sessions[session_id] = {
                                        'course_learner_id': course_learner_id,
                                        'time_array': [{'start_time': start_time, 'end_time': end_time}]
                                    };
                                }
                                final_time = new Date(event_logs[i]['event_time']);
                                session_id = '';
                                start_time = '';
                                end_time = '';
                            }
                        }
                    }

                    if (final_time !== '') {
                        let new_logs = [];
                        for (let log of event_logs) {
                            if (log ['event_time'] >= final_time) {
                                new_logs.push(log);
                            }
                        }
                        updated_learner_all_event_logs[course_learner_id] = new_logs;
                    }
                }
            }
        }
    // } from while true

    for (let session_id in quiz_sessions) {
        if (!(quiz_sessions.hasOwnProperty(session_id))){ continue; }
        if (Object.keys(quiz_sessions[session_id]['time_array']).length > 1) {
            let start_time = '';
            let end_time = '';
            let updated_time_array = [];
            for (let i = 0; i < Object.keys(quiz_sessions[session_id]['time_array']).length; i++) {
                let verification_time = new Date(end_time);
                if (i === 0) {
                    start_time = new Date(quiz_sessions[session_id]['time_array'][i]['start_time']);
                    end_time = new Date(quiz_sessions[session_id]['time_array'][i]['end_time']);
                } else if (new Date(quiz_sessions[session_id]['time_array'][i]['start_time']) > verification_time.setMinutes(verification_time.getMinutes() + 30)) {
                    updated_time_array.push({'start_time': start_time, 'end_time': end_time});
                    start_time = new Date(quiz_sessions[session_id]['time_array'][i]['start_time']);
                    end_time = new Date(quiz_sessions[session_id]['time_array'][i]['end_time']);
                    if (i === Object.keys(quiz_sessions[session_id]['time_array']).length - 1) {
                        updated_time_array.push({'start_time': start_time, 'end_time': end_time});
                    }
                }
                else {
                    end_time = new Date(quiz_sessions[session_id]['time_array'][i]['end_time']);
                    if (i === Object.keys(quiz_sessions[session_id]['time_array']).length - 1) {
                        updated_time_array.push({'start_time': start_time, 'end_time': end_time});
                    }
                }
            }
            quiz_sessions[session_id]['time_array'] = updated_time_array;
        }
    }

    let quiz_session_record = [];
    for (let session_id in quiz_sessions) {
        if (!(quiz_sessions.hasOwnProperty(session_id))){ continue; }
        let course_learner_id = quiz_sessions[session_id]['course_learner_id'];
        for (let i = 0; i < Object.keys(quiz_sessions[session_id]['time_array']).length; i++) {
            let start_time = new Date(quiz_sessions[session_id]['time_array'][i]['start_time']);
            let end_time = new Date(quiz_sessions[session_id]['time_array'][i]['end_time']);
            if (start_time < end_time) {
                let duration = (end_time - start_time)/1000;
                let final_session_id = session_id + '_' + start_time + '_' + end_time;
                if (duration > 5) {
                    let array = [final_session_id, course_learner_id, start_time, end_time, duration];
                    quiz_session_record.push(array);
                }
            }
        }
    }

    if (quiz_session_record.length > 0) {
        let data = [];
        for (let array of quiz_session_record) {
            let session_id = array[0];
            if (chunk !== 0) {
                session_id = session_id + '_' + chunk
            }
            if (index !== 0) {
                session_id = session_id + '_' + index
            }
            let course_learner_id = array[1];
            let start_time = array[2];
            let end_time = array[3];
            let duration = process_null(array[4]);
            let values = {
                'session_id': session_id, 'course_learner_id': course_learner_id,
                'start_time': start_time, 'end_time': end_time, 'duration': duration
            };
            data.push(values)
        }
        sqlLogInsert('quiz_sessions', data);
        progress_display(data.length + ' quiz interaction sessions', index);
    } else {
        console.log('No quiz session data')
    }

    chunk++;

    if (chunk < total_chunks){
        progress_display('Part\n' + (chunk+1) + ' of ' + total_chunks, index);
        toastr.info('Processing a new chunk of file number ' + (index + 1));
        processLogFiles(index, chunk);
    } else {
        index++;
        if (index < total){
            chunk = 0;
            toastr.info('Starting with file number ' + (index + 1));
            processLogFiles(index, chunk);
        } else {
            let table = document.getElementById("progress_tab");
            let row = table.insertRow();
            let cell1 = row.insertCell();
            setTimeout(function(){
                toastr.success('Please reload the page now', 'Logfiles ready', {timeOut: 0});
                cell1.innerHTML = ('Done! at ' + new Date().toLocaleString('en-GB'));
                $('#loading').hide();
                $.unblockUI()
            }, 10000);
        }
    }
}


function processSessions(tablename, headers) {
    connection.runSql('select * from courses').then(function (courses) {
        courses.forEach(function(course){
            let course_id = course.course_id;
            let total_count = 0;
            let counter = 0;
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
                console.log(counter)
            });
        });
    })
}


function drawCharts(graphElementMap, start, end) {
    testApex(graphElementMap, start, end);
    let canvas = document.getElementById('barChart');
    let ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let startDate = new Date(start);
    let endDate = new Date(end);

    let data = {
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

    let options = {
        type: 'line',
        data: data,
        title: graphElementMap['course_name'],
        options: {
            fill: true,
            responsive: true,
            scales: {
                xAxes: [{
                    type: 'time',
                    display: true,
                    time: {
                        unit: 'day',
                        min: startDate,
                        max: endDate
                    },
                    scaleLabel: {
                        display: true,
                        labelString: "Date",
                    }
                }],
                yAxes: [{
                    id: 'A',
                    ticks: {
                        beginAtZero: true,
                    },
                    position: 'left',
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: "Total Students",
                    }
                }, {
                    id: 'B',
                    ticks: {
                        beginAtZero: true,
                    },
                    position: 'right',
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: "Total Sessions",
                    }
                }]
            }
        }
    };

    if (chart !== null) {
        chart.destroy();
    }

    chart = new Chart(ctx, options);

    let lineCtx = document.getElementById('lineChart').getContext('2d');

    let lineData = {
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
            label: 'Video Session Count',
            yAxisID: 'B',
            data: Object.values(graphElementMap['orderedVideoSessions']),
            borderColor: '#753599',
            backgroundColor: '#753599',
            lineTension: 0,
        }, {
            fill: true,
            label: 'Quiz Session Count',
            yAxisID: 'B',
            data: Object.values(graphElementMap['orderedQuizSessions']),
            borderColor: '#13c70e',
            backgroundColor: '#13c70e',
            lineTension: 0,
        }, {
            fill: true,
            label: 'Forum Session Count',
            yAxisID: 'B',
            data: Object.values(graphElementMap['orderedForumSessions']),
            borderColor: '#992425',
            backgroundColor: '#992425',
            lineTension: 0,
        }]
    };

    let lineOptions = {
        type: 'line',
        data: lineData,
        options: {

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
                        unit: 'day',
                        min: startDate,
                        max: endDate
                    },
                    scaleLabel: {
                        display: true,
                        labelString: "Date",
                    }
                }],
                yAxes: [{
                    id: 'A',
                    ticks: {
                        beginAtZero: true,
                    },
                    position: 'left',
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: "Duration in Seconds",
                    }
                }, {
                    id: 'B',
                    stacked: true,
                    ticks: {
                        beginAtZero: true,
                    },
                    position: 'right',
                    display: true,
                    scaleLabel: {
                        display: true,
                        labelString: "Number of Sessions",
                    }
                }]
            }
        }
    };
    if (lineChart !== null) {
        lineChart.destroy();
    }
    lineChart = new Chart(lineCtx, lineOptions);
}


function getGraphElementMap(callback, start, end) {
    let graphElementMap = {};
    connection.runSql("SELECT * FROM webdata WHERE name = 'graphElements' ").then(function(result) {
        if (result.length === 1) {
            graphElementMap = result[0]['object'];
            callback(graphElementMap, start, end);
        } else {

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
            let orderedForumPosters = {};
            let orderedForumPosterRegulars = {};
            let orderedForumPostByRegulars = {};
            let orderedForumPosterOccasionals = {};
            let orderedForumPostByOccasionals = {};

            let start_date = '';
            let end_date = '';
            let course_name = '';

            let query = "SELECT * FROM courses";
            connection.runSql(query).then(function (courses) {

                courses.forEach(function (course) {
                    $('#loading').show();
                    $.blockUI();
                    course_name = course['course_name'];
                    start_date = course['start_time'].toDateString();
                    end_date = course['end_time'].toDateString();

                    query = "SELECT * FROM sessions";
                    connection.runSql(query).then(function (sessions) {
                        toastr.info('Processing indicators');

                        sessions.forEach(function (session) {
                            let start = session["start_time"].toDateString();
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

                        query = "SELECT * FROM quiz_sessions";
                        connection.runSql(query).then(function (q_sessions) {
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

                            toastr.info('Crunching quiz data');

                            query = "SELECT * FROM video_interaction";
                            connection.runSql(query).then(function (v_sessions) {
                                v_sessions.forEach(function (session) {
                                    let start = session["start_time"].toDateString();
                                    start = new Date(start);
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

                                let dueDates = [];
                                query = "SELECT * FROM quiz_questions";
                                connection.runSql(query).then(function (questions) {
                                    questions.forEach(function (question) {
                                        dueDates.push(question['question_due'].toDateString())
                                    });

                                    let quizDates = Array.from(new Set(dueDates));
                                    let annotations = quizDates.map(function (date, index) {
                                        return {
                                            type: 'line',
                                            id: 'line' + index,
                                            mode: 'vertical',
                                            scaleID: 'x-axis-0',
                                            value: new Date(date),
                                            borderColor: 'red',
                                            borderWidth: 1,
                                            label: {
                                                enabled: true,
                                                position: "top",
                                                content: 'quiz'
                                            }
                                        }
                                    });

                                    query = "SELECT * FROM forum_sessions";
                                    connection.runSql(query).then(function (f_sessions) {
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

                                        query = "SELECT * FROM forum_interaction";
                                        connection.runSql(query).then(function (f_interactions) {
                                            f_interactions.forEach(function (interaction) {
                                                let timestamp = interaction["post_timestamp"].toDateString();
                                                timestamp = new Date(timestamp);

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
                                            toastr.info('Almost there!');

                                            // FORUM SEGMENTATION
                                            let weeklyPosters = groupWeekly(forumPosters);
                                            let posters = {};
                                            let regularPosters = [];
                                            let occasionalPosters = [];
                                            for (let week in weeklyPosters){
                                                let weekPosters = new Set(weeklyPosters[week]);
                                                for (let poster of weekPosters) {
                                                    if (posters.hasOwnProperty(poster)) {
                                                        posters[poster] = posters[poster] + 1
                                                    } else {
                                                        posters[poster] = 1
                                                    }
                                                }
                                            }
                                            for (let p in posters){
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
                                            for (let week in weeklyFViewers){
                                                let weekViewers = new Set(weeklyFViewers[week]);
                                                for (let viewer of weekViewers) {
                                                    if (fViewers.hasOwnProperty(viewer)) {
                                                        fViewers[viewer] = fViewers[viewer] + 1
                                                    } else {
                                                        fViewers[viewer] = 1
                                                    }
                                                }
                                            }
                                            for (let p in fViewers){
                                                if (fViewers[p] > 2) {
                                                    regularFViewers.push(p)
                                                } else {
                                                    occasionalFViewers.push(p)
                                                }
                                            }

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
                                                    for (let student of forumSessions[date]){
                                                        if (regularFViewers.includes(student)){
                                                            regulars.push(student)
                                                        } else {
                                                            occasionals.push(student)
                                                        }
                                                    }
                                                } else {
                                                    orderedForumSessions[date] = 0
                                                }
                                                orderedForumSessionRegulars[date] = regulars.length;
                                                orderedForumRegulars[date] = new Set(regulars).size;
                                                orderedForumSessionOccasionals[date] = occasionals.length;
                                                orderedForumOccasionals[date] = new Set(occasionals).size;

                                                orderedForumPosterOccasionals[date] = 0;
                                                orderedForumPosterRegulars[date] = 0;
                                                if (forumPosters.hasOwnProperty(date)) {
                                                    orderedForumPosters[date] = Math.round(forumPosters[date].length);
                                                    for (let poster of forumPosters[date]) {
                                                        if (regularPosters.includes(poster)) {
                                                            orderedForumPosterRegulars[date] = orderedForumPosterRegulars[date] + 1
                                                        } else {
                                                            orderedForumPosterOccasionals[date] = orderedForumPosterOccasionals[date] + 1
                                                        }
                                                    }
                                                } else {
                                                    orderedForumPosters[date] = 0;
                                                }

                                                if (forumPosts.hasOwnProperty(date)) {
                                                    orderedForumPosts[date] = Math.round(forumPosts[date].length);
                                                    // for (let post of forumPosts[date]) {
                                                    //     if ()
                                                    // }
                                                } else {
                                                    orderedForumPosts[date] = 0;
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
                                                if (forumDurations.hasOwnProperty(date)){
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

                                                'orderedForumPosts': orderedForumPosts,
                                                'orderedForumPosters': orderedForumPosters,
                                                'orderedForumPosterRegulars': orderedForumPosterRegulars,
                                                'orderedForumPosterOccasionals': orderedForumPosterOccasionals,

                                                'orderedForumStudents': orderedForumStudents,
                                                'orderedForumRegulars': orderedForumRegulars,
                                                'orderedForumOccasionals': orderedForumOccasionals,
                                                'annotations': annotations
                                            };
                                            let graphElements = [{'name': 'graphElements', 'object': graphElementMap}];
                                            toastr.info('Processing graph data');
                                            sqlInsert('webdata', graphElements);
                                            callback(graphElementMap, start, end);
                                        })
                                    })
                                });
                            })
                        })
                    });
                });
            });
        }
    })
}

function exportChart(chartId) {
    document.getElementById(chartId).toBlob(function(blob) {
        let a = document.createElement('a');
        let filename = chartId;
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    });
}

function updateChart() {
    $('#loading').show();
    $.blockUI();
    connection.runSql("DELETE FROM webdata WHERE name = 'graphElements'");
    connection.runSql("DELETE FROM webdata WHERE name = 'databaseDetails'");
    connection.runSql("DELETE FROM webdata WHERE name = 'mainIndicators'").then(function (e) {
        $('#loading').hide();
        $.unblockUI();
        toastr.success('Please reload the page now', 'Updating Indicators and Charts', {timeOut: 0})
    });
}



function testApex(graphElementMap, start, end){
    let data = [];

    for (let date in graphElementMap["orderedSessions"]){
        let value = [date, graphElementMap["orderedSessions"][date]];
        data.push(value)
    }

    let optionsDetail = {
        chart: {
            id: 'chartDetail',
            type: 'line',
            height: 250,
            toolbar: {
                autoSelected: 'pan',
                show: false
            }
        },
        colors: ['#546E7A'],
        stroke: {
            width: 3
        },
        // dataLabels: {
        //     enabled: true
        // },
        fill: {
            opacity: 1,
        },
        markers: {
            size: 0
        },
        series: [{
            name: 'Sessions',
            data: data
        }],
        xaxis: {
            type: 'datetime'
        },
        yaxis: {
            min: 0,
            forceNiceScale: true
        }
    };

    let chartDetail = new ApexCharts(
        document.querySelector("#chartDetail"),
        optionsDetail
    );

    chartDetail.render();

    let optionsBrush = {
        chart: {
            id: 'chartBrush',
            height: 150,
            type: 'area',
            brush:{
                target: 'chartDetail',
                enabled: true
            },
            stroke: {
                curve: 'straight'
            },
            selection: {
                enabled: true,
                xaxis: {
                    min: start,
                    max: end
                }
            },
        },
        colors: ['#008FFB'],
        series: [{
            name: 'Sessions',
            data: data
        }],
        fill: {
            type: 'gradient',
            gradient: {
                opacityFrom: 0.91,
                opacityTo: 0.1,
            }
        },
        xaxis: {
            type: 'datetime',
            tooltip: {
                enabled: false
            }
        },
        yaxis: {
            tickAmount: 2,
            min: 0
        }
    };

    let chartBrush= new ApexCharts(
        document.querySelector("#chartBrush"),
        optionsBrush
    );
    chartBrush.render();

    let weekly = true;

    let weeklyPosts = groupWeeklyMapped(graphElementMap, 'orderedForumPosts');
    let weeklyRegPosts = groupWeeklyMapped(graphElementMap, 'orderedForumPosterRegulars');
    let weeklyOccPosts = groupWeeklyMapped(graphElementMap, 'orderedForumPosterOccasionals');
    let weeklyForumSessions = groupWeeklyMapped(graphElementMap, 'orderedForumAvgDurations');
    let weeklyForumStudents = groupWeeklyMapped(graphElementMap, 'orderedForumStudents');

    let dateLabels = [];
    let forumData = [];
    let forumRegData = [];
    let forumOccData = [];
    let forumDurations = [];
    let forumStudents = [];
    if (weekly === true){
        for (let date in weeklyPosts['weeklySum']){
            dateLabels.push(date.toLocaleString())
        }
        forumData = Object.values(weeklyPosts['weeklySum']);
        forumRegData = Object.values(weeklyRegPosts['weeklySum']);
        forumOccData = Object.values(weeklyOccPosts['weeklySum']);
        forumDurations = Object.values(weeklyForumSessions['weeklyAvg']);
        forumStudents = Object.values(weeklyForumStudents['weeklySum']);
    } else {
        for (let date of graphElementMap["dateListChart"]){
            dateLabels.push(date.toLocaleString())
        }
        forumData = Object.values(graphElementMap["orderedForumPosts"]);
        forumRegData = Object.values(graphElementMap["orderedForumPosterRegulars"]);
        forumOccData = Object.values(graphElementMap["orderedForumPosterOccasionals"]);
        forumDurations = Object.values(graphElementMap['orderedForumAvgDurations']);
        forumStudents = Object.values(graphElementMap['orderedForumStudents']);
    }

    let optionsMixed = {
        chart: {
            height: 350,
            type: 'line',
            stacked: true,
        },
        responsive: [{
            breakpoint: 480,
            options: {
                legend: {
                    position: 'bottom',
                    offsetX: -10,
                    offsetY: 0
                }
            }
        }],
        // plotOptions: {
        //     bar: {
        //         horizontal: false,
        //         stacked: true
        //     },
        // },
        series: [{
            name: 'Posts by Regulars',
            type: 'column',
            data: forumRegData
        }, {
            name: 'Posts by Occasionals',
            type: 'column',
            data: forumOccData
        }, {
            name: 'Average time spent in Forums',
            type: 'line',
            data: forumDurations
        // }, {
        //     name: 'Number of Students in Forums',
        //     type: 'line',
        //     data: forumStudents
        }],
        stroke: {
            width: [0, 0, 3, 3]
        },
        title: {
            text: 'Weekly Forum Analysis'
        },
        labels: dateLabels,
        xaxis: {
            type: 'datetime'
        },
        yaxis: [{
        //     // title: {
        //     //     text: 'New Forum Posts',
        //     // },
        //     labels: {
        //         show: false,
        //         formatter: function(val, index) {
        //             return val.toFixed(0);
        //         }
        //     },
        //     seriesName: 'Forum Posts by Reg',
        //     // forceNiceScale: true
        // }, {
        //     title: {
        //         text: 'New Forum Posts',
        //     },
        //     labels: {
        //         show: true,
        //         formatter: function(val, index) {
        //             return val.toFixed(0);
        //         }
        //     },
        //     seriesName: 'Forum Posts by Occ',
        //     forceNiceScale: true
        // }, {
        //     title: {
        //         text: 'Students visiting Forums',
        //     },
        //     labels: {
        //         show: true,
        //         formatter: function(val, index) {
        //             return val.toFixed(0);
        //         }
        //     },
        //     seriesName: 'Number of Students in Forums',
        //     forceNiceScale: true
        // }, {
            opposite: true,
            title: {
                text: 'Seconds in Forums / New Posts'
            },
            labels: {
                show: true,
                formatter: function(val, index) {
                    return val.toFixed(0);
                }
            },
            seriesName: 'Average time spent in Forums',
            forceNiceScale: true
        }]
    };

    let chartMixed = new ApexCharts(
        document.querySelector("#chartMixed"),
        optionsMixed
    );

    chartMixed.render();
}

function deleteEverything() {
    let query = 'DELETE FROM sessions';
    let r = confirm("WARNING!\nTHIS WILL DELETE EVERYTHING IN THE DATABASE");
    if (r === true) {
        $('#loading').show();
        $.blockUI();
        connection.clear('sessions').then(function () {
            console.log('Cleared sessions table');
            connection.clear('video_interaction').then(function () {
                console.log('Cleared video_interaction table');
                connection.clear('submissions').then(function () {
                    console.log('Cleared submissions ');
                    connection.runSql(query).then(function () {
                        console.log('Cleared quiz_sessions ');
                        connection.clear('course_learner').then(function () {
                            console.log('Cleared course_learner ');
                            connection.clear('forum_sessions').then(function () {
                                console.log('Cleared forum_sessions ');
                                connection.dropDb().then(function(result){
                                    if (result === 1){
                                        $('#loading').hide();
                                        $.unblockUI();
                                        toastr.success('Database has been deleted!')
                                    }
                                });
                            }).catch(function (err) {
                                console.log(err);
                                alert('The deletion process started but did not finish,\n please refresh and try again');
                            });
                        }).catch(function (err) {
                            console.log(err);
                            alert('The deletion process started but did not finish,\n please refresh and try again');
                        });
                    }).catch(function (err) {
                        console.log(err);
                        alert('The deletion process started but did not finish,\n please refresh and try again');
                    });
                }).catch(function (err) {
                    console.log(err);
                    alert('The deletion process started but did not finish,\n please refresh and try again');
                });
            }).catch(function (err) {
                console.log(err);
                alert('The deletion process started but did not finish,\n please refresh and try again');
            });
        }).catch(function (err) {
            console.log(err);
            alert('Could not delete database, please try again');
        });
    } else {
        alert('Nothing was deleted')
    }
}

// Returns the ISO week of the date.
Date.prototype.getWeek = function() {
    let date = new Date(this.getTime());
    date.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    // January 4 is always in week 1.
    let week1 = new Date(date.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1.
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
        - 3 + (week1.getDay() + 6) % 7) / 7);
};

// Returns the four-digit year corresponding to the ISO week of the date.
Date.prototype.getWeekYear = function() {
    let date = new Date(this.getTime());
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    return date.getFullYear();
};

function getEdxDbQuery() {
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
    let unorderedVideos = [];
    let arcData = {};
    connection.runSql("SELECT * FROM metadata WHERE name = 'metadata_map' ").then(function(result) {
        if (result.length !== 1) {
            console.log('Metadata empty')
        } else {
            let course_metadata_map = result[0]['object'];
            let courseId = course_metadata_map.course_id;
            courseId = courseId.slice(courseId.indexOf(':') + 1,);
            connection.runSql("SELECT * FROM course_learner").then(function (learners) {
                learners.forEach(function (learner) {
                    learnerIds.push(learner.course_learner_id);
                    learnerStatus[learner.course_learner_id] = learner.certificate_status;
                });

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
                        })
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
                }

                let videoChains = {};
                let passingChains = {};
                // learnerIds = learnerIds.slice(0, 5000);
                let maxViewers = 0;
                let counter = 0;
                for (let learner of learnerIds) {
                    let learnerSessions = [];
                    let query = "SELECT * FROM video_interaction WHERE course_learner_id = '" + learner + "'";
                    connection.runSql(query).then(function (sessions) {
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
                            if (learnerStatus[learner] === 'downloadable'){
                                passingChains[learner] = videoChain;
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
                                        frequency[nextVideo] = frequency[nextVideo] / videoIds[video].length;
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
                                        frequency[nextVideo] = frequency[nextVideo] / videoIds[video].length;
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

                            let i = 0;
                            let nodes = [];
                            let links = [];
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
                                i++;
                                nodes.push({
                                    'name': 'Video ' + i,
                                    'info': percentages,
                                    'n': (videoIds[currentVideo].length / maxViewers) * 20,
                                    'grp': 1,
                                    'id': currentVideo
                                });
                            }
                            console.log(frequencies);
                            console.log(frequenciesP);
                            arcData['nodes'] = nodes;
                            arcData['links'] = links;
                            let arcElements = [{'name': 'arcElements', 'object': arcData}];
                            connection.runSql("DELETE FROM webdata WHERE name = 'arcElements'").then(function (success) {
                                sqlInsert('webdata', arcElements);
                                drawVideoArc();
                            });
                        }
                    });
                }
            })
        }
    });
}

function drawVideoArc(){ // https://www.d3-graph-gallery.com/graph/arc_template.html
    connection.runSql("SELECT * FROM webdata WHERE name = 'arcElements' ").then(function(result) {
        if (result.length !== 1) {
            videoTransitions()
        } else {
            let nodeData = result[0]['object'];
            let margin = {top: 0, right: 150, bottom: 250, left: 150},
                width = Math.max(
                    document.body.scrollWidth,
                    document.documentElement.scrollWidth,
                    document.body.offsetWidth,
                    document.documentElement.offsetWidth,
                    document.documentElement.clientWidth
                ) - margin.left - margin.right,
                height = 600 - margin.top - margin.bottom;

            let svg = d3.select("#videoArc")
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform",
                    "translate(" + margin.left + "," + margin.top + ")");

                svg.append("text")
                .attr("x", (width / 30))
                .attr("y", 20 - (margin.top / 2))
                .attr("text-anchor", "middle")
                .style("font-size", "16px")
                .style("text-decoration", "underline")
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

            // Add the links
            let links = svg
                .selectAll('mylinks')
                .data(nodeData.links)
                .enter()
                .append('path')
                .attr('d', function (d) {
                    if (d.status === 'passing') {
                        start = x(idToNode[d.source].name);
                        end = x(idToNode[d.target].name);
                        return ['M', start, height - 30,
                            'A',
                            (start - end) / 2.3, ',',
                            (start - end) / 2, 0, 0, ',',
                            start < end ? 1 : 1, end, ',', height - 30] // We always want the arc on top. So if end is before start, putting 0 here turn the arc upside down.
                            .join(' ');
                    // } else if (d.status === 'general') {
                    } else {
                        start = x(idToNode[d.source].name);
                        end = x(idToNode[d.target].name);
                        return ['M', start, height - 30,
                            'A',
                            (start - end) / 2.3, ',',
                            (start - end) / 2, 0, 0, ',',
                            start < end ? 1 : 1, end, ',', height - 30] // We always want the arc on top. So if end is before start, putting 0 here turn the arc upside down.
                            .join(' ');
                    }
                })
                .style("fill", "none")
                .attr("stroke", "grey")
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
                .attr("stroke", "white");

            let labels = svg
                .selectAll("mylabels")
                .data(nodeData.nodes)
                .enter()
                .append("text")
                .attr("x", 0)
                .attr("y", 0)
                .text(function (d) {
                    return (d.name)
                })
                .style("text-anchor", "end")
                .attr("transform", function (d) {
                    return ("translate(" + (x(d.name)) + "," + (height - 15) + ")rotate(-45)")
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
                        // .style('stroke', function (link_d) {
                        //     return link_d.source === d.id ? '#b83b00' : '#b8b8b8';
                        // })
                        .style('stroke', function (link_d) {
                            if (link_d.status === 'general') {
                                return link_d.source === d.id ? '#b83b00' : '#b8b8b8';
                            } else {
                                return link_d.source === d.id ? '#138d00' : '#b8b8b8';
                            }
                        })
                        .style('stroke-opacity', function (link_d) {
                            return link_d.source === d.id || link_d.target === d.id ? 1 : .2;
                        })
                        .style('stroke-width', function (link_d) {
                            return link_d.source === d.id || link_d.target === d.id ? 10 * (d.value) : 5;
                        });
                    labels
                        .style("font-size", function (label_d) {
                            return label_d.name === d.name ? 16 : 2
                        })
                        .attr("y", function (label_d) {
                            return label_d.name === d.name ? 10 : 0
                        });
                    tooltip
                        .style("top", (event.pageY - 250) + "px")
                        .style("left", (event.pageX - 50) + "px")
                        .html(d.info)
                        .style("visibility", "visible");

                })
                .on('mouseout', function (d) {
                    nodes.style('opacity', 1);
                    links
                        .style('stroke', 'grey')
                        .style('stroke-opacity', .8)
                        .style("stroke-width", function (d) {
                            return 10 * (d.value)
                        });
                    labels
                        .text(function (d) {
                            return (d.name)
                        })
                        .attr("y", 0)
                        .style("font-size", 10);
                    tooltip
                        .style("visibility", "hidden");
                })
        }
    })
}

function webdataJSON(){
    connection.runSql("SELECT * FROM webdata").then(function(webElements) {
        let jsonString = '';
        webElements.forEach(function (element) {
            // console.log(JSON.stringify(element))
            jsonString += JSON.stringify(element) + ',\n'
        });
        console.log(jsonString)
    })
}

function populateSamples(courseId){
    let courseMap = {'FP101x': "DelftX+FP101x+3T2015.json",
                     'TW3421x': "DelftX+TW3421x+3T2016.json"};
    let courseFile = 'samples/' + courseMap[courseId];
    connection.runSql("SELECT * FROM webdata").then(function(metadata) {
        if (metadata.length > 1){
            toastr.error('The database has to be clear first!');
        } else {
            toastr.info('Reading sample');
            $.getJSON(courseFile, function(json) {
                sqlInsert('webdata', json);
                toastr.success('Please reload the page now', 'Sample data ready', {timeOut: 0})
            })
        }
    })
}

// R SCRIPT FOR MARKOV CHAIN VIZ
// video.str <-
// video.m <- read.table(text = video.str, header = T, allowEscapes = TRUE, sep = ',', stringsAsFactors = F, row.names = 1, check.names = F)
// video.m <- read.table(text = video.str, allowEscapes = TRUE, sep = ',', stringsAsFactors = F)
// video.t <- data.matrix(video.m)
// g <- graph_from_adjacency_matrix(video.t, weighted = "prob")
// E(g)$prob <- ifelse(is.nan(E(g)$prob), NA, E(g)$prob)
// plot(g, edge.label = round(E(g)$prob, 2), edge.arrow.size = .25, edge.label.cex = .5)

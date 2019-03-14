var connection = new JsStore.Instance(new Worker('scripts/jsstore.worker.js'));
define(function (require) {
    pako = require('pako');
});
window.onload = function () {
    brython({debug: 1});
    //// DATABASE INITIALIZATION SCRIPTS //////////////////////////////////////////////////////////////////////////////
    // initiateDb();
    initiateEdxDb();
    $('#btnAddStudent').click(function () {
        window.location.href = 'add.html';
    });
    $('#tblGrid tbody').on('click', '.edit', function () {
        var StudentId = $(this).parents().eq(1).attr('itemid');
        window.location.href = 'add.html?id=' + StudentId;
    });
    $('#tblGrid tbody').on('click', '.delete', function () {
        var Result = confirm('Are you sure, you want to delete?');
        if (Result) {
            var StudentId = $(this).parents().eq(1).attr('itemid');
            deleteData(StudentId);
        }
    });
    //// FILE SYSTEM SCRIPTS ///////////////////////////////////////////////////////////////////////////
    // const fileInput = document.getElementById('fileInput');
    // const fileDisplayArea = document.getElementById('fileDisplayArea');
    //
    // fileInput.addEventListener('change', function(e) {
    //     let file = fileInput.files[0];
    //     let textType = /text.*/;
    //     let gzipType = /gzip/;
    //
    //     if (file.type.match(textType)) {
    //         let reader = new FileReader();
    //         reader.onload = function (e) {
    //             fileDisplayArea.innerText = reader.result;
    //         };
    //         reader.readAsText(file);
    //
    //     } else if (file.type.match(gzipType)) {
    //         let reader = new FileReader();
    //         reader.onload = function(event) {
    //             let result = pako.inflate(event.target.result, { to: 'string' });
    //             // console.log(result);
    //             let message = result.split('\n');
    //             fileDisplayArea.innerText = 'This document is '.concat(result.length, ' characters long' +
    //                 ' and the first line is: \n', message[0]);
    //         };
    //         reader.readAsArrayBuffer(file);
    //
    //     } else if (file.name.endsWith('sql')) {
    //         let reader = new FileReader();
    //         reader.onload = function (e) {
    //             fileDisplayArea.innerText = reader.result;
    //         };
    //         reader.readAsText(file);
    //
    //     } else {
    //         fileDisplayArea.innerText = "File not supported!"
    //     }
    // });

    //// MULTI FILE SYSTEM SCRIPTS ///////////////////////////////////////////////////////////////////////////
    let  multiFileInput = document.getElementById('filesInput');
    multiFileInput.addEventListener('change', function (e) {
        $('#loading').show();
        let files = multiFileInput.files;
        readMetaFiles(files, passFiles);
    });

    let  multiFileInputLogs = document.getElementById('logFilesInput');
    multiFileInputLogs.addEventListener('change', function (e) {
        // $('#loading').show();
        let files = multiFileInputLogs.files;
        // readLogFiles(files, passLogFiles);
        processLogFiles(files)
    });
};

function readMetaFiles(files, callback){
    let output = [];
    let checkedFiles = {};
    let processedFiles = [];
    let fileNames = 'Names: ';
    let counter = 1;
    let gzipType = /gzip/;
    let sqlType = 'sql';
    let jsonType = 'json';

    for (const f of files) {
        output.push('<li><strong>', f.name, '</strong> (', f.type || 'n/a', ') - ',
            f.size, ' bytes', '</li>');

        // if (f.type.match(gzipType)) {
        //     const reader = new FileReader();
        //     reader.onloadend = function (event) {
        //         let result = pako.inflate(event.target.result, {to: 'string'});
        //         console.log('This document is '.concat(result.length, ' characters long'));
        //         passLogFiles(result);
        //         counter++;
        //     };
        //     reader.readAsArrayBuffer(f);

        if (f.name.includes(sqlType) || (f.name.includes(jsonType))) {
            const reader = new FileReader();
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
            };
            reader.readAsText(f);
        } else {
            counter ++;
        }
    }
}

function readLogFiles(files, callback){
    let output = [];
    let processedFiles = [];
    let counter = 1;
    let gzipType = /gzip/;
    let sqlType = 'sql';
    let jsonType = 'json';

    for (const f of files) {
        output.push('<li><strong>', f.name, '</strong> (', f.type || 'n/a', ') - ',
            f.size, ' bytes', '</li>');

        if (f.type.match(gzipType)) {
            const reader = new FileReader();
            reader.onloadend = function (event) {
                let content = pako.inflate(event.target.result, {to: 'string'});
                processedFiles.push({
                    key: f.name,
                    value: content
                });
                if (counter === files.length) {
                    callback([processedFiles, output]);
                }
                counter++;
            };
            reader.readAsArrayBuffer(f);

        // } else if (f.name.includes(sqlType) || (f.name.includes(jsonType))) {
        //     const reader = new FileReader();
        //     reader.onloadend = function () {
        //         let content = reader.result;
        //         processedFiles.push({
        //             key: f.name,
        //             value: content
        //         });
        //         if (counter === files.length) {
        //             callback([processedFiles, output]);
        //         }
        //         counter++;
        //     };
        //     reader.readAsText(f);

        } else {
            counter ++;
        }
    }
}

function processLogFiles(files){
    const reader = new FileReader();
    for (const f of files) {
        readAndPassLog(f, reader, passLogFiles)
    }
}


function readAndPassLog(f, reader, callback){
    let output = [];
    let processedFiles = [];
    let gzipType = /gzip/;
    // Continue here! The idea is to reuse the reader, but we have to wait until it's done.
    // Otherwise there's an error that it's already busy reading.
    output.push('<li><strong>', f.name, '</strong> (', f.type || 'n/a', ') - ',
        f.size, ' bytes', '</li>');

    if (f.type.match(gzipType)) {
        // const reader = new FileReader();
        reader.onloadend = function (event) {
            let content = pako.inflate(event.target.result, {to: 'string'});
            processedFiles.push({
                key: f.name,
                value: content
            });
            callback([processedFiles, output]);
        };
        reader.readAsArrayBuffer(f);
    } else {
        alert(f.name + ' is not a log file');
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////

function passFiles(result){
    const reader = new FileReader();
    let names = result[0];
    let output = result[1];
    document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
    let answer = JSON.stringify(names);
    let readerEvent = new CustomEvent("studentMetaReader", {
        "detail": answer
    });
    document.dispatchEvent(readerEvent);
}

// function passLogFiles(result){
//     let files = result[0];
//     let output = result[1];
//     document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
//     files = JSON.stringify(files);
//     let readerEvent = new CustomEvent("logFileReader", {
//         "detail": files
//     });
//     document.dispatchEvent(readerEvent);
// }

function passLogFiles(result){
    let files = result[0];
    let output = result[1];
    let list = document.getElementById('listLogs').innerHTML;
    document.getElementById('listLogs').innerHTML = list +'<ul>' + output.join('') + '</ul>';
    // connection.runSql('SELECT * FROM metadata').then(function(result) {
    //     let readerEvent = new CustomEvent("logFileReader", {
    //         "detail": [result, files]
    //     });
    //     document.dispatchEvent(readerEvent);
    // });
}

////////////////////////////////////////////////////////////////////////////////////////////////
// BRYTHON FUNCTIONS

function sqlQuery(query){
    connection.runSql(query).then(function(result) {
        let answer = JSON.stringify(result);
        let passData = new CustomEvent("finishedQuery", {
            "detail": answer
        });
        document.dispatchEvent(passData);
    });
}

function getMetaMap(){
    connection.runSql('SELECT * FROM metadata').then(function(result) {
        let answer = JSON.stringify(result);
        let passData = new CustomEvent("metaMapReady", {
            "detail": answer
        });
        document.dispatchEvent(passData);
    });
}

function sqlInsert(table, data) {
    connection.runSql('DELETE FROM ' + table);
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
        if (rowsAdded > 0) {
            console.log('Successfully added: ', table);
        }
    }).catch(function (err) {
        console.log(err);
    });
}

function sqlLogInsert(table, data) {
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
        if (rowsAdded > 0) {
            console.log('Successfully added: ', table);
        }
    }).catch(function (err) {
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

function progress_display(content){
    let table = document.getElementById("progress_tab");
    let row = table.insertRow();
    let cell1 = row.insertCell();
    cell1.innerHTML = content
    //document.getElementById("progress").innerHTML = content;
}

////////////////////////////////////////////////////////////////////////////////////////////////
// DATABASE FUNCTIONS
function initiateEdxDb() {
    let dbName = "edxdb";
    connection.runSql('ISDBEXIST ' + dbName).then(function (isExist) {
        if (isExist) {
            connection.runSql('OPENDB ' + dbName).then(function () {
                console.log('edx db ready');
                showCoursesTableDataExtra();
            });
        } else {
            console.log('Generating edx database');
            let dbQuery = getEdxDbQuery();
            connection.runSql(dbQuery).then(function (tables) {
                // console.log(tables);
                // showCoursesTableDataExtra();
                alert('Database prepared, please refresh the page');
            });
        }
    }).catch(function (err) {
        console.log(err);
        alert(err.message);
    });
}

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
           forum_interaction + forum_sessions + survey_descriptions + survey_responses );
}

function showCoursesTableDataExtra() {
    connection.runSql('select * from courses').then(function (courses) {
        let HtmlString = "";
        courses.forEach(function (course) {
            HtmlString += "<tr ItemId=" + course.course_id + "><td>" +
                course.course_name + "</td><td>" +
                course.start_time + "</td><td>" +
                course.end_time + "</td><td>" ;
            let query = "count from course_elements where course_id = '" + course.course_id + "'";
            connection.runSql(query).then(function (result) {
                HtmlString += result + "</td><td>" ;
                let query = "count from learner_index where course_id = '" + course.course_id + "'";
                connection.runSql(query).then(function (result) {
                    HtmlString += result;
                    $('#tblGrid tbody').html(HtmlString);
                })
            })
        });
    }).catch(function (error) {
        console.log(error);
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////
// function fileReader(file){
//     return new Promise( function (resolve, reject) {
//         let reader = new FileReader();
//         reader.onloadend = function (e) {
//             if (reader.readyState === 2){
//                 resolve(reader.result);
//             }
//         };
//         reader.readAsText(file);
//         reader.onerror = reject;
//     });
// }


// function deleteData(studentId) {
//     var query = new SqlWeb.Query("DELETE FROM Student WHERE Id='@studentId'");
//     query.map("@studentId", Number(studentId));
//     connection.runSql(query).
//     then(function (rowsDeleted) {
//         console.log(rowsDeleted + ' rows deleted');
//         if (rowsDeleted > 0) {
//             showTableData();
//         }
//     }).catch(function (error) {
//         console.log(err);
//         alert(error.message);
//     });
// }

// function initiateDb() {
//     var dbName = "Students";
//     connection.runSql('ISDBEXIST ' + dbName).then(function (isExist) {
//         if (isExist) {
//             connection.runSql('OPENDB ' + dbName).then(function () {
//                 console.log('db opened');
//             });
//             showTableData();
//         } else {
//             var dbQuery = getDbQuery();
//             connection.runSql(dbQuery).then(function (tables) {
//                 console.log(tables);
//             });
//             insertStudents();
//             showTableData();
//         }
//     }).catch(function (err) {
//         console.log(err);
//         alert(err.message);
//     });
// }

// function getDbQuery() {
//     var db = "DEFINE DB Students;";
//     var tblStudent = `DEFINE TABLE Student(
//         Id PRIMARYKEY AUTOINCREMENT,
//         Name NOTNULL STRING,
//         GENDER STRING DEFAULT 'male',
//         Country NOTNULL STRING,
//         City NOTNULL
//     )
//     `;
//     var dbQuery = db + tblStudent;
//     return dbQuery;
// }
//
// function insertStudents() {
//     var students = getStudents();
//     var query = new SqlWeb.Query("INSERT INTO Student values='@val'");
//     query.map("@val", students);
//     connection.runSql(query).then(function (rowsAdded) {
//         if (rowsAdded > 0) {
//             alert('Successfully added');
//         }
//     }).catch(function (err) {
//         console.log(err);
//         alert('Error Occurred while adding data')
//     });
// }
//
// //This function refreshes the table
// function showTableData() {
//     connection.runSql('select * from Student').then(function (students) {
//         var HtmlString = "";
//         students.forEach(function (student) {
//             HtmlString += "<tr ItemId=" + student.Id + "><td>" +
//                 student.Name + "</td><td>" +
//                 student.Gender + "</td><td>" +
//                 student.Country + "</td><td>" +
//                 student.City + "</td><td>" +
//                 "<a href='#' class='edit'>Edit</a></td>" +
//                 "<td><a href='#' class='delete''>Delete</a></td>";
//         });
//         $('#tblGrid tbody').html(HtmlString);
//     }).catch(function (error) {
//         console.log(error);
//     });
// }
//
// function getStudents() {
//     //Student Array
//     var Students = [{
//         Name: 'Alfred',
//         Gender: 'male',
//         Country: 'Germany',
//         City: 'Berlin'
//         },
//         {
//             Name: 'George',
//             Gender: 'male',
//             Country: 'America',
//             City: 'Detroit'
//         },
//         {
//             Name: 'Berglunds',
//             Gender: 'female',
//             Country: 'Sweden',
//             City: 'Luleå'
//         },
//         {
//             Name: 'Eastern',
//             Gender: 'male',
//             Country: 'Canada',
//             City: 'QWE'
//         },
//     ];
//     return Students;
// }


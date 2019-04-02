let connection = new JsStore.Instance(new Worker('scripts/jsstore.worker.js'));

// let define function (require) {
//     pako = require('pako');
// };

window.onload = function () {
    brython();
    //// DATABASE INITIALIZATION SCRIPTS //////////////////////////////////////////////////////////////////////////////
    // initiateDb();
    initiateEdxDb();

    // $('#btnAddStudent').click(function () {
    //     window.location.href = 'add.html';
    // });
    // $('#tblGrid tbody').on('click', '.edit', function () {
    //     let StudentId = $(this).parents().eq(1).attr('itemid');
    //     window.location.href = 'add.html?id=' + StudentId;
    // });
    // $('#tblGrid tbody').on('click', '.delete', function () {
    //     let Result = confirm('Are you sure, you want to delete?');
    //     if (Result) {
    //         let StudentId = $(this).parents().eq(1).attr('itemid');
    //         deleteData(StudentId);
    //     }
    // });

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
        // $('#loading').show();
        let files = multiFileInput.files;
        readMetaFiles(files, passFiles);
    });

    let  multiFileInputLogs = document.getElementById('logFilesInput');
    multiFileInputLogs.addEventListener('change', function (e) {
        // $('#loading').show();
        //let files = multiFileInputLogs.files;
        // readLogFiles(files, passLogFiles);
        // processLogFiles(files, 0)
        processLogFiles(0, 0)
    });
};

let reader = new FileReader();

function readMetaFiles(files, callback){
    let output = [];
    let checkedFiles = {};
    let processedFiles = [];
    let fileNames = 'Names: ';
    let counter = 1;
    let gzipType = /gzip/;
    let sqlType = 'sql';
    let jsonType = 'json';
    let mongoType = 'mongo';

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

        if (f.name.includes(sqlType) || (f.name.includes(jsonType)) || (f.name.includes(mongoType))) {
            const reader = new FileReader();
            reader.onload = function () {
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

function processLogFiles(index, chunk){
    let  multiFileInputLogs = document.getElementById('logFilesInput');
    let files = multiFileInputLogs.files;
    let counter = 0;
    let total = files.length;
    for (const f of files) {
        if (counter === index){
            let today = new Date();
            let time = (today.getHours() + ":" + today.getMinutes() + ":" +
                        today.getSeconds() + '.' + today.getMilliseconds());
            console.log('Starting with file ' + index + ' at ' + time);
            readAndPassLog(f, reader, index, total, chunk, passLogFiles)
        }
        counter += 1;
    }
}


function readAndPassLog(f, reader, index, total, chunk, callback){
    let output = [];
    let processedFiles = [];
    let gzipType = /gzip/;
    let chunk_size = 5000;
    output.push('<li><strong>', f.name, '</strong> (', f.type || 'n/a', ') - ',
                f.size, ' bytes', '</li>');

    if (f.type.match(gzipType)) {
        // const reader = new FileReader();
        reader.onloadend = function (event) {
            let content = pako.inflate(event.target.result, {to: 'string'});
            let lines = content.split('\n');
            // if (chunk === 0){
            //     let today = new Date();
            //     let starting = (today.getHours() + ":" + today.getMinutes() +
            //                     ":" + today.getSeconds() + '.' + today.getMilliseconds());
            //     document.getElementById('progress_time').innerHTML = 'Processing - Started at ' + starting + ' ';
            //     progress_display('Working on file ' + (index + 1) + ' out of ' + total +
            //                       ' with ' + Math.ceil(lines.length/chunk_size) + ' stages');
            //     document.getElementById('progress_bar').innerHTML = 'Processing: ';
            // }
            processedFiles.push({
                key: f.name,
                value: lines.slice((chunk * chunk_size), chunk_size + (chunk*chunk_size)).join('\n')
                // value: content
            });
            callback([processedFiles, output, index, total, chunk]);
        };
        reader.readAsArrayBuffer(f);
    } else if (f.name.includes('-log')) {
        // const reader = new FileReader();
        reader.onload = function () {
            let content = reader.result;
            let lines = content.split('\n');
            if (chunk === 0){
                let today = new Date();
                let starting = (today.getHours() + ":" + today.getMinutes() +
                    ":" + today.getSeconds() + '.' + today.getMilliseconds());
                document.getElementById('progress_time').innerHTML = 'Processing - Started at ' + starting + ' ';
                progress_display('Working on file ' + (index + 1) + ' out of ' + total +
                    ' with ' + Math.ceil(lines.length/chunk_size) + ' stages');
                document.getElementById('progress_bar').innerHTML = 'Processing: ';
            }
            processedFiles.push({
                key: f.name,
                value: lines.slice((chunk * chunk_size), chunk_size + (chunk*chunk_size)).join('\n')
            });
            callback([processedFiles, output, index, total, chunk]);
        };
        reader.readAsText(f);
    } else {
        alert(f.name + ' is not a log file');
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////

function passFiles(result){
    let names = result[0];
    let output = result[1];
    document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
    // let answer = JSON.stringify(names);
    // let readerEvent = new CustomEvent("studentMetaReader", {
    //     "detail": answer
    // });
    // document.dispatchEvent(readerEvent);
    learner_mode(names);
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
    let index = result[2];
    let total = result[3];
    let chunk = result[4];
    let list = document.getElementById('listLogs').innerHTML;
    // document.getElementById('listLogs').innerHTML = list +'<ul>' + output.join('') + '</ul>';
    connection.runSql('SELECT * FROM metadata').then(function(result) {
        // let today = new Date();
        // let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();
        // console.log('Passing file ' + index + ' chunk ' + chunk + ' to Brython at ' + time);
        // let readerEvent = new CustomEvent("logFileReader", {
        //     "detail": [result, files, index, total, chunk]
        // });
        // document.dispatchEvent(readerEvent);
        let course_metadata_map = result[0]['object'];
        // session_mode(course_metadata_map, files, index, total, chunk);
        // forum_sessions(course_metadata_map, files, index, total, chunk);
        // video_interaction(course_metadata_map, files, index, total, chunk);
        // quiz_mode(course_metadata_map, files, index, total, chunk);
        quiz_sessions(course_metadata_map, files, index, total, chunk);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////
// USER INTERACTION FUNCTIONS

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
            let today = new Date();
            let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();
            console.log('Successfully added: ', table, ' at ', time);
            if (table === 'metadata'){
                alert('Please reload the page now')
            }
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
            let today = new Date();
            let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();
            console.log('Successfully added: ', table, ' at ', time);
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
                console.log(tables);
                // showCoursesTableDataExtra();
                alert('Database prepared, please refresh the page');
            });
        }
    }).catch(function (err) {
        console.log(err);
        alert(err.message);
    });
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

                    course_metadata_map['start_time'] = course_metadata_map['start_date'];
                    course_metadata_map['end_time'] = course_metadata_map['end_date'];

                    for (let child of jsonObject[record]['children']) {
                        child_parent_map[child] = record;
                    }
                    element_time_map[record] = new Date(jsonObject[record]['metadata']['start']);
                    element_type_map[record] = jsonObject[record]['category'];
                } else {
                    let element_id = record;
                    for (let child of jsonObject[element_id]['children']) {
                        child_parent_map[child] = element_id;
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
                    while (!(element_parent in element_time_map)) {
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
            console.log('Metadata map ready');
            return course_metadata_map;
        }
    }
}


function learner_mode(files) {
    let report = [];
    let course_record = [];
    let course_element_record = [];
    let learner_index_record = [];
    let course_learner_record = [];
    let learner_demographic_record = [];
    let course_metadata_map = ExtractCourseInformation(files);
    console.log(course_metadata_map);

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
                    let course_id = record[2];
                    let time = record[3];
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
            let file_name = file['key']
            let num_uncertifiedLearners = 0;
            let num_certifiedLearners = 0;
            if (file_name.includes('certificates_generatedcertificate')) {
                let input_file = file['value'];
                let lines = input_file.split('\n');
                for (let line of lines) {
                    let record = line.split('\t');
                    if (record.length < 10) {
                        continue;
                    }
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
            let file_name = file['key']
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
        console.log('All metadata ready');
        console.log(learner_index_record.length);
        console.log(course_learner_record.length);
        console.log(learner_demographic_record.length);
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
            // sqlInsert('courses', data);
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
            // sqlInsert ('course_elements', data);
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
                let py_values = {'global_learner_id': global_learner_id, 'course_id': course_id, 
                    'course_learner_id': course_learner_id};
                data.push(py_values);
            }
            // sqlInsert ('learner_index', data);
        }
        else {
            console.log('no learner index info');
        }
        if (course_learner_record.length > 0) {
            let data = [];
            for (let array of course_learner_record) {
                let course_learner_id = array[0];
                let final_grade = process_null(array[1]);
                if (typeof final_grade !== 'number'){
                    console.log(final_grade, typeof final_grade);

                }
                let enrollment_mode = array[2];
                let certificate_status = array[3];
                let register_time = process_null(array[4]);
                let py_values = {'course_learner_id': course_learner_id, 'final_grade': final_grade, 
                    'enrollment_mode': enrollment_mode, 'certificate_status': certificate_status, 
                    'register_time': register_time};
                data.push(py_values);
            }
            // sqlInsert('course_learner', data);
        }
        else {
            console.log('no enrolled students info');
        }
        if (learner_demographic_record.length > 0) {
            let data = [];
            for (let array of learner_demographic_record) {
                let course_learner_id = process_null (array[0]);
                let gender = array[1];
                let year_of_birth = process_null(array[2]);
                let level_of_education = array[3];
                let country = array[4];
                let email = array[5];
                email = email.replace(/"/g, '');
                let py_values = {'course_learner_id': course_learner_id, 'gender': gender, 'year_of_birth': year_of_birth,
                    'level_of_education': level_of_education, 'country': country, 'email': email};
                data.push(py_values);
            }
            // sqlInsert('learner_demographic', data);
        }
        else {
            console.log('no learner demographic info');
        }
        let map_to_store = course_metadata_map;
        // map_to_store['start_time'] = start_time.isoformat ();
        // map_to_store['end_time'] = end_time.isoformat ();
        // for (let element of map_to_store ['element_time_map']) {
        //     map_to_store ['element_time_map'][element] = course_metadata_map['element_time_map'][element].isoformat ();
        // }
        // for (let element of map_to_store ['element_time_map_due']) {
        //     map_to_store ['element_time_map_due'][element] = course_metadata_map['element_time_map_due'][element].isoformat ();
        // }
        let store_map = [{'name': 'metadata_map', 'object': map_to_store}];
        // sqlInsert ('metadata', store_map);
        // loader.hide();
        // if (window.confirm('Download processing report?')) {
        //     let report = '\n'.join (report);
        //     window.download ('report.txt', report);
        //     alert ('Your data is being stored, please wait a couple minutes before reloading this page');
        // }
        // else {
        //     window.console.log ('No report downloaded');
        //     alert ('Your data is being stored, please wait a couple minutes before reloading this page');
        // }
    }
    else {
        console.log('Course structure file not found');
        // jq ('#loading').hide ();
        // if (window.confirm ('Download processing report?')) {
        //     let report = '\n'.join (report);
        //     window.download ('report.txt', report);
        // }
        // else {
        //     window.console.log ('No report downloaded');
        // }
    }
};


// TRANSLATION MODULES

function session_mode(course_metadata_map, log_files, index, total, chunk){
    let zero_start = performance.now();
    // let current_date = course_metadata_map["start_date"];
    // let end_next_date  = getNextDay(course_metadata_map["end_date"]);
    let learner_all_event_logs = [];
    let updated_learner_all_event_logs = {};
    let session_record = [];

    for (const f in log_files){
        let file_name = log_files[f]['key'];
        let input_file = log_files[f]['value'];
        if (file_name.includes('log')){

            let today = new Date();
            let start = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();

            // let counter = 0;
            console.log('Starting chunk', chunk, 'at', start);
            learner_all_event_logs = [];
            learner_all_event_logs = updated_learner_all_event_logs;
            updated_learner_all_event_logs = [];

            let course_learner_id_set = new Set();
            for (const course_learner_id in learner_all_event_logs){
                course_learner_id_set.add(course_learner_id)
            }
            let lines = input_file.split('\n');
            console.log(lines.length + ' lines to process in file');

            let new_line_reader = ['new_line_reader']; // Performance
            let existing_line_reader = ['existing_line_reader']; // Performance

            for (let line of lines){
                // let line = lines[x];
                let start = performance.now();
                if (line.length < 10) { continue; }
                let jsonObject = JSON.parse(line);
                if (jsonObject['context'].hasOwnProperty('user_id') === false ){continue;}
                let global_learner_id = jsonObject["context"]["user_id"];
                let event_type = jsonObject["event_type"];

                if (global_learner_id !== ''){
                    let course_id = jsonObject["context"]["course_id"];
                    let course_learner_id = course_id + "_" + global_learner_id;

                    let event_time = jsonObject["time"];
                    event_time = event_time.slice(0,19);
                    event_time = event_time.replace("T", " ");
                    // event_time = datetime.datetime.strptime(event_time,"%Y-%m-%d %H:%M:%S")
                    if (course_learner_id_set.has(course_learner_id)){
                        learner_all_event_logs[course_learner_id].push({"event_time":event_time, "event_type":event_type});
                        existing_line_reader.push(performance.now() - start) // Performance
                    } else {
                        learner_all_event_logs[course_learner_id] = [{"event_time":event_time, "event_type":event_type}];
                        course_learner_id_set.add(course_learner_id);
                        new_line_reader.push(performance.now() - start) // Performance
                    }
                }
            }
            let sorter = ['sorter']; // Performance
            let starting_event = ['starting_event'];// Performance
            let cont_event_a = ['cont_event_a'];// Performance
            let cont_event_b = ['cont_event_b'];// Performance

            for (let course_learner_id in learner_all_event_logs){
                let start = performance.now();
                let event_logs = learner_all_event_logs[course_learner_id];
                event_logs.sort(function(a, b) {
                    return new Date(a.event_time) - new Date(b.event_time) ;
                });
                sorter.push(performance.now() - start);// Performance
                let session_id = "";
                let start_time = "";
                let end_time = "";
                let final_time = "";
                for (let i in event_logs){
                    let start = performance.now();
                    if (start_time === ''){
                        start_time = new Date(event_logs[i]["event_time"]);
                        end_time = new Date(event_logs[i]["event_time"]);
                        starting_event.push(performance.now() - start);// Performance
                    } else {
                        if (new Date(event_logs[i]["event_time"]) > end_time.setMinutes(end_time.getMinutes() + 30)){
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

                            cont_event_a.push(performance.now()-start);// Performance

                        } else {
                            if (event_logs[i]["event_type"] === "page_close"){
                                end_time = new Date(event_logs[i]["event_time"]);
                                let session_id = course_learner_id + '_' + start_time + '_' + end_time;
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
                            cont_event_b.push(performance.now() - start);// Performance
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
            for (let x in session_record){
                let array = session_record[x];
                let session_id = array[0];
                if (!(session_id in session_id_set)){
                    session_id_set.add(session_id);
                    updated_session_record.push(array);
                }
            }

            session_record = updated_session_record;
            if (session_record.length > 0){
                let data = [];
                for (let x in session_record){
                    let array = session_record[x];
                    let session_id = array[0];
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
                // sqlLogInsert('sessions', data);
                progress_display('Done with file ' + (index + 1));
                index = index + 1;
                if (index < total){
                    processLogFiles(index, chunk);
                } else {
                    console.log(performance.now() - zero_start, ' milliseconds');
                }
            } else {
                console.log('no session info', index, total);
                $('#loading').hide()
            }

            // download('js_list', [new_line_reader, existing_line_reader, sorter, starting_event,
            //                                       cont_event_a, cont_event_b, 'total', performance.now() - zero_start] )
        }
    }
    if (index < total){
        let new_index = index + 1;
        processLogFiles(new_index, chunk);
    }
}

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


function forum_sessions(course_metadata_map, log_files, index, total, chunk) {
    let zero_start = performance.now();

    let start_date = new Date(course_metadata_map['start_date']);
    let end_date = new Date(course_metadata_map['end_date']);
    let current_date = start_date;
    let end_next_date = getNextDay(end_date);
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
                // let log_file = open (log_path + log_file, 'r');
                let lines = input_file.split('\n');
                console.log('    with ', lines.length, 'lines');
                for (let line of lines) {
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
                        // event_time = event_time.slice(0, 19);
                        // event_time = event_time.replace('T', ' ');
                        // event_time = datetime.datetime.strptime (event_time, '%Y-%m-%d %H:%M:%S');
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
                                if (new Date(event_logs[i]["event_time"]) > end_time.setMinutes(end_time.getMinutes() + 30)) {
                                    session_id = session_id + '_' + start_time + '_' + end_time.setMinutes(end_time.getMinutes() - 30);
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
                                    final_time = event_logs[i]['event_time'];

                                    session_id = 'forum_session_' + course_learner_id;
                                    start_time = new Date(event_logs[i]['event_time']);
                                    end_time = new Date(event_logs[i]['event_time']);
                                    if (event_logs[i]['event_type'] === 'edx.forum.searched') {
                                        times_search = 1;
                                    }
                                    session_rel_element_cur = rel_element_cur;
                                } else {
                                    end_time = event_logs[i]['event_time'];
                                    if (event_logs[i]['event_type'] === 'edx.forum.searched') {
                                        times_search++;
                                    }
                                    if (session_rel_element_cur === '') {
                                        session_rel_element_cur = rel_element_cur;
                                    }
                                }
                            } else {
                                if (new Date(event_logs[i]["event_time"]) <= end_time.setMinutes(end_time.getMinutes() + 30)){
                                    end_time = new Date(event_logs[i]['event_time']);
                                } else {
                                    end_time.setMinutes(end_time.getMinutes() - 30);
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

    console.log(forum_sessions_record.length);

    if (forum_sessions_record.length > 0){
        let data = [];
        for (let array of forum_sessions_record){
            let session_id = array[0];
            let course_learner_id = array[1];
            let times_search = process_null(array[2]);
            let start_time = array[3];
            let end_time = array[4];
            let duration = process_null(array[5]);
            let rel_element_id = array[6];
            let values = {'session_id':session_id, 'course_learner_id':course_learner_id,
                'times_search': times_search, 'start_time':start_time,
                'end_time': end_time, 'duration':duration, 'relevent_element_id': rel_element_id};
            data.push(values);
        }
        console.log('Send to storage at ' + new Date());
        // sqlLogInsert('forum_sessions', data);
        progress_display('Done with file ' + (index + 1));
        index = index + 1;
        if (index < total){
            processLogFiles(index, chunk);
        } else {
            console.log(performance.now() - zero_start, ' milliseconds');
        }
    } else {
        console.log('no forum session info', index, total);
        $('#loading').hide()
    }
}


function video_interaction(course_metadata_map, log_files, index, total, chunk) {
    let zero_start = performance.now();
    console.log('Starting video session processing');
    // let course_metadata_map = ExtractCourseInformation(metadata_path);
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
                for (let line of lines) {
                    let jsonObject = JSON.parse(line);
                    if (video_event_types.includes(jsonObject['event_type'])) {
                        if (!('user_id' in jsonObject['context'])) {
                            continue;
                        }
                        let global_learner_id = jsonObject['context']['user_id'];
                        if (global_learner_id !== '') {
                            let course_id = jsonObject['context']['course_id'];
                            let course_learner_id = (course_id + '_') + global_learner_id;
                            let video_id = '';
                            let event_time = new Date(jsonObject['time']);
                            // let event_time = event_time.__getslice__ (0, 19, 1);
                            // let event_time = event_time.py_replace ('T', ' ');
                            // let event_time = datetime.datetime.strptime (event_time, '%Y-%m-%d %H:%M:%S');
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
                            }
                            if (['seek_video', 'edx.video.position.changed'].includes(event_type)){
                                if (new_time !== null && old_time !== null) {
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
                            // let event_time = event_time.__getslice__ (0, 19, 1);
                            // let event_time = event_time.py_replace ('T', ' ');
                            // let event_time = datetime.datetime.strptime (event_time, '%Y-%m-%d %H:%M:%S');
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
                            video_start_time = log['event_time'];
                            video_id = log['video_id'];
                            if (pause_check) {
                                let duration_pause = (log['event_time'] - pause_start_time)/1000;
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
                            // if (log['event_time'] > video_start_time + datetime.timedelta (__kwargtrans__ ({hours: 0.5}))) {
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

                                    let watch_duration = (log['event_time'] - video_start_time)/1000;
                                    let video_end_time = log['event_time'];
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
                                        pause_start_time = video_end_time;
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
                                    let video_end_time = log['event_time'];
                                    let watch_duration = (video_end_time - video_start_time)/1000;
                                    let video_interaction_id = (course_learner_id + '_' + video_id + '_' + video_end_time);
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

        if ('times_pause' in video_interaction_map[interaction_id]) {
            times_pause = video_interaction_map[interaction_id]['watch_duration'];
            duration_pause = video_interaction_map[interaction_id]['duration_pause'];
        }
        let array = [video_interaction_id, course_learner_id, video_id, duration, times_forward_seek, duration_forward_seek, times_backward_seek, duration_backward_seek, times_speed_up, times_speed_down, times_pause, duration_pause, start_time, end_time];
        array = array.map(function(value){
            if (typeof value === "number"){
                return Math.round(value);
            } else {
                return value;
            }
        });
        video_interaction_record.push(array);
    }

    // for (let record of video_interaction_record){
    //     console.log(record.slice(2, 12))
    // }
    if (video_interaction_record.length > 0) {
        let data = [];
        for (let array of video_interaction_record) {
            let interaction_id = array[0];
            let course_learner_id = array[1];
            let video_id = array[2];
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
            let values = {'interaction_id':interaction_id, 'course_learner_id':course_learner_id, 'video_id': video_id,
                'duration':duration, 'times_forward_seek':times_forward_seek, 'duration_forward_seek':duration_forward_seek,
                'times_backward_seek': times_backward_seek, 'duration_backward_seek':duration_backward_seek,
                'times_speed_up':times_speed_up, 'times_speed_down':times_speed_down, 'times_pause':times_pause,
                'duration_pause':duration_pause, 'start_time':start_time, 'end_time':end_time};
            data.push(values);
        }
        console.log('Sending', data.length, ' values to storage at ' + new Date());
        // sqlLogInsert('video_interaction', data);
        progress_display('Done with file ' + (index + 1));
        index = index + 1;
        if (index < total){
            processLogFiles(index, chunk);
        } else {
            console.log(performance.now() - zero_start, ' milliseconds');
        }
    } else {
        console.log('no forum session info', index, total);
        $('#loading').hide()
    }
}


function quiz_mode(course_metadata_map, log_files, index, total, chunk) {
    console.log('Starting quiz processing');

    let zero_start = performance.now();

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

    // sqlLogInsert('quiz_questions', data);   // Uncomment!!!!!!!!!!!!!!!!

    let submission_event_collection = [];
    submission_event_collection.push('problem_check');
    let current_date = course_metadata_map['start_date'];
    let end_next_date = getNextDay(new Date(course_metadata_map['end_date']));
    let submission_uni_index = 0;
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
                for (let line of lines) {
                    let jsonObject = JSON.parse(line);
                    if (submission_event_collection.includes(jsonObject['event_type'])) {
                        if (!('user_id' in jsonObject['context'])) {
                            continue;
                        }
                        let global_learner_id = jsonObject['context']['user_id'];
                        if (global_learner_id !== '') {
                            let course_id = jsonObject['context']['course_id'];
                            let course_learner_id = course_id + '_'+ global_learner_id;
                            let question_id = '';
                            let grade = '';
                            let max_grade = '';
                            let event_time = new Date(jsonObject['time']);
                            // let event_time = event_time.__getslice__ (0, 19, 1);
                            // let event_time = event_time.py_replace ('T', ' ');
                            // let event_time = datetime.datetime.strptime (event_time, '%Y-%m-%d %H:%M:%S');
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
                                let submission_timestamp = event_time;
                                let values = {'submission_id': submission_id, 'course_learner_id':course_learner_id,
                                              'question_id':question_id, 'submission_timestamp':submission_timestamp};
                                submission_data.push(values);

                                if (grade !== '' && max_grade !== '') {
                                    let assessment_id = submission_id;
                                    let values = {'assessment_id':assessment_id, 'course_learner_id':course_learner_id,
                                                  'max_grade':max_grade, 'grade':grade};
                                    assessment_data.push(values);
                                }
                            }
                        }
                    }
                }
            }
            sqlLogInsert('assessments', assessment_data);
            sqlLogInsert('submissions', submission_data);
        }
        // current_date = getNextDay(current_date);
    // }
}

function quiz_sessions(course_metadata_map, log_files, index, total, chunk) {
    let zero_start = performance.now();
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
    let counter0 = 0;
    let counter1 = 0;
    let counter2 = 0;
    let counter3 = 0;
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

                for (let line of lines) {
                    if (line.length < 1){
                        continue;
                    }
                    let jsonObject = JSON.parse(line);
                    if (!('user_id' in jsonObject['context'])) {
                        continue;
                    }
                    let global_learner_id = jsonObject['context']['user_id'];
                    let event_type = jsonObject['event_type'];
                    if (global_learner_id !== '') {
                        let course_id = jsonObject['context']['course_id'];
                        let course_learner_id = course_id + '_' + global_learner_id;
                        let event_time = new Date(jsonObject['time']);
                        // let event_time = event_time.__getslice__ (0, 19, 1);
                        // let event_time = event_time.py_replace ('T', ' ');
                        // let event_time = datetime.datetime.strptime (event_time, '%Y-%m-%d %H:%M:%S');
                        if (course_learner_id in learner_all_event_logs) {
                            learner_all_event_logs[course_learner_id].push({'event_time': event_time, 'event_type': event_type});
                        }
                        else {
                            learner_all_event_logs[course_learner_id] = [{'event_time': event_time, 'event_type': event_type}];
                        }
                    }
                }

                for (let course_learner_id in learner_all_event_logs) {
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
                    // console.log(event_logs);
                    for (let i in event_logs) {
                        counter2++;

                        if (session_id === '') {
                            counter0++;
                            if (event_logs[i]['event_type'].includes('problem+block') || event_logs[i]['event_type'].includes("_problem;_") || submission_event_collection.includes(event_logs[i]['event_type'])) {
                                let event_type_array = event_logs[i]['event_type'].split('/');
                                let question_id = '';
                                if (event_logs[i]['event_type'].includes('problem+block')) {
                                    question_id = event_type_array[4];
                                }
                                if (event_logs[i]['event_type'].includes('_problem;_')) {
                                    question_id = event_type_array[6].replace(/;_/g, '/');
                                    // console.log(question_id);
                                    // console.log('first b', i);
                                }
                                if (question_id in child_parent_map) {
                                    // console.log(i, 'in child map', question_id);
                                    session_id = 'quiz_session_' + child_parent_map[question_id] + '_' + course_learner_id;
                                    start_time = event_logs[i]['event_time'];
                                    end_time = event_logs[i]['event_time'];
                                }
                            }
                        } else {
                            counter1++;
                            if (event_logs[i]['event_type'].includes('problem+block') || event_logs[i]['event_type'].includes('_problem;_') || submission_event_collection.includes(event_logs[i]['event_type'])) {
                                // console.log('other', i);
                                let verification_time = new Date(end_time);
                                if (event_logs[i]['event_time'] > verification_time.setMinutes(verification_time.getMinutes() + 30)) {
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
                                            // console.log('a', question_id);
                                        }
                                        if (event_logs[i]['event_type'].includes('_problem;_')) {
                                            question_id = event_type_array[6].replace(/;_/g, '/');
                                            // console.log('b', question_id);
                                        }
                                        if (question_id in child_parent_map) {
                                            session_id = 'quiz_session_' + child_parent_map[question_id] + '_' + course_learner_id;
                                            start_time = event_logs[i]['event_time'];
                                            end_time = event_logs[i]['event_time'];
                                            // console.log(i, 'in second child map', question_id);
                                        } else {
                                            // console.log(i, 'not in second child map', question_id);
                                            session_id = '';
                                            start_time = '';
                                            end_time = '';
                                        }
                                    }
                                } else {
                                    end_time = event_logs[i]['event_time'];
                                }
                            } else {
                                let verification_time = new Date(end_time);
                                if (event_logs[i]['event_time'] <= verification_time.setMinutes(verification_time.getMinutes() + 30)) {
                                    end_time = event_logs[i]['event_time'];
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
                                final_time = event_logs[i]['event_time'];
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
        console.log('c0',counter0);
        console.log('c1',counter1);
        console.log('c2', counter2);
        console.log('c3', counter3);
        // for (let x in learner_all_event_logs){
        //     console.log(learner_all_event_logs[x].length)
        // }
        console.log('event logs', Object.keys(learner_all_event_logs).length);
        console.log('keys', Object.keys(quiz_sessions).length);
        console.log((performance.now() - zero_start)/1000);
        // current_date = getNextDay(current_date);

    // } from while true


    for (let session_id in quiz_sessions) {
        if (Object.keys(quiz_sessions[session_id]['time_array']).length > 1) {
            let start_time = '';
            let end_time = '';
            let updated_time_array = [];
            for (let i = 0; i < Object.keys(quiz_sessions[session_id]['time_array']).length; i++) {
                let verification_time = new Date(end_time);
                if (i === 0) {
                    start_time = quiz_sessions[session_id]['time_array'][i]['start_time'];
                    end_time = quiz_sessions[session_id]['time_array'][i]['end_time'];
                } else if (quiz_sessions[session_id]['time_array'][i]['start_time'] > verification_time.setMinutes(verification_time.getMinutes() + 30)) {
                    updated_time_array.push({'start_time': start_time, 'end_time': end_time});
                    start_time = quiz_sessions[session_id]['time_array'][i]['start_time'];
                    end_time = quiz_sessions[session_id]['time_array'][i]['end_time'];
                    if (i === Object.keys(quiz_sessions[session_id]['time_array']).length - 1) {
                        updated_time_array.push({'start_time': start_time, 'end_time': end_time});
                    }
                }
                else {
                    end_time = quiz_sessions[session_id]['time_array'][i]['end_time'];
                    if (i === Object.keys(quiz_sessions[session_id]['time_array']).length - 1) {
                        updated_time_array.push({'start_time': start_time, 'end_time': end_time});
                    }
                }
            }
            quiz_sessions[session_id]['time_array'] = updated_time_array;
        }
    }
    for (let sesh in quiz_sessions){
        console.log(sesh.slice(-8,))
    }
    let quiz_session_record = [];
    for (let session_id in quiz_sessions) {
        let course_learner_id = quiz_sessions[session_id]['course_learner_id'];
        for (let i = 0; i < Object.keys(quiz_sessions[session_id]['time_array']).length; i++) {
            let start_time = quiz_sessions[session_id]['time_array'][i]['start_time'];
            let end_time = quiz_sessions[session_id]['time_array'][i]['end_time'];
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
    console.log(quiz_session_record)
    // for (let array of quiz_session_record) {
    //     let session_id = array[0];
    //     let course_learner_id = array[1];
    //     let start_time = array[2];
    //     let end_time = array[3];
    //     let duration = process_null (array[4]);
    //     let sql = 'insert into quiz_sessions (session_id, course_learner_id, start_time, end_time, duration) values (%s,%s,%s,%s,%s)';
    //     let data = tuple ([session_id, course_learner_id, start_time, end_time, duration]);
    //     cursor.execute (sql, data);
    // }
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
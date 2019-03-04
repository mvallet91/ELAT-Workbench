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
        let files = multiFileInput.files;
        readMetaFiles(files, passFiles);
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

function passLogFiles(result){
    let answer = JSON.stringify(result);
    let logReaderEvent = new CustomEvent("logFileReader", {
        "detail": answer
    });
    document.dispatchEvent(logReaderEvent);
}
////////////////////////////////////////////////////////////////////////////////////////////////
function sqlQuery(query){
    connection.runSql(query).then(function(result) {
        let answer = JSON.stringify(result);
        let passData = new CustomEvent("finishedQuery", {
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


function initiateEdxDb() {
    let dbName = "edx";
    connection.runSql('ISDBEXIST ' + dbName).then(function (isExist) {
        if (isExist) {
            connection.runSql('OPENDB ' + dbName).then(function () {
                console.log('edx db opened');
            });
            showTableData();
        } else {
            let dbQuery = getEdxDbQuery();
            connection.runSql(dbQuery).then(function (tables) {
                console.log(tables);
            });
            // insertStudents();
            showCoursesTableDataExtra();
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
    return db + courses + demographic + elements + learners;
}

function showCoursesTableData() {
    connection.runSql('select * from courses').then(function (courses) {
        var HtmlString = "";
        courses.forEach(function (course) {
            HtmlString += "<tr ItemId=" + course.course_id + "><td>" +
                course.course_name + "</td><td>" +
                course.start_time + "</td><td>" +
                course.end_time + "</td><td>" ;
                // "<a href='#' class='edit'>Edit</a></td>" +
                // "<td><a href='#' class='delete''>Delete</a></td>";
        });
        $('#tblGrid tbody').html(HtmlString);
    }).catch(function (error) {
        console.log(error);
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
            connection.runSql('count * from course_elements').then(function (result) {
                HtmlString += result + "</td><td>" ;
                connection.runSql('count * from course_learner').then(function (result) {
                    HtmlString += result + "</td><td>" ;
                    $('#tblGrid tbody').html(HtmlString);
                })
            })
        });
    }).catch(function (error) {
        console.log(error);
    });
}

///////////////////////////////////////////////////////////////////////////////////////////////
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


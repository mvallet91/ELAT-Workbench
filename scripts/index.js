var connection = new JsStore.Instance(new Worker('scripts/jsstore.worker.js'));
define(function (require) {
    pako = require('pako');
});
window.onload = function () {
    brython({debug: 1});
    //// DATABASE INITIALIZATION SCRIPTS //////////////////////////////////////////////////////////////////////////////
    initiateDb();
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
    var fileInput = document.getElementById('fileInput');
    var fileDisplayArea = document.getElementById('fileDisplayArea');
    var fileContent;

    fileInput.addEventListener('change', function(e) {
        var file = fileInput.files[0];
        console.log(file.type);
        var textType = /text.*/;

        var gzipType = /gzip/;

        if (file.type.match(textType)) {
            var reader = new FileReader();
            reader.onload = function (e) {
                fileDisplayArea.innerText = reader.result;
            };
            fileContent = reader.result;
            reader.readAsText(file);

        } else if (file.type.match(gzipType)) {
            var reader = new FileReader();
            reader.onload = function(event) {
                var result = pako.inflate(event.target.result, { to: 'string' });
                // console.log(result);
                var message = result.split('\n');
                fileDisplayArea.innerText = 'This document is '.concat(result.length, ' characters long' +
                    ' and the first line is: \n', message[0]);
            };
            reader.readAsArrayBuffer(file);

        } else if (file.name.endsWith('sql')) {
            var reader = new FileReader();
            reader.onload = function (e) {
                fileDisplayArea.innerText = reader.result;
            };
            fileContent = reader.result;
            reader.readAsText(file);

        } else {
            fileDisplayArea.innerText = "File not supported!"
        }
    });
    //// MULTI FILE SYSTEM SCRIPTS ///////////////////////////////////////////////////////////////////////////
    let  multiFileInput = document.getElementById('filesInput');

    multiFileInput.addEventListener('change', function (e) {
        let files = multiFileInput.files;
        // let result = readFiles(files);
        // passFiles(result[0], result[1]);

// returns a promise
        async function wrapperFunc() {
            try {
                let result = await readFiles(files);
                passFiles(result[0], result[1]);
            } catch(e) {
                console.log(e);
                throw e;      // let caller know the promise was rejected with this reason
            }
        }

        wrapperFunc().then(result => {
            // got final result
        }).catch(err => {
            // got error
        });
    });
};

function readFiles(files){
    let output = [];
    let readFiles = {};
    let processedFiles = [];
    let fileNames = 'Names: ';
    let fileCount = 1;
    let gzipType = /gzip/;
    let sqlType = 'sql';

    for (const f of files) {
    // Array.from(files).forEach(f => {

        output.push('<li><strong>', f.name, '</strong> (', f.type || 'n/a', ') - ',
            f.size, ' bytes', '</li>');
        fileCount++;

        if (f.type.match(gzipType)) {
            const reader = new FileReader();
            reader.onload = function (event) {
                var result = pako.inflate(event.target.result, {to: 'string'});
                var message = result.split('\n');
                console.log('This document is '.concat(result.length, ' characters long' +
                    ' and the first line is: \n', message[0]));
            };
            reader.readAsArrayBuffer(f);

        } if (f.name.includes(sqlType)) {
            const reader = new FileReader();
            reader.onload = function (e) {
                // readFiles[f.name] = reader.result;
                // processedFiles.push({
                //     key: f.name,
                //     value: reader.result
                // });
                fileNames = fileNames + f.name + '\n';
                console.log('This document is '.concat(reader.result.length, ' characters long ', f.name));
            };
            reader.readAsText(f);

            // function read(callback) {
            //     let reader = new FileReader();
            //     reader.onload = function() {
            //         callback(reader.result);
            //     };
            //     reader.readAsText(f);
            // }
            // let content = read();
            // readFiles[f.name] = content;
            // console.log('This document is '.concat(content.length, ' characters long ', f.name));

            // readFile(f, function(e) {
            //     let content = e.target.result;
            //     fileNames = fileNames + f.name + '\n';
            //     console.log('This document is '.concat(content.length, ' characters long ', f.name));
            // });
            //
            // function readFile(file, onLoadCallback) {
            //     let reader = new FileReader();
            //     reader.onload = onLoadCallback;
            //     reader.readAsText(file);
            // }

            // const readUploadedFileAsText = (inputFile) => {
            //     const temporaryFileReader = new FileReader();
            //
            //     return new Promise((resolve, reject) => {
            //         temporaryFileReader.onerror = () => {
            //             temporaryFileReader.abort();
            //             reject(new DOMException("Problem parsing input file."));
            //         };
            //
            //         temporaryFileReader.onload = () => {
            //             resolve(temporaryFileReader.result);
            //         };
            //         temporaryFileReader.readAsText(inputFile);
            //     });
            // };
            //
            // const handleUpload = async (event) => {
            //     try {
            //         const fileContents = await readUploadedFileAsText(f);
            //         console.log(fileContents);
            //     } catch (e) {
            //         console.warn(e.message)
            //     }
            // };
            // handleUpload();
        }
    }
    // );
    return [fileNames, output];
}
////////////////////////////////////////////////////////////////////////////////////////////////
function passFiles(names, output){
    document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
    let answer = JSON.stringify(names);
    let readerEvent = new CustomEvent("studentMetaReader", {"detail": answer});
    document.dispatchEvent(readerEvent);
}
////////////////////////////////////////////////////////////////////////////////////////////////
function sqlQuery(query){
    connection.runSql(query).then(function(result) {
        let answer = JSON.stringify(result);
        let event = new CustomEvent("finishedQuery", {"detail": answer});
        document.dispatchEvent(event);
    });
}
///////////////////////////////////////////////////////////////////////////////////////////////
function deleteData(studentId) {
    var query = new SqlWeb.Query("DELETE FROM Student WHERE Id='@studentId'");
    query.map("@studentId", Number(studentId));
    connection.runSql(query).
    then(function (rowsDeleted) {
        console.log(rowsDeleted + ' rows deleted');
        if (rowsDeleted > 0) {
            showTableData();
        }
    }).catch(function (error) {
        console.log(err);
        alert(error.message);
    });
}

function initiateDb() {
    var dbName = "Students";
    connection.runSql('ISDBEXIST ' + dbName).then(function (isExist) {
        if (isExist) {
            connection.runSql('OPENDB ' + dbName).then(function () {
                console.log('db opened');
            });
            showTableData();
        } else {
            var dbQuery = getDbQuery();
            connection.runSql(dbQuery).then(function (tables) {
                console.log(tables);
            });
            insertStudents();
            showTableData();
        }
    }).catch(function (err) {
        console.log(err);
        alert(err.message);
    });
}

function insertStudents() {
    var students = getStudents();
    var query = new SqlWeb.Query("INSERT INTO Student values='@val'");
    query.map("@val", students);
    connection.runSql(query).then(function (rowsAdded) {
        if (rowsAdded > 0) {
            alert('Successfully added');
        }
    }).catch(function (err) {
        console.log(err);
        alert('Error Occurred while adding data')
    });
}

function getDbQuery() {
    var db = "DEFINE DB Students;";
    var tblStudent = `DEFINE TABLE Student(
        Id PRIMARYKEY AUTOINCREMENT,
        Name NOTNULL STRING,
        GENDER STRING DEFAULT 'male',
        Country NOTNULL STRING,
        City NOTNULL
    )
    `;
    var dbQuery = db + tblStudent;
    return dbQuery;
}

//This function refreshes the table
function showTableData() {
    connection.runSql('select * from Student').then(function (students) {
        var HtmlString = "";
        students.forEach(function (student) {
            HtmlString += "<tr ItemId=" + student.Id + "><td>" +
                student.Name + "</td><td>" +
                student.Gender + "</td><td>" +
                student.Country + "</td><td>" +
                student.City + "</td><td>" +
                "<a href='#' class='edit'>Edit</a></td>" +
                "<td><a href='#' class='delete''>Delete</a></td>";
        });
        $('#tblGrid tbody').html(HtmlString);
    }).catch(function (error) {
        console.log(error);
    });
}

function getStudents() {
    //Student Array
    var Students = [{
        Name: 'Alfred',
        Gender: 'male',
        Country: 'Germany',
        City: 'Berlin'
        },
        {
            Name: 'George',
            Gender: 'male',
            Country: 'America',
            City: 'Detroit'
        },
        {
            Name: 'Berglunds',
            Gender: 'female',
            Country: 'Sweden',
            City: 'Luleå'
        },
        {
            Name: 'Eastern',
            Gender: 'male',
            Country: 'Canada',
            City: 'QWE'
        },
    ];
    return Students;
}


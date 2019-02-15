var connection = new JsStore.Instance(new Worker('scripts/jsstore.worker.js'));
define(function (require) {
    pako = require('pako');
});
window.onload = function () {
    brython();
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
                console.log(result);
                fileDisplayArea.innerText = result;
            };
            reader.readAsArrayBuffer(file);

        } else {
            fileDisplayArea.innerText = "File not supported!"
        }
    });
};

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
        alert('Error Occured while adding data')
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
            Name: 'Alfreds',
            Gender: 'male',
            Country: 'Germany',
            City: 'Berlin'
        },
        {
            Name: 'george',
            Gender: 'male',
            Country: 'America',
            City: 'xyx'
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
            City: 'qwe'
        },
    ];
    return Students;
}

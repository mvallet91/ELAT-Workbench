import {loader} from "./helpers.js";

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
    let query = new SqlWeb.Query("INSERT INTO " + table + " values='@val'");
    for (let row of rowsArray) {
        for (let field of Object.keys(row)) {
            if (field.includes('_time')){
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
                dbHelpers.sqlInsert('webdata', json, connection);
                toastr.success('Please reload the page now', 'Sample data ready', {timeOut: 0})
            })
        }
    })
}

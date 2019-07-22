export function webdataJSON(connection){
    connection.runSql("SELECT * FROM webdata").then(function(webElements) {
        let jsonString = '[';
        webElements.forEach(function (element) {
            jsonString += JSON.stringify(element) + ',\n'
        });
        console.log(jsonString.slice(0, jsonString.lastIndexOf(',')) + ']')
    });
}

export function loader(on){
    if (on){
        $('#loading').show();
        $.blockUI();
    } else {
        $('#loading').hide();
        $.unblockUI();
    }
}

export function downloadCsv(filename, content) {
    let downloadElement = document.createElement('a');
    let joinedContent = content.map(e=>e.join(",")).join("\n");
    let t = new Blob([joinedContent], {type : 'application/csv'});
    downloadElement.href = URL.createObjectURL(t);
    downloadElement.download = filename;
    downloadElement.click();
}


export function progress_display(content, index){
    let table = document.getElementById("progress_tab");
    let row = table.rows[index];
    let cell1 = row.insertCell();
    cell1.innerHTML = '  ' + content + '  ';
}
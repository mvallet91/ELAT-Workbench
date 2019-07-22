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

export function cmp_datetime(a_datetime, b_datetime){
    if (a_datetime < b_datetime) {
        return -1;
    } else if (a_datetime > b_datetime){
        return 1;
    } else {
        return 0;
    }
}

export function process_null(inputString){
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

export function cleanUnicode(text) {
    if (typeof text === 'string'){
        return text.normalize('NFC');
    } else {
        return text;
    }
}

export function escapeString(text) {
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


export function getNextDay(current_day){
    current_day.setDate(current_day.getDate() + 1);
    return current_day;
}


export function getDayDiff(beginDate, endDate) {
    let count = 0;
    while ((endDate.getDate() - beginDate.getDate()) >= 1){
        endDate.setDate(endDate.getDate() - 1);
        count += 1
    }
    return count
}

export function courseElementsFinder(eventlog, course_id) {
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

export function coucourseElementsFinder_string(eventlog_item, course_id) {
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
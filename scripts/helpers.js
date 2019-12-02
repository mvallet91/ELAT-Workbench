/**
 * Function for development, used to download all processed dashboard data for Samples
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
export function webdataJSON(connection){
    connection.runSql("SELECT * FROM webdata").then(function(webElements) {
        let jsonString = '[';
        webElements.forEach(function (element) {
            jsonString += JSON.stringify(element) + ',\n'
        });
        console.log(jsonString.slice(0, jsonString.lastIndexOf(',')) + ']')
    });
}

/**
 *  Show or hide the loader and block the screen
 * @param {boolean} on
 */
export function loader(on){
    if (on){
        $('#loading').show();
        $.blockUI();
    } else {
        $('#loading').hide();
        $.unblockUI();
    }
}


/**
 * Function to verify if the edx database exists and start the dashboard, or generate it otherwise
 * @param connection Main JsStore worker that handles the connection to SqlWeb
 */
export function verifyBrowser() {
    let userBrowser = bowser.getParser(navigator.userAgent).getResult();
    console.log(userBrowser.browser.name);
    if (! (['Chrome', 'Firefox'].includes(userBrowser.browser.name)) ) {
        toastr.error('ELAT is developed mainly for Chrome and supports Firefox, please try one of those browsers',  {positionClass: "toast-top-center", timeOut: "0", extendedTimeOut: "0"})
    }
}

/**
 * Process the text contents of a table into a csv-formatted file and download it
 * @param {string} filename String with the name of the file
 * @param {array} content Array of lines
 */
export function downloadCsv(filename, content) {
    let downloadElement = document.createElement('a');
    let joinedContent = content.map(e=>e.join(",")).join("\n");
    let t = new Blob([joinedContent], {type : 'application/csv'});
    downloadElement.href = URL.createObjectURL(t);
    downloadElement.download = filename;
    downloadElement.click();
}

/**
 * Manages a rule to separate students by their id, for example for A/B testing
 * @param {string} learnerId Identifier of the learner
 * @returns {string} segment The segment they belong to
 */
export function learnerSegmentation(learnerId, segmentation) {
    if (! segmentation) {
        segmentation = $("input[name='segmentationRule']:checked").val();
    }
    let segment = 'none';
    if (String(learnerId).includes('_')) {
        learnerId = Number(learnerId.split('_')[1]);
    }
    if (segmentation === 'ab') {
        if (learnerId % 2 === 0) {
            segment = 'A'
        } else {
            segment = 'B'
        }
    }
    return segment;
}

/**
 * Replaces a value in an array by a given index
 * @param {array} array Array to be modified
 * @param {number} index Position of the value to be modified
 * @param {string} value New value
 * @returns {array} replaceInArray Array with the replaced value
 */
function replaceAt(array, index, value) {
    const replaceInArray = array.slice(0);
    replaceInArray[index] = value;
    return replaceInArray;
}

/**
 * Processing and download of a csv file of learners' forum behavior. The columns are the learner id, posting behavior and viewing behavior
 * @param connection
 */
export function downloadForumSegmentation(connection) {
    connection.runSql("SELECT * FROM webdata WHERE name = 'studentsForumBehavior' ").then(function(result) {
        if (result.length === 0){
            loader(false);
            toastr.error('Graph data has to be processed again, click the Update Graph Values button');
        } else {
            let studentList = [['studentId', 'posterGroup', 'viewerGroup']];
            let forumSegments = result[0]['object'];
            for (let student in forumSegments) {
                const studentId = student.slice(student.indexOf('_')+1,);
                let segments = [studentId, 'undefined', 'undefined'];
                if (forumSegments[student].length > 0) {
                    for (let group of forumSegments[student]) {
                        if (group.includes('Poster')) {
                            segments = replaceAt(segments, 1, group)
                        }
                        if (group.includes('Viewer')) {
                            segments = replaceAt(segments, 2, group)
                        }
                    }
                }
                studentList.push(segments)
            }
            downloadCsv('studentsByForumGroup.csv', studentList)
        }
    })
}

/**
 * Adds a new cell with the progress of log processing in the dashboard
 * @param {string} content Content to be added
 * @param {number} index Position in the display table
 */
export function progressDisplay(content, index){
    let table = document.getElementById("progress_tab");
    table.insertRow();
    let row = table.rows[index];
    let cell1 = row.insertCell();
    cell1.innerHTML = '  ' + content + '  ';
}

/**
 * Compares two datetime elements and returns positive if the first is after the second, and negative otherwise
 * @param {Date} a_datetime First datetime element
 * @param {Date} b_datetime Second datetime element
 * @returns {number} the result of the comparison
 */
export function compareDatetime(a_datetime, b_datetime){
    a_datetime = new Date(a_datetime);
    b_datetime = new Date(b_datetime);
    if (a_datetime < b_datetime) {
        return -1;
    } else if (a_datetime > b_datetime){
        return 1;
    } else {
        return 0;
    }
}

/**
 * Null verification to avoid insertion issues
 * @param {string} inputString String to be verified
 * @returns {string|null}
 */
export function processNull(inputString){
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

/**
 * Unicode cleaning for forum posts
 * @param {string} text Post to be cleaned
 * @returns {string} text Cleaned text
 */
export function cleanUnicode(text) {
    if (typeof text === 'string'){
        return text.normalize('NFC');
    } else {
        return text;
    }
}

/**
 * Process escaped values for forum posts
 * @param {string} text Post to be cleaned
 * @returns {string} text Cleaned text
 */
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

/**
 * Returns a date element for the following day
 * @param {Date} current_day
 * @returns {Date} nextDay
 */
export function getNextDay(current_day){
    current_day.setDate(current_day.getDate() + 1);
    return current_day;
}

/**
 * Returns the number of days between dates
 * @param {Date} beginDate
 * @param {Date} endDate
 * @returns {number}
 */
export function getDayDiff(beginDate, endDate) {
    let count = 0;
    while ((endDate.getDate() - beginDate.getDate()) >= 1){
        endDate.setDate(endDate.getDate() - 1);
        count += 1
    }
    return count
}

/**
 * Returns the course element related to a record from a log
 * @param {Object} eventlog Record of an event
 * @param {string} course_id Course identifier
 * @returns {string} Id of the related element
 */
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

/**
 * Processing for for the courseElementsFinder function
 * @param {Object} eventlog_item
 * @param {string} course_id Course identifier
 * @returns {string} Id of the related element
 */
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

/**
 * Processing to find all important information from an Open Response Assessment record
 * @param {Object} fullEvent Complete record of an ORA evebt
 * @returns {Object} oraInfo
 */
export function getORAEventTypeAndElement(fullEvent) {
    let eventType = '',
        element = '',
        meta = false;
    if (fullEvent['event_type'].includes('openassessmentblock')) {
        eventType = fullEvent['event_type'];
        eventType = eventType.slice(eventType.indexOf('.') + 1,);
        element = fullEvent['context']['module']['usage_key'];
        element = element.slice(element.lastIndexOf('@') + 1,);
    }
    if (fullEvent['event_type'].includes('openassessment+block')) {
        eventType = fullEvent['event_type'];
        eventType = eventType.slice(eventType.lastIndexOf('/') + 1, );
        element = fullEvent['event_type'];
        element = element.slice(element.lastIndexOf('@') + 1,);
        element = element.slice(0, element.indexOf('/'));
        meta = true;
    }
    let oraInfo = {
        'eventType': eventType,
        'element': element,
        'meta': meta
    };
    return oraInfo
}
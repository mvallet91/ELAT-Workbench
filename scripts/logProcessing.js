import {sqlLogInsert, clearStoredWebdata} from "./databaseHelpers.js";

import {loader, progressDisplay, downloadCsv, webdataJSON,
    cmpDatetime, processNull, cleanUnicode, escapeString,
    getDayDiff, getNextDay, courseElementsFinder} from './helpers.js'

/**
 * This function will read the records in the logfile and extract all interactions from students with the course,
 * process their values, like start, end and duration, and finally store them in the database
 * @param {object} courseMetadataMap Object with the basic course metadata information
 * @param {array} logFiles Array of objects with name and file content
 * @param {number} index Current file number
 * @param {number} total Total files to process
 * @param {number} chunk Current chunk to process
 * @param {JsStoreWorker} connection Main JsStore worker that handles the connection to SqlWeb
 */
export function processGeneralSessions(courseMetadataMap, logFiles, index, total, chunk, connection){
    let current_course_id = courseMetadataMap["course_id"];
    current_course_id = current_course_id.slice(current_course_id.indexOf('+') + 1, current_course_id.lastIndexOf('+') + 7);

    let zero_start = performance.now();
    // let current_date = courseMetadataMap["start_date"];
    // let end_next_date  = getNextDay(courseMetadataMap["end_date"]);
    let learner_all_event_logs = [];
    let updated_learner_all_event_logs = {};
    let session_record = [];

    for (let f in logFiles){
        let file_name = logFiles[f]['key'];
        let input_file = logFiles[f]['value'];
        if (file_name.includes('log')){
            let today = new Date();
            let start = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();
            learner_all_event_logs = [];
            learner_all_event_logs = JSON.parse(JSON.stringify(updated_learner_all_event_logs));
            updated_learner_all_event_logs = [];

            let course_learner_id_set = new Set();
            for (const course_learner_id in learner_all_event_logs){
                course_learner_id_set.add(course_learner_id)
            }
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

                if (global_learner_id !== ''){
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

                let session_id = null,
                    start_time = null,
                    end_time = null,
                    final_time = null;
                for (let i in event_logs){
                    if (start_time == null){
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
                                start_time = null;
                                end_time = null;

                                final_time = new Date(event_logs[i]["event_time"]);

                            } else {
                                end_time = new Date(event_logs[i]["event_time"]);
                            }
                        }
                    }
                }
                if (final_time != null){
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
                    let duration = processNull(array[4]);
                    let values = {'session_id':session_id, 'course_learner_id':course_learner_id,
                        'start_time':start_time,
                        'end_time': end_time, 'duration':duration};
                    data.push(values);
                }
                console.log('Send to storage at ' + new Date());
                console.log(performance.now() - zero_start);

                sqlLogInsert('sessions', data, connection);
                clearStoredWebdata(connection);
                progressDisplay(data.length + ' sessions', index);
            } else {
                console.log('no session info', index, total);
            }
        }
    }
}

/**
 * This function will read the records in the logfile and extract all interactions from students with the forums,
 * process their values, like duration and times they search, to finally store them in the database
 * @param {object} courseMetadataMap Object with the basic course metadata information
 * @param {array} logFiles Array of objects with name and file content
 * @param {number} index Current file number
 * @param {number} total Total files to process
 * @param {number} chunk Current chunk to process
 * @param {JsStoreWorker} connection Main JsStore worker that handles the connection to SqlWeb
 */
export function processForumSessions(courseMetadataMap, logFiles, index, total, chunk, connection) {
    // This is only for one course! It has to be changed to allow for more courses
    let current_course_id = courseMetadataMap["course_id"];
    current_course_id = current_course_id.slice(current_course_id.indexOf('+') + 1, current_course_id.lastIndexOf('+') + 7);

    let start_date = new Date(courseMetadataMap['start_date']);
    // let end_date = new Date(courseMetadataMap['end_date']);
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
    for (let log_file of logFiles) {
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
                if (!('user_id' in jsonObject['context']) || jsonObject['context']['user_id'] === '') {
                    continue;
                }
                const global_learner_id = jsonObject['context']['user_id'];
                let event_type = jsonObject['event_type'];
                if (event_type.includes('/discussion/') || forum_event_types.includes(event_type)) {
                    if (event_type !== 'edx.forum.searched') {
                        event_type = 'forum_activity';
                    }
                }
                if (global_learner_id !== '') {
                    const course_id = jsonObject['context']['course_id'],
                        course_learner_id = course_id + '_' + global_learner_id,
                        event_time = new Date(jsonObject['time']);

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

            for (const learner in learner_all_event_logs) {
                const course_learner_id = learner,
                    course_id = course_learner_id.split('_')[0];
                let event_logs = learner_all_event_logs[learner];
                event_logs.sort(function(a, b) {
                    return b.event_type - a.event_type;
                });
                event_logs.sort(function(a, b) {
                    return new Date(a.event_time) - new Date(b.event_time) ;
                });
                let session_id = '',
                    start_time = null,
                    end_time = null,
                    final_time = null,
                    times_search = 0;
                let sessionRelatedElementPrevious = '';
                let sessionRelatedElementCurrent = '';

                for (let i in event_logs) {
                    let relatedElementCurrent = courseElementsFinder(event_logs[i], course_id);

                    if (session_id === '') {
                        if (['forum_activity', 'edx.forum.searched'].includes(event_logs[i]['event_type'])) {
                            session_id = 'forum_session_' + course_learner_id;
                            start_time = new Date(event_logs[i]['event_time']);
                            end_time = new Date(event_logs[i]['event_time']);
                            if (event_logs[i]['event_type'] === 'edx.forum.searched') {
                                times_search++;
                            }
                            sessionRelatedElementCurrent = relatedElementCurrent;
                        }
                    } else {
                        if (['forum_activity', 'edx.forum.searched'].includes(event_logs[i]['event_type'])) {
                            let verification_time = new Date(end_time);
                            if (new Date(event_logs[i]["event_time"]) > verification_time.setMinutes(verification_time.getMinutes() + 30)) {
                                session_id = session_id + '_' + start_time + '_' + end_time;
                                const duration = (end_time - start_time) / 1000;

                                if (duration > 5) {
                                    let relatedElementId = '';
                                    if (sessionRelatedElementCurrent !== '') {
                                        relatedElementId = sessionRelatedElementCurrent;
                                    } else {
                                        relatedElementId = sessionRelatedElementPrevious;
                                    }
                                    let array = [session_id, course_learner_id, times_search, start_time, end_time, duration, relatedElementId];
                                    forum_sessions_record.push(array);
                                }
                                final_time = new Date(event_logs[i]['event_time']);

                                session_id = 'forum_session_' + course_learner_id;
                                start_time = new Date(event_logs[i]['event_time']);
                                end_time = new Date(event_logs[i]['event_time']);
                                if (event_logs[i]['event_type'] === 'edx.forum.searched') {
                                    times_search = 1;
                                }
                                sessionRelatedElementCurrent = relatedElementCurrent;
                            } else {
                                end_time = new Date(event_logs[i]['event_time']);
                                if (event_logs[i]['event_type'] === 'edx.forum.searched') {
                                    times_search++;
                                }
                                if (sessionRelatedElementCurrent === '') {
                                    sessionRelatedElementCurrent = relatedElementCurrent;
                                }
                            }
                        } else {
                            let verification_time = new Date(end_time);
                            if (new Date(event_logs[i]["event_time"]) <= verification_time.setMinutes(verification_time.getMinutes() + 30)){
                                end_time = new Date(event_logs[i]['event_time']);
                            }
                            session_id = session_id + '_' +  start_time + '_' + end_time;
                            const duration = (end_time - start_time) / 1000;

                            if (duration > 5) {
                                let rel_element_id = '';
                                if (sessionRelatedElementCurrent !== '') {
                                    rel_element_id = sessionRelatedElementCurrent;
                                } else {
                                    rel_element_id = sessionRelatedElementPrevious;
                                }
                                let array = [session_id, course_learner_id, times_search, start_time, end_time, duration, rel_element_id];
                                forum_sessions_record.push(array);
                            }
                            final_time = new Date(event_logs[i]['event_time']);
                            session_id = '';
                            start_time = null;
                            end_time = null;
                            times_search = 0;
                        }
                        if (relatedElementCurrent !== '') {
                            sessionRelatedElementPrevious = relatedElementCurrent;
                        }
                    }
                }
                if (final_time != null){
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

    if (forum_sessions_record.length === 0) {
        console.log('no forum session info', index, total);
    } else {
        let data = [];
        for (let array of forum_sessions_record) {
            let session_id = array[0];
            if (chunk !== 0) {
                session_id = session_id + '_' + chunk
            }
            if (index !== 0) {
                session_id = session_id + '_' + index
            }
            const course_learner_id = array[1],
                times_search = processNull(array[2]),
                start_time = array[3],
                end_time = array[4],
                duration = processNull(array[5]),
                rel_element_id = array[6];
            let values = {
                'session_id': session_id, 'course_learner_id': course_learner_id,
                'times_search': times_search, 'start_time': start_time,
                'end_time': end_time, 'duration': duration, 'relevent_element_id': rel_element_id
            };
            data.push(values);
        }
        console.log('Sending to storage at ' + new Date());
        sqlLogInsert('forum_sessions', data, connection);
        progressDisplay(data.length + ' forum interaction sessions', index);
    }
}

/**
 * This function will read the records in the logfile and extract all interactions from students with the forums,
 * process their values, like duration and times they search, to finally store them in the database
 * @param {object} courseMetadataMap Object with the basic course metadata information
 * @param {array} logFiles Array of objects with name and file content
 * @param {number} index Current file number
 * @param {number} total Total files to process
 * @param {number} chunk Current chunk to process
 * @param {JsStoreWorker} connection Main JsStore worker that handles the connection to SqlWeb
 */
export function processVideoInteractionSessions(courseMetadataMap, logFiles, index, total, chunk, connection) {
    // This is only for one course! It has to be changed to allow for more courses
    const course_id = courseMetadataMap["course_id"],
        current_course_id = course_id.slice(course_id.indexOf('+') + 1, course_id.lastIndexOf('+') + 7);

    console.log('Starting video session processing');
    let current_date = new Date(courseMetadataMap['start_date']);
    // let end_next_date = getNextDay(course_metadata_map['end_date']);
    const video_event_types = ['hide_transcript', 'edx.video.transcript.hidden', 'edx.video.closed_captions.hidden',
        'edx.video.closed_captions.shown', 'load_video', 'edx.video.loaded', 'pause_video', 'edx.video.paused',
        'play_video', 'edx.video.played', 'seek_video', 'edx.video.position.changed', 'show_transcript',
        'edx.video.transcript.shown', 'speed_change_video', 'stop_video', 'edx.video.stopped', 'video_hide_cc_menu',
        'edx.video.language_menu.hidden', 'video_show_cc_menu', 'edx.video.language_menu.shown'];
    let video_interaction_map = {},
        learner_video_event_logs = {},
        updated_learner_video_event_logs = {};

    // while (true) {
    //     if (current_date == end_next_date) {
    //         break;
    //     }

    for (const file of logFiles) {
        const file_name = file['key'],
            input_file = file['value'];
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
                    if (!('user_id' in jsonObject['context'])) {continue;}
                    let global_learner_id = jsonObject['context']['user_id'];
                    if (global_learner_id !== '') {
                        const course_id = jsonObject['context']['course_id'],
                            course_learner_id = (course_id + '_') + global_learner_id,
                            event_time = new Date(jsonObject['time']),
                            event_type = jsonObject['event_type'];
                        let video_id = '',
                            new_time = 0,
                            old_time = 0,
                            new_speed = 0,
                            old_speed = 0,
                            event_jsonObject;

                        if (typeof jsonObject['event'] === "string") {
                            event_jsonObject = JSON.parse(jsonObject['event']);
                        } else {
                            event_jsonObject = jsonObject['event'];
                        }
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
                    if (! ('user_id' in jsonObject['context'])){ continue; }
                    let global_learner_id = jsonObject['context']['user_id'];
                    if (global_learner_id !== '') {
                        let course_id = jsonObject['context']['course_id'],
                            course_learner_id = course_id + '_' + global_learner_id,
                            event_time = new Date(jsonObject['time']),
                            event_type = jsonObject['event_type'];
                        if (course_learner_id_set.has(course_learner_id)) {
                            learner_video_event_logs[course_learner_id].push({'event_time': event_time,
                                'event_type': event_type});
                        } else {
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
                let video_start_time = null,
                    final_time = null,
                    times_forward_seek = 0,
                    duration_forward_seek = 0,
                    times_backward_seek = 0,
                    duration_backward_seek = 0,
                    speed_change_last_time = '',
                    times_speed_up = 0,
                    times_speed_down = 0,
                    pause_check = false,
                    pause_start_time = null,
                    duration_pause = 0;
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
                    if (video_start_time != null) {
                        let verification_time = new Date(video_start_time);
                        if (log["event_time"] > verification_time.setMinutes(verification_time.getMinutes() + 30)){
                            video_start_time = null;
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
                                let watch_duration = (new Date(log['event_time']) - video_start_time)/1000,
                                    video_end_time = new Date(log['event_time']),
                                    video_interaction_id = (course_learner_id + '_' + video_id + '_' + video_end_time);
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
                                video_start_time = null;
                                video_id = '';
                                final_time = log['event_time'];
                                continue;
                            }

                            // Page Changed/Session Closed
                            if ( !(video_event_types.includes(log['event_type']))) {
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
                                video_start_time = null;
                                video_id = '';
                                final_time = log['event_time'];
                            }
                        }
                    }
                }
                if (final_time != null) {
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
        const video_interaction_id = interaction_id,
            course_learner_id = video_interaction_map[interaction_id]['course_learner_id'],
            video_id = video_interaction_map[interaction_id]['video_id'],
            duration = video_interaction_map[interaction_id]['watch_duration'],
            times_forward_seek = video_interaction_map[interaction_id]['times_forward_seek'],
            duration_forward_seek = video_interaction_map[interaction_id]['duration_forward_seek'],
            times_backward_seek = video_interaction_map[interaction_id]['times_backward_seek'],
            duration_backward_seek = video_interaction_map[interaction_id]['duration_backward_seek'],
            times_speed_up = video_interaction_map[interaction_id]['times_speed_up'],
            times_speed_down = video_interaction_map[interaction_id]['times_speed_down'],
            start_time = video_interaction_map[interaction_id]['start_time'],
            end_time = video_interaction_map[interaction_id]['end_time'];

        let times_pause = 0,
            duration_pause = 0;

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
            const course_learner_id = array[1],
                video_id = array[2],
                duration = processNull(array[3]),
                times_forward_seek = processNull(array[4]),
                duration_forward_seek = processNull(array[5]),
                times_backward_seek = processNull(array[6]),
                duration_backward_seek = processNull(array[7]),
                times_speed_up = processNull(array[8]),
                times_speed_down = processNull(array[9]),
                times_pause = processNull(array[10]),
                duration_pause = processNull(array[11]),
                start_time = array[12],
                end_time = array[13];
            let values = {'interaction_id': interaction_id, 'course_learner_id':course_learner_id, 'video_id': video_id,
                'duration':duration, 'times_forward_seek':times_forward_seek, 'duration_forward_seek':duration_forward_seek,
                'times_backward_seek': times_backward_seek, 'duration_backward_seek':duration_backward_seek,
                'times_speed_up':times_speed_up, 'times_speed_down':times_speed_down, 'times_pause':times_pause,
                'duration_pause':duration_pause, 'start_time':start_time, 'end_time':end_time};
            data.push(values);
        }
        console.log('Sending', data.length, ' values to storage at ' + new Date());
        sqlLogInsert('video_interaction', data, connection);
        progressDisplay(data.length + ' video interaction sessions', index);
    } else {
        console.log('No forum session info for ', index, total);
    }
}

/**
 * This function will read the records in the logfile and extract the submissions and (automatic) assessments
 * of quiz questions, process their values, like timestamp or grade, to finally store them in the database
 * @param {object} courseMetadataMap Object with the basic course metadata information
 * @param {array} logFiles Array of objects with name and file content
 * @param {number} index Current file number
 * @param {number} total Total files to process
 * @param {number} chunk Current chunk to process
 * @param {JsStoreWorker} connection Main JsStore worker that handles the connection to SqlWeb
 */
export function processAssessmentsSubmissions(courseMetadataMap, logFiles, index, total, chunk, connection) {
    // This is only for one course! It has to be changed to allow for more courses
    const course_id = courseMetadataMap["course_id"];
    const current_course_id = course_id.slice(course_id.indexOf('+') + 1, course_id.lastIndexOf('+') + 7);

    console.log('Starting quiz processing');
    let submission_event_collection = ['problem_check'];
    let current_date = courseMetadataMap['start_date'];
    let end_next_date = getNextDay(new Date(courseMetadataMap['end_date']));
    let submission_uni_index = chunk * 100;
    // while (true) {
    //     if (current_date == end_next_date) {
    //         break;
    //     }
    for (let file of logFiles) {
        const file_name = file['key'],
            input_file = file['value'],
            submission_data = [],
            assessment_data = [];
        if (file_name.includes(current_date) || true) {
            console.log('   for file', file_name);
            const lines = input_file.split('\n');
            for (const line of lines) {
                if (line.length < 10 || !(line.includes(current_course_id)) ) { continue; }
                const jsonObject = JSON.parse(line);
                if (submission_event_collection.includes(jsonObject['event_type'])) {
                    if (!('user_id' in jsonObject['context'])) { continue }
                    const global_learner_id = jsonObject['context']['user_id'];
                    if (global_learner_id === '') { continue }
                    const course_id = jsonObject['context']['course_id'],
                        course_learner_id = course_id + '_'+ global_learner_id,
                        event_time = new Date(jsonObject['time']);
                    let question_id = '',
                        grade = '',
                        max_grade = '';
                    if (typeof jsonObject['event'] === 'object') {
                        question_id = jsonObject['event']['problem_id'];
                        if ('grade' in jsonObject['event'] && 'max_grade' in jsonObject['event']) {
                            grade = jsonObject['event']['grade'];
                            max_grade = jsonObject['event']['max_grade'];
                        }
                    }
                    if (question_id !== '') {
                        const submission_id = course_learner_id + '_' + question_id + '_' + submission_uni_index;
                        submission_uni_index = submission_uni_index + 1;
                        const values = {'submission_id': submission_id, 'course_learner_id': course_learner_id,
                            'question_id': question_id, 'submission_timestamp': event_time};
                        submission_data.push(values);
                        if (grade !== '' && max_grade !== '') {
                            const values = {'assessment_id': submission_id, 'course_learner_id': course_learner_id,
                                'max_grade': max_grade, 'grade': grade};
                            assessment_data.push(values);
                        }
                    }
                }
            }
        }
        if (assessment_data.length === 0) {
            console.log('No assessment data', index, total)
        } else {
            sqlLogInsert('assessments', assessment_data, connection);
        }
        if (submission_data.length === 0) {
            console.log('No submission data', index, total)
        } else {
            sqlLogInsert('submissions', submission_data, connection);
        }
    }
    // current_date = getNextDay(current_date);
    // }
    console.log('Done with quiz questions');
}

/**
 * This function will read the records in the logfile and extract the submissions and (automatic) assessments
 * of quiz questions, process their values, like timestamp or grade, to finally store them in the database
 * @param {object} courseMetadataMap Object with the basic course metadata information
 * @param {array} logFiles Array of objects with name and file content
 * @param {number} index Current file number
 * @param {number} total Total files to process
 * @param {number} chunk Current chunk to process
 * @param {number} totalChunks Total chunks to process in the current file
 * @param {JsStoreWorker} connection Main JsStore worker that handles the connection to SqlWeb
 * @param {function} callback Callback to prepareLogFiles function, providing the file index and chunk index to continue
 * @returns {array} processingCheck Array with the values for next index and chunk, or to end processing
 */
export function processQuizSessions(courseMetadataMap, logFiles, index, total, chunk, totalChunks, connection, callback) {
    // This is only for one course! It has to be changed to allow for more courses
    const courseId = courseMetadataMap["course_id"],
        currentCourseId = courseId.slice(courseId.indexOf('+') + 1, courseId.lastIndexOf('+') + 7);

    const submissionEventCollection = ['problem_check', 'save_problem_check', 'problem_check_fail',
        'save_problem_check_fail', 'problem_graded', 'problem_rescore', 'problem_rescore_fail',
        'problem_reset', 'reset_problem', 'reset_problem_fail', 'problem_save', 'save_problem_fail',
        'save_problem_success', 'problem_show', 'showanswer'];

    const currentDate = courseMetadataMap['start_date'];
    // let end_next_date = getNextDay(new Date(courseMetadataMap['end_date']));

    let childParentMap = courseMetadataMap['child_parent_map'],
        learnerAllEventLogs = {},
        updatedLearnerAllEventLogs = {},
        quizSessions = {};

    // while (true) {
    //     if (current_date == end_next_date) {
    //         break;
    //     }

    for (const logFile of logFiles) {
        const fileName = logFile['key'],
            inputFile = logFile['value'];
        if (fileName.includes(currentDate) || true) {
            console.log('   for file', fileName);
            learnerAllEventLogs = {};
            learnerAllEventLogs = updatedLearnerAllEventLogs;
            updatedLearnerAllEventLogs = {};
            let courseLearnerIdSet = new Set();
            for (const courseLearnerId in learnerAllEventLogs) {
                courseLearnerIdSet.add(courseLearnerId);
            }
            const lines = inputFile.split('\n');
            if (lines.length < 2) {
                chunk = 0;
                toastr.info('Starting with file number ' + (index + 1));
                callback(index, chunk, totalChunks);
            } else {
                console.log('    with ', lines.length, 'lines');

                for (const line of lines) {
                    if (line.length < 10 || !(line.includes(currentCourseId))) {
                        continue
                    }
                    const jsonObject = JSON.parse(line);
                    if (!('user_id' in jsonObject['context'])) {
                        continue
                    }
                    const global_learner_id = jsonObject['context']['user_id'],
                        event_type = jsonObject['event_type'];
                    if (global_learner_id === '') {
                        continue
                    }
                    const course_id = jsonObject['context']['course_id'],
                        course_learner_id = course_id + '_' + global_learner_id,
                        event_time = new Date(jsonObject['time']);
                    if (course_learner_id in learnerAllEventLogs) {
                        learnerAllEventLogs[course_learner_id].push({
                            'event_time': event_time,
                            'event_type': event_type
                        });
                    } else {
                        learnerAllEventLogs[course_learner_id] = [{'event_time': event_time, 'event_type': event_type}];
                    }
                }

                for (const courseLearnerId in learnerAllEventLogs) {
                    if (!(learnerAllEventLogs.hasOwnProperty(courseLearnerId))) {
                        continue
                    }
                    let eventLogs = learnerAllEventLogs[courseLearnerId];
                    eventLogs.sort(function (a, b) {
                        return b.event_type - a.event_type;
                    });
                    eventLogs.sort(function (a, b) {
                        return new Date(a.event_time) - new Date(b.event_time);
                    });
                    let sessionId = '',
                        startTime = null,
                        endTime = null,
                        finalTime = null;
                    for (const i in eventLogs) {
                        if (sessionId === '') {
                            if (eventLogs[i]['event_type'].includes('problem+block') || eventLogs[i]['event_type'].includes("_problem;_") || submissionEventCollection.includes(eventLogs[i]['event_type'])) {
                                const eventTypeArray = eventLogs[i]['event_type'].split('/');
                                let questionId = '';
                                if (eventLogs[i]['event_type'].includes('problem+block')) {
                                    questionId = eventTypeArray[4];
                                }
                                if (eventLogs[i]['event_type'].includes('_problem;_')) {
                                    questionId = eventTypeArray[6].replace(/;_/g, '/');
                                }
                                if (questionId in childParentMap) {
                                    sessionId = 'quiz_session_' + childParentMap[questionId] + '_' + courseLearnerId;
                                    startTime = new Date(eventLogs[i]['event_time']);
                                    endTime = new Date(eventLogs[i]['event_time']);
                                }
                            }
                        } else {
                            if (eventLogs[i]['event_type'].includes('problem+block') || eventLogs[i]['event_type'].includes('_problem;_') || submissionEventCollection.includes(eventLogs[i]['event_type'])) {
                                let verification_time = new Date(endTime);
                                if (new Date(eventLogs[i]['event_time']) > verification_time.setMinutes(verification_time.getMinutes() + 30)) {
                                    if (sessionId in quizSessions) {
                                        quizSessions[sessionId]['time_array'].push({
                                            'start_time': startTime,
                                            'end_time': endTime
                                        });
                                    } else {
                                        quizSessions[sessionId] = {
                                            'course_learner_id': courseLearnerId,
                                            'time_array': [{'start_time': startTime, 'end_time': endTime}]
                                        };
                                    }
                                    finalTime = eventLogs[i]['event_time'];
                                    if (eventLogs[i]['event_type'].includes('problem+block') || eventLogs[i]['event_type'].includes('_problem;_') || submissionEventCollection.includes(eventLogs[i]['event_type'])) {
                                        let event_type_array = eventLogs[i]['event_type'].split('/');
                                        let questionId = '';
                                        if (eventLogs[i]['event_type'].includes('problem+block')) {
                                            questionId = event_type_array[4];
                                        }
                                        if (eventLogs[i]['event_type'].includes('_problem;_')) {
                                            questionId = event_type_array[6].replace(/;_/g, '/');
                                        }
                                        if (questionId in childParentMap) {
                                            sessionId = 'quiz_session_' + childParentMap[questionId] + '_' + courseLearnerId;
                                            startTime = new Date(eventLogs[i]['event_time']);
                                            endTime = new Date(eventLogs[i]['event_time']);
                                        } else {
                                            sessionId = '';
                                            startTime = null;
                                            endTime = null;
                                        }
                                    }
                                } else {
                                    endTime = new Date(eventLogs[i]['event_time']);
                                }
                            } else {
                                let verification_time = new Date(endTime);
                                if (eventLogs[i]['event_time'] <= verification_time.setMinutes(verification_time.getMinutes() + 30)) {
                                    endTime = new Date(eventLogs[i]['event_time']);
                                }
                                if (sessionId in quizSessions) {
                                    quizSessions[sessionId]['time_array'].push({
                                        'start_time': startTime,
                                        'end_time': endTime
                                    });
                                } else {
                                    quizSessions[sessionId] = {
                                        'course_learner_id': courseLearnerId,
                                        'time_array': [{'start_time': startTime, 'end_time': endTime}]
                                    };
                                }
                                finalTime = new Date(eventLogs[i]['event_time']);
                                sessionId = '';
                                startTime = null;
                                endTime = null;
                            }
                        }
                    }

                    if (finalTime != null) {
                        let new_logs = [];
                        for (let log of eventLogs) {
                            if (log ['event_time'] >= finalTime) {
                                new_logs.push(log);
                            }
                        }
                        updatedLearnerAllEventLogs[courseLearnerId] = new_logs;
                    }
                }
            }
        }
        // } from while true

        for (let session_id in quizSessions) {
            if (!(quizSessions.hasOwnProperty(session_id))) {
                continue;
            }
            if (Object.keys(quizSessions[session_id]['time_array']).length > 1) {
                let start_time = null;
                let end_time = null;
                let updated_time_array = [];
                for (let i = 0; i < Object.keys(quizSessions[session_id]['time_array']).length; i++) {
                    let verification_time = new Date(end_time);
                    if (i === 0) {
                        start_time = new Date(quizSessions[session_id]['time_array'][i]['start_time']);
                        end_time = new Date(quizSessions[session_id]['time_array'][i]['end_time']);
                    } else if (new Date(quizSessions[session_id]['time_array'][i]['start_time']) > verification_time.setMinutes(verification_time.getMinutes() + 30)) {
                        updated_time_array.push({'start_time': start_time, 'end_time': end_time});
                        start_time = new Date(quizSessions[session_id]['time_array'][i]['start_time']);
                        end_time = new Date(quizSessions[session_id]['time_array'][i]['end_time']);
                        if (i === Object.keys(quizSessions[session_id]['time_array']).length - 1) {
                            updated_time_array.push({'start_time': start_time, 'end_time': end_time});
                        }
                    } else {
                        end_time = new Date(quizSessions[session_id]['time_array'][i]['end_time']);
                        if (i === Object.keys(quizSessions[session_id]['time_array']).length - 1) {
                            updated_time_array.push({'start_time': start_time, 'end_time': end_time});
                        }
                    }
                }
                quizSessions[session_id]['time_array'] = updated_time_array;
            }
        }

        let quiz_session_record = [];
        for (let session_id in quizSessions) {
            if (!(quizSessions.hasOwnProperty(session_id))) {
                continue;
            }
            let course_learner_id = quizSessions[session_id]['course_learner_id'];
            for (let i = 0; i < Object.keys(quizSessions[session_id]['time_array']).length; i++) {
                let start_time = new Date(quizSessions[session_id]['time_array'][i]['start_time']);
                let end_time = new Date(quizSessions[session_id]['time_array'][i]['end_time']);
                if (start_time < end_time) {
                    let duration = (end_time - start_time) / 1000;
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
                let duration = processNull(array[4]);
                let values = {
                    'session_id': session_id, 'course_learner_id': course_learner_id,
                    'start_time': start_time, 'end_time': end_time, 'duration': duration
                };
                data.push(values)
            }
            sqlLogInsert('quiz_sessions', data, connection);
            progressDisplay(data.length + ' quiz interaction sessions', index);
        } else {
            console.log('No quiz session data')
        }
        chunk++;
        if (chunk < totalChunks) {
            progressDisplay('Part\n' + (chunk + 1) + ' of this file', index);
            toastr.info('Processing a new chunk of file number ' + (index + 1));
            callback(index, chunk, totalChunks)
        } else {
            index++;
            if (index < total) {
                chunk = 0;
                toastr.info('Starting with file number ' + (index + 1));
                callback(index, chunk, totalChunks);
            } else {
                let table = document.getElementById("progress_tab");
                let row = table.insertRow();
                let cell1 = row.insertCell();
                setTimeout(function () {
                    toastr.success('Please reload the page now', 'Logfiles Processed!', {timeOut: 0});
                    cell1.innerHTML = ('Done! at ' + new Date().toLocaleString('en-GB'));
                    loader(false)
                }, 10000);
            }
        }
    }
}
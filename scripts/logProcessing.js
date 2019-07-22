import {sqlLogInsert} from "./databaseHelpers.js";
import {loader, progress_display, downloadCsv, webdataJSON,
    cmp_datetime, process_null, cleanUnicode, escapeString,
    getDayDiff, getNextDay, courseElementsFinder} from './helpers.js'
export function session_mode(course_metadata_map, log_files, index, total, chunk, connection){
    let current_course_id = course_metadata_map["course_id"];
    current_course_id = current_course_id.slice(current_course_id.indexOf('+') + 1, current_course_id.lastIndexOf('+') + 7);

    let zero_start = performance.now();
    // let current_date = course_metadata_map["start_date"];
    // let end_next_date  = getNextDay(course_metadata_map["end_date"]);
    let learner_all_event_logs = [];
    let updated_learner_all_event_logs = {};
    let session_record = [];

    for (let f in log_files){
        let file_name = log_files[f]['key'];
        let input_file = log_files[f]['value'];
        if (file_name.includes('log')){

            let today = new Date();
            let start = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds() + '.' + today.getMilliseconds();
            console.log('Starting at', start);
            learner_all_event_logs = [];
            learner_all_event_logs = JSON.parse(JSON.stringify(updated_learner_all_event_logs));
            updated_learner_all_event_logs = [];

            let course_learner_id_set = new Set();
            for (const course_learner_id in learner_all_event_logs){
                course_learner_id_set.add(course_learner_id)
            }
            console.log(input_file.length);
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

                if (global_learner_id != ''){
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

                let session_id = "";
                let start_time = "";
                let end_time = "";
                let final_time = "";
                for (let i in event_logs){
                    if (start_time === ''){
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
                                start_time = "";
                                end_time = "";

                                final_time = new Date(event_logs[i]["event_time"]);

                            } else {
                                end_time = new Date(event_logs[i]["event_time"]);
                            }
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
                    let duration = process_null(array[4]);
                    let values = {'session_id':session_id, 'course_learner_id':course_learner_id,
                        'start_time':start_time,
                        'end_time': end_time, 'duration':duration};
                    data.push(values);
                }
                console.log('Send to storage at ' + new Date());
                console.log(performance.now() - zero_start);

                sqlLogInsert('sessions', data, connection);
                connection.runSql("DELETE FROM webdata WHERE name = 'graphElements'");
                connection.runSql("DELETE FROM webdata WHERE name = 'databaseDetails'");
                connection.runSql("DELETE FROM webdata WHERE name = 'mainIndicators'");
                connection.runSql("DELETE FROM webdata WHERE name = 'arcElements'");
                connection.runSql("DELETE FROM webdata WHERE name = 'cycleElements'");
                progress_display(data.length + ' sessions', index);
            } else {
                console.log('no session info', index, total);
            }
        }
    }
}

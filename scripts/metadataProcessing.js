import {cleanUnicode, cmpDatetime, getDayDiff, loader, processNull, escapeString} from "./helpers.js";
import {sqlInsert} from "./databaseHelpers.js";

function ExtractCourseInformation(files) {
    let courseMetadataMap = {};
    let i = 0;
    for (let file of files) {
        i++;
        let fileName = file['key'];
        if (! fileName.includes('course_structure')) {
            if (i === files.length){
                toastr.error('Course structure file is missing!');
                return courseMetadataMap
            }
        } else {
            let child_parent_map = {};
            let element_time_map = {};

            let element_time_map_due = {};
            let element_type_map = {};
            let element_without_time = [];

            let quiz_question_map = {};
            let block_type_map = {};

            let order_map = {};
            let element_name_map = {};

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
                    courseMetadataMap['course_id'] = course_id;
                    courseMetadataMap['course_name'] = jsonObject[record]['metadata']['display_name'];

                    courseMetadataMap['start_date'] = new Date(jsonObject[record]['metadata']['start']);
                    courseMetadataMap['end_date'] = new Date(jsonObject[record]['metadata']['end']);

                    courseMetadataMap['start_time'] = new Date(courseMetadataMap['start_date']);
                    courseMetadataMap['end_time'] = new Date(courseMetadataMap['end_date']);

                    let elementPosition = 0;

                    for (let child of jsonObject[record]['children']) {
                        elementPosition++;
                        child_parent_map[child] = record;
                        order_map[child] = elementPosition;
                    }
                    element_time_map[record] = new Date(jsonObject[record]['metadata']['start']);
                    element_type_map[record] = jsonObject[record]['category'];
                } else {
                    let element_id = record;
                    element_name_map[element_id] = jsonObject[element_id]['metadata']['display_name'];
                    let elementPosition = 0;

                    for (let child of jsonObject[element_id]['children']) {
                        elementPosition++;
                        child_parent_map[child] = element_id;
                        order_map[child] = elementPosition;
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
                    while (!(element_time_map.hasOwnProperty(element_parent))) {
                        element_parent = child_parent_map[element_parent];
                    }
                    element_start_time = element_time_map[element_parent];
                }
                element_time_map[element_id] = element_start_time;
            }
            courseMetadataMap['element_time_map'] = element_time_map;
            courseMetadataMap['element_time_map_due'] = element_time_map_due;
            courseMetadataMap['element_type_map'] = element_type_map;
            courseMetadataMap['quiz_question_map'] = quiz_question_map;
            courseMetadataMap['child_parent_map'] = child_parent_map;
            courseMetadataMap['block_type_map'] = block_type_map;
            courseMetadataMap['order_map'] = order_map;
            courseMetadataMap['element_name_map'] = element_name_map;
            console.log('Metadata map ready');
            return courseMetadataMap;
        }
    }
}


function processEnrollment(course_id, input_file, course_metadata_map){
    let course_learner_map = {};
    let learner_enrollment_time_map = {};
    let enrolled_learner_set = new Set();
    let learner_index_record = [];
    let lines = input_file.split('\n');
    for (let line of lines.slice(1, )) {
        let record = line.split('\t');
        if (record.length < 2) { continue; }
        let global_learner_id = record[1],
            time = new Date(record[3]),
            course_learner_id = course_id + '_' + global_learner_id;
        if (cmpDatetime(course_metadata_map['end_time'], new Date(time)) === 1) {
            enrolled_learner_set.add(global_learner_id);
            let array = [global_learner_id, course_id, course_learner_id];
            learner_index_record.push(array);
            course_learner_map[global_learner_id] = course_learner_id;
            learner_enrollment_time_map[global_learner_id] = time;
        }
    }
    return {'courseLearnerMap': course_learner_map,
        'learnerEnrollmentTimeMap': learner_enrollment_time_map,
        'enrolledLearnerSet': enrolled_learner_set,
        'learnerIndexRecord': learner_index_record
    }
}


function processCertificates(inputFile, enrollmentValues) {
    let uncertifiedLearners = 0,
        certifiedLearners = 0,
        courseLearnerRecord = [];
    for (let line of inputFile.split('\n')) {
        let record = line.split('\t');
        if (record.length < 10) { continue; }
        let global_learner_id = record[1],
            final_grade = record[3],
            enrollment_mode = record[14].replace(/\n/g, ''),
            certificate_status = record[7],
            register_time = '';
        if (global_learner_id in enrollmentValues.courseLearnerMap) {
            register_time =  enrollmentValues.learnerEnrollmentTimeMap[global_learner_id];
        }
        if (global_learner_id in  enrollmentValues.courseLearnerMap) {
            certifiedLearners++;
            let array = [ enrollmentValues.courseLearnerMap[global_learner_id], final_grade, enrollment_mode, certificate_status, register_time];
            courseLearnerRecord.push(array);
        }
        else {
            uncertifiedLearners++;
        }
    }
    return {'certifiedLearners': certifiedLearners,
        'uncertifiedLearners': uncertifiedLearners,
        'courseLearnerRecord': courseLearnerRecord
    }
}


function processMailMap(inputFile, enrollmentValues) {
    let learnerMailMap = {};
    for (let line of inputFile.split('\n')) {
        let record = line.split('\t');
        if (enrollmentValues.enrolledLearnerSet.has(record[0])) {
            learnerMailMap[record[0]] = record[4];
        }
    }
    return learnerMailMap
}


function processDemographics(courseId, inputFile, enrollmentValues, learnerMailMap) {
    let learnerDemographicRecord = [];
    for (let line of inputFile.split('\n')) {
        let record = line.split('\t');
        if (record.length < 10) { continue; }
        let global_learner_id = record[1],
            gender = record[7],
            year_of_birth = record[9],
            level_of_education = record[10],
            country = record[13],
            course_learner_id = courseId + '_' + global_learner_id;
        if (enrollmentValues.enrolledLearnerSet.has(global_learner_id)) {
            let array = [course_learner_id, gender, year_of_birth, level_of_education, country, learnerMailMap[global_learner_id]];
            learnerDemographicRecord.push(array);
        }
    }
    return {'learnerDemographicRecord': learnerDemographicRecord}

}


export function learnerMode(files, connection) {
    loader(true);
    let courseMetadataMap = ExtractCourseInformation(files);
    if (Object.keys(courseMetadataMap).length < 1) {
        loader(false);
    } else {
        let courseRecord = [],
            course_id = courseMetadataMap.course_id,
            fileMap = {};
        courseRecord.push([courseMetadataMap['course_id'], courseMetadataMap['course_name'], courseMetadataMap['start_time'], courseMetadataMap['end_time']]);

        let shortId = course_id.slice(course_id.indexOf(':') + 1, );
        shortId = shortId.replace('+', '-').replace('+', '-');
        for (let file of files) {
            let fileName = file['key'];
            let shortName = fileName.slice(fileName.indexOf(shortId) + shortId.length + 1, fileName.indexOf('.'));
            fileMap[shortName] = file['value'];
        }

        let requiredFiles = ['student_courseenrollment-prod-analytics', 'auth_user-prod-analytics',
            'certificates_generatedcertificate-prod-analytics', 'auth_userprofile-prod-analytics',
            'prod'];

        if (! requiredFiles.every(function(x) { return x in fileMap; })) {
            toastr.error('Some files are missing');
            loader(false);
        } else {
            let courseElementRecord = [];
            for (let element_id in courseMetadataMap['element_time_map']) {
                let element_start_time = new Date(courseMetadataMap['element_time_map'][element_id]);
                let week = getDayDiff(courseMetadataMap['start_time'], element_start_time) / 7 + 1;
                let array = [element_id, courseMetadataMap['element_type_map'][element_id], week, courseMetadataMap['course_id']];
                courseElementRecord.push(array);
            }
            console.log('Finished processing ' + courseElementRecord.length + ' course components in metadata map');

            let enrollmentValues = processEnrollment(course_id, fileMap['student_courseenrollment-prod-analytics'], courseMetadataMap);

            let learnerMailMap = processMailMap(fileMap['auth_user-prod-analytics'], enrollmentValues);

            let certificateValues = processCertificates(fileMap['certificates_generatedcertificate-prod-analytics'], enrollmentValues);

            let demographicValues = processDemographics(course_id, fileMap['auth_userprofile-prod-analytics'], enrollmentValues, learnerMailMap);

            let forumInteractionRecords = forum_interaction(fileMap['prod'], courseMetadataMap);

            console.log('All metadata ready');
            if (courseRecord.length === 0) {
                console.log('No courses info');
            } else {
                let rows = [];
                for (let array of courseRecord) {
                    let course_id = courseMetadataMap['course_id'];
                    let course_name = courseMetadataMap['course_name'];
                    let start_time = courseMetadataMap['start_time'];
                    let end_time = courseMetadataMap['end_time'];
                    let values = {
                        'course_id': course_id, 'course_name': course_name,
                        'start_time': start_time, 'end_time': end_time
                    };
                    rows.push(values);
                }
                sqlInsert('courses', rows, connection);
            }

            if (courseElementRecord.length === 0) {
                console.log('No course element info');
            } else {
                let data = [];
                for (let array of courseElementRecord) {
                    let element_id = array[0];
                    let element_type = array[1];
                    let week = processNull(array[2]);
                    let course_id = array[3];
                    let values = {
                        'element_id': element_id, 'element_type': element_type,
                        'week': week, 'course_id': course_id
                    };
                    data.push(values);
                }
                sqlInsert('course_elements', data, connection);
            }

            if (enrollmentValues.learnerIndexRecord.length === 0) {
                console.log('no learner index info');
            } else {
                let data = [];
                for (let array of enrollmentValues.learnerIndexRecord) {
                    let global_learner_id = array[0];
                    let course_id = array[1];
                    let course_learner_id = array[2];
                    let values = {
                        'global_learner_id': global_learner_id.toString(), 'course_id': course_id,
                        'course_learner_id': course_learner_id
                    };
                    data.push(values);
                }
                sqlInsert('learner_index', data, connection);
            }

            if (certificateValues.courseLearnerRecord.length === 0) {
                console.log('no enrolled students info');
            } else {
                let data = [];
                for (let array of certificateValues.courseLearnerRecord) {
                    let course_learner_id = array[0],
                        final_grade = parseFloat(processNull(array[1])),
                        enrollment_mode = array[2],
                        certificate_status = array[3],
                        register_time = new Date(processNull(array[4])),
                        values = {
                            'course_learner_id': course_learner_id, 'final_grade': final_grade,
                            'enrollment_mode': enrollment_mode, 'certificate_status': certificate_status,
                            'register_time': register_time
                        };
                    data.push(values);
                }
                sqlInsert('course_learner', data, connection);
            }

            if (demographicValues.learnerDemographicRecord.length === 0) {
                console.log('no learner demographic info');
            } else {
                let data = [];
                for (let array of demographicValues.learnerDemographicRecord) {
                    let course_learner_id = processNull(array[0]),
                        gender = array[1],
                        year_of_birth = parseInt(processNull(array[2])),
                        level_of_education = array[3],
                        country = array[4],
                        email = array[5];
                    email = email.replace(/"/g, '');
                    let values = {
                        'course_learner_id': course_learner_id, 'gender': gender, 'year_of_birth': year_of_birth,
                        'level_of_education': level_of_education, 'country': country, 'email': email
                    };
                    data.push(values);
                }
                sqlInsert('learner_demographic', data, connection);
            }

            if (forumInteractionRecords.length === 0) {
                console.log('no forum interaction records')
            } else {
                let data = [];
                for (let array of forumInteractionRecords) {
                    let post_id = processNull(array[0]),
                        course_learner_id = array[1],
                        post_type = array[2],
                        post_title = cleanUnicode(array[3]),
                        post_content = cleanUnicode(array[4]),
                        post_timestamp = array[5],
                        post_parent_id = array[6],
                        post_thread_id = array[7];
                    let values = {
                        "post_id": post_id, "course_learner_id": course_learner_id, "post_type": post_type,
                        "post_title": post_title, "post_content": post_content, "post_timestamp": post_timestamp,
                        "post_parent_id": post_parent_id, "post_thread_id": post_thread_id
                    };
                    data.push(values);
                }
                connection.runSql('DELETE FROM forum_interaction');
                for (let array of data) {
                    try {
                        sqlInsert('forum_interaction', [array], connection)
                    } catch (error) {
                        console.log(array)
                    }
                }
            }

            let quizQuestionMap = courseMetadataMap['quiz_question_map'],
                blockTypeMap = courseMetadataMap['block_type_map'],
                elementTimeMapDue = courseMetadataMap['element_time_map_due'],
                quizData = [];
            for (let questionId in quizQuestionMap) {
                let questionDue = '',
                    questionWeight = quizQuestionMap[questionId],
                    quizQuestionParent = courseMetadataMap['child_parent_map'][questionId];
                if (questionDue === '' && quizQuestionParent in elementTimeMapDue) {
                    questionDue = elementTimeMapDue[quizQuestionParent];
                }
                while (!(quizQuestionParent in blockTypeMap)) {
                    quizQuestionParent = courseMetadataMap['child_parent_map'][quizQuestionParent];
                    if (questionDue === '' && quizQuestionParent in elementTimeMapDue) {
                        questionDue = elementTimeMapDue [quizQuestionParent];
                    }
                }
                let quizQuestionType = blockTypeMap[quizQuestionParent];
                questionDue = processNull(questionDue);
                let values = {
                    'question_id': questionId, 'question_type': quizQuestionType, 'question_weight': questionWeight,
                    'question_due': new Date(questionDue)
                };
                quizData.push(values);
            }
            sqlInsert('quiz_questions', quizData, connection);

            sqlInsert('metadata', [{'name': 'metadata_map', 'object': courseMetadataMap}], connection);
        }
    }
}

function forum_interaction(forum_file, course_metadata_map){
    let forum_interaction_records = [];
    let lines = forum_file.split("\n");
    for (let line of lines) {
        if (line.length < 9) {continue;}
        let jsonObject = JSON.parse(line);

        let post_id = jsonObject["_id"]["$oid"];
        let course_learner_id = jsonObject["course_id"] + "_" + jsonObject["author_id"];

        let post_type = jsonObject["_type"];
        if (post_type === "CommentThread"){
            post_type += "_" + jsonObject["thread_type"];
        }
        if ("parent_id" in jsonObject &&  jsonObject["parent_id"] !== ""){
            post_type = "Comment_Reply"
        }

        let post_title = "";
        if (jsonObject.hasOwnProperty("title")){
            post_title = jsonObject["title"];
        }

        let post_content = jsonObject["body"];
        let post_timestamp = new Date(jsonObject["created_at"]["$date"]);

        let post_parent_id = "";
        if (jsonObject.hasOwnProperty("parent_id")) {
            post_parent_id = jsonObject["parent_id"]["$oid"]
        }

        let post_thread_id = "";
        if (jsonObject.hasOwnProperty("comment_thread_id" )) {
            post_thread_id = jsonObject["comment_thread_id"]["$oid"]
        }
        if (post_timestamp < new Date(course_metadata_map["end_time"])) {
            let array = [post_id, course_learner_id, post_type, post_title, escapeString(post_content),
                post_timestamp, post_parent_id, post_thread_id];
            forum_interaction_records.push(array)
        }
    }
    return forum_interaction_records;
}

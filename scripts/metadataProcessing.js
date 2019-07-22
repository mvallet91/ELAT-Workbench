
export function ExtractCourseInformation(files) {
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
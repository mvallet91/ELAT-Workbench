import {processVideoInteractionSessions, processForumSessions} from "../scripts/logProcessing.js"
import {getTestValues, getOutputValues} from "./logTestValues.js"

let courseMetadataMap = getTestValues('courseMetadataMap');
courseMetadataMap = JSON.parse(courseMetadataMap);

let videoLogFile = getTestValues('videoLogFile'),
    index = 0,
    total = 1,
    chunk = 0,
    connection = null;

let videoData = getOutputValues('videoSession');

test('getNextDay to Monday 7, Oct, 2019 returns Tuesday 8', () => {
    expect(processVideoInteractionSessions(courseMetadataMap, videoLogFile, index, total, chunk, connection))
        .toEqual(videoData)
});
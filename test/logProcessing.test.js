import {processVideoInteractionSessions, processForumSessions} from "../scripts/logProcessing.js"
import {getTestValues, getOutputValues} from "./logTestValues.js"

let courseMetadataMap = getTestValues('courseMetadataMap');
courseMetadataMap = JSON.parse(courseMetadataMap);

let logFile = getTestValues('logFile'),
    index = 0,
    total = 1,
    chunk = 0,
    connection = null;

let videoData = getOutputValues('videoSession'),
    forumData = getOutputValues('forumSession');

test('Process a video session from a subset of records', () => {
    expect(processVideoInteractionSessions(courseMetadataMap, logFile, index, total, chunk, connection))
        .toEqual(videoData)
});

test('Process a forum session from a subset of records', () => {
    expect(processForumSessions(courseMetadataMap, logFile, index, total, chunk, connection))
        .toEqual(forumData)
});
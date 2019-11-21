import {processGeneralSessions, processAssessmentsSubmissions, processQuizSessions,
    processVideoInteractionSessions, processForumSessions} from "../scripts/logProcessing.js"
import {getTestValues, getOutputValues} from "./logTestValues.js"
import {getTestingValues} from "./metadataTestingValues.js"
import {processORASessions} from "../scripts/logProcessing";

let courseMetadataMap = getTestingValues('courseMetadataMap');
courseMetadataMap = JSON.parse(courseMetadataMap);
let oraCourseMetadataMap = getTestingValues('oraCourseMetadataMap');
oraCourseMetadataMap = JSON.parse(oraCourseMetadataMap);

let logFile = getTestValues('logFile'),
    index = 0,
    total = 1,
    chunk = 0,
    totalChunks = 1,
    connection = null,
    oraCallback = function () {};

let sessionData = getOutputValues('learningSession'),
    videoData = getOutputValues('videoSession'),
    forumData = getOutputValues('forumSession'),
    submissionData = getOutputValues('submissionSession'),
    quizData = getOutputValues('quizSession'),
    oraData = getOutputValues('oraSession');

test('Process general learning sessions from a subset of records', () => {
    expect(processGeneralSessions(courseMetadataMap, logFile, index, total, chunk, connection))
        .toEqual(sessionData)
});

test('Process a video session from a subset of records', () => {
    expect(processVideoInteractionSessions(courseMetadataMap, logFile, index, total, chunk, connection))
        .toEqual(videoData)
});

test('Process a forum session from a subset of records', () => {
    expect(processForumSessions(courseMetadataMap, logFile, index, total, chunk, connection))
        .toEqual(forumData)
});

test('Process a submission session from a subset of records', () => {
    expect(processAssessmentsSubmissions(courseMetadataMap, logFile, index, total, chunk, connection))
        .toEqual(submissionData)
});

test('Process a quiz session from a subset of records', () => {
    expect(processQuizSessions(courseMetadataMap, logFile, index, total, chunk, connection))
        .toEqual(quizData)
});


test('Process ORA session from a subset of records', () => {
    expect(processORASessions(oraCourseMetadataMap, logFile, index, total, chunk, totalChunks, connection, oraCallback))
        .toEqual(oraData)
});
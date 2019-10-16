import {processEnrollment, processCertificates, processAuthMap, processGroups,
    processDemographics} from "../scripts/metadataProcessing.js"
import {getTestingValues, getTestingOutput} from "./testingValues.js"

let courseMetadataMap = getTestingValues('courseMetadataMap'),
    courseId = getTestingValues('courseId'),
    enrollmentFile = getTestingValues('enrollmentFile'),
    certificateFile = getTestingValues('certificateFile'),
    authFile = getTestingValues('authFile'),
    groupFile = getTestingValues('groupFile');

courseMetadataMap = JSON.parse(courseMetadataMap);

let enrollmentOutput = getTestingOutput('enrollmentOutput'),
    certificateOutput = getTestingOutput('certificateOutput'),
    authOutput = getTestingOutput('authOutput'),
    groupOutput = getTestingOutput('groupOutput');

test('Input enrollment sample, to get processed object', () => {
    expect(processEnrollment(courseId, enrollmentFile, courseMetadataMap))
        .toEqual(enrollmentOutput)
});
let enrollmentValues = processEnrollment(courseId, enrollmentFile, courseMetadataMap);

test('Input certificates sample, to get processed object', () => {
    expect(processCertificates(certificateFile, enrollmentValues, courseMetadataMap))
        .toEqual(certificateOutput)
});

test('Input authentication sample, to get processed object', () => {
    expect(processAuthMap(authFile, enrollmentValues))
        .toEqual(authOutput)
});
let learnerAuthMap = processAuthMap(authFile, enrollmentValues);

test('Input group sample, to get processed object', () => {
    expect(processGroups(courseId, groupFile, enrollmentValues))
        .toEqual(groupOutput)
});

test('Input demographic sample, to get processed object', () => {
    expect(processDemographics(courseId, demographicFile, enrollmentValues, learnerAuthMap))
        .toEqual(groupOutput)
});




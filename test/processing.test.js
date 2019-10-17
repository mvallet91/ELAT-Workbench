import {processEnrollment} from "../scripts/metadataProcessing.js"
import {getTestValues} from "./logTestValues.js"
// import {getNextDay} from "../scripts/helpers";
//
// test('getNextDay to Monday 7, Oct, 2019 returns Tuesday 8', () => {
//     expect(getNextDay(new Date('Monday 7, Oct, 2019')))
//         .toStrictEqual(new Date('Tuesday 8, Oct, 2019'))
// });

let courseMetadataMap = getTestValues('courseMetadataMap');

let courseId = 'courseId',
    inputFile =
        "id\tuser_id\tcourse_id\tcreated\tis_active\tmode\n"+
        "1\t11\tcourse-v1:courseId\t2015-07-01 20:27:51\t1\thonor\n" +
        "2\t22\tcourse-v1:courseId\t2015-07-01 20:53:19\t1\thonor\n" +
        "3\t33\tcourse-v1:courseId\t2015-07-01 21:07:35\t1\thonor\n" +
        "4\t44\tcourse-v1:courseId\t2015-07-01 21:33:22\t0\tverified\n" +
        "5\t55\tcourse-v1:courseId\t2015-07-01 21:37:52\t1\thonor";


courseMetadataMap = JSON.parse(courseMetadataMap);
test('Input enrollment sample, to get processed rows', () => {
    expect(processEnrollment(courseId, inputFile, courseMetadataMap))
        .toBe({})
});
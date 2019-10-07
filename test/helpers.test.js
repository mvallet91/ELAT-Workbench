import {escapeString, getNextDay} from "../scripts/helpers.js";

test('escapeString escapes special characters in string', () => {
    expect(escapeString('test\tstring')).toBe('test\\tstring')
})

test('getNextDay to Monday 7, Oct, 2019 returns Tuesday 8', () => {
    expect(getNextDay(new Date('Monday 7, Oct, 2019')))
        .toStrictEqual(new Date('Tuesday 8, Oct, 2019'))
})
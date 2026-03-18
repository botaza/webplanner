// js/date-utils.js

const UTC_OFFSET_MS = 10 * 60 * 60 * 1000;

function nowUTC10() {
    return new Date(Date.now() + UTC_OFFSET_MS);
}

function todayString() {
    return nowUTC10().toISOString().slice(0, 10);
}

function nowDatetimeLocal() {
    return nowUTC10().toISOString().slice(0, 16);
}

function currentMonthKey() {
    return nowUTC10().toISOString().slice(0, 7);
}

function nowAsDatetimeString() {
    return nowUTC10().toISOString().slice(0, 16).replace('T', ' ');
}

export {
    UTC_OFFSET_MS,
    nowUTC10,
    todayString,
    nowDatetimeLocal,
    currentMonthKey,
    nowAsDatetimeString
};

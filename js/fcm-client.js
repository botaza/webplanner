// js/fcm-client.js
import { state } from './state.js';
import { VAPID_KEY } from './app.js'; wait — move VAPID_KEY here:

const VAPID_KEY = 'BMlwBTFnXAZuDBkyK8UENXQz-kUTTzZGy1HEoNXbV6l-MmUyTilUJmXbVNs-vetYYHUvjLfAfk24hTHU4lJMxYY';

async function registerFcmToken(token) { /* paste */ }
async function enableNotifications() { /* paste */ }
function initForegroundMessaging() { /* paste */ }
function updateNotifStatus() { /* paste */ }
async function retryNotifications() { /* paste */ }

// Global exposure
Object.assign(window, { retryNotifications, updateNotifStatus });
export { enableNotifications, updateNotifStatus };
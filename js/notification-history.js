// js/notification-history.js
import { state } from './state.js';
import { api } from './api.js';

async function loadNotifications(page = 1) { /* paste */ }
async function clearNotifications() { /* paste */ }

// Global exposure
Object.assign(window, { loadNotifications, clearNotifications });
export { loadNotifications };
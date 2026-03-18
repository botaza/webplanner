// js/state.js

export const state = {
    events: [],
    expenses: [],
    income: [],
    messaging: null,
    fcmToken: null,
    notificationPermission: false,
    currentEditId: null,
    notifications: [],
    
    // NEW: Helper to check if an event should be notified
    shouldNotifyEvent(event) {
        if (!event || event.completed) return false;
        
        const now = new Date();
        const eventDate = new Date(event.datetime);
        
        // Don't notify past events
        if (eventDate < now) return false;
        
        // Check if within 15 minutes
        const diffMs = eventDate - now;
        const diffMins = diffMs / (1000 * 60);
        return diffMins <= 15 && diffMins > 0;
    },
    
    // NEW: Reset a completed event to incomplete
    resetEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            event.completed = false;
            this.saveEvents();
            return true;
        }
        return false;
    },
    
    // NEW: Update event date and preserve notification eligibility
    updateEventDate(eventId, newDatetime) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            event.datetime = newDatetime;
            event.completed = false; // Auto-reset when date changes
            this.saveEvents();
            return true;
        }
        return false;
    },
    
    saveEvents() {
        localStorage.setItem('planner_events', JSON.stringify(this.events));
    },
    
    loadEvents() {
        const stored = localStorage.getItem('planner_events');
        this.events = stored ? JSON.parse(stored) : [];
    }
};
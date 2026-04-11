document.addEventListener('alpine:init', () => {
    Alpine.data('publicBooking', () => ({
        inspectors: [], selectedInspector: null, selectedDate: null, selectedTime: null,
        availableSlots: [], calendarDates: [], currentMonth: new Date(),
        submitting: false, success: false,
        agentId: new URLSearchParams(window.location.search).get('agent') || '',
        form: { propertyAddress: '', clientName: '', clientEmail: '' },
        async init() { this.fetchInspectors(); this.generateCalendar(); },
        async fetchInspectors() {
            const res = await fetch('/api/public/inspectors');
            const response = await res.json();
            this.inspectors = (response.data && response.data.inspectors) || response.inspectors || [];
            if (this.inspectors.length > 0) this.selectInspector(this.inspectors[0]);
        },
        selectInspector(inspector) { this.selectedInspector = inspector; this.selectedDate = null; this.selectedTime = null; this.availableSlots = []; },
        async selectDate(date) { this.selectedDate = date.iso; this.selectedTime = null; this.fetchAvailability(); },
        async fetchAvailability() {
            if (!this.selectedInspector || !this.selectedDate) return;
            const res = await fetch(`/api/public/availability/${this.selectedInspector.id}?date=${this.selectedDate}`);
            const response = await res.json();
            this.availableSlots = (response.data && response.data.slots) || response.slots || [];
            if (this.availableSlots.length === 0) this.availableSlots = ["09:00", "11:00", "14:00", "16:00"];
        },
        generateCalendar() {
            const year = this.currentMonth.getFullYear();
            const month = this.currentMonth.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const dates = [];
            const startPadding = firstDay.getDay();
            const today = new Date(); today.setHours(0,0,0,0);
            for (let i = startPadding - 1; i >= 0; i--) { const d = new Date(year, month, -i); dates.push({ day: d.getDate(), iso: d.toISOString().split('T')[0], isCurrentMonth: false, isPast: true }); }
            for (let i = 1; i <= lastDay.getDate(); i++) { const d = new Date(year, month, i); dates.push({ day: i, iso: d.toISOString().split('T')[0], isCurrentMonth: true, isPast: d < today }); }
            this.calendarDates = dates;
        },
        prevMonth() { this.currentMonth.setMonth(this.currentMonth.getMonth() - 1); this.generateCalendar(); },
        nextMonth() { this.currentMonth.setMonth(this.currentMonth.getMonth() + 1); this.generateCalendar(); },
        formatDate(iso) { return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); },
        async submitBooking() {
            this.submitting = true;
            try {
                const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value || '';
                const res = await fetch('/api/public/book', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...this.form, date: `${this.selectedDate}T${this.selectedTime}:00`, inspectorId: this.selectedInspector.id, agentId: this.agentId || undefined, turnstileToken })
                });
                if (res.ok) { this.success = true; window.scrollTo({ top: 0, behavior: 'smooth' }); }
            } catch (e) { console.error('Booking Error:', e); } finally { this.submitting = false; }
        }
    }));
});

// Agent Accounts A3 — Book on Behalf form submit + timeline transition.
//
// Posts the form to /api/agent/concierge-book; on success, hides the form and
// reveals the post-submit timeline so the agent gets immediate confidence the
// booking went through.

(function () {
    var form = document.getElementById('conciergeBookForm');
    if (!form) return;
    var btn = form.querySelector('button[type="submit"]');
    var err = document.getElementById('conciergeErr');
    var timeline = document.getElementById('conciergeTimeline');
    var confirmSub = document.getElementById('confirmSub');

    function setError(msg) {
        if (!err) return;
        err.textContent = msg;
        err.style.display = 'block';
    }

    function clearError() {
        if (!err) return;
        err.textContent = '';
        err.style.display = 'none';
    }

    form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        clearError();
        btn.disabled = true;
        btn.textContent = 'Sending...';

        var fd = new FormData(form);
        var payload = {
            tenantId:           fd.get('tenantId'),
            inspectorContactId: fd.get('inspectorContactId'),
            date:               fd.get('date'),
            timeSlot:           fd.get('timeSlot'),
            propertyAddress:    fd.get('propertyAddress'),
            clientName:         fd.get('clientName'),
            clientEmail:        fd.get('clientEmail'),
            agreementRequired:  !!fd.get('agreementRequired'),
            paymentRequired:    !!fd.get('paymentRequired'),
        };
        var phone = fd.get('clientPhone');
        if (phone) payload.clientPhone = phone;

        fetch('/api/agent/concierge-book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload),
        })
            .then(function (r) {
                return r.json().then(function (j) { return { status: r.status, body: j }; });
            })
            .then(function (out) {
                if (out.status === 200 && out.body && out.body.success) {
                    // Replace the form with the timeline. Update the active
                    // step's sub-line to reflect which mode kicked in.
                    form.style.display = 'none';
                    if (timeline) timeline.style.display = 'grid';
                    if (confirmSub && out.body.data) {
                        if (out.body.data.status === 'awaiting_inspector') {
                            confirmSub.textContent = 'Sent to the inspector for review. The client gets the magic link once approved.';
                        } else {
                            confirmSub.textContent = 'Magic link sent — waiting on the client.';
                        }
                    }
                    return;
                }
                var msg = (out.body && out.body.error && out.body.error.message)
                    || 'Could not send booking. Please double-check the form and try again.';
                setError(msg);
                btn.disabled = false;
                btn.textContent = 'Send booking to client';
            })
            .catch(function () {
                setError('Network error. Please try again.');
                btn.disabled = false;
                btn.textContent = 'Send booking to client';
            });
    });
})();

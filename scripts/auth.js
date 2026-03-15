// Auth helpers: register, login, logout, getMe
// Communicates with /api/auth/* and /api/me

(function () {
    'use strict';

    let _currentUser = null; // { id, email } or null

    async function apiFetch(url, options) {
        const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, options));
        let body;
        try {
            body = await res.json();
        } catch (_) {
            body = {};
        }
        return { ok: res.ok, status: res.status, body };
    }

    async function getMe() {
        const { ok, body } = await apiFetch('/api/me');
        _currentUser = ok ? body : null;
        return _currentUser;
    }

    async function register(email, password) {
        const { ok, body } = await apiFetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (ok) _currentUser = body;
        return { ok, body };
    }

    async function login(email, password) {
        const { ok, body } = await apiFetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (ok) _currentUser = body;
        return { ok, body };
    }

    async function logout() {
        const { ok } = await apiFetch('/api/auth/logout', { method: 'POST' });
        if (ok) _currentUser = null;
        return ok;
    }

    function currentUser() {
        return _currentUser;
    }

    // Expose globally
    window.auth = { getMe, register, login, logout, currentUser };
}());

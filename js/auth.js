/**
 * auth.js — Login, Signup, Logout, Session management
 * Fixed: no circular import from app.js, uses dynamic import for showToast/updateNavbarAuth
 */

import { sb } from './supabase.js';

export let currentUser = null;

/* ── Session Listener ── */
export async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await loadProfile(currentUser);
    const { updateNavbarAuth } = await import('./app.js');
    updateNavbarAuth(currentUser);
  }

  sb.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    if (currentUser) await loadProfile(currentUser);
    const { updateNavbarAuth } = await import('./app.js');
    updateNavbarAuth(currentUser);
  });
}

async function loadProfile(user) {
  const { data } = await sb.from('users').select('*').eq('id', user.id).maybeSingle();
  if (data) user.profile = data;
}

/* ── Signup ── */
export async function signUp(name, email, password, phone) {
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { name } }
  });
  if (error) throw error;
  if (phone && data.user) {
    setTimeout(async () => {
      await sb.from('users').update({ phone, name }).eq('id', data.user.id);
    }, 1000);
  }
  return data;
}

/* ── Login ── */
export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/* ── Logout ── */
export async function signOut() {
  await sb.auth.signOut();
  currentUser = null;
  const { updateNavbarAuth, showToast, route } = await import('./app.js');
  updateNavbarAuth(null);
  showToast('Signed out successfully.', 'info');
  route('home');
}

/* ── Require Auth Guard ── */
export function requireAuth(callback) {
  if (!currentUser) {
    openAuthModal('login');
    return false;
  }
  callback();
  return true;
}

/* ── Modal ── */
export function openAuthModal(tab = 'login') {
  document.getElementById('auth-modal')?.classList.add('open');
  switchAuthTab(tab);
}

export function closeAuthModal() {
  document.getElementById('auth-modal')?.classList.remove('open');
  clearAuthForms();
}

function switchAuthTab(tab) {
  document.getElementById('login-form-wrap')?.classList.toggle('hidden', tab !== 'login');
  document.getElementById('signup-form-wrap')?.classList.toggle('hidden', tab !== 'signup');
  document.getElementById('tab-login')?.classList.toggle('active',  tab === 'login');
  document.getElementById('tab-signup')?.classList.toggle('active', tab === 'signup');
}

function clearAuthForms() {
  ['loginEmail','loginPassword','signupName','signupEmail','signupPhone','signupPassword']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  clearAuthError();
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function clearAuthError() {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}

/* ── Form Submit Handlers ── */
export function setupAuthForms() {
  // Login
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const email    = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      await signIn(email, password);
      closeAuthModal();
      const { showToast } = await import('./app.js');
      showToast('Welcome back! 👋', 'success');
    } catch (err) {
      showAuthError(err.message || 'Login failed. Please try again.');
    } finally {
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  });

  // Signup
  document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthError();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Creating account…';
    try {
      const name     = document.getElementById('signupName').value.trim();
      const email    = document.getElementById('signupEmail').value.trim();
      const phone    = document.getElementById('signupPhone').value.trim();
      const password = document.getElementById('signupPassword').value;
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      await signUp(name, email, password, phone);
      closeAuthModal();
      const { showToast } = await import('./app.js');
      showToast('Account created! Check your email to confirm.', 'success');
    } catch (err) {
      showAuthError(err.message || 'Signup failed. Please try again.');
    } finally {
      btn.disabled = false; btn.textContent = 'Create Account';
    }
  });

  // Close overlay click
  document.getElementById('auth-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'auth-modal') closeAuthModal();
  });

  // Tab switching
  document.getElementById('tab-login')?.addEventListener('click',  () => switchAuthTab('login'));
  document.getElementById('tab-signup')?.addEventListener('click', () => switchAuthTab('signup'));
  document.getElementById('auth-close')?.addEventListener('click', closeAuthModal);

  // Open triggers
  document.getElementById('btn-login')?.addEventListener('click',  () => openAuthModal('login'));
  document.getElementById('btn-signup')?.addEventListener('click', () => openAuthModal('signup'));
}

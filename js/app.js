/**
 * app.js — SPA Router + Global Utilities
 * Fixed: circular import removed, event delegation for nav, booking reinit guard
 */

import { initAuth, setupAuthForms, signOut, openAuthModal } from './auth.js';
import { initBookingPage } from './booking.js';
import { initDashboardPage } from './dashboard.js';

/* ── Toast ── */
let toastTimer = null;
export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const icons   = { success: '✅', error: '❌', info: 'ℹ️' };
  const borders  = { success: '#D4AF37', error: '#F87171', info: '#9CA3AF' };
  toast.style.borderColor = borders[type] || borders.info;
  toast.innerHTML = `<span>${icons[type] || ''} ${message}</span>`;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
}

/* ── Navbar auth state ── */
export function updateNavbarAuth(user) {
  const guestNav   = document.getElementById('nav-guest');
  const userNav    = document.getElementById('nav-user');
  const userNameEl = document.getElementById('nav-username');
  if (user) {
    guestNav?.classList.add('hidden');
    userNav?.classList.remove('hidden');
    if (userNameEl) userNameEl.textContent = user.profile?.name || user.email?.split('@')[0] || 'User';
  } else {
    guestNav?.classList.remove('hidden');
    userNav?.classList.add('hidden');
  }
}

/* ── SPA Sections ── */
const SECTIONS = ['home-section', 'booking-section', 'dashboard-section'];
let bookingInitialized = false;

function showSection(name) {
  SECTIONS.forEach(id => {
    document.getElementById(id)?.classList.toggle('hidden', id !== `${name}-section`);
  });
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('text-gold', el.dataset.nav === name);
    el.classList.toggle('text-gray-400', el.dataset.nav !== name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export async function route(page) {
  showSection(page);
  if (page === 'booking') {
    // Reset booking state each time user navigates to booking
    bookingInitialized = false;
    await initBookingPage();
  }
  if (page === 'dashboard') await initDashboardPage();
}

/* ── Navbar ── */
function setupNavbar() {
  window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 40);
  });

  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('mobile-menu')?.classList.toggle('hidden');
  });

  // Event delegation on document for ALL [data-nav] — catches footer too
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-nav]');
    if (!el) return;
    e.preventDefault();
    route(el.dataset.nav);
    document.getElementById('mobile-menu')?.classList.add('hidden');
  });

  document.getElementById('btn-logout')?.addEventListener('click', signOut);
  document.getElementById('nav-dashboard-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    route('dashboard');
  });
}

/* ── Home Page — Scroll animations ── */
function setupHomePage() {
  document.getElementById('btn-book-hero')?.addEventListener('click', () => route('booking'));
  document.getElementById('btn-book-services')?.addEventListener('click', () => route('booking'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.anim-on-scroll').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(28px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });

  // Counter animation for stats
  const animateCounter = (el, target, prefix = '', suffix = '') => {
    let start = 0;
    const step = target / 40;
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { start = target; clearInterval(timer); }
      el.textContent = prefix + Math.floor(start) + suffix;
    }, 35);
  };

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const val = parseInt(el.dataset.target);
        animateCounter(el, val, el.dataset.prefix || '', el.dataset.suffix || '');
        statsObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-target]').forEach(el => statsObserver.observe(el));
}

/* ── Global event bus ── */
window.addEventListener('route',    (e) => route(e.detail));
window.addEventListener('openAuth', (e) => openAuthModal(e.detail));

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  setupAuthForms();
  setupNavbar();
  setupHomePage();
  showSection('home');
});

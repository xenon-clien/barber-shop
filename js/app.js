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

/* ── Intro Animation ── */
function playIntroAnimation() {
  const scissor = document.getElementById('intro-scissor');
  const left = document.getElementById('intro-left');
  const right = document.getElementById('intro-right');
  const overlay = document.getElementById('intro-overlay');
  const body = document.getElementById('body');

  if (!scissor || !left || !right || !overlay) return;

  // Wait a moment for page render
  setTimeout(() => {
    // 1. Scissor moves down through the screen
    scissor.style.transform = 'translateY(120vh) rotate(-90deg)';
    
    // As scissor cuts, add glowing borders to curtains
    left.classList.add('border-opacity-100');
    right.classList.add('border-opacity-100');
    
    // 2. Open the curtains behind the scissor
    setTimeout(() => {
      left.style.transform = 'translateX(-100%)';
      right.style.transform = 'translateX(100%)';
      
      // 3. Remove overlay and enable scrolling
      setTimeout(() => {
        overlay.remove();
        if (body) body.classList.remove('overflow-hidden');
      }, 1200); // Wait for curtain transition
    }, 800);
    
  }, 300);
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  playIntroAnimation();
  await initAuth();
  setupAuthForms();
  setupNavbar();
  setupHomePage();
  showSection('home');
});

/* ── AI Barber Guide Logic ── */
const aiResponses = {
  'Classic Pompadour': `
    <p><strong>Haircut Guide:</strong></p>
    <ul class="list-disc pl-5 space-y-1 text-gray-300">
      <li><strong>Sides & Back:</strong> Use a <strong>No. 2 or No. 3 trimmer guard</strong> to taper the sides. Keep it classic, not a skin fade.</li>
      <li><strong>Top:</strong> Leave 3-5 inches of length on top. Point cut for texture.</li>
      <li><strong>Styling:</strong> Blow-dry backward using a round brush. Apply strong-hold pomade for the classic slick look.</li>
    </ul>
    <p class="mt-4"><strong>Beard Guide:</strong></p>
    <ul class="list-disc pl-5 space-y-1 text-gray-300">
      <li>Use a <strong>No. 3 guard</strong> to keep the beard neat but full.</li>
      <li>Line up the cheeks and neck sharply using a straight razor.</li>
    </ul>
  `,
  'Mid Fade & Line Up': `
    <p><strong>Haircut Guide:</strong></p>
    <ul class="list-disc pl-5 space-y-1 text-gray-300">
      <li><strong>Sides & Back:</strong> Start with <strong>No. 0 (bald)</strong> around the ears. Use <strong>No. 1 and No. 2 guards</strong> to blend the mid fade seamlessly.</li>
      <li><strong>Top:</strong> Trim slightly with scissors to keep it level.</li>
      <li><strong>Line Up:</strong> Use a detailer trimmer for sharp, crisp edges along the forehead and temples.</li>
    </ul>
    <p class="mt-4"><strong>Beard Guide:</strong></p>
    <ul class="list-disc pl-5 space-y-1 text-gray-300">
      <li>Fade the sideburns into the beard using <strong>No. 1 and No. 1.5 guards</strong>.</li>
      <li>Keep the chin area thicker (No. 4 guard) and line up the bottom edges.</li>
    </ul>
  `,
  'Textured Crop': `
    <p><strong>Haircut Guide:</strong></p>
    <ul class="list-disc pl-5 space-y-1 text-gray-300">
      <li><strong>Sides & Back:</strong> High fade using a <strong>No. 1 guard</strong>.</li>
      <li><strong>Top:</strong> Heavily texture the top using thinning shears. Leave the fringe blunt and short.</li>
      <li><strong>Styling:</strong> Apply matte clay or texture powder to enhance the messy, choppy look.</li>
    </ul>
    <p class="mt-4"><strong>Beard Guide:</strong></p>
    <ul class="list-disc pl-5 space-y-1 text-gray-300">
      <li>Stubble look: Use a <strong>No. 1 guard</strong> all over the beard.</li>
      <li>Natural neck line (no sharp razor lines needed for this casual look).</li>
    </ul>
  `
};

window.openAIGuide = function(styleName) {
  const modal = document.getElementById('ai-modal');
  const title = document.getElementById('ai-style-name');
  const content = document.getElementById('ai-content');
  
  if (!modal || !title || !content) return;
  
  title.textContent = styleName;
  content.innerHTML = '<p class="text-gold animate-pulse text-center py-10">AI is analyzing the style...</p>';
  modal.classList.add('open');
  
  // Simulate AI loading delay
  setTimeout(() => {
    content.innerHTML = aiResponses[styleName] || '<p>Style analysis not found.</p>';
  }, 1200);
};

window.closeAIGuide = function() {
  const modal = document.getElementById('ai-modal');
  if (modal) modal.classList.remove('open');
};

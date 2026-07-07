/**
 * booking.js
 * Full Booking Engine:
 * - Fetches services & barbers from Supabase
 * - Multi-service cart with live price/duration totals
 * - Barber selection
 * - Smart date/time slot picker with overlap prevention
 * - Booking submission (bookings + booking_items)
 */

import { sb } from './supabase.js';
import { currentUser, requireAuth, openAuthModal } from './auth.js';
import { showToast } from './app.js';

/* ── State ── */
const state = {
  services:      [],
  barbers:       [],
  cart:          new Set(),      // service ids
  selectedBarber: null,          // barber object or null (= any)
  selectedDate:  '',
  selectedSlot:  '',
  step:          1,              // 1=services, 2=barber+date, 3=confirm
};

const TIME_SLOTS = [
  '09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30',
  '15:00','15:30','16:00','16:30','17:00','17:30',
  '18:00','18:30',
];

/* ── Load Data ── */
async function loadBookingData() {
  const [{ data: services }, { data: barbers }] = await Promise.all([
    sb.from('services').select('*').order('category').order('name'),
    sb.from('barbers').select('*').eq('availability_status', true).order('name'),
  ]);
  state.services = services || [];
  state.barbers  = barbers  || [];
}

/* ── Computed Totals ── */
function getCartTotals() {
  let price = 0, duration = 0;
  for (const id of state.cart) {
    const s = state.services.find(x => x.id === id);
    if (s) { price += parseFloat(s.price); duration += s.duration_minutes; }
  }
  return { price: price.toFixed(2), duration };
}

/* ── Render Category Tabs ── */
function renderCategoryTabs(container, activeCategory, onSelect) {
  const categories = ['All', ...new Set(state.services.map(s => s.category))];
  container.innerHTML = categories.map(cat => `
    <button class="category-tab ${cat === activeCategory ? 'active' : ''}" data-cat="${cat}">
      ${cat}
    </button>
  `).join('');
  container.querySelectorAll('.category-tab').forEach(btn => {
    btn.addEventListener('click', () => onSelect(btn.dataset.cat));
  });
}

/* ── Render Services ── */
function renderServices(container, activeCategory) {
  const filtered = activeCategory === 'All'
    ? state.services
    : state.services.filter(s => s.category === activeCategory);

  container.innerHTML = filtered.map(s => `
    <div class="service-card ${state.cart.has(s.id) ? 'selected' : ''}"
         data-id="${s.id}" role="checkbox"
         aria-checked="${state.cart.has(s.id)}"
         tabindex="0">
      <div class="flex justify-between items-start gap-2">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
              ${state.cart.has(s.id) ? 'bg-amber-500 border-amber-500' : 'border-gray-500'}">
              ${state.cart.has(s.id) ? '<svg class="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 12 12"><path d="M10.28 2.28L4 8.56 1.72 6.28a1 1 0 00-1.41 1.41l3 3a1 1 0 001.41 0l7-7a1 1 0 00-1.41-1.41z"/></svg>' : ''}
            </div>
            <h4 class="font-semibold text-sm text-white">${s.name}</h4>
          </div>
          <p class="text-xs text-muted ml-6">${s.description}</p>
          <p class="text-xs text-muted ml-6 mt-1">⏱ ${s.duration_minutes} min</p>
        </div>
        <div class="text-right">
          <p class="text-gold font-bold text-base">₹${(parseFloat(s.price) * 100).toLocaleString('en-IN')}</p>
          <p class="text-xs text-muted">${s.category}</p>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.service-card').forEach(card => {
    const toggle = () => {
      const id = parseInt(card.dataset.id);
      if (state.cart.has(id)) state.cart.delete(id);
      else state.cart.add(id);
      renderServices(container, activeCategory);
      updateOrderSummary();
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }});
  });
}

/* ── Update Order Summary Bar ── */
function updateOrderSummary() {
  const bar = document.getElementById('order-summary');
  const { price, duration } = getCartTotals();
  const count = state.cart.size;

  if (count === 0) {
    bar.classList.remove('visible');
    return;
  }
  bar.classList.add('visible');
  bar.querySelector('#summary-count').textContent    = `${count} service${count !== 1 ? 's' : ''}`;
  bar.querySelector('#summary-price').textContent    = `₹${(parseFloat(price) * 100).toLocaleString('en-IN')}`;
  bar.querySelector('#summary-duration').textContent = `${duration} min`;
}

/* ── Render Barber Carousel ── */
function renderBarbers(container) {
  const anyCard = `
    <div class="barber-card ${state.selectedBarber === null ? 'selected' : ''}" data-id="any">
      <div class="w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl
           border-2 border-dashed" style="border-color:var(--border-gold)">✂️</div>
      <p class="font-semibold text-sm text-white">Any Available</p>
      <p class="text-xs text-muted mt-1">We'll pick the best!</p>
      <div class="stars mt-2">★★★★★</div>
    </div>
  `;
  const barberCards = state.barbers.map(b => `
    <div class="barber-card ${state.selectedBarber?.id === b.id ? 'selected' : ''}" data-id="${b.id}">
      <img src="${b.image_url}" alt="${b.name}" loading="lazy">
      <p class="font-semibold text-sm text-white">${b.name}</p>
      <p class="text-xs text-muted mt-0.5">${b.specialty}</p>
      <div class="stars mt-2">${'★'.repeat(Math.round(b.rating))}${'☆'.repeat(5 - Math.round(b.rating))}</div>
      <p class="text-xs text-gold mt-1">${b.rating} / 5.0</p>
    </div>
  `).join('');

  container.innerHTML = anyCard + barberCards;

  container.querySelectorAll('.barber-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      state.selectedBarber = id === 'any' ? null : state.barbers.find(b => b.id === parseInt(id));
      renderBarbers(container);
      // Re-render slots if date already selected
      if (state.selectedDate) renderTimeSlots();
    });
  });
}

/* ── Slot Overlap Prevention ── */
async function fetchBookedSlots(barberId, date) {
  let query = sb.from('bookings')
    .select('time_slot, total_duration')
    .eq('booking_date', date)
    .in('status', ['confirmed', 'pending']);

  if (barberId) query = query.eq('barber_id', barberId);

  const { data } = await query;
  return data || [];
}

function slotOverlaps(slotTime, slotDuration, bookedSlots) {
  const toMinutes = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const newStart = toMinutes(slotTime);
  const newEnd   = newStart + slotDuration;

  return bookedSlots.some(b => {
    const bStart = toMinutes(b.time_slot.slice(0, 5));
    const bEnd   = bStart + b.total_duration;
    return newStart < bEnd && newEnd > bStart;  // overlap check
  });
}

async function renderTimeSlots() {
  const container = document.getElementById('slot-grid');
  if (!container || !state.selectedDate) return;

  // Show loading
  container.innerHTML = TIME_SLOTS.map(() =>
    '<div class="skeleton time-slot" style="height:38px"></div>'
  ).join('');

  const { duration } = getCartTotals();
  const slotDuration = duration || 30;
  const barberId = state.selectedBarber?.id || null;
  const bookedSlots = await fetchBookedSlots(barberId, state.selectedDate);

  // Check date is not in the past
  const today = new Date(); today.setHours(0,0,0,0);
  const chosen = new Date(state.selectedDate);

  container.innerHTML = TIME_SLOTS.map(slot => {
    const isToday = chosen.getTime() === today.getTime();
    const nowMin  = isToday ? (new Date().getHours() * 60 + new Date().getMinutes()) : 0;
    const slotMin = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]);
    const isPast  = isToday && slotMin <= nowMin;
    const hasOverlap = slotOverlaps(slot, slotDuration, bookedSlots);
    const disabled = isPast || hasOverlap;
    const isSelected = slot === state.selectedSlot && !disabled;

    return `
      <div class="time-slot ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}"
           data-slot="${slot}" ${disabled ? 'title="Not available"' : ''}>
        ${slot}
        ${hasOverlap && !isPast ? '<span class="block text-xs opacity-60">Booked</span>' : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.time-slot:not(.disabled)').forEach(el => {
    el.addEventListener('click', () => {
      state.selectedSlot = el.dataset.slot;
      container.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}

/* ── Confirm Booking ── */
function renderConfirmation(container) {
  const { price, duration } = getCartTotals();
  const selectedServices = state.services.filter(s => state.cart.has(s.id));
  const barberName = state.selectedBarber?.name || 'Any Available Barber';
  const dateStr = new Date(state.selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  container.innerHTML = `
    <div class="card p-6 mb-6" style="border-color:var(--border-gold)">
      <h3 class="font-serif text-xl text-gold mb-4">📋 Booking Summary</h3>
      <div class="space-y-3 mb-4">
        ${selectedServices.map(s => `
          <div class="flex justify-between py-1 border-b" style="border-color:var(--border)">
            <span class="text-gray-300">${s.name}</span>
            <span class="text-gold">₹${(parseFloat(s.price) * 100).toLocaleString('en-IN')}</span>
          </div>
        `).join('')}
      </div>
      <div class="gold-line my-3"></div>
      <div class="flex justify-between text-sm mb-2">
        <span class="text-muted">Barber</span>
        <span class="text-white font-medium">${barberName}</span>
      </div>
      <div class="flex justify-between text-sm mb-2">
        <span class="text-muted">Date</span>
        <span class="text-white font-medium">${dateStr}</span>
      </div>
      <div class="flex justify-between text-sm mb-4">
        <span class="text-muted">Time</span>
        <span class="text-white font-medium">${state.selectedSlot}</span>
      </div>
      <div class="gold-line my-3"></div>
      <div class="flex justify-between font-bold">
        <span class="text-gold">Total</span>
        <div class="text-right">
          <span class="text-gold text-xl">₹${(parseFloat(price) * 100).toLocaleString('en-IN')}</span>
          <p class="text-xs text-muted font-normal">${duration} minutes</p>
        </div>
      </div>
    </div>
    <button id="confirm-booking-btn" class="btn-gold w-full text-base py-4">
      ✅ Confirm Appointment
    </button>
  `;

  document.getElementById('confirm-booking-btn')?.addEventListener('click', submitBooking);
}

/* ── Submit Booking ── */
async function submitBooking() {
  if (!requireAuth(() => {})) return;
  const btn = document.getElementById('confirm-booking-btn');
  btn.disabled = true; btn.textContent = 'Processing…';

  try {
    const { price, duration } = getCartTotals();
    const { data: booking, error: bookingErr } = await sb.from('bookings').insert({
      user_id:        currentUser.id,
      barber_id:      state.selectedBarber?.id || null,
      total_price:    parseFloat(price),
      total_duration: duration,
      booking_date:   state.selectedDate,
      time_slot:      state.selectedSlot,
      status:         'pending',
    }).select().single();

    if (bookingErr) throw bookingErr;

    // Insert booking items
    const items = [...state.cart].map(sid => ({ booking_id: booking.id, service_id: sid }));
    const { error: itemsErr } = await sb.from('booking_items').insert(items);
    if (itemsErr) throw itemsErr;

    // Reset state
    state.cart.clear();
    state.selectedBarber = null;
    state.selectedDate   = '';
    state.selectedSlot   = '';

    showToast('🎉 Appointment booked successfully!', 'success');
    window.dispatchEvent(new CustomEvent('route', { detail: 'dashboard' }));

  } catch (err) {
    showToast(err.message || 'Booking failed. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = '✅ Confirm Appointment';
  }
}

/* ── Step Navigation ── */
function setStep(n) {
  state.step = n;
  [1, 2, 3].forEach(i => {
    document.getElementById(`step-${i}`)?.classList.toggle('hidden', i !== n);
  });
  // Update indicators
  [1, 2, 3].forEach(i => {
    const dot = document.getElementById(`step-dot-${i}`);
    if (!dot) return;
    dot.classList.toggle('done', i < n);
    dot.classList.toggle('active', i === n);
    dot.classList.remove(...(i < n ? ['active'] : []), ...(i === n ? ['done'] : []));
    if (i < n) { dot.classList.add('done'); dot.classList.remove('active'); }
    else if (i === n) { dot.classList.add('active'); dot.classList.remove('done'); }
    else { dot.classList.remove('done', 'active'); }
  });
  document.getElementById('step-line-1')?.classList.toggle('done', n > 1);
  document.getElementById('step-line-2')?.classList.toggle('done', n > 2);
  window.scrollTo({ top: document.getElementById('booking-section')?.offsetTop - 80, behavior: 'smooth' });
}

/* ── Init Booking Page ── */
export async function initBookingPage() {
  const section = document.getElementById('booking-section');
  if (!section) return;

  section.innerHTML = `
    <div class="section-padding max-container">
      <div class="text-center mb-10">
        <p class="text-sm tracking-widest text-gold mb-2 uppercase">Reserve Your Experience</p>
        <h2 class="font-serif text-4xl md:text-5xl text-white">Book an <span class="text-gold-gradient">Appointment</span></h2>
        <div class="hero-divider"></div>
      </div>

      <!-- Step Indicator -->
      <div class="step-indicator max-w-md mx-auto mb-10">
        <div id="step-dot-1" class="step-dot active">1</div>
        <div id="step-line-1" class="step-line"></div>
        <div id="step-dot-2" class="step-dot">2</div>
        <div id="step-line-2" class="step-line"></div>
        <div id="step-dot-3" class="step-dot">3</div>
      </div>

      <!-- Step 1: Services -->
      <div id="step-1">
        <h3 class="font-serif text-2xl text-white mb-6">Select Services</h3>
        <div id="category-tabs" class="flex flex-wrap gap-2 mb-6"></div>
        <div id="services-grid" class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8"></div>
        <div class="text-right">
          <button id="to-step-2" class="btn-gold px-8">Next: Choose Barber & Time →</button>
        </div>
      </div>

      <!-- Step 2: Barber + Date/Time -->
      <div id="step-2" class="hidden">
        <button id="back-to-step-1" class="text-muted text-sm mb-6 flex items-center gap-1 hover:text-gold transition-colors">
          ← Back to Services
        </button>

        <h3 class="font-serif text-2xl text-white mb-4">Choose Your Barber</h3>
        <div id="barbers-carousel" class="barbers-carousel mb-10 pb-2"></div>

        <h3 class="font-serif text-2xl text-white mb-4">Pick a Date</h3>
        <div class="mb-6">
          <input type="date" id="booking-date" class="form-input max-w-xs"
            min="${new Date().toISOString().split('T')[0]}"
            max="${new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]}">
        </div>

        <h3 class="font-serif text-2xl text-white mb-4">Available Time Slots</h3>
        <p class="text-muted text-sm mb-4">Unavailable slots are greyed out based on real-time bookings.</p>
        <div id="slot-grid" class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-8"></div>

        <div class="flex gap-4 justify-end">
          <button id="back-to-step-1-2" class="btn-outline-gold px-6">← Back</button>
          <button id="to-step-3" class="btn-gold px-8">Review Booking →</button>
        </div>
      </div>

      <!-- Step 3: Confirm -->
      <div id="step-3" class="hidden max-w-lg mx-auto">
        <button id="back-to-step-2" class="text-muted text-sm mb-6 flex items-center gap-1 hover:text-gold transition-colors">
          ← Back to Schedule
        </button>
        <h3 class="font-serif text-2xl text-white mb-6">Confirm Your Booking</h3>
        <div id="confirm-container"></div>
      </div>
    </div>
  `;

  // Load data
  await loadBookingData();

  // Init step 1
  let activeCategory = 'All';
  const catTabs = document.getElementById('category-tabs');
  const svcGrid = document.getElementById('services-grid');

  const refreshServices = (cat) => {
    activeCategory = cat;
    renderCategoryTabs(catTabs, activeCategory, refreshServices);
    renderServices(svcGrid, activeCategory);
  };
  refreshServices('All');
  updateOrderSummary();

  // Step navigation
  document.getElementById('to-step-2')?.addEventListener('click', () => {
    if (state.cart.size === 0) { showToast('Please select at least one service.', 'error'); return; }
    setStep(2);
    renderBarbers(document.getElementById('barbers-carousel'));
  });

  document.getElementById('back-to-step-1')?.addEventListener('click', () => setStep(1));
  document.getElementById('back-to-step-1-2')?.addEventListener('click', () => setStep(1));
  document.getElementById('back-to-step-2')?.addEventListener('click', () => setStep(2));

  document.getElementById('to-step-3')?.addEventListener('click', () => {
    if (!state.selectedDate) { showToast('Please select a date.', 'error'); return; }
    if (!state.selectedSlot) { showToast('Please select a time slot.', 'error'); return; }
    setStep(3);
    requireAuth(() => {
      renderConfirmation(document.getElementById('confirm-container'));
    });
    if (!currentUser) openAuthModal('login');
  });

  // Date picker
  document.getElementById('booking-date')?.addEventListener('change', (e) => {
    state.selectedDate = e.target.value;
    state.selectedSlot = '';
    renderTimeSlots();
  });
}

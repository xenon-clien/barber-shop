/**
 * dashboard.js
 * Client Dashboard: Upcoming & Past appointments with cancel option.
 */

import { sb } from './supabase.js';
import { currentUser } from './auth.js';
import { showToast } from './app.js';

/* ── Fetch bookings with related data ── */
async function fetchUserBookings() {
  const { data, error } = await sb
    .from('bookings')
    .select(`
      *,
      barbers ( name, specialty, image_url ),
      booking_items (
        service_id,
        services ( name, price )
      )
    `)
    .eq('user_id', currentUser.id)
    .order('booking_date', { ascending: false })
    .order('time_slot', { ascending: false });

  if (error) throw error;
  return data || [];
}

/* ── Cancel Booking ── */
async function cancelBooking(bookingId, btn) {
  btn.disabled = true; btn.textContent = 'Cancelling…';
  const { error } = await sb
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('user_id', currentUser.id);

  if (error) {
    showToast('Failed to cancel. Please try again.', 'error');
    btn.disabled = false; btn.textContent = 'Cancel';
    return;
  }
  showToast('Appointment cancelled successfully.', 'info');
  initDashboardPage(); // Refresh
}

/* ── Can Cancel (must be >2h before slot) ── */
function canCancel(booking) {
  if (booking.status !== 'pending' && booking.status !== 'confirmed') return false;
  const slotDateTime = new Date(`${booking.booking_date}T${booking.time_slot}`);
  const now = new Date();
  const diffMs = slotDateTime.getTime() - now.getTime();
  return diffMs > 2 * 60 * 60 * 1000; // > 2 hours
}

/* ── Format Date ── */
function fmtDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
}

/* ── Render Booking Card ── */
function renderBookingCard(b) {
  const barberName = b.barbers?.name || 'Any Available';
  const services   = b.booking_items?.map(bi => bi.services?.name).filter(Boolean).join(', ') || '—';
  const cancellable = canCancel(b);

  return `
    <div class="booking-item-card animate-fade-in-up" id="booking-${b.id}">
      <div class="flex flex-wrap justify-between items-start gap-3 mb-3">
        <div>
          <p class="font-semibold text-white text-base">${services}</p>
          <p class="text-sm text-muted mt-0.5">with <span class="text-gold">${barberName}</span></p>
        </div>
        <span class="badge badge-${b.status}">${b.status}</span>
      </div>
      <div class="gold-line my-3"></div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
        <div>
          <p class="text-muted text-xs mb-0.5">Date</p>
          <p class="text-white">${fmtDate(b.booking_date)}</p>
        </div>
        <div>
          <p class="text-muted text-xs mb-0.5">Time</p>
          <p class="text-white">${b.time_slot?.slice(0,5)}</p>
        </div>
        <div>
          <p class="text-muted text-xs mb-0.5">Duration</p>
          <p class="text-white">${b.total_duration} min</p>
        </div>
        <div>
          <p class="text-xs text-muted">Total</p>
          <p class="text-gold font-bold">₹${parseFloat(b.total_price).toLocaleString('en-IN')}</p>
        </div>
      </div>
      ${cancellable ? `
        <button class="cancel-btn btn-outline-gold text-sm py-2 px-4"
                data-id="${b.id}"
                style="border-color:#7f1d1d; color:#F87171"
                title="Cancel appointment">
          Cancel Appointment
        </button>
        <p class="text-xs text-muted mt-1">Can cancel up to 2 hours before your appointment.</p>
      ` : ''}
    </div>
  `;
}

/* ── Render Tab Content ── */
function renderTab(bookings, tab, container) {
  const now = new Date();
  const filtered = bookings.filter(b => {
    const slotDT = new Date(`${b.booking_date}T${b.time_slot}`);
    const isPast = slotDT < now || b.status === 'completed' || b.status === 'cancelled';
    return tab === 'upcoming' ? !isPast : isPast;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16">
        <p class="text-5xl mb-4">${tab === 'upcoming' ? '📅' : '🕐'}</p>
        <p class="text-muted">No ${tab === 'upcoming' ? 'upcoming appointments' : 'past bookings'} found.</p>
        ${tab === 'upcoming' ? `
          <button id="dash-book-now" class="btn-gold mt-6 px-8">Book an Appointment</button>
        ` : ''}
      </div>
    `;
    document.getElementById('dash-book-now')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('route', { detail: 'booking' }));
    });
    return;
  }

  container.innerHTML = `<div class="space-y-4">${filtered.map(renderBookingCard).join('')}</div>`;

  container.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Cancel this appointment?')) cancelBooking(btn.dataset.id, btn);
    });
  });
}

/* ── Init Dashboard ── */
export async function initDashboardPage() {
  const section = document.getElementById('dashboard-section');
  if (!section) return;

  if (!currentUser) {
    section.innerHTML = `
      <div class="section-padding max-container text-center">
        <p class="text-5xl mb-4">🔒</p>
        <h2 class="font-serif text-3xl text-white mb-3">Sign In Required</h2>
        <p class="text-muted mb-6">Please sign in to view your appointments.</p>
        <button id="dash-signin-btn" class="btn-gold px-8">Sign In</button>
      </div>
    `;
    document.getElementById('dash-signin-btn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('openAuth', { detail: 'login' }));
    });
    return;
  }

  section.innerHTML = `
    <div class="section-padding max-container">
      <div class="mb-8">
        <p class="text-sm tracking-widest text-gold mb-2 uppercase">My Appointments</p>
        <h2 class="font-serif text-4xl text-white">Your <span class="text-gold-gradient">Dashboard</span></h2>
        <div class="hero-divider" style="margin:1rem 0"></div>
        <p class="text-muted">Welcome back, <span class="text-gold">${currentUser.profile?.name || currentUser.email}</span> 👋</p>
      </div>

      <!-- Tabs -->
      <div class="flex border-b mb-6" style="border-color:var(--border)">
        <button id="tab-upcoming" class="dash-tab active">📅 Upcoming</button>
        <button id="tab-history"  class="dash-tab">🕐 Past History</button>
        <div class="ml-auto flex items-center pb-2">
          <button id="dash-new-booking" class="btn-gold text-sm px-5 py-2">+ Book Now</button>
        </div>
      </div>

      <!-- Content -->
      <div id="dash-content">
        <div class="skeleton h-32 rounded-lg mb-4"></div>
        <div class="skeleton h-32 rounded-lg mb-4"></div>
        <div class="skeleton h-32 rounded-lg"></div>
      </div>
    </div>
  `;

  document.getElementById('dash-new-booking')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('route', { detail: 'booking' }));
  });

  let bookings = [];
  let activeTab = 'upcoming';

  const contentEl = document.getElementById('dash-content');

  try {
    bookings = await fetchUserBookings();
  } catch (err) {
    contentEl.innerHTML = `<p class="text-red-400">Failed to load bookings: ${err.message}</p>`;
    return;
  }

  const switchTab = (tab) => {
    activeTab = tab;
    document.getElementById('tab-upcoming').classList.toggle('active', tab === 'upcoming');
    document.getElementById('tab-history').classList.toggle('active',  tab === 'history');
    renderTab(bookings, tab, contentEl);
  };

  document.getElementById('tab-upcoming')?.addEventListener('click', () => switchTab('upcoming'));
  document.getElementById('tab-history')?.addEventListener('click',  () => switchTab('history'));

  switchTab('upcoming');
}

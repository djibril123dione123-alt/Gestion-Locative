const APP_ORIGIN = window.SAMAY_KEUR_APP_URL || 'https://app.samaykeur.com';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function appUrl(path) {
  return `${APP_ORIGIN}${path}`;
}

function track(name, properties = {}) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: name,
    product: 'Samay Këur',
    source: 'marketing_site',
    ...properties,
  });
}

document.querySelectorAll('[data-app-link]').forEach((link) => {
  const target = link.getAttribute('data-app-link');
  if (!target) return;
  const path = target.startsWith('/') ? target : `/${target}`;
  link.setAttribute('href', appUrl(path));
  link.addEventListener('click', () => track('marketing_cta_click', { target: path }));
});

const header = document.querySelector('[data-site-header]');
let lastScrollY = window.scrollY;

function updateHeader() {
  const current = window.scrollY;
  if (!header) return;
  header.classList.toggle('is-scrolled', current > 16);
  header.classList.toggle('is-hidden', current > 180 && current > lastScrollY && !document.body.classList.contains('menu-open'));
  lastScrollY = current;
}

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const menuToggle = document.querySelector('[data-menu-toggle]');
const mobileMenu = document.querySelector('#mobile-menu');

function setMenu(open) {
  if (!menuToggle || !mobileMenu) return;
  menuToggle.setAttribute('aria-expanded', String(open));
  mobileMenu.hidden = !open;
  document.body.classList.toggle('menu-open', open);
}

menuToggle?.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  setMenu(open);
  track('marketing_mobile_menu', { open });
});

mobileMenu?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('menu-open')) {
    setMenu(false);
    menuToggle?.focus();
  }
});

document.querySelectorAll('a[href^="#"], [data-scroll-target]').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    const selector = trigger.getAttribute('data-scroll-target') || trigger.getAttribute('href');
    if (!selector || selector === '#') return;
    const target = document.querySelector(selector);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    track('marketing_section_scroll', { target: selector });
  });
});

document.querySelectorAll('.faq-item').forEach((item) => {
  const button = item.querySelector('button');
  const panel = item.querySelector('.faq-answer');
  if (!button || !panel) return;

  button.addEventListener('click', () => {
    const open = item.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    track('marketing_faq_toggle', { question: button.textContent.trim(), open });
  });
});

const observer = 'IntersectionObserver' in window && !prefersReducedMotion
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
  : null;

const revealElements = Array.from(document.querySelectorAll('[data-reveal]'));

revealElements.forEach((element, index) => {
  element.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 70}ms`);
  if (observer) observer.observe(element);
  else element.classList.add('is-visible');
});

if (!prefersReducedMotion) {
  const floatingElements = Array.from(document.querySelectorAll('[data-float]'));
  let ticking = false;

  function floatScene() {
    const offset = Math.min(window.scrollY * 0.035, 28);
    floatingElements.forEach((element) => {
      element.style.transform = `translate3d(0, ${offset}px, 0)`;
    });
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (ticking || floatingElements.length === 0) return;
    ticking = true;
    window.requestAnimationFrame(floatScene);
  }, { passive: true });
}

track('marketing_page_view', { path: window.location.pathname });

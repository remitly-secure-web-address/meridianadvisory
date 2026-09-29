const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector("#site-nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.textContent = open ? "Close" : "Menu";
  });
}

fetch("/api/config")
  .then((response) => (response.ok ? response.json() : null))
  .then((config) => {
    if (!config) return;
    if (config.bookingUrl) {
      document.querySelectorAll("[data-booking]").forEach((link) => {
        link.href = config.bookingUrl;
      });
    }
    const contact = document.querySelector(".contact-line");
    if (contact && config.contactHtml) contact.innerHTML = config.contactHtml;
  })
  .catch(() => {});

const tabs = [...document.querySelectorAll('[role="tab"]')];

function selectTab(index, { focus = false } = {}) {
  const next = (index + tabs.length) % tabs.length;
  tabs.forEach((tab, item) => {
    const selected = item === next;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
    tab.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute("aria-controls"));
    if (panel) panel.hidden = !selected;
    if (selected && focus) tab.focus();
  });
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(index));
  tab.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(index + 1, { focus: true });
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(index - 1, { focus: true });
    }
  });
});

const slides = [...document.querySelectorAll(".slide")];
const dots = [...document.querySelectorAll(".dot")];

if (slides.length > 1) {
  let index = 0;
  let timer = 0;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const show = (next) => {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, item) => {
      const active = item === index;
      slide.classList.toggle("is-active", active);
      const image = slide.querySelector("img");
      if (image && !reduce) {
        image.style.animation = "none";
        if (active) {
          void image.offsetWidth;
          image.style.animation = "";
        }
      }
    });
    dots.forEach((dot, item) => {
      if (item === index) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  };
  const stop = () => window.clearInterval(timer);
  const start = () => {
    stop();
    if (reduce) return;
    timer = window.setInterval(() => show(index + 1), 18000);
  };
  dots.forEach((dot, item) => {
    dot.addEventListener("click", () => {
      show(item);
      start();
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  start();
}

/* Lightbox for the plates on the record page */

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxClose = document.getElementById("lightbox-close");
const lightboxOpeners = [...document.querySelectorAll("[data-lightbox]")];

if (lightbox && lightboxImage && lightboxClose && lightboxOpeners.length) {
  let lastFocused = null;

  const openLightbox = (src, alt) => {
    lastFocused = document.activeElement;
    lightboxImage.src = src;
    lightboxImage.alt = alt || "";
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lightboxClose.focus();
  };

  const closeLightbox = () => {
    lightbox.hidden = true;
    lightboxImage.removeAttribute("src");
    lightboxImage.alt = "";
    document.body.style.overflow = "";
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  };

  lightboxOpeners.forEach((button) => {
    button.addEventListener("click", () => {
      const src = button.getAttribute("data-lightbox");
      const alt = button.getAttribute("data-lightbox-alt") || "";
      if (src) openLightbox(src, alt);
    });
  });

  lightboxClose.addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lightbox.hidden) closeLightbox();
  });
}

const proceed = document.querySelector("[data-proceed]");

if (proceed) {
  const scenes = [...proceed.querySelectorAll("[data-scene]")];
  const items = [...document.querySelectorAll("[data-proceed-item]")];
  const dots = [...proceed.querySelectorAll("[data-proceed-dot]")];
  const count = proceed.querySelector("[data-proceed-count]");
  const toggle = proceed.querySelector("[data-proceed-toggle]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let index = 0;
  let timer = 0;
  let paused = reduce;

  const show = (next) => {
    index = (next + scenes.length) % scenes.length;
    scenes.forEach((scene, item) => scene.classList.toggle("is-on", item === index));
    items.forEach((item, itemIndex) => item.classList.toggle("is-on", itemIndex === index));
    dots.forEach((dot, item) => {
      if (item === index) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    if (count) count.textContent = String(index + 1);
  };

  const stop = () => window.clearInterval(timer);
  const start = () => {
    stop();
    if (paused) return;
    timer = window.setInterval(() => show(index + 1), 5600);
  };

  dots.forEach((dot, item) => {
    dot.addEventListener("click", () => {
      show(item);
      start();
    });
  });

  items.forEach((item, itemIndex) => {
    item.tabIndex = 0;
    item.addEventListener("click", () => {
      show(itemIndex);
      start();
    });
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      show(itemIndex);
      start();
    });
  });

  if (toggle) {
    const paint = () => {
      toggle.textContent = paused ? "Play" : "Pause";
      toggle.setAttribute("aria-pressed", paused ? "true" : "false");
    };
    paint();
    toggle.addEventListener("click", () => {
      paused = !paused;
      paint();
      if (paused) stop();
      else start();
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
  start();
}
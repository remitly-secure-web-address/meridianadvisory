const form = document.querySelector("#intake");
const preamble = document.querySelector("#preamble");
const receipt = document.querySelector("#receipt");
const receiptTitle = document.querySelector("#receipt-title");
const referenceInput = document.querySelector("#reference");
const receiptNote = document.querySelector("#receipt-note");
const formAlert = document.querySelector("#form-alert");
const submitButton = document.querySelector("#submit-button");
const copyButton = document.querySelector("#copy-reference");
const anotherButton = document.querySelector("#another-matter");
const originalTitle = document.title;
const storageKey = "meridian-receipt";

const fields = [
  "fullName",
  "email",
  "city",
  "country",
  "storeUrl",
  "niche",
  "product",
  "yearCreated",
  "plan",
  "expert",
  "nature",
  "category",
  "summary",
  "detail",
  "firstSaleDate",
  "lastSaleDate",
  "consent",
  "firstSale",
  "lastSale",
];

function line(id) {
  return document.getElementById(id).value.trim();
}

function radio(name) {
  const selected = form.querySelector(`input[name="${name}"]:checked`);
  return selected ? selected.value : "";
}

function syncSaleFields() {
  const firstIsDate = radio("firstSale") === "date";
  const lastIsDate = radio("lastSale") === "date";
  const firstDate = document.getElementById("firstSaleDate");
  const lastDate = document.getElementById("lastSaleDate");
  const firstWrap = form.querySelector('[data-field="firstSaleDate"]');
  const lastWrap = form.querySelector('[data-field="lastSaleDate"]');
  firstDate.disabled = !firstIsDate;
  lastDate.disabled = !lastIsDate;
  firstWrap.hidden = !firstIsDate;
  lastWrap.hidden = !lastIsDate;
  if (!firstIsDate) firstDate.value = "";
  if (!lastIsDate) lastDate.value = "";
}

function clearErrors() {
  formAlert.hidden = true;
  formAlert.textContent = "";
  for (const name of fields) {
    const error = document.getElementById(`${name}-error`);
    const wrap = form.querySelector(`[data-field="${name}"]`);
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }
    if (wrap) {
      wrap.classList.remove("has-error");
      const control = document.getElementById(name);
      if (control) control.removeAttribute("aria-invalid");
    }
  }
}

function showError(name, message) {
  const error = document.getElementById(`${name}-error`);
  const wrap = form.querySelector(`[data-field="${name}"]`);
  if (!error || !wrap) return;
  error.hidden = false;
  error.textContent = message;
  wrap.classList.add("has-error");
  const control = document.getElementById(name);
  if (control) control.setAttribute("aria-invalid", "true");
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeUrl(value) {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function localProblems(payload) {
  const problems = [];
  if (payload.fullName.length < 2) problems.push(["fullName", "Enter your full name."]);
  if (!validEmail(payload.email)) problems.push(["email", "Enter a valid email address."]);
  if (!validUrl(payload.storeUrl)) {
    problems.push(["storeUrl", "Enter the public address of the store."]);
  }
  if (!payload.nature) problems.push(["nature", "Select the nature of this submission."]);
  if (!payload.category) problems.push(["category", "Select a category."]);
  if (payload.summary.length < 20) {
    problems.push(["summary", "Please give a fuller description."]);
  }
  if (payload.yearCreated) {
    const current = new Date().getFullYear();
    const parsed = Number(payload.yearCreated);
    if (!/^\d{4}$/.test(payload.yearCreated) || parsed < 2006 || parsed > current) {
      problems.push(["yearCreated", `Enter a year from 2006 to ${current}, or leave this blank.`]);
    }
  }
  if (payload.firstSale === "date" && !payload.firstSaleDate) {
    problems.push(["firstSaleDate", "Enter the date, or choose another answer."]);
  }
  if (payload.lastSale === "date" && !payload.lastSaleDate) {
    problems.push(["lastSaleDate", "Enter the date, or choose another answer."]);
  }
  if (!payload.consent) {
    problems.push(["consent", "Confirm this statement before submitting."]);
  }
  return problems;
}

function payloadFromForm() {
  const marketing = [...form.querySelectorAll('input[name="marketing"]:checked')].map(
    (input) => input.value,
  );
  return {
    fullName: line("fullName"),
    email: line("email"),
    city: line("city"),
    country: line("country"),
    storeUrl: normalizeUrl(line("storeUrl")),
    niche: line("niche"),
    product: line("product"),
    yearCreated: line("yearCreated"),
    plan: document.getElementById("plan").value,
    firstSale: radio("firstSale"),
    firstSaleDate: document.getElementById("firstSaleDate").value,
    lastSale: radio("lastSale"),
    lastSaleDate: document.getElementById("lastSaleDate").value,
    marketing,
    expert: line("expert"),
    nature: document.getElementById("nature").value,
    category: document.getElementById("category").value,
    summary: line("summary"),
    detail: document.getElementById("detail").value.trim(),
    consent: document.getElementById("consent").checked,
    hp: document.getElementById("hp").value,
  };
}

function receiptMessage(result) {
  if (result.emailedSubmitter && result.emailedAdvisor) {
    return "A confirmation has been sent to your email address. Quote this reference in any further correspondence.";
  }
  if (result.emailedAdvisor && !result.emailedSubmitter) {
    return "Meridian Advisory has received your request. A confirmation email could not be sent, so please copy the reference and keep it.";
  }
  if (result.emailedSubmitter && !result.emailedAdvisor) {
    return "A confirmation has been sent to your email address. Please keep the reference below as well.";
  }
  return "Your request has been recorded. Email delivery is not available at the moment, so please keep this reference.";
}

function showReceipt(result, { focus = true } = {}) {
  referenceInput.value = result.reference;
  receiptNote.textContent = result.note || receiptMessage(result);
  document.title = `${result.reference} | Meridian Advisory`;
  preamble.hidden = true;
  form.hidden = true;
  receipt.hidden = false;
  sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      reference: result.reference,
      note: receiptNote.textContent,
    }),
  );
  if (focus) receiptTitle.focus();
}

function applyProblems(problems) {
  formAlert.hidden = false;
  formAlert.textContent = "The form needs a correction before it can be accepted.";
  for (const [name, message] of problems) showError(name, message);
  const first = problems[0] && document.getElementById(problems[0][0]);
  if (first) {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    first.scrollIntoView({ behavior: motion ? "auto" : "smooth", block: "center" });
    first.focus();
  }
}

form.addEventListener("change", (event) => {
  if (event.target.name === "firstSale" || event.target.name === "lastSale") {
    syncSaleFields();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();
  const payload = payloadFromForm();
  const problems = localProblems(payload);
  if (problems.length) {
    applyProblems(problems);
    return;
  }

  submitButton.disabled = true;
  submitButton.classList.add("is-busy");
  submitButton.textContent = "Submitting…";

  try {
    const response = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let result = {};
    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (response.status === 422 && Array.isArray(result.errors)) {
      applyProblems(result.errors.map((item) => [item.field, item.message]));
      return;
    }

    if (response.status === 429) {
      formAlert.hidden = false;
      formAlert.textContent =
        result.message ||
        "Several requests have been received from this connection. Please wait, then try again.";
      return;
    }

    if (!response.ok || !result.reference) {
      formAlert.hidden = false;
      formAlert.textContent =
        "The request could not be submitted. Please try again in a moment. What you have written will remain on this page.";
      return;
    }

    showReceipt(result);
  } catch {
    formAlert.hidden = false;
    formAlert.textContent =
      "The request could not be submitted. Please try again in a moment. What you have written will remain on this page.";
  } finally {
    submitButton.classList.remove("is-busy");
    submitButton.textContent = "Submit request";
    syncSubmit();
  }
});

copyButton.addEventListener("click", async () => {
  const value = referenceInput.value;
  try {
    await navigator.clipboard.writeText(value);
    copyButton.textContent = "Copied";
  } catch {
    referenceInput.focus();
    referenceInput.select();
    copyButton.textContent = "Select the reference above";
  }
  window.setTimeout(() => {
    copyButton.textContent = "Copy reference";
  }, 2000);
});

anotherButton.addEventListener("click", () => {
  form.reset();
  syncSaleFields();
  syncPlaces();
  syncProducts();
  clearErrors();
  sessionStorage.removeItem(storageKey);
  receipt.hidden = true;
  preamble.hidden = false;
  form.hidden = false;
  document.title = originalTitle;
  syncSubmit();
  document.getElementById("fullName").focus();
});

const saved = sessionStorage.getItem(storageKey);
if (saved) {
  try {
    showReceipt(JSON.parse(saved), { focus: false });
  } catch {
    sessionStorage.removeItem(storageKey);
  }
}

syncSaleFields();

const placeList = [];
const choiceList = [];
const countrySelect = document.getElementById("country");
const citySelect = document.getElementById("city");
const nicheSelect = document.getElementById("niche");
const productSelect = document.getElementById("product");
const consentInput = document.getElementById("consent");

function syncSubmit() {
  submitButton.disabled = submitButton.classList.contains("is-busy") || !consentInput.checked;
}

function fillSelect(select, values, placeholder) {
  const chosen = select.value;
  select.replaceChildren();
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = placeholder;
  select.append(blank);
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = values.includes(chosen) ? chosen : "";
}

function syncPlaces() {
  const found = placeList.find((item) => item.country === countrySelect.value);
  if (!countrySelect.value || !found) {
    fillSelect(citySelect, [], "Select a country first");
    citySelect.disabled = true;
    return;
  }
  citySelect.disabled = false;
  fillSelect(citySelect, found.places, "Not stated");
}

function syncProducts() {
  const found = choiceList.find((item) => item.niche === nicheSelect.value);
  if (!nicheSelect.value || !found) {
    fillSelect(productSelect, [], "Select a niche first");
    productSelect.disabled = true;
    return;
  }
  productSelect.disabled = false;
  fillSelect(productSelect, found.products, "Not stated");
}

consentInput.addEventListener("change", syncSubmit);
countrySelect.addEventListener("change", syncPlaces);
nicheSelect.addEventListener("change", syncProducts);

Promise.all([
  fetch("/places.json").then((response) => response.json()),
  fetch("/choices.json").then((response) => response.json()),
])
  .then(([places, choices]) => {
    placeList.push(...places);
    choiceList.push(...choices);
    fillSelect(
      countrySelect,
      places.map((item) => item.country),
      "Not stated",
    );
    fillSelect(
      nicheSelect,
      choices.map((item) => item.niche),
      "Not stated",
    );
    syncPlaces();
    syncProducts();
  })
  .catch(() => {
    formAlert.hidden = false;
    formAlert.textContent = "The lists on this form could not be loaded. Please refresh the page.";
  });

const yearInput = document.getElementById("yearCreated");
if (yearInput) yearInput.max = String(new Date().getFullYear());

syncSubmit();

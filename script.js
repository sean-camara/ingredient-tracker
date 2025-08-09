/* main script for ingredients PWA
   - image upload (base64)
   - merge duplicates (name+category), sum numeric quantities
   - card layout with checkbox on left, image middle-left, content center, trash right
   - modal that doesn't overlap bottom nav
*/

// DOM elements
const ingredientsList = document.getElementById('ingredientsList');
const searchInput = document.getElementById('search');
const filterBought = document.getElementById('filterBought');
const filterCategory = document.getElementById('filterCategory');
const resetFiltersBtn = document.getElementById('resetFilters');

const modalBg = document.getElementById('modal-bg');
const ingredientForm = document.getElementById('ingredientForm');
const imageFile = document.getElementById('imageFile');
const imagePreview = document.getElementById('imagePreview');
const cancelBtn = document.getElementById('cancelBtn');

const settingsModalBg = document.getElementById('settings-modal-bg');
const clearAllBtn = document.getElementById('clearAllBtn');
const resetFiltersSettingsBtn = document.getElementById('resetFiltersSettingsBtn');
const settingsCancelBtn = document.getElementById('settingsCancelBtn');

const navAdd = document.getElementById('navAdd');
const navFilter = document.getElementById('navFilter');
const navSettings = document.getElementById('navSettings');
const navHome = document.getElementById('navHome');

// data
const STORAGE_KEY = 'ingredientsDataV1';
let ingredients = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let editingIndex = null;

// helpers: quantity parse/build
function parseQuantity(q){
  if(!q) return {num: NaN, unit: ''};
  const m = q.trim().match(/^(\d+(\.\d+)?)(.*)$/);
  if(m) return {num: parseFloat(m[1]), unit: m[3].trim()};
  return {num: NaN, unit: q.trim()};
}
function buildQuantity(num, unit){
  if(isNaN(num)) return unit || '';
  return unit ? `${num} ${unit}` : `${num}`;
}

// save & load
function saveIngredients(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(ingredients)); }

// merge logic (name lower + category exact)
function addOrMergeIngredient(newIng){
  const key = newIng.name.trim().toLowerCase();
  const cat = newIng.category;
  const idx = ingredients.findIndex(it => it.name.trim().toLowerCase() === key && it.category === cat);
  if(idx === -1){
    ingredients.push(newIng);
  } else {
    const ex = ingredients[idx];
    const p1 = parseQuantity(ex.quantity || '');
    const p2 = parseQuantity(newIng.quantity || '');
    let mergedQty;
    if(!isNaN(p1.num) && !isNaN(p2.num)){
      const sum = p1.num + p2.num;
      const unit = p1.unit || p2.unit;
      mergedQty = buildQuantity(sum, unit);
    } else {
      mergedQty = ex.quantity + ' + ' + newIng.quantity;
    }
    // earliest expiration
    const exp = (!ex.expiration) ? newIng.expiration : (!newIng.expiration ? ex.expiration : (new Date(ex.expiration) <= new Date(newIng.expiration) ? ex.expiration : newIng.expiration));
    // notes combine
    const notes = [ex.notes, newIng.notes].filter(Boolean).join(' ∘ ');
    // prefer existing image
    const imageDataUrl = ex.imageDataUrl || newIng.imageDataUrl || '';
    const bought = ex.bought || newIng.bought || false;
    ingredients[idx] = {...ex, quantity: mergedQty, expiration: exp, notes, imageDataUrl, bought};
  }
  saveIngredients();
}

// escape helper
function escapeHtml(s){ if(!s) return ''; return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// render function using the 4-col grid per card
function renderIngredients(){
  ingredientsList.innerHTML = '';
  const q = (searchInput.value || '').trim().toLowerCase();
  const boughtFilterVal = filterBought ? filterBought.value : 'all';
  const catFilterVal = filterCategory ? filterCategory.value : 'all';

  const visible = ingredients.filter(ing => {
    if(q && !ing.name.toLowerCase().includes(q)) return false;
    if(boughtFilterVal === 'bought' && !ing.bought) return false;
    if(boughtFilterVal === 'notBought' && ing.bought) return false;
    if(catFilterVal !== 'all' && ing.category !== catFilterVal) return false;
    return true;
  });

  visible.forEach((ing, i) => {
    const li = document.createElement('li');
    li.className = 'ingredient-item';

    // Add class if bought for styling
    if(ing.bought) li.classList.add('bought');

    // checkbox cell
    const checkboxCell = document.createElement('div');
    checkboxCell.className = 'checkbox-cell';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'bought-checkbox';
    checkbox.checked = !!ing.bought;
    checkbox.addEventListener('change', () => {
      // find actual index in main array
      const realIndex = ingredients.findIndex(it => it === ing);
      if(realIndex >= 0){
        ingredients[realIndex].bought = checkbox.checked;
        saveIngredients(); renderIngredients();
      }
    });
    checkboxCell.appendChild(checkbox);

    // image cell
    const imageCell = document.createElement('div');
    imageCell.className = 'image-cell';
    if(ing.imageDataUrl){
      const img = document.createElement('img');
      img.className = 'ingredient-img';
      img.src = ing.imageDataUrl;
      img.alt = ing.name;
      imageCell.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'thumb-placeholder';
      ph.textContent = (ing.name || '').slice(0,2).toUpperCase();
      imageCell.appendChild(ph);
    }

    // content
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = `${ing.name} (${ing.category || '—'})`;

    const quantity = document.createElement('div');
    quantity.className = 'quantity';
    quantity.textContent = `Quantity: ${ing.quantity || '—'}`;

    const notes = document.createElement('div');
    notes.className = 'notes';
    notes.textContent = ing.notes || '';

    // bought label
    const boughtLabel = document.createElement('div');
    boughtLabel.className = 'bought-label';
    if(ing.bought){
      boughtLabel.textContent = 'Bought ✅';
    }

    // actions
    const actions = document.createElement('div');
    actions.className = 'actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.innerHTML = '🗑️';
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', () => {
      if(confirm(`Delete "${ing.name}"?`)){
        // remove first matching instance (should be the same object)
        const realIndex = ingredients.findIndex(it => it === ing);
        if(realIndex >= 0) ingredients.splice(realIndex, 1);
        saveIngredients(); renderIngredients();
      }
    });
    actions.appendChild(delBtn);

    // assemble
    li.appendChild(checkboxCell);
    li.appendChild(imageCell);
    li.appendChild(title);
    li.appendChild(quantity);
    li.appendChild(notes);
    li.appendChild(boughtLabel);
    li.appendChild(actions);

    ingredientsList.appendChild(li);
  });

  if(visible.length === 0){
    ingredientsList.innerHTML = `<div class="empty-note">No ingredients found.</div>`;
  }
}

// modal controls
function openAdd(){
  editingIndex = null;
  ingredientForm.reset();
  imagePreview.style.display = 'none';
  imagePreview.src = '';
  modalBg.classList.add('active');
  document.getElementById('modalTitle').textContent = 'Add Ingredient 🍳';
}
function closeAdd(){ modalBg.classList.remove('active'); }

// image upload handling
imageFile.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if(!f){ imagePreview.style.display = 'none'; imagePreview.src = ''; return; }
  const reader = new FileReader();
  reader.onload = ev => {
    imagePreview.src = ev.target.result;
    imagePreview.style.display = 'block';
  };
  reader.readAsDataURL(f);
});

// submit form
ingredientForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = ingredientForm.name.value.trim();
  const category = ingredientForm.category.value;
  const expiration = ingredientForm.expiration.value || '';
  const quantity = ingredientForm.quantity.value.trim();
  const notes = ingredientForm.notes.value.trim();
  const imageDataUrl = imagePreview.src && imagePreview.style.display !== 'none' ? imagePreview.src : '';

  if(!name || !category || !quantity){
    alert('Please fill required fields.');
    return;
  }

  const newIng = { name, category, expiration, quantity, notes, imageDataUrl, bought: false };
  if(editingIndex !== null){
    // update (edit not fully implemented UI-wise here)
    ingredients[editingIndex] = {...ingredients[editingIndex], ...newIng};
    editingIndex = null;
    saveIngredients(); renderIngredients(); closeAdd();
    return;
  }

  addOrMergeIngredient(newIng);
  renderIngredients();
  closeAdd();
});

// UI wiring
navAdd.addEventListener('click', openAdd);
cancelBtn.addEventListener('click', closeAdd);
modalBg.addEventListener('click', e => { if(e.target === modalBg) closeAdd(); });

// filters/search events
searchInput.addEventListener('input', renderIngredients);
if(filterBought) filterBought.addEventListener('change', renderIngredients);
if(filterCategory) filterCategory.addEventListener('change', renderIngredients);
if(resetFiltersBtn) resetFiltersBtn.addEventListener('click', () => {
  if(filterBought) filterBought.value='all';
  if(filterCategory) filterCategory.value='all';
  searchInput.value='';
  renderIngredients();
});

// nav interactions
navFilter.addEventListener('click', () => {
  const fp = document.getElementById('filtersPanel');
  fp.classList.toggle('active');
  if(fp.classList.contains('active')){
    if(filterBought) filterBought.focus();
  } else searchInput.focus();
});
navSettings.addEventListener('click', () => { settingsModalBg.classList.add('active'); });
settingsCancelBtn.addEventListener('click', () => { settingsModalBg.classList.remove('active'); });
clearAllBtn.addEventListener('click', ()=> {
  if(confirm('Delete ALL ingredients?')){
    ingredients = [];
    saveIngredients();
    renderIngredients();
    settingsModalBg.classList.remove('active');
  }
});
resetFiltersSettingsBtn.addEventListener('click', ()=> {
  if(filterBought) filterBought.value='all';
  if(filterCategory) filterCategory.value='all';
  searchInput.value='';
  renderIngredients();
  alert('Filters reset');
  settingsModalBg.classList.remove('active');
});

// close settings by clicking backdrop
settingsModalBg.addEventListener('click', e => { if(e.target === settingsModalBg) settingsModalBg.classList.remove('active'); });

// service worker registration
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  });
}

// initial render — wait for DOM ready
document.addEventListener('DOMContentLoaded', () => {
  renderIngredients();
});

// Navbar hide/show on scroll
let lastScrollTop = 0;
const bottomNav = document.getElementById('bottomNav');

window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset || document.documentElement.scrollTop;

  if (currentScroll > lastScrollTop) {
    // User is scrolling down — hide navbar
    bottomNav.classList.add('hide');
  } else {
    // User is scrolling up — show navbar
    bottomNav.classList.remove('hide');
  }

  lastScrollTop = currentScroll <= 0 ? 0 : currentScroll; // Reset to 0 if negative scroll
});


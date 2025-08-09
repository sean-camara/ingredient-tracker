// Elements
const ingredientsList = document.getElementById("ingredientsList");
const searchInput = document.getElementById("search");
const modalBg = document.getElementById("modal-bg");
const ingredientForm = document.getElementById("ingredientForm");
const navAdd = document.getElementById("navAdd");
const navHome = document.getElementById("navHome");
const navFilter = document.getElementById("navFilter");

const imageFile = document.getElementById("imageFile");
const imagePreview = document.getElementById("imagePreview");
const cancelBtn = document.getElementById("cancelBtn");

// Data
let ingredients = JSON.parse(localStorage.getItem("ingredients")) || [];
let editingIndex = null; // not used for now, but kept for future edit feature

// Helpers for quantity parsing & building
function parseQuantity(q){
  if(!q) return {num:0, unit:''};
  const m = q.trim().match(/^(\d+(\.\d+)?)(.*)$/);
  if(m) return {num: parseFloat(m[1]), unit: m[3].trim()};
  return {num: NaN, unit: q.trim()};
}
function buildQuantity(num, unit){
  if(isNaN(num)) return unit || '';
  if(!unit) return String(num);
  return `${num} ${unit}`.trim();
}

// Save
function saveIngredients(){
  localStorage.setItem("ingredients", JSON.stringify(ingredients));
}

// Merge duplicates by name (case-insensitive) + same category; sum numeric quantities
function addOrMergeIngredient(newIng){
  const nameKey = newIng.name.trim().toLowerCase();
  const cat = newIng.category;
  const idx = ingredients.findIndex(it => it.name.trim().toLowerCase() === nameKey && it.category === cat);
  if(idx === -1){
    ingredients.push(newIng);
  } else {
    const exist = ingredients[idx];
    const p1 = parseQuantity(exist.quantity);
    const p2 = parseQuantity(newIng.quantity);

    let mergedQty;
    if(!isNaN(p1.num) && !isNaN(p2.num)) {
      const sum = p1.num + p2.num;
      const unit = p1.unit || p2.unit;
      mergedQty = buildQuantity(sum, unit);
    } else {
      // fallback: join
      mergedQty = exist.quantity + ' + ' + newIng.quantity;
    }

    // keep earliest expiration if present
    const expA = exist.expiration || '';
    const expB = newIng.expiration || '';
    const earliest = (!expA) ? expB : (!expB ? expA : (new Date(expA) <= new Date(expB) ? expA : expB));

    // merge notes
    const notes = [exist.notes, newIng.notes].filter(Boolean).join(' ∘ ');

    // image: prefer existing, else new
    const imageDataUrl = exist.imageDataUrl || newIng.imageDataUrl || '';

    ingredients[idx] = {
      ...exist,
      quantity: mergedQty,
      expiration: earliest,
      notes,
      imageDataUrl,
      bought: exist.bought || newIng.bought || false
    };
  }
  saveIngredients();
}

// Render
function renderIngredients(filterText = ""){
  ingredientsList.innerHTML = "";

  const q = (filterText || searchInput.value || "").toLowerCase();

  ingredients.forEach((ing, i) => {
    if(q && !ing.name.toLowerCase().includes(q)) return;

    const li = document.createElement("li");
    li.className = "ingredient-item";

    // left side: checkbox + image (if)
    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.flexDirection = "column";
    left.style.alignItems = "center";
    left.style.gap = "8px";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bought-checkbox";
    checkbox.checked = !!ing.bought;
    checkbox.addEventListener("change", () => {
      ing.bought = checkbox.checked;
      saveIngredients();
      renderIngredients(q);
    });
    left.appendChild(checkbox);

    if(ing.imageDataUrl){
      const img = document.createElement("img");
      img.src = ing.imageDataUrl;
      img.alt = ing.name;
      img.style.width = "56px";
      img.style.height = "56px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "10px";
      left.appendChild(img);
    }

    // content
    const details = document.createElement("div");
    details.className = "details";
    details.style.marginLeft = "12px";
    details.innerHTML = `
      <p><strong>${escapeHtml(ing.name)}</strong> (${escapeHtml(ing.category)})</p>
      <p>Quantity: ${escapeHtml(ing.quantity)}</p>
      ${ing.expiration ? `<p style="margin:4px 0; font-size:0.9rem; color:#7a6aa6">Expires: ${escapeHtml(ing.expiration)}</p>` : ''}
      ${ing.notes ? `<p class="item-notes" style="margin-top:6px; color:#8f78b6">${escapeHtml(ing.notes)}</p>` : ''}
    `;

    // actions
    const actions = document.createElement("div");
    actions.className = "actions";

    // delete (trash emoji only)
    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.innerHTML = "🗑️";
    delBtn.title = "Delete";
    delBtn.addEventListener("click", () => {
      if(confirm(`Delete "${ing.name}"?`)){
        ingredients.splice(i,1);
        saveIngredients();
        renderIngredients(q);
      }
    });

    actions.appendChild(delBtn);

    // assemble li: left + details + actions
    // create a container for left+details so layout is correct
    const center = document.createElement("div");
    center.style.display = "flex";
    center.style.flex = "1";
    center.style.alignItems = "center";

    center.appendChild(left);
    center.appendChild(details);

    li.appendChild(center);
    li.appendChild(actions);

    ingredientsList.appendChild(li);
  });

  if([...ingredients].filter(ing => (q ? ing.name.toLowerCase().includes(q) : true)).length === 0){
    ingredientsList.innerHTML = `<p style="text-align:center; margin-top:1rem; color:#8f78b6">No ingredients found.</p>`;
  }
}

// simple helper to avoid HTML injection
function escapeHtml(str){
  if(!str) return '';
  return str.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

// Open / close modal
navAdd.addEventListener("click", openModal);
function openModal(){
  editingIndex = null;
  ingredientForm.reset();
  imagePreview.style.display = 'none';
  imagePreview.src = '';
  modalBg.classList.remove("hidden");
}
cancelBtn.addEventListener("click", ()=> modalBg.classList.add("hidden"));
modalBg.addEventListener("click", (e) => { if(e.target === modalBg) modalBg.classList.add("hidden"); });

// Image file -> preview (base64)
imageFile.addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if(!f){ imagePreview.style.display='none'; imagePreview.src=''; return; }
  const reader = new FileReader();
  reader.onload = function(ev){
    imagePreview.src = ev.target.result;
    imagePreview.style.display = 'block';
  };
  reader.readAsDataURL(f);
});

// Submit form
ingredientForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = ingredientForm.name.value.trim();
  const category = ingredientForm.category.value;
  const quantity = ingredientForm.quantity.value.trim();
  const expiration = ingredientForm.expiration ? ingredientForm.expiration.value : '';
  const notes = ingredientForm.notes ? ingredientForm.notes.value.trim() : '';
  const imageDataUrl = imagePreview.src && imagePreview.style.display !== 'none' ? imagePreview.src : '';

  if(!name || !category || !quantity){
    alert('Please fill required fields.');
    return;
  }

  const newIng = {
    name, category, quantity, expiration, notes, imageDataUrl, bought: false
  };

  addOrMergeIngredient(newIng);
  renderIngredients();
  modalBg.classList.add("hidden");
});

// search event
searchInput.addEventListener("input", ()=> renderIngredients());

// initial render
renderIngredients();

// register service worker (if you used service-worker.js)
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  });
}

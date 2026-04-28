// 1. Initialize Supabase - Renamed variable to avoid conflict
const supabaseUrl = 'https://xepigypsxurtrwmcojlq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlcGlneXBzeHVydHJ3bWNvamxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTc4MDIsImV4cCI6MjA5MjU5MzgwMn0.zwcWKbiOMo55OSTirqKxelxWlK71YipXe6LU25G8QJA';

// Note: the library uses 'supabase' globally from the CDN
let _supabase;
try {
    _supabase = supabase.createClient(supabaseUrl, supabaseKey);
    console.log("Tapat Engine: Initialized");
} catch (err) {
    console.error("Supabase failed to initialize:", err);
}

/* ============================================================
     ===== MODAL & UI LOGIC =====
     ============================================================ */

function toggleModal(show) {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        // We use 'flex' instead of 'block' to keep your modal centered
        modal.style.display = show ? 'flex' : 'none'; 
        if (show) switchAuthView('login');
    } else {
        console.error("Could not find auth-modal element");
    }
}

function switchAuthView(view, isAdmin = false) {
    const views = ['login-view', 'signup-view', 'forgot-view'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.style.display = 'none';
    });

    const target = document.getElementById(`${view}-view`);
    if (target) {
        target.style.display = 'block';

        const loginTitle = document.querySelector('#login-view h2');
        const loginSub = document.querySelector('#login-view p');

        if (isAdmin && view === 'login') {
            if (loginTitle) loginTitle.innerText = "Admin Access";
            if (loginSub) loginSub.innerText = "Hi Admin, please enter credentials";
            // Important: Mark the form so handleLogin knows to check for admin role
            document.getElementById('login-form').dataset.mode = 'admin';
        } else if (view === 'login') {
            if (loginTitle) loginTitle.innerText = "Welcome Back";
            if (loginSub) loginSub.innerText = "Log in to check your stamps";
            document.getElementById('login-form').dataset.mode = 'client';
        }
    }
}

/* ============================================================
     ===== INITIALIZATION =====
     ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Connect Navigation Buttons
    const joinBtn = document.getElementById('client-join-btn');
    if (joinBtn) {
        joinBtn.addEventListener('click', () => toggleModal(true));
    }

    // 2. Connect Form Submissions
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            console.log("Login form submitted!");
            handleLogin(e);
        });
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignUp);
    }

    // 3. Close Modal on Background Click
    window.onclick = (event) => {
        const modal = document.getElementById('auth-modal');
        if (event.target == modal) toggleModal(false);
    };

    // 4. Admin pages only — safely no-op on index.html if these functions don't exist
    if (typeof loadRallyDrafts === 'function') loadRallyDrafts();
    if (typeof loadRallySummary === 'function') loadRallySummary();
});



/* ============================================================
     ===== AUTH LOGIC (SIGN UP / LOG IN) =====
     ============================================================ */

async function handleLogin(e) {
    e.preventDefault();
    const email = e.target[0].value;
    const password = e.target[1].value;

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Login failed: " + error.message);
    } else {
        checkUserStatus(data.user);
    }
}

async function checkUserStatus(user) {
    // 1. Query the profiles table for the specific user role
    const { data: profile, error } = await _supabase
        .from('profiles')
        .select('full_name, role, tier_name')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error("Error fetching profile:", error.message);
        return;
    }

    // 2. Branching Logic based on the 'role' column from your Supabase screenshot
    if (profile) {
        if (profile.role === 'admin') {
            // Redirect to Admin Dashboard
            console.log("Redirecting to Admin...");
            window.location.href = 'admin.html';
        } 
        else if (profile.role === 'client') {
            // Redirect to Client Dashboard
            console.log("Redirecting to Client...");
            window.location.href = 'client.html';
        } 
        else {
            // Fallback for undefined roles
            alert("Role not recognized. Please contact support.");
        }
    }
}

//===================== HANDLE SIGN UP ================//

async function handleSignUp(e) {
    e.preventDefault();
    const fullName = e.target[0].value.trim();
    const email    = e.target[1].value.trim();
    const password = e.target[2].value;

    // 1. Create the auth user
    const { data, error } = await _supabase.auth.signUp({ email, password });

    if (error) {
        alert("Sign up failed: " + error.message);
        return;
    }

    // 2. Generate a simple member code e.g. "BGW-481023"
    const memberCode = 'BGW-' + Math.floor(100000 + Math.random() * 900000);

    // 3. Insert full profile row
    const { error: profileError } = await _supabase
        .from('profiles')
        .insert({
            id:               data.user.id,
            full_name:        fullName,
            email:            email,
            role:             'client',
            tier:             0,           // Dayo tier (starting tier)
            tier_name:        'Dayo',
            main_points:      0,
            visit_count:      0,
            redemption_hold:  0,
            member_code:      memberCode
            // created_at is auto-filled by Supabase
        });

    if (profileError) {
        console.error("Profile insert error:", profileError.message);
        alert("Account created but profile setup failed: " + profileError.message);
        return;
    }

    alert("Welcome to the club! Please check your email to confirm your account.");
    toggleModal(false);
}

//================= PRODUCT ENROLLMENT LOGIC =============//

async function handleProductSubmit(event) {
    event.preventDefault(); 
    
    // 1. Collect values from your Admin HTML IDs
    const name = document.getElementById('p-name').value;
    const imageUrl = document.getElementById('p-image').value; // THE MISSING LINK
    const price = parseFloat(document.getElementById('p-price').value);
    const points = parseInt(document.getElementById('p-points').value);
    const category = document.getElementById('p-cat1').value;
    const highlight = document.getElementById('p-cat2').value;

    // 2. Insert into Supabase
    const { data, error } = await _supabase
        .from('products')
        .insert([
            { 
                name: name, 
                image_url: imageUrl, // MATCHES YOUR SQL COLUMN
                price: price, 
                points_equivalent: points, 
                category: category, 
                highlight_tag: highlight 
            }
        ]);

    if (error) {
        console.error("Enrollment Error:", error.message);
        alert("Failed to enroll product: " + error.message);
    } else {
        alert("Product successfully enrolled!");
        
        // 3. Reset the form for the next entry
        document.getElementById('product-form').reset();
        
        // 4. Refresh the inventory list
        if (typeof loadProducts === "function") {
            loadProducts();
        }
    }
}

/* ============================================================
     ===== PRODUCT DISPLAY LOGIC =====
     ============================================================ */

async function loadProducts() {
    console.log("Tapat: Fetching menu items...");
    
    const { data: products, error } = await _supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error("Error loading products:", error.message);
        return;
    }

    const drinksContainer = document.getElementById('drinks-container');
    const foodContainer = document.getElementById('food-container');

    if (!drinksContainer || !foodContainer) return;

    // Clear current content
    drinksContainer.innerHTML = '';
    foodContainer.innerHTML = '';

    products.forEach(product => {
        const productHtml = `
            <div class="menu-item">
                <img src="${product.image_url || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93'}" alt="${product.name}">
                <div class="menu-info">
                    <h4>${product.name}</h4>
                    <p>${product.highlight_tag ? `<span>${product.highlight_tag}</span>` : ''} ₱${product.price}</p>
                </div>
            </div>
        `;

        if (product.category === 'Drinks') {
            drinksContainer.insertAdjacentHTML('beforeend', productHtml);
        } else {
            foodContainer.insertAdjacentHTML('beforeend', productHtml);
        }
    });
}



/* ═══════════════════════════════════════════════════════════════
   RALLY DRAFT FLOW
   Tables used:
     rallies      — id, title, description, start_date, end_date,
                    grand_prize_name, grand_prize_description,
                    is_active, is_finalized, created_at
     rally_tasks  — id, rally_id, task_name, task_description,
                    point_value, sort_order, badge_icon, created_at
═══════════════════════════════════════════════════════════════ */

// ── Step 1: Create a rally draft (no tasks yet) ──────────────
async function handleRallySubmit(e) {
    e.preventDefault();

    const title     = document.getElementById('r-name').value.trim();
    const startDate = document.getElementById('r-start').value;
    const endDate   = document.getElementById('r-end').value;
    const prizeName = document.getElementById('r-prize-name')?.value.trim() || '';
    const prizeDesc = document.getElementById('r-prize-desc')?.value.trim() || '';

    if (!title || !startDate || !endDate) return;

    const { data, error } = await _supabase
        .from('rallies')
        .insert({
            title,
            start_date:              startDate,
            end_date:                endDate,
            grand_prize_name:        prizeName || null,
            grand_prize_description: prizeDesc || null,
            is_active:               false,
            is_finalized:            false
        })
        .select()
        .single();

    if (error) {
        console.error('Rally insert error:', error);
        alert('Could not create rally draft. See console for details.');
        return;
    }

    // Reset form
    document.getElementById('rally-form').reset();

    // Reload draft list
    await loadRallyDrafts();
}

// ── Step 2: Load and render all non-finalized rally drafts ───
async function loadRallyDrafts() {
    const { data: rallies, error } = await _supabase
        .from('rallies')
        .select('*')
        .eq('is_finalized', false)
        .order('created_at', { ascending: false });

    if (error) { console.error('loadRallyDrafts error:', error); return; }

    const container = document.getElementById('rally-draft-list');
    const emptyMsg  = document.getElementById('rally-draft-empty');
    if (!container) return;

    // Remove existing cards (keep empty-msg sentinel)
    container.querySelectorAll('.rally-draft-card').forEach(el => el.remove());

    if (!rallies || rallies.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }
    if (emptyMsg) emptyMsg.style.display = 'none';

    rallies.forEach(rally => {
        const card = buildRallyDraftCard(rally);
        container.appendChild(card);
    });
}

// ── Build a single draft card DOM element ───────────────────
function buildRallyDraftCard(rally) {
    const fmt = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    const card = document.createElement('div');
    card.className = 'rally-draft-card';
    card.dataset.rallyId = rally.id;

    const statusClass = rally.is_active ? 'status-published' : 'status-draft';
    const statusLabel = rally.is_active ? 'Published'        : 'Draft';

    // Build 10 task input rows
    let taskRowsHtml = '';
    for (let i = 0; i < 10; i++) {
        taskRowsHtml += `
        <div class="task-row">
            <span class="task-num">${i + 1}.</span>
            <input type="text"   class="task-input task-desc-input auth-input" data-index="${i}" placeholder="Task description">
            <input type="number" class="task-input task-pts-input  auth-input" data-index="${i}" placeholder="Pts" min="0">
        </div>`;
    }

    card.innerHTML = `
        <div class="rally-draft-header" onclick="toggleRallyCard('${rally.id}')">
            <div class="rally-draft-info">
                <div class="rally-draft-title">${escapeHtml(rally.title)}</div>
                <div class="rally-draft-dates">${fmt(rally.start_date)} – ${fmt(rally.end_date)}</div>
            </div>
            <span class="rally-draft-status ${statusClass}">${statusLabel}</span>
            <span class="rally-draft-chevron">▼</span>
        </div>
        <div class="rally-draft-body">
            ${rally.grand_prize_name ? `<p style="font-size:12px;color:#999;margin:10px 0 0;">🏆 ${escapeHtml(rally.grand_prize_name)}</p>` : ''}
            <p style="font-size:12px;color:#aaa;margin:8px 0 0;">Add tasks below, then publish to make this rally live.</p>
            <div class="task-management-grid">${taskRowsHtml}</div>
            <div class="rally-publish-row">
                <button class="btn btn-primary" onclick="publishRally('${rally.id}')">Publish Rally</button>
                <button class="btn btn-danger"  onclick="deleteRallyDraft('${rally.id}')">Delete</button>
            </div>
        </div>
    `;

    return card;
}

// ── Toggle open/close a draft card ──────────────────────────
function toggleRallyCard(rallyId) {
    const card = document.querySelector(`.rally-draft-card[data-rally-id="${rallyId}"]`);
    if (!card) return;
    card.classList.toggle('open');
}

// ── Step 3: Publish — insert tasks, set is_active = true ────
async function publishRally(rallyId) {
    const card = document.querySelector(`.rally-draft-card[data-rally-id="${rallyId}"]`);
    if (!card) return;

    const tasks = collectTaskInputsFromCard(card);
    if (tasks.length === 0) {
        alert('Please add at least one task before publishing.');
        return;
    }

    // Insert tasks
    const taskRows = tasks.map((t, i) => ({
        rally_id:         rallyId,
        task_name:        t.description,   // task_name = short label
        task_description: t.description,   // task_description = same; extend if you add a separate field
        point_value:      t.points,
        sort_order:       i + 1
    }));

    const { error: taskError } = await _supabase
        .from('rally_tasks')
        .insert(taskRows);

    if (taskError) {
        console.error('Task insert error:', taskError);
        alert('Could not save tasks. See console.');
        return;
    }

    // Set rally active
    const { error: rallyError } = await _supabase
        .from('rallies')
        .update({ is_active: true })
        .eq('id', rallyId);

    if (rallyError) {
        console.error('Rally publish error:', rallyError);
        alert('Tasks saved but rally could not be set active. See console.');
        return;
    }

    alert('Rally published successfully!');
    await loadRallyDrafts();
    await loadRallySummary(); // refresh the Rally History table if it exists
}

// ── Collect task inputs from a specific card ─────────────────
function collectTaskInputsFromCard(card) {
    const descInputs = card.querySelectorAll('.task-desc-input');
    const ptsInputs  = card.querySelectorAll('.task-pts-input');
    const tasks = [];

    descInputs.forEach((descEl, i) => {
        const desc = descEl.value.trim();
        const pts  = parseInt(ptsInputs[i]?.value) || 0;
        if (desc) tasks.push({ description: desc, points: pts });
    });

    return tasks;
}

// ── Delete a draft rally (only if not yet published) ─────────
async function deleteRallyDraft(rallyId) {
    if (!confirm('Delete this rally draft? This cannot be undone.')) return;

    const { error } = await _supabase
        .from('rallies')
        .delete()
        .eq('id', rallyId)
        .eq('is_active', false); // safety: never delete a live rally this way

    if (error) {
        console.error('Delete rally error:', error);
        alert('Could not delete. See console.');
        return;
    }

    await loadRallyDrafts();
}

// ── Load rally summary table (Rally History & Summary block) ─
async function loadRallySummary() {
    const tbody = document.getElementById('rally-summary-list');
    if (!tbody) return;

    const { data: rallies, error } = await _supabase
        .from('rallies')
        .select('id, title, is_active, is_finalized, created_at')
        .order('created_at', { ascending: false });

    if (error) { console.error('loadRallySummary error:', error); return; }

    if (!rallies || rallies.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#999;">No rallies yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = rallies.map(r => {
        const statusLabel = r.is_finalized ? 'Finalized' : r.is_active ? 'Active' : 'Draft';
        const statusStyle = r.is_finalized
            ? 'background:#eef0f5;color:#4a5568'
            : r.is_active
                ? 'background:#e0f5ea;color:#1a7a42'
                : 'background:#f0f0f0;color:#777';
        return `
        <tr>
            <td><span class="tier-badge" style="${statusStyle};padding:3px 9px;">${statusLabel}</span></td>
            <td>${escapeHtml(r.title)}</td>
            <td>—</td>
            <td>—</td>
            <td style="text-align:right;">
                <button class="btn btn-pill-outline" style="font-size:12px;padding:4px 12px;"
                    onclick="viewRallySummaryDetail('${r.id}')">View</button>
            </td>
        </tr>`;
    }).join('');
}

// ── Placeholder: hook up to a detail modal later ─────────────
function viewRallySummaryDetail(rallyId) {
    alert(`Detail view for rally ${rallyId} — wire this up to your modal or route.`);
}

// ── Safety helper ────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

//================= ADDITIONAL DOM FOR PRODUCT VIEW ==============//

document.addEventListener('DOMContentLoaded', () => {
    loadRallyDrafts();
    loadRallySummary();
    loadProducts(); // <--- Add this here
});

}
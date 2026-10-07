// ================================
// SUPABASE AUTHENTICATION
// ================================

// Supabase configuration
const SUPABASE_URL = "https://zbfrfjeotxjwablxxiif.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tEl8zScIAQQk9eH1J_t-_g_hVy4sdxI";

// Create a single reusable Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Auth state
let isAuthenticated = false;
let authInitialized = false;
let appInitialized = false;

// Login screen elements
const loginScreen = document.getElementById("loginScreen");
const mainApp = document.getElementById("mainApp");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginSubmit = document.getElementById("loginSubmit");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

// Show error message on login screen
function showLoginError(message) {
    loginError.textContent = message;
    loginError.hidden = false;
    loginEmail.setAttribute("aria-invalid", "true");
    loginPassword.setAttribute("aria-invalid", "true");
}

// Clear error message
function clearLoginError() {
    loginError.textContent = "";
    loginError.hidden = true;
    loginEmail.removeAttribute("aria-invalid");
    loginPassword.removeAttribute("aria-invalid");
}

// Set loading state on login button
function setLoginLoading(loading) {
    loginSubmit.disabled = loading;
    loginSubmit.classList.toggle("loading", loading);
    loginEmail.disabled = loading;
    loginPassword.disabled = loading;
}

// Handle Supabase auth errors with user-friendly messages
function getAuthErrorMessage(error) {
    if (!error) return "An unexpected error occurred. Please try again.";

    const message = error.message || error.toString();

    // Map common Supabase auth errors to friendly messages
    // Check "Email not confirmed" FIRST before the generic invalid credentials
    if (message.includes("Email not confirmed")) {
        return "Please check your email and confirm your address before signing in.";
    }
    if (message.includes("Invalid login credentials")) {
        return "Invalid email or password. Please check your credentials and try again.";
    }
    if (message.includes("Too many requests")) {
        return "Too many login attempts. Please wait a moment and try again.";
    }
    if (message.includes("network") || message.includes("fetch") || message.includes("Failed to fetch")) {
        return "Unable to connect. Please check your internet connection and try again.";
    }
    if (message.includes("User not found") || message.includes("Invalid email")) {
        return "No account found with that email address.";
    }

    // Generic fallback
    return "Sign in failed. Please try again.";
}

// Show the main app and hide login screen
function showMainApp() {
    loginScreen.hidden = true;
    mainApp.hidden = false;
    isAuthenticated = true;
    document.body.style.overflow = "";
}

// Show login screen and hide main app
function showLoginScreen() {
    mainApp.hidden = true;
    loginScreen.hidden = false;
    isAuthenticated = false;
    clearLoginError();
    loginForm.reset();
    // Focus email input for better UX
    setTimeout(() => loginEmail.focus(), 100);
}

// Initialize auth - check existing session on page load
async function initializeAuth() {
    // Prevent multiple initializations
    if (authInitialized) return;
    authInitialized = true;

    try {
        console.log("Initializing auth, checking existing session...");
        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (error) {
            console.error("Auth session error:", error);
            showLoginScreen();
            return;
        }

        if (session) {
            // Valid session exists - show main app
            console.log("Existing session found for:", session.user?.email);
            showMainApp();
            if (!appInitialized) {
                appInitialized = true;
                initializeApp();
            }
        } else {
            // No session - show login screen
            console.log("No existing session, showing login screen");
            showLoginScreen();
        }
    } catch (err) {
        console.error("Auth initialization error:", err);
        showLoginScreen();
    }
}

// Initialize the main app (notes, UI, event listeners)
async function initializeApp() {
    console.log("Initializing app...");
    displayNotes();
    setupSidebarButtonHandlers();

    // Open first active note on desktop only
    if (!isMobile) {
        const firstActiveNote =
            notes.find(
                note => !note.trashed
            );


        if (firstActiveNote) {

            openNote(
                firstActiveNote.id
            );

        }
    }
    // Any other app initialization goes here

    // Phase 2A: Check if migration from localStorage to Supabase is needed
    await checkMigrationNeeded();

    // Phase 1: Supabase read test - verify we can read user's notes
    await testSupabaseRead();
}

async function testSupabaseRead() {
    try {
        console.log("Phase 1: Testing Supabase read...");
        const { data, error } = await supabaseClient
            .from("notes")
            .select("id, title, category, pinned, trashed, tags, created_at, updated_at");

        if (error) {
            console.error("Phase 1: Supabase read failed:", error);
            return;
        }

        console.log(`Phase 1: Supabase read SUCCESS - ${data?.length ?? 0} note(s) returned`);
    } catch (err) {
        console.error("Phase 1: Supabase read error:", err);
    }
}

// ================================
// PHASE 2A: LOCALSTORAGE → SUPABASE MIGRATION
// ================================

async function checkMigrationNeeded() {
    try {
        // Only run for authenticated users
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            console.log("Migration check skipped: no authenticated user");
            return;
        }

        // Check if user has any notes in Supabase
        const { count, error: countError } = await supabaseClient
            .from("notes")
            .select("*", { count: "exact", head: true });

        if (countError) {
            console.error("Migration check: failed to count Supabase notes:", countError);
            return;
        }

        // Filter active (non-trashed) notes for migration
        const activeNotes = notes.filter(note => !note.trashed);
        const activeNotesCount = activeNotes.length;

        // Only offer migration if Supabase is empty AND active local notes exist
        if (count === 0 && activeNotesCount > 0) {
            console.log(`Migration check: ${activeNotesCount} active local note(s), 0 Supabase notes — showing prompt`);
            showMigrationModal(activeNotesCount);
        } else {
            console.log(`Migration check: ${activeNotesCount} active local note(s) (${notes.length} total), ${count} Supabase note(s) — no migration needed`);
        }
    } catch (err) {
        console.error("Migration check error:", err);
    }
}

function showMigrationModal(localCount) {
    const modal = document.getElementById("migrationModal");
    const countEl = document.getElementById("localNoteCount");
    const confirmBtn = document.getElementById("migrationConfirm");
    const notNowBtn = document.getElementById("migrationNotNow");
    const statusEl = document.getElementById("migrationStatus");

    if (!modal || !countEl || !confirmBtn || !notNowBtn || !statusEl) {
        console.error("Migration modal elements not found");
        return;
    }

    countEl.textContent = localCount;
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.className = "modal-status";
    confirmBtn.disabled = false;
    notNowBtn.disabled = false;

    // Remove any existing listeners
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    notNowBtn.replaceWith(notNowBtn.cloneNode(true));

    const newConfirmBtn = document.getElementById("migrationConfirm");
    const newNotNowBtn = document.getElementById("migrationNotNow");

    newConfirmBtn.addEventListener("click", handleMigrationConfirm);
    newNotNowBtn.addEventListener("click", handleMigrationNotNow);

    modal.hidden = false;
    // Focus confirm button for accessibility
    setTimeout(() => newConfirmBtn.focus(), 100);
}

async function handleMigrationConfirm() {
    const confirmBtn = document.getElementById("migrationConfirm");
    const notNowBtn = document.getElementById("migrationNotNow");
    const statusEl = document.getElementById("migrationStatus");

    confirmBtn.disabled = true;
    notNowBtn.disabled = true;
    statusEl.hidden = false;
    statusEl.textContent = "Migrating notes...";
    statusEl.className = "modal-status";

    try {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            throw new Error("Unable to get authenticated user");
        }

        // Filter active (non-trashed) notes for migration
        const activeNotes = notes.filter(note => !note.trashed);

        // Map active local notes to Supabase schema
        const notesToInsert = activeNotes.map(note => ({
            user_id: user.id,
            title: note.title,
            content: note.content,
            category: note.category,
            pinned: note.pinned,
            trashed: note.trashed,
            tags: note.tags || [],
            background: note.background,
            created_at: note.createdAt || new Date().toISOString(),
            updated_at: note.updatedAt || new Date().toISOString()
        }));

        console.log(`Migrating ${notesToInsert.length} active notes to Supabase...`);

        const { data, error } = await supabaseClient
            .from("notes")
            .insert(notesToInsert)
            .select("id");

        if (error) {
            throw error;
        }

        const insertedCount = data?.length ?? 0;
        const expectedCount = notesToInsert.length;

        if (insertedCount !== expectedCount) {
            throw new Error(`Migration verification failed: expected ${expectedCount} rows, inserted ${insertedCount}`);
        }

        // Mark migration as done locally (prevents re-prompt on same device)
        localStorage.setItem("brainVaultMigrationDone", "true");

        statusEl.textContent = `✅ Successfully migrated ${insertedCount} active note(s) to Supabase!`;
        statusEl.className = "modal-status success";

        console.log(`Migration complete: ${insertedCount} notes inserted`);

        // Close modal after a delay
        setTimeout(() => {
            const modal = document.getElementById("migrationModal");
            if (modal) modal.hidden = true;
        }, 2500);

    } catch (err) {
        console.error("Migration failed:", err);
        statusEl.textContent = `❌ Migration failed: ${err.message}`;
        statusEl.className = "modal-status error";
        confirmBtn.disabled = false;
        notNowBtn.disabled = false;
    }
}

function handleMigrationNotNow() {
    const modal = document.getElementById("migrationModal");
    if (modal) {
        modal.hidden = true;
    }
    console.log("Migration deferred by user");
}

// Listen for auth state changes
supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log("Auth state changed:", event, session ? "session exists" : "no session");

    try {
        if (event === "SIGNED_IN" && session) {
            showMainApp();
            if (!appInitialized) {
                appInitialized = true;
                initializeApp();
            }
        } else if (event === "SIGNED_OUT") {
            showLoginScreen();
            appInitialized = false;
        } else if (event === "TOKEN_REFRESHED" && session) {
            // Session refreshed, user stays logged in
            console.log("Session refreshed");
        } else if (event === "INITIAL_SESSION") {
            // Handle initial session if needed (we also check manually in initializeAuth)
            console.log("Initial session event:", session ? "session exists" : "no session");
        }
    } catch (err) {
        console.error("Error in auth state change handler:", err);
        // Don't let auth state errors break the UI
        if (event === "SIGNED_IN") {
            showLoginError("Authentication succeeded but app initialization failed. Please refresh the page.");
        }
    }
    // Note: We don't rely solely on INITIAL_SESSION since we manually check with getSession()
});

// Handle login form submission
loginForm.addEventListener("submit", async (e) => {
    // Prevent form submission/reload immediately - must be first
    e.preventDefault();
    e.stopPropagation();

    try {
        clearLoginError();

        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        if (!email || !password) {
            showLoginError("Please enter both email and password.");
            return;
        }

        setLoginLoading(true);

        console.log("Attempting login for:", email);
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error("Supabase signInWithPassword error:", error);
            throw error;
        }

        // Success - onAuthStateChange will handle showing the main app
        console.log("Login successful:", data.user?.email);
    } catch (err) {
        console.error("Login error:", err);
        showLoginError(getAuthErrorMessage(err));
    } finally {
        setLoginLoading(false);
    }
}, { passive: false });

// Handle logout
logoutBtn.addEventListener("click", async () => {
    try {
        console.log("Signing out...");
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            console.error("Logout error:", error);
            // Force show login screen even if signOut fails
            showLoginScreen();
        }
        // onAuthStateChange will handle showing login screen
    } catch (err) {
        console.error("Logout error:", err);
        showLoginScreen();
    }
});


// ================================
// BACKGROUND IMAGES
// ================================

const BACKGROUND_IMAGES = [
    "images/inspo 1.jpg",
    "images/inspo 3.png",
    "images/inspo 4.png",
    "images/inspo 5.png",
    "images/inspo 6.jpeg",
    "images/inspo 7.jpg",
    "images/inspo 8.png",
    "images/inspo 9.jpg",
    "images/inspo 10.jpeg",
    "images/Inspo 11.jpg",
    "images/inspo 12.jpg",
    "images/inspo 14.jpg",
    "images/inspo 15.jpg",
    "images/inspo 16.png",
    "images/inspo 17.png"
];

function getRandomBackground() {
    const index = Math.floor(Math.random() * BACKGROUND_IMAGES.length);
    return BACKGROUND_IMAGES[index];
}

function ensureBackground(note) {
    if (!note.background) {
        note.background = getRandomBackground();
    }
    return note.background;
}


// ================================
// NOTES DATA
// ================================

let notes = JSON.parse(localStorage.getItem("brainVaultNotes")) || [
    {
        id: 1,
        title: "Welcome to Brain Vault",
        content: "This is where your notes will live.",
        category: "Important",
        pinned: true,
        trashed: false,
        tags: []
    },

    {
        id: 2,
        title: "Example Note",
        content: "Medical notes, appointments and important information...",
        category: "Hayley",
        pinned: false,
        trashed: false,
        tags: []
    }
];

notes.forEach(ensureBackground);

notes.forEach(note => {
    if (note.supabase_id === undefined) {
        note.supabase_id = null;
    }
});


// ================================
// PHASE 2B-1: LOCAL ↔ SUPABASE ASSOCIATION
// ================================

function normalizeTimestamp(value) {
    return value ? new Date(value).toISOString() : null;
}

function computeLegacyNoteIdentity(note) {
    const canonical = {
        title: note.title,
        content: note.content,
        category: note.category,
        pinned: note.pinned,
        trashed: note.trashed,
        tags: [...(note.tags || [])].sort(),
        background: note.background,
        updated_at: normalizeTimestamp(note.updatedAt)
    };
    return JSON.stringify(canonical);
}

function computeSupabaseNoteIdentity(sn) {
    const canonical = {
        title: sn.title,
        content: sn.content,
        category: sn.category,
        pinned: sn.pinned,
        trashed: sn.trashed,
        tags: [...(sn.tags || [])].sort(),
        background: sn.background,
        updated_at: normalizeTimestamp(sn.updated_at)
    };
    return JSON.stringify(canonical);
}

async function computeSHA256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function associateLocalSupabaseNotes() {
    console.log("Phase 2B-1: Starting local ↔ Supabase association (legacy matching)...");

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        console.error("Association failed: no authenticated user");
        return { success: false, error: "Not authenticated" };
    }

    const { data: supabaseNotes, error: fetchError } = await supabaseClient
        .from("notes")
        .select("id, title, content, category, pinned, trashed, tags, background, created_at, updated_at")
        .eq("user_id", user.id);

    if (fetchError) {
        console.error("Association failed: could not fetch Supabase notes", fetchError);
        return { success: false, error: fetchError.message };
    }

    if (!supabaseNotes || supabaseNotes.length !== 12) {
        console.error(`Association failed: expected 12 Supabase notes, got ${supabaseNotes?.length ?? 0}`);
        return { success: false, error: `Expected 12 Supabase notes, got ${supabaseNotes?.length ?? 0}` };
    }

    const activeLocalNotes = notes.filter(note => !note.trashed);
    if (activeLocalNotes.length !== 12) {
        console.error(`Association failed: expected 12 active local notes, got ${activeLocalNotes.length}`);
        return { success: false, error: `Expected 12 active local notes, got ${activeLocalNotes.length}` };
    }

    const trashedLocalNotes = notes.filter(note => note.trashed);
    console.log(`Found ${trashedLocalNotes.length} trashed local notes (will remain untouched)`);

    const supabaseIdentities = new Map();
    for (const sn of supabaseNotes) {
        const identity = computeSupabaseNoteIdentity(sn);
        if (supabaseIdentities.has(identity)) {
            console.error("Duplicate Supabase identity detected, failing safely:", identity);
            return { success: false, error: "Ambiguous match: duplicate Supabase note identities" };
        }
        supabaseIdentities.set(identity, sn);
    }

    const matches = [];
    const unmatched = [];

    for (const localNote of activeLocalNotes) {
        const localIdentity = computeLegacyNoteIdentity(localNote);
        const supabaseNote = supabaseIdentities.get(localIdentity);

        if (!supabaseNote) {
            unmatched.push(localNote);
            continue;
        }

        const fieldsMatch =
            localNote.title === supabaseNote.title &&
            localNote.content === supabaseNote.content &&
            localNote.category === supabaseNote.category &&
            localNote.pinned === supabaseNote.pinned &&
            localNote.trashed === supabaseNote.trashed &&
            JSON.stringify([...(localNote.tags || [])].sort()) === JSON.stringify([...(supabaseNote.tags || [])].sort()) &&
            localNote.background === supabaseNote.background &&
            normalizeTimestamp(localNote.updatedAt) === normalizeTimestamp(supabaseNote.updated_at);

        if (!fieldsMatch) {
            console.error("Identity matched but field verification failed for note:", localNote.id);
            unmatched.push(localNote);
            continue;
        }

        matches.push({ localNote, supabaseNote });
    }

    if (unmatched.length > 0) {
        console.error(`Association failed: ${unmatched.length} active local note(s) could not be matched`);
        unmatched.forEach(n => console.error("  Unmatched local note:", n.id, n.title));
        return { success: false, error: `${unmatched.length} note(s) unmatched`, unmatched };
    }

    if (matches.length !== 12) {
        console.error(`Association failed: expected 12 matches, got ${matches.length}`);
        return { success: false, error: `Expected 12 matches, got ${matches.length}` };
    }

    for (const { localNote, supabaseNote } of matches) {
        localNote.supabase_id = supabaseNote.id;
    }

    saveNotes();

    console.log("Phase 2B-1: Association complete. Verification:");
    console.log(`  - Active notes with supabase_id: ${notes.filter(n => !n.trashed && n.supabase_id).length}/12`);
    console.log(`  - Active notes without supabase_id: ${notes.filter(n => !n.trashed && !n.supabase_id).length}`);
    console.log(`  - Trashed notes (untouched): ${notes.filter(n => n.trashed).length}`);
    console.log(`  - Total local notes: ${notes.length}`);

    const { count: supabaseCount } = await supabaseClient
        .from("notes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
    console.log(`  - Supabase rows: ${supabaseCount}`);

    return { success: true, matches: matches.length };
}

window.associateLocalSupabaseNotes = associateLocalSupabaseNotes;


// ================================
// PHASE 2B-1 DIAGNOSTIC: Hash Mismatch Debug
// ================================

async function diagnoseHashMismatch() {
    console.log("=== PHASE 2B-1 DIAGNOSTIC: Hash Mismatch Debug ===");

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        console.error("Diagnostic failed: not authenticated");
        return;
    }

    const { data: supabaseNotes, error: fetchError } = await supabaseClient
        .from("notes")
        .select("id, title, content, category, pinned, trashed, tags, background, created_at, updated_at")
        .eq("user_id", user.id);

    if (fetchError) {
        console.error("Diagnostic failed: could not fetch Supabase notes", fetchError);
        return;
    }

    const activeLocalNotes = notes.filter(note => !note.trashed);

    console.log(`\n--- LOCAL NOTES (${activeLocalNotes.length} active) ---`);
    activeLocalNotes.forEach((note, i) => {
        console.log(`\n[Local #${i + 1}] id: ${note.id}, title: "${note.title}"`);
        console.log("  Fields:");
        console.log("    title:", JSON.stringify(note.title));
        console.log("    content:", JSON.stringify(note.content));
        console.log("    category:", JSON.stringify(note.category));
        console.log("    pinned:", note.pinned);
        console.log("    trashed:", note.trashed);
        console.log("    tags:", JSON.stringify(note.tags));
        console.log("    background:", JSON.stringify(note.background));
        console.log("    createdAt:", JSON.stringify(note.createdAt));
        console.log("    updatedAt:", JSON.stringify(note.updatedAt));
    });

    console.log(`\n--- SUPABASE NOTES (${supabaseNotes.length}) ---`);
    supabaseNotes.forEach((sn, i) => {
        console.log(`\n[Supabase #${i + 1}] id: ${sn.id}, title: "${sn.title}"`);
        console.log("  Fields:");
        console.log("    title:", JSON.stringify(sn.title));
        console.log("    content:", JSON.stringify(sn.content));
        console.log("    category:", JSON.stringify(sn.category));
        console.log("    pinned:", sn.pinned);
        console.log("    trashed:", sn.trashed);
        console.log("    tags:", JSON.stringify(sn.tags));
        console.log("    background:", JSON.stringify(sn.background));
        console.log("    created_at:", JSON.stringify(sn.created_at));
        console.log("    updated_at:", JSON.stringify(sn.updated_at));
    });

    if (activeLocalNotes.length > 0 && supabaseNotes.length > 0) {
        const localNote = activeLocalNotes[0];
        const supabaseNote = supabaseNotes[0];

        console.log("\n=== DETAILED COMPARISON: First Active Local vs First Supabase ===");

        const fields = [
            { local: "title", remote: "title", lVal: localNote.title, rVal: supabaseNote.title },
            { local: "content", remote: "content", lVal: localNote.content, rVal: supabaseNote.content },
            { local: "category", remote: "category", lVal: localNote.category, rVal: supabaseNote.category },
            { local: "pinned", remote: "pinned", lVal: localNote.pinned, rVal: supabaseNote.pinned },
            { local: "trashed", remote: "trashed", lVal: localNote.trashed, rVal: supabaseNote.trashed },
            { local: "tags", remote: "tags", lVal: JSON.stringify([...(localNote.tags || [])].sort()), rVal: JSON.stringify([...(supabaseNote.tags || [])].sort()) },
            { local: "background", remote: "background", lVal: localNote.background, rVal: supabaseNote.background },
            { local: "createdAt", remote: "created_at", lVal: localNote.createdAt, rVal: supabaseNote.created_at },
            { local: "updatedAt", remote: "updated_at", lVal: localNote.updatedAt, rVal: supabaseNote.updated_at },
        ];

        console.log("\nField-by-field match:");
        fields.forEach(f => {
            const match = f.lVal === f.rVal;
            console.log(`  ${f.local} / ${f.remote}: ${match ? "✅ MATCH" : "❌ MISMATCH"}`);
            if (!match) {
                console.log(`    local:  ${JSON.stringify(f.lVal)}`);
                console.log(`    remote: ${JSON.stringify(f.rVal)}`);
            }
        });

        const localCanonical = {
            title: localNote.title,
            content: localNote.content,
            category: localNote.category,
            pinned: localNote.pinned,
            trashed: localNote.trashed,
            tags: [...(localNote.tags || [])].sort(),
            background: localNote.background,
            created_at: localNote.createdAt,
            updated_at: localNote.updatedAt
        };

        const remoteCanonical = {
            title: supabaseNote.title,
            content: supabaseNote.content,
            category: supabaseNote.category,
            pinned: supabaseNote.pinned,
            trashed: supabaseNote.trashed,
            tags: [...(supabaseNote.tags || [])].sort(),
            background: supabaseNote.background,
            created_at: supabaseNote.created_at,
            updated_at: supabaseNote.updated_at
        };

        console.log("\n--- Canonical JSON (local) ---");
        console.log(JSON.stringify(localCanonical, null, 2));

        console.log("\n--- Canonical JSON (supabase) ---");
        console.log(JSON.stringify(remoteCanonical, null, 2));

        const localHash = await computeSHA256(JSON.stringify(localCanonical));
        const remoteHash = await computeSHA256(JSON.stringify(remoteCanonical));

        console.log("\n--- Hashes ---");
        console.log("  Local hash:  ", localHash);
        console.log("  Remote hash: ", remoteHash);
        console.log("  Match:       ", localHash === remoteHash ? "✅ YES" : "❌ NO");
    }

    console.log("\n=== DIAGNOSTIC COMPLETE ===");
}

window.diagnoseHashMismatch = diagnoseHashMismatch;


// ================================
// PHASE 2B-1 DIAGNOSTIC: Backrooms Note Mismatch
// ================================

async function diagnoseBackroomsMismatch() {
    console.log("=== PHASE 2B-1 DIAGNOSTIC: Backrooms Note Mismatch ===");

    const LOCAL_NOTE_ID = 1791326621767;
    const SUPABASE_NOTE_ID = "bb23113a-51b5-421c-b62d-a237dff714f9";

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        console.error("Diagnostic failed: not authenticated");
        return { success: false, error: "Not authenticated" };
    }

    const { data: supabaseNote, error: fetchError } = await supabaseClient
        .from("notes")
        .select("id, title, content, category, pinned, trashed, tags, background, created_at, updated_at")
        .eq("id", SUPABASE_NOTE_ID)
        .eq("user_id", user.id)
        .single();

    if (fetchError || !supabaseNote) {
        console.error("Diagnostic failed: could not fetch Supabase note", fetchError);
        return { success: false, error: fetchError?.message || "Supabase note not found" };
    }

    const localNote = notes.find(note => note.id === LOCAL_NOTE_ID);
    if (!localNote) {
        console.error("Diagnostic failed: local note not found");
        return { success: false, error: "Local note not found" };
    }

    console.log("\n--- LOCAL NOTE ---");
    console.log("id:", localNote.id);
    console.log("title:", JSON.stringify(localNote.title));
    console.log("content length:", localNote.content?.length ?? 0);
    console.log("category:", JSON.stringify(localNote.category));
    console.log("pinned:", localNote.pinned);
    console.log("trashed:", localNote.trashed);
    console.log("tags:", JSON.stringify(localNote.tags));
    console.log("background:", JSON.stringify(localNote.background));
    console.log("updatedAt:", JSON.stringify(localNote.updatedAt));

    console.log("\n--- SUPABASE NOTE ---");
    console.log("id:", supabaseNote.id);
    console.log("title:", JSON.stringify(supabaseNote.title));
    console.log("content length:", supabaseNote.content?.length ?? 0);
    console.log("category:", JSON.stringify(supabaseNote.category));
    console.log("pinned:", supabaseNote.pinned);
    console.log("trashed:", supabaseNote.trashed);
    console.log("tags:", JSON.stringify(supabaseNote.tags));
    console.log("background:", JSON.stringify(supabaseNote.background));
    console.log("updated_at:", JSON.stringify(supabaseNote.updated_at));

    const localUpdated = normalizeTimestamp(localNote.updatedAt);
    const remoteUpdated = normalizeTimestamp(supabaseNote.updated_at);

    const fields = [
        { name: "title", local: localNote.title, remote: supabaseNote.title },
        { name: "content", local: localNote.content, remote: supabaseNote.content },
        { name: "category", local: localNote.category, remote: supabaseNote.category },
        { name: "pinned", local: localNote.pinned, remote: supabaseNote.pinned },
        { name: "trashed", local: localNote.trashed, remote: supabaseNote.trashed },
        { name: "tags", local: [...(localNote.tags || [])].sort(), remote: [...(supabaseNote.tags || [])].sort() },
        { name: "background", local: localNote.background, remote: supabaseNote.background },
        { name: "updatedAt/updated_at", local: localUpdated, remote: remoteUpdated },
    ];

    const results = [];
    console.log("\n=== FIELD-BY-FIELD COMPARISON ===");
    fields.forEach(f => {
        const match = JSON.stringify(f.local) === JSON.stringify(f.remote);
        const status = match ? "✅ MATCH" : "❌ MISMATCH";
        console.log(`  ${f.name}: ${status}`);
        console.log(`    local:  ${JSON.stringify(f.local)}`);
        console.log(`    remote: ${JSON.stringify(f.remote)}`);
        results.push({ field: f.name, local: f.local, remote: f.remote, match });
    });

    const result = {
        success: true,
        localNoteId: LOCAL_NOTE_ID,
        supabaseNoteId: SUPABASE_NOTE_ID,
        localContentLength: localNote.content?.length ?? 0,
        supabaseContentLength: supabaseNote.content?.length ?? 0,
        fields: results,
        allMatch: results.every(r => r.match)
    };

    console.log("\n=== SUMMARY ===");
    console.log("Local content length:", result.localContentLength);
    console.log("Supabase content length:", result.supabaseContentLength);
    console.log("All fields match:", result.allMatch ? "✅ YES" : "❌ NO");

    console.log("\n=== DIAGNOSTIC COMPLETE ===");
    return result;
}

window.diagnoseBackroomsMismatch = diagnoseBackroomsMismatch;


// ================================
// PHASE 2B-1 LEGACY RESOLUTION: Backrooms Note
// ================================

async function resolveBackroomsLegacyMismatch() {
    const LOCAL_NOTE_ID = 1791326621767;
    const SUPABASE_NOTE_ID = "bb23113a-51b5-421c-b62d-a237dff714f9";

    console.log("=== PHASE 2B-1 LEGACY RESOLUTION: Backrooms Note ===");

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
        console.error("Resolution failed: not authenticated");
        return { success: false, error: "Not authenticated" };
    }

    const localNote = notes.find(note => note.id === LOCAL_NOTE_ID);
    if (!localNote) {
        console.error("Resolution failed: local note not found");
        return { success: false, error: "Local note not found" };
    }

    const { data: supabaseNote, error: fetchError } = await supabaseClient
        .from("notes")
        .select("id, title, content, category, pinned, trashed, tags, background, created_at, updated_at")
        .eq("id", SUPABASE_NOTE_ID)
        .eq("user_id", user.id)
        .single();

    if (fetchError || !supabaseNote) {
        console.error("Resolution failed: could not fetch Supabase note", fetchError);
        return { success: false, error: fetchError?.message || "Supabase note not found" };
    }

    if (supabaseNote.trashed) {
        console.error("Resolution failed: Supabase note is trashed, skipping");
        return { success: false, error: "Supabase note is trashed" };
    }

    const updatePayload = {
        title: localNote.title,
        content: localNote.content,
        category: localNote.category,
        pinned: localNote.pinned,
        trashed: localNote.trashed,
        tags: localNote.tags || [],
        background: localNote.background,
        updated_at: localNote.updatedAt || new Date().toISOString()
    };

    console.log("Updating Supabase note with local authoritative data...");
    console.log("Fields to update:", Object.keys(updatePayload));

    const { data: updatedNote, error: updateError } = await supabaseClient
        .from("notes")
        .update(updatePayload)
        .eq("id", SUPABASE_NOTE_ID)
        .eq("user_id", user.id)
        .select("id, title, content, category, pinned, trashed, tags, background, updated_at")
        .single();

    if (updateError || !updatedNote) {
        console.error("Resolution failed: Supabase update failed", updateError);
        return { success: false, error: updateError?.message || "Supabase update failed" };
    }

    localNote.supabase_id = SUPABASE_NOTE_ID;
    saveNotes();

    console.log("=== RESOLUTION COMPLETE ===");
    console.log("Local note ID:", LOCAL_NOTE_ID);
    console.log("Supabase note ID:", SUPABASE_NOTE_ID);
    console.log("Updated fields:", Object.keys(updatePayload).join(", "));
    console.log("Supabase updated_at:", updatedNote.updated_at);

    return {
        success: true,
        localNoteId: LOCAL_NOTE_ID,
        supabaseNoteId: SUPABASE_NOTE_ID,
        updatedFields: Object.keys(updatePayload),
        supabaseUpdatedAt: updatedNote.updated_at
    };
}

window.resolveBackroomsLegacyMismatch = resolveBackroomsLegacyMismatch;


// ================================
// SAVE NOTES
// ================================

function saveNotes() {

    localStorage.setItem(
        "brainVaultNotes",
        JSON.stringify(notes)
    );

}


// Start auth initialization
initializeAuth();


// ================================
// DATE FORMATTING
// ================================

function formatDate(date) {
    const d = new Date(date);
    const day = d.getDate();
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
}


// ================================
// WORD COUNT
// ================================

function updateWordCount(text) {
    if (!text || text.trim() === "") {
        wordCountEl.textContent = "0 words";
        return;
    }
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const count = words.length;
    wordCountEl.textContent = count === 1 ? "1 word" : `${count} words`;
}


// ================================
// TAGS HANDLING
// ================================

function normalizeTag(tag) {
    return tag.replace(/^#/, "").toLowerCase().trim();
}

function renderTags(note) {
    tagsDisplay.innerHTML = "";
    if (!note.tags || note.tags.length === 0) return;

    note.tags.forEach(tag => {
        const tagChip = document.createElement("span");
        tagChip.className = "tag-chip";
        tagChip.innerHTML = `
            #${tag}
            <button class="tag-remove" data-tag="${tag}" title="Remove tag">×</button>
        `;
        tagsDisplay.appendChild(tagChip);
    });

    // Add click handlers for remove buttons
    tagsDisplay.querySelectorAll(".tag-remove").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            removeTag(note, btn.dataset.tag);
        });
    });
}

function addTag(note, tagText) {
    const normalized = normalizeTag(tagText);
    if (!normalized) return false;

    // Check for duplicates (case-insensitive)
    const existingLower = note.tags.map(t => t.toLowerCase());
    if (existingLower.includes(normalized)) return false;

    note.tags.push(normalized);
    note.updatedAt = new Date().toISOString();
    saveNotes();
    renderTags(note);
    displayNotes();
    return true;
}

function removeTag(note, tagToRemove) {
    note.tags = note.tags.filter(t => t.toLowerCase() !== tagToRemove.toLowerCase());
    note.updatedAt = new Date().toISOString();
    saveNotes();
    renderTags(note);
    displayNotes();
}

// Tag input handler
// Moved after ELEMENTS declarations to avoid ReferenceError
// tagInput.addEventListener("keydown", (e) => {
//     if (e.key === "Enter" && currentNoteId !== null) {
//         e.preventDefault();
//         const tagText = tagInput.value.trim();
//         if (tagText) {
//             const note = notes.find(n => n.id === currentNoteId);
//             if (note && addTag(note, tagText)) {
//                 tagInput.value = "";
//             }
//         }
//     }
// });


// ================================
// ELEMENTS
// ================================

const noteTitle =
    document.getElementById("noteTitle");

const noteContent =
    document.getElementById("noteContent");

const newNoteButton =
    document.querySelector(".new-note-btn");

const notesList =
    document.getElementById("notesList");

const searchInput =
    document.getElementById("searchInput");


// Category dropdown

const categorySelect =
    document.getElementById("categorySelect");

// Tags elements
const tagInput = document.getElementById("tagInput");
const tagsDisplay = document.getElementById("tagsDisplay");

// Tag input handler
tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && currentNoteId !== null) {
        e.preventDefault();
        const tagText = tagInput.value.trim();
        if (tagText) {
            const note = notes.find(n => n.id === currentNoteId);
            if (note && addTag(note, tagText)) {
                tagInput.value = "";
            }
        }
    }
});


// Page heading

const pageTitle =
    document.querySelector(".panel-header h1");

const pageDescription =
    document.querySelector(".panel-header p");


// Editor buttons

const pinButton =
    document.querySelector(
        '.editor-actions button[title="Pin note"]'
    );

const deleteButton =
    document.querySelector(
        '.editor-actions button[title="Delete note"]'
    );

// Mobile back button
const mobileBackButton =
    document.querySelector(".mobile-back-btn");

// Editor footer elements
const lastSavedEl = document.getElementById("lastSaved");
const wordCountEl = document.getElementById("wordCount");

// Background element
const editorPanel = document.querySelector(".editor-panel");


// Sidebar buttons

const sidebarButtons =
    document.querySelectorAll(".category-btn");


// Sort elements
const sortButton =
    document.querySelector(".sort-btn");

let sortDropdown = null;


// ================================
// APP STATE
// ================================

// "all"      = all normal notes
// "pinned"   = pinned notes
// "trash"    = trashed notes
// "category" = selected category

let currentView = "all";

let currentCategoryFilter = null;


// Currently open note

let currentNoteId = null;

// Search state
let currentSearchQuery = "";

// Sort state
let currentSort = "newest";

// Visible notes (for page heading)
let visibleNotes = [];

// Mobile state
let isMobile = window.innerWidth <= 768;

// ================================
// MOBILE SIDEBAR (HAMBURGER MENU)
// ================================

const hamburgerButton = document.querySelector(".hamburger-btn");
const sidebar = document.querySelector(".sidebar");
const sidebarOverlay = document.querySelector(".sidebar-overlay");

function openMobileSidebar() {
    if (isMobile) {
        sidebar.classList.add("open");
        sidebarOverlay.classList.add("visible");
        hamburgerButton.setAttribute("aria-expanded", "true");
        sidebarOverlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }
}

function closeMobileSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("visible");
    hamburgerButton.setAttribute("aria-expanded", "false");
    sidebarOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function toggleMobileSidebar() {
    if (sidebar.classList.contains("open")) {
        closeMobileSidebar();
    } else {
        openMobileSidebar();
    }
}

// Hamburger button click
if (hamburgerButton) {
    hamburgerButton.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMobileSidebar();
    });
}

// Close sidebar when clicking overlay
if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeMobileSidebar);
}

// Close sidebar on escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("open")) {
        closeMobileSidebar();
    }
});

// Close sidebar when selecting a sidebar item (on mobile)
function closeSidebarOnMobile() {
    if (isMobile && sidebar.classList.contains("open")) {
        closeMobileSidebar();
    }
}

function setupSidebarButtonHandlers() {
    const sidebarButtons = document.querySelectorAll(".category-btn");
    sidebarButtons.forEach(button => {
        // Remove existing mobile click handler to avoid duplicates
        button.removeEventListener("click", closeSidebarOnMobile);
        // Add handler to close sidebar on mobile after navigation
        button.addEventListener("click", closeSidebarOnMobile);
    });
}

// Window resize handler to update mobile state
window.addEventListener("resize", () => {
    const wasMobile = isMobile;
    checkMobile();
    // Close mobile editor if resized to desktop
    if (!isMobile) {
        closeMobileEditor();
        closeMobileSidebar();
    }
    // Re-setup sidebar button handlers when mobile state changes
    if (wasMobile !== isMobile) {
        setupSidebarButtonHandlers();
    }
});

// Initial setup
setupSidebarButtonHandlers();

// ================================
// MOBILE HELPERS
// ================================

function checkMobile() {
    isMobile = window.innerWidth <= 768;
}

function openMobileEditor() {
    if (isMobile) {
        document.querySelector(".app").classList.add("mobile-editor-open");
    }
}

function closeMobileEditor() {
    document.querySelector(".app").classList.remove("mobile-editor-open");
}

// ================================
// NEW NOTE
// ================================

newNoteButton.addEventListener(
    "click",
    createNewNote
);


function createNewNote() {

    const newNote = {

        id: Date.now(),

        title: "Untitled Note",

        content: "",

        category: "Important",

        pinned: false,

        trashed: false,

        tags: [],

        createdAt: new Date().toISOString(),

        updatedAt: new Date().toISOString(),

        background: getRandomBackground(),

        supabase_id: null

    };


    notes.push(newNote);


    saveNotes();


    currentView = "all";

    currentCategoryFilter = null;


    displayNotes();


    openNote(newNote.id);

}


// ================================
// DISPLAY NOTES
// ================================

function displayNotes() {

    notesList.innerHTML = "";


    visibleNotes = [];


    // --------------------------------
    // SEARCH MODE - Search across all notes
    // --------------------------------

    if (currentSearchQuery !== "") {

        // Determine base notes to search (respect trash view)
        let baseNotes = [];
        if (currentView === "trash") {
            baseNotes = notes.filter(note => note.trashed);
        } else {
            baseNotes = notes.filter(note => !note.trashed);
        }

        visibleNotes = baseNotes.filter(note => {
            const query = currentSearchQuery;
            const titleMatch = note.title.toLowerCase().includes(query);
            const contentMatch = note.content.toLowerCase().includes(query);
            const categoryMatch = note.category.toLowerCase().includes(query);
            const tagsMatch = note.tags && note.tags.some(tag => tag.toLowerCase().includes(query));
            return titleMatch || contentMatch || categoryMatch || tagsMatch;
        });

    }

    // --------------------------------
    // NORMAL MODE - View-based filtering
    // --------------------------------

    else {

        // --------------------------------
        // TRASH
        // --------------------------------

        if (currentView === "trash") {

            visibleNotes = notes.filter(
                note => note.trashed
            );

        }


        // --------------------------------
        // PINNED
        // --------------------------------

        else if (currentView === "pinned") {

            visibleNotes = notes.filter(
                note =>
                    note.pinned &&
                    !note.trashed
            );

        }


        // --------------------------------
        // CATEGORY
        // --------------------------------

        else if (currentView === "category") {

            visibleNotes = notes.filter(
                note =>
                    note.category === currentCategoryFilter &&
                    !note.trashed
            );

        }


        // --------------------------------
        // ALL NOTES
        // --------------------------------

        else {

            visibleNotes = notes.filter(
                note => !note.trashed
            );

        }

    }


    // --------------------------------
    // APPLY SORTING
    // --------------------------------

    visibleNotes = applySort(visibleNotes);


    // --------------------------------
    // CREATE NOTE CARDS
    // --------------------------------

    if (visibleNotes.length === 0) {
        const emptyMessage = document.createElement("div");
        emptyMessage.classList.add("note-card", "empty-state");
        emptyMessage.textContent = currentSearchQuery !== ""
            ? `No notes found for "${searchInput.value}"`
            : "No notes yet";
        notesList.appendChild(emptyMessage);
    } else {
        visibleNotes.forEach(note => {

            const noteCard =
                document.createElement("div");


            noteCard.classList.add(
                "note-card"
            );

            if (note.pinned) {
                noteCard.classList.add("pinned");
            }


            noteCard.dataset.id =
                note.id;


            noteCard.innerHTML = `

                <div class="note-card-top">

                    <span class="note-category">
                        📋 ${note.category}
                    </span>

                    ${note.pinned ? "📌" : ""}

                </div>


                <h2>
                    ${note.title}
                </h2>


                <p>
                    ${note.content || "No content yet..."}
                </p>

                ${note.tags && note.tags.length > 0 ? `
                <div class="note-card-tags">
                    ${note.tags.map(tag => `<span class="note-card-tag">#${tag}</span>`).join("")}
                </div>
                ` : ""}

                <small>
                    ${note.trashed ? "In Trash" : "Just now"}
                </small>

            `;


            noteCard.addEventListener(
                "click",
                () => {

                    openNote(note.id);

                }
            );


            notesList.appendChild(
                noteCard
            );

        });
    }


    updatePageHeading();

}


// ================================
// UPDATE PAGE HEADING
// ================================

function updatePageHeading() {

    // Search mode heading
    if (currentSearchQuery !== "") {

        pageTitle.textContent =
            `Search results for "${searchInput.value}"`;

        pageDescription.textContent =
            `Found ${visibleNotes.length} note(s) across all categories.`;

    }

    else if (currentView === "trash") {

        pageTitle.textContent =
            "Trash";

        pageDescription.textContent =
            "Notes you've moved to the trash.";

    }


    else if (currentView === "pinned") {

        pageTitle.textContent =
            "Pinned";

        pageDescription.textContent =
            "Your pinned notes.";

    }


    else if (currentView === "category") {

        pageTitle.textContent =
            currentCategoryFilter;

        pageDescription.textContent =
            "Notes in this category.";

    }


    else {

        pageTitle.textContent =
            "All Notes";

        pageDescription.textContent =
            "Everything in your Brain Vault.";

    }


    // Change trash button into restore button

    if (currentView === "trash") {

        deleteButton.textContent =
            "↩️";

        deleteButton.title =
            "Restore note";

    }

    else {

        deleteButton.textContent =
            "🗑️";

        deleteButton.title =
            "Delete note";

    }

}


// ================================
// OPEN NOTE
// ================================

function openNote(noteId) {

    const note =
        notes.find(
            note => note.id === noteId
        );


    if (!note) return;


    // Don't open trashed notes outside Trash

    if (
        note.trashed &&
        currentView !== "trash"
    ) {

        return;

    }


    currentNoteId =
        noteId;


    noteTitle.value =
        note.title;


    noteContent.value =
        note.content;


    // Ensure background exists for backward compatibility
    ensureBackground(note);

    // Apply background to editor panel
    if (editorPanel) {
        editorPanel.style.setProperty("--note-background", `url("${note.background}")`);
    }


    // Ensure tags array exists for backward compatibility
    if (!note.tags) {
        note.tags = [];
    }

    // Set category dropdown

    categorySelect.value =
        note.category;


    // Render tags
    renderTags(note);
    // Clear tag input
    tagInput.value = "";


    // Update pin button

    if (note.pinned) {

        pinButton.textContent =
            "📌";

    }

    else {

        pinButton.textContent =
            "📍";

    }

    // Update last saved timestamp
    if (note.updatedAt) {
        lastSavedEl.textContent = `Last saved: ${formatDate(note.updatedAt)}`;
    } else {
        lastSavedEl.textContent = "Last saved: Never";
    }

    // Update word count
    updateWordCount(note.content);

    // Open mobile editor view
    openMobileEditor();

    console.log(
        "Opened note:",
        note
    );

}


// ================================
// SAVE NOTE TEXT
// ================================

noteTitle.addEventListener(
    "input",
    saveCurrentNote
);


noteContent.addEventListener(
    "input",
    () => {
        saveCurrentNote();
        if (currentNoteId !== null) {
            updateWordCount(noteContent.value);
        }
    }
);


function saveCurrentNote() {

    if (
        currentNoteId === null
    ) {

        return;

    }


    const note =
        notes.find(
            note =>
                note.id === currentNoteId
        );


    if (!note) return;


    note.title =
        noteTitle.value;


    note.content =
        noteContent.value;

    note.updatedAt = new Date().toISOString();


    saveNotes();


    displayNotes();


    console.log(
        "Saved note:",
        note
    );

}


// ================================
// CHANGE CATEGORY
// ================================

categorySelect.addEventListener(
    "change",
    changeCategory
);


function changeCategory() {

    if (
        currentNoteId === null
    ) {

        return;

    }


    const note =
        notes.find(
            note =>
                note.id === currentNoteId
        );


    if (!note) return;


    note.category =
        categorySelect.value;

    note.updatedAt = new Date().toISOString();


    saveNotes();


    displayNotes();


    console.log(
        "Category changed:",
        note
    );

}


// ================================
// PIN / UNPIN
// ================================

pinButton.addEventListener(
    "click",
    togglePin
);


function togglePin() {

    if (
        currentNoteId === null
    ) {

        return;

    }


    const note =
        notes.find(
            note =>
                note.id === currentNoteId
        );


    if (!note) return;


    note.pinned =
        !note.pinned;


    saveNotes();


    if (note.pinned) {

        pinButton.textContent =
            "📌";

    }

    else {

        pinButton.textContent =
            "📍";

    }


    displayNotes();


    console.log(
        "Pin status changed:",
        note
    );

}


// ================================
// DELETE / RESTORE
// ================================

deleteButton.addEventListener(
    "click",
    handleDeleteButton
);


function handleDeleteButton() {

    if (
        currentNoteId === null
    ) {

        return;

    }


    const note =
        notes.find(
            note =>
                note.id === currentNoteId
        );


    if (!note) return;


    // --------------------------------
    // RESTORE
    // --------------------------------

    if (
        currentView === "trash"
    ) {

        note.trashed =
            false;


        saveNotes();


        currentNoteId =
            null;


        noteTitle.value =
            "";

        noteContent.value =
            "";

        // Reset editor footer
        lastSavedEl.textContent = "Last saved: Never";
        wordCountEl.textContent = "0 words";
        // Clear tags display
        tagsDisplay.innerHTML = "";
        tagInput.value = "";
        // Clear background
        if (editorPanel) {
            editorPanel.style.removeProperty("--note-background");
        }

displayNotes();

        // Close mobile editor after restore
        closeMobileEditor();

        console.log(
            "Restored note:",
            note
        );


        return;

    }


    // --------------------------------
    // MOVE TO TRASH
    // --------------------------------

    note.trashed =
        true;


    saveNotes();


    currentNoteId =
        null;


    noteTitle.value =
        "";

    noteContent.value =
        "";

// Reset editor footer
    lastSavedEl.textContent = "Last saved: Never";
    wordCountEl.textContent = "0 words";
    // Clear tags display
    tagsDisplay.innerHTML = "";
    tagInput.value = "";
    // Clear background
    if (editorPanel) {
        editorPanel.style.removeProperty("--note-background");
    }


displayNotes();

    // Close mobile editor after delete
    closeMobileEditor();


    console.log(
        "Moved note to trash:",
        note
    );

}


// ================================
// SIDEBAR NAVIGATION
// ================================

sidebarButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const text =
                    button.textContent.trim();


                // Hayley

                if (
                    text.includes("Hayley")
                ) {

                    currentView =
                        "category";

                    currentCategoryFilter =
                        "Hayley";

                }


                // Housing

                else if (
                    text.includes("Housing")
                ) {

                    currentView =
                        "category";

                    currentCategoryFilter =
                        "Housing";

                }


                // Money

                else if (
                    text.includes("Money")
                ) {

                    currentView =
                        "category";

                    currentCategoryFilter =
                        "Money";

                }


                // Important

                else if (
                    text.includes("Important")
                ) {

                    currentView =
                        "category";

                    currentCategoryFilter =
                        "Important";

                }


                // Personal

                else if (
                    text.includes("Personal")
                ) {

                    currentView =
                        "category";

                    currentCategoryFilter =
                        "Personal";

                }


                // Pinned

                else if (
                    text.includes("Pinned")
                ) {

                    currentView =
                        "pinned";

                    currentCategoryFilter =
                        null;

                }


                // All Notes

                else if (
                    text.includes("All Notes")
                ) {

                    currentView =
                        "all";

                    currentCategoryFilter =
                        null;

                }


                // Trash

                else if (
                    text.includes("Trash")
                ) {

                    currentView =
                        "trash";

                    currentCategoryFilter =
                        null;

                }


                // Settings

                else if (
                    text.includes("Settings")
                ) {

                    console.log(
                        "Settings clicked"
                    );

                    return;

                }


                displayNotes();

                // Close mobile editor when navigating via sidebar
                closeMobileEditor();

            }
        );

    }
);

searchInput.addEventListener(
    "input",
    () => {
        currentSearchQuery = searchInput.value.trim().toLowerCase();
        displayNotes();
        // Close mobile editor when searching
        closeMobileEditor();
    }
);

// Mobile back button handler
if (mobileBackButton) {
    mobileBackButton.addEventListener("click", () => {
        closeMobileEditor();
        currentNoteId = null;
        noteTitle.value = "";
        noteContent.value = "";
        lastSavedEl.textContent = "Last saved: Never";
        wordCountEl.textContent = "0 words";
        tagsDisplay.innerHTML = "";
        tagInput.value = "";
        // Reset pin button
        pinButton.textContent = "📍";
        // Clear background
        if (editorPanel) {
            editorPanel.style.removeProperty("--note-background");
        }
        // Refresh notes list
        displayNotes();
    });
}

// Window resize handler to update mobile state
window.addEventListener("resize", () => {
    checkMobile();
    // Close mobile editor if resized to desktop
    if (!isMobile) {
        closeMobileEditor();
    }
});


// ================================
// SORT FUNCTIONALITY
// ================================

const sortOptions = [
    { value: "newest", label: "🕐 Newest first" },
    { value: "oldest", label: "🕰️ Oldest first" },
    { value: "az", label: "🔤 A → Z" },
    { value: "za", label: "🔤 Z → A" },
    { value: "pinned", label: "📌 Pinned first" }
];

function createSortDropdown() {
    sortDropdown = document.createElement("div");
    sortDropdown.className = "sort-dropdown hidden";

    sortOptions.forEach(option => {
        const btn = document.createElement("button");
        btn.className = "sort-option" + (option.value === currentSort ? " active" : "");
        btn.textContent = option.label;
        btn.dataset.value = option.value;
        btn.addEventListener("click", () => {
            currentSort = option.value;
            updateSortDropdown();
            displayNotes();
            sortDropdown.classList.add("hidden");
        });
        sortDropdown.appendChild(btn);
    });

    document.querySelector(".panel-header").appendChild(sortDropdown);
}

function updateSortDropdown() {
    if (!sortDropdown) return;
    sortDropdown.querySelectorAll(".sort-option").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.value === currentSort);
    });
}

function applySort(notesArray) {
    const sorted = [...notesArray];
    switch (currentSort) {
        case "newest":
            sorted.sort((a, b) => b.id - a.id);
            break;
        case "oldest":
            sorted.sort((a, b) => a.id - b.id);
            break;
        case "az":
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case "za":
            sorted.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case "pinned":
            sorted.sort((a, b) => (b.pinned === a.pinned ? 0 : b.pinned ? 1 : -1));
            break;
    }
    return sorted;
}

sortButton.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!sortDropdown) {
        createSortDropdown();
    }
    sortDropdown.classList.toggle("hidden");
    updateSortDropdown();
});

document.addEventListener("click", (e) => {
    if (sortDropdown && !sortDropdown.contains(e.target) && e.target !== sortButton) {
        sortDropdown.classList.add("hidden");
    }
});
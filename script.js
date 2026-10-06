// ================================
// SUPABASE AUTHENTICATION
// ================================

// Supabase configuration
const SUPABASE_URL = "https://zbfrfjeotxjwablxxiif.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tEl8zScIAQQk9eH1J_t-_g_hVy4sdxI";

// Create a single reusable Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
        const { data: { session }, error } = await supabase.auth.getSession();

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
function initializeApp() {
    console.log("Initializing app...");
    displayNotes();
    setupSidebarButtonHandlers();
    // Any other app initialization goes here
}

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
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
        const { data, error } = await supabase.auth.signInWithPassword({
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
        const { error } = await supabase.auth.signOut();
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

        updatedAt: new Date().toISOString(),

        background: getRandomBackground()

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
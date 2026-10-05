console.log("🖤 Brain Vault loaded successfully!");


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


// ================================
// SAVE NOTES
// ================================

function saveNotes() {

    localStorage.setItem(
        "brainVaultNotes",
        JSON.stringify(notes)
    );

}


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

// Editor footer elements
const lastSavedEl = document.getElementById("lastSaved");
const wordCountEl = document.getElementById("wordCount");


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

        updatedAt: new Date().toISOString()

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
        emptyMessage.classList.add("note-card");
        emptyMessage.style.cursor = "default";
        emptyMessage.style.textAlign = "center";
        emptyMessage.style.padding = "30px 15px";
        emptyMessage.style.color = "#777784";
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


        displayNotes();


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


    displayNotes();


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

            }
        );

    }
);

searchInput.addEventListener(
    "input",
    () => {
        currentSearchQuery = searchInput.value.trim().toLowerCase();
        displayNotes();
    }
);


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


// ================================
// INITIAL DISPLAY
// ================================

displayNotes();


// Open first active note

const firstActiveNote =
    notes.find(
        note => !note.trashed
    );


if (firstActiveNote) {

    openNote(
        firstActiveNote.id
    );

}
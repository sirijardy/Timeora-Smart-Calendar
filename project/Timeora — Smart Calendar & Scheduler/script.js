
"use strict";

// ==========================================
// TIMEORA - CALENDAR & SCHEDULER
// ==========================================

const $ = selector => document.querySelector(selector);

const STORAGE_KEY = "timeora_events";
const THEME_KEY = "timeora_theme";
const PROFILE_KEY = "timeora_profile";

const COLORS = {
    Study: "#4d91ff",
    Work: "#26c994",
    Personal: "#ff5b91",
    Health: "#ffbf30",
    Important: "#ff626b",
    Others: "#9962ff"
};

const CATEGORIES = Object.keys(COLORS);

const today = new Date();
const todayKey = toKey(today);

let selectedDate = todayKey;
let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let currentView = "month";
let editingId = null;
let openedEventId = null;
let searchQuery = "";
let activeCategory = null;
let showAllUpcoming = false;
let showAllSchedule = false;

// ==========================================
// DATE HELPERS
// ==========================================

function toKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function addDays(key, amount) {
    const date = fromKey(key);
    date.setDate(date.getDate() + amount);
    return toKey(date);
}

function monthLabel(date) {
    return date.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric"
    });
}

function dateLabel(key, options = {
    day: "numeric",
    month: "short",
    year: "numeric"
}) {
    return fromKey(key).toLocaleDateString("en-IN", options);
}

function timeLabel(time) {
    if (!time) return "All day";

    const [hour, minute] = time.split(":").map(Number);

    return new Date(2000, 0, 1, hour, minute)
        .toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit"
        });
}

function currentTime() {
    const date = new Date();
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isFuture(event) {
    const key = toKey(new Date());

    return event.date > key ||
        (event.date === key && event.time >= currentTime());
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// ==========================================
// SAMPLE EVENTS
// ==========================================

function sampleEvents() {
    const sample = [
        [1, "Project Meeting", "10:00", "Work"],
        [2, "Web Dev Study", "16:00", "Study"],
        [3, "Gym", "07:00", "Health"],
        [5, "Assignment", "11:00", "Work"],
        [6, "Doctor Appointment", "16:00", "Health"],
        [7, "Team Meeting", "14:00", "Work"],
        [9, "JavaScript", "18:00", "Study"],
        [12, "College", "09:00", "Study"],
        [14, "Birthday Party", "19:00", "Personal"],
        [15, "Project Deadline", "23:00", "Work"],
        [17, "Family Time", "18:00", "Personal"],
        [19, "GATE Study", "09:00", "Study"],
        [20, "Mock Test", "15:00", "Study"],
        [22, "Movie", "17:00", "Others"],
        [23, "Presentation", "13:00", "Work"],
        [25, "Hair Appointment", "11:00", "Health"],
        [27, "Internship Apply", "17:00", "Study"],
        [28, "Shopping", "16:00", "Personal"],
        [30, "Review Notes", "18:00", "Study"],
        [31, "Plan Next Month", "20:00", "Others"]
    ];

    return sample.map((item, index) => ({
        id: index + 1,
        date: `2026-10-${String(item[0]).padStart(2, "0")}`,
        title: item[1],
        time: item[2],
        category: item[3],
        description: "",
        reminder: 10,
        important: [6, 9, 10, 17].includes(index + 1),
        completed: false
    }));
}

// ==========================================
// LOCAL STORAGE
// ==========================================

function validEvent(event) {
    if (!event || typeof event !== "object") return false;

    if (!Number.isSafeInteger(event.id) || event.id < 0) return false;

    if (typeof event.title !== "string" || !event.title.trim()) return false;

    if (typeof event.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return false;

    if (toKey(fromKey(event.date)) !== event.date) return false;

    if (typeof event.time !== "string" ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)) return false;

    if (!COLORS[event.category]) return false;

    return true;
}

function loadEvents() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);

        if (raw !== null) {
            const parsed = JSON.parse(raw);

            if (Array.isArray(parsed)) {
                return parsed.filter(validEvent).map(event => ({
                    ...event,
                    title: event.title.trim(),
                    description: typeof event.description === "string"
                        ? event.description
                        : "",
                    reminder: [0, 5, 10, 30, 60, 1440].includes(Number(event.reminder))
                        ? Number(event.reminder)
                        : 0,
                    important: Boolean(event.important),
                    completed: Boolean(event.completed)
                }));
            }
        }
    } catch (error) {
        console.error("Unable to load saved events.", error);
    }

    return null;
}

let events = loadEvents();

if (events === null) {
    events = sampleEvents();

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
        console.warn("Sample events could not be saved.");
    }
}

function saveEvents() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
        return true;
    } catch (error) {
        alert("Unable to save your changes. Check browser storage.");
        return false;
    }
}

function sorted(list) {
    return [...list].sort((a, b) =>
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time) ||
        a.title.localeCompare(b.title)
    );
}

function matchesFilters(event) {
    const query = searchQuery.toLowerCase();

    const matchesText =
        !query ||
        event.title.toLowerCase().includes(query) ||
        event.category.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query);

    return matchesText &&
        (!activeCategory || event.category === activeCategory);
}

function getMonthEvents() {
    const prefix = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;

    return sorted(events.filter(event =>
        event.date.startsWith(prefix) && matchesFilters(event)
    ));
}

// ==========================================
// SUMMARY CARDS
// ==========================================

function renderStats() {
    const list = getMonthEvents();

    const completed = list.filter(event => event.completed).length;
    const important = list.filter(event => event.important).length;

    const upcoming = sorted(events.filter(event =>
        !event.completed && isFuture(event)
    ));

    $("#totalEvents").textContent = list.length;
    $("#completedEvents").textContent = completed;
    $("#importantEvents").textContent = important;
    $("#upcomingEvents").textContent = upcoming.length;

    $("#monthlyEvents").textContent = monthLabel(currentMonth);

    const percent = list.length
        ? Math.round(completed / list.length * 100)
        : 0;

    $("#completedPercent").textContent = `${percent}% completed`;

    $("#nextEvent").textContent = upcoming.length
        ? `Next: ${upcoming[0].title} at ${timeLabel(upcoming[0].time)}`
        : "No upcoming events";
}

// ==========================================
// EVENT CHIP
// ==========================================

function eventChip(event) {
    return `
        <button class="event-chip ${event.completed ? "done" : ""}"
            data-event-id="${event.id}"
            style="--event-color:${COLORS[event.category]}"
            title="${escapeHTML(event.title)}">
            <span class="chip-title">
                <span class="chip-dot"></span>
                ${escapeHTML(event.title)}${event.important ? " ★" : ""}
            </span>
            <span class="chip-time">${timeLabel(event.time)}</span>
        </button>
    `;
}

// ==========================================
// MAIN CALENDAR
// ==========================================

function renderCalendar() {
    const titles = {
        month: monthLabel(currentMonth),
        week: `Week of ${dateLabel(selectedDate)}`,
        day: dateLabel(selectedDate, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }),
        list: `${monthLabel(currentMonth)} — All Events`
    };

    $("#calendarTitle").textContent = titles[currentView];

    document.querySelectorAll(".view-btn").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.view === currentView
        );
    });

    const grid = $("#calendarGrid");

    grid.className = "calendar-grid";
    grid.style.gridTemplateColumns = "";

    if (currentView === "month") renderMonth(grid);
    if (currentView === "week") renderWeek(grid);
    if (currentView === "day") renderDay(grid);
    if (currentView === "list") renderList(grid);
}

function renderMonth(grid) {
    const first = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1
    );

    const start = new Date(first);
    start.setDate(1 - first.getDay());

    grid.innerHTML = Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);

        const key = toKey(date);

        const list = getMonthEvents().filter(event =>
            event.date === key
        );

        return `
            <div class="day-cell
                ${date.getMonth() !== currentMonth.getMonth() ? "outside" : ""}
                ${key === selectedDate ? "selected" : ""}"
                data-date="${key}">
                <button class="day-number ${key === toKey(new Date()) ? "today" : ""}"
                    data-select-date="${key}">
                    ${date.getDate()}
                </button>
                ${list.slice(0, 3).map(eventChip).join("")}
                ${list.length > 3
                    ? `<button class="more-events" data-show-day="${key}">
                        +${list.length - 3} more
                       </button>`
                    : ""}
            </div>
        `;
    }).join("");
}

function renderWeek(grid) {
    const start = fromKey(selectedDate);
    start.setDate(start.getDate() - start.getDay());

    grid.innerHTML = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);

        const key = toKey(date);

        const list = sorted(events.filter(event =>
            event.date === key && matchesFilters(event)
        ));

        return `
            <div class="day-cell ${key === selectedDate ? "selected" : ""}">
                <button class="day-number ${key === toKey(new Date()) ? "today" : ""}"
                    data-select-date="${key}">
                    ${date.toLocaleDateString("en-IN", { weekday: "short" })}
                    ${date.getDate()}
                </button>
                ${list.map(eventChip).join("")}
            </div>
        `;
    }).join("");
}

function renderDay(grid) {
    const list = sorted(events.filter(event =>
        event.date === selectedDate && matchesFilters(event)
    ));

    grid.style.gridTemplateColumns = "1fr";

    grid.innerHTML = `
        <div class="day-cell selected">
            <strong>${dateLabel(selectedDate, {
                weekday: "long",
                day: "numeric",
                month: "long"
            })}</strong>
            ${list.length
                ? list.map(eventChip).join("")
                : '<p class="empty-state">No events on this date.</p>'}
        </div>
    `;
}

function renderList(grid) {
    const list = getMonthEvents();

    grid.style.gridTemplateColumns = "1fr";

    grid.innerHTML = list.length
        ? list.map(event => `
            <div class="day-cell">
                <strong>${dateLabel(event.date)} · ${timeLabel(event.time)}</strong>
                ${eventChip(event)}
                <small>${escapeHTML(event.category)}</small>
            </div>
        `).join("")
        : '<p class="empty-state">No events found.</p>';
}

// ==========================================
// MINI CALENDAR
// ==========================================

function renderMiniCalendar() {
    $("#miniTitle").textContent = monthLabel(currentMonth);

    const first = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1
    );

    const start = new Date(first);
    start.setDate(1 - first.getDay());

    $("#miniGrid").innerHTML = Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);

        const key = toKey(date);
        const hasEvents = events.some(event => event.date === key);

        return `
            <button
                class="${date.getMonth() !== currentMonth.getMonth() ? "muted-day" : ""}
                ${key === selectedDate ? "selected" : ""}
                ${hasEvents ? "has-events" : ""}"
                data-mini-date="${key}"
                aria-label="${dateLabel(key)}">
                ${date.getDate()}
            </button>
        `;
    }).join("");
}

// ==========================================
// TODAY'S SCHEDULE
// ==========================================

function renderSchedule() {
    $("#scheduleDate").textContent = dateLabel(selectedDate, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    });

    const list = sorted(events.filter(event =>
        event.date === selectedDate && matchesFilters(event)
    ));

    const visible = showAllSchedule ? list : list.slice(0, 5);

    $("#scheduleList").innerHTML = visible.length
        ? visible.map(event => `
            <div class="schedule-item">
                <span class="schedule-time">${timeLabel(event.time)}</span>
                <span class="category-dot"
                    style="background:${COLORS[event.category]}"></span>
                <div>
                    <strong>${escapeHTML(event.title)}</strong>
                    ${event.completed ? "<small> · Completed</small>" : ""}
                </div>
                <button class="text-button" data-event-id="${event.id}">›</button>
            </div>
        `).join("")
        : '<p class="empty-state">Nothing scheduled for this date.</p>';

    $("#scheduleViewAll").textContent =
        showAllSchedule ? "Show Less ↑" : "View All →";
}

// ==========================================
// UPCOMING EVENTS
// ==========================================

function renderUpcoming() {
    const list = sorted(events.filter(event =>
        !event.completed && isFuture(event) && matchesFilters(event)
    ));

    const visible = showAllUpcoming ? list : list.slice(0, 5);

    $("#upcomingList").innerHTML = visible.length
        ? visible.map(event => `
            <div class="upcoming-item">
                <span class="category-dot"
                    style="background:${COLORS[event.category]}"></span>
                <div>
                    <div class="upcoming-title">
                        ${escapeHTML(event.title)}
                        ${event.important ? " ⭐" : ""}
                    </div>
                    <div class="upcoming-meta">
                        ▦ ${dateLabel(event.date)} · ◷ ${timeLabel(event.time)}
                    </div>
                </div>
                <div class="event-menu">
                    <button data-event-id="${event.id}" title="View event">⋮</button>
                </div>
            </div>
        `).join("")
        : '<p class="empty-state">No upcoming events.</p>';

    $("#upcomingViewAll").textContent =
        showAllUpcoming ? "Show Less ↑" : "View All →";
}

// ==========================================
// CATEGORY CHART - CSS ONLY
// ==========================================

function renderCategorySummary() {
    const list = getMonthEvents();

    const counts = CATEGORIES.map(category =>
        list.filter(event => event.category === category).length
    );

    const total = counts.reduce((sum, count) => sum + count, 0);

    $("#categoryTotal").textContent = total;

    let angle = 0;

    const segments = counts.map((count, index) => {
        const start = angle;

        angle += total ? count / total * 360 : 0;

        return `${COLORS[CATEGORIES[index]]} ${start}deg ${angle}deg`;
    });

    $("#categoryChart").style.background = total
        ? `conic-gradient(${segments.join(", ")})`
        : "conic-gradient(#e7eaf4 0deg 360deg)";

    $("#categoryLegend").innerHTML = CATEGORIES
        .map((category, index) => ({
            category,
            count: counts[index]
        }))
        .filter(item => item.count > 0)
        .map(item => `
            <div class="legend-item">
                <div class="legend-label">
                    <span class="category-dot"
                        style="background:${COLORS[item.category]}"></span>
                    <span>${item.category}</span>
                </div>
                <span class="legend-value">
                    ${item.count} (${Math.round(item.count / total * 100)}%)
                </span>
            </div>
        `).join("");

    if (!total) {
        $("#categoryLegend").innerHTML =
            '<p class="empty-state">Add events to see your summary.</p>';
    }

    $("#sidebarCategories").innerHTML = CATEGORIES.map(category => `
        <div class="side-category ${activeCategory === category ? "active-category" : ""}"
            data-category="${category}">
            <span class="category-dot" style="background:${COLORS[category]}"></span>
            <span>${category}</span>
        </div>
    `).join("");
}

// ==========================================
// ADD / EDIT EVENT FORM
// ==========================================

function resetForm() {
    editingId = null;

    $("#eventForm").reset();
    $("#eventDate").value = selectedDate;
    $("#eventTime").value = "10:00";
    $("#eventReminder").value = "10";

    $("#formTitle").textContent = "Add New Event";
    $("#submitEvent").textContent = "＋ Add Event";
    $("#cancelEdit").hidden = true;
    $("#formMessage").textContent = "";
}

function editEvent(id) {
    const event = events.find(item => item.id === id);
    if (!event) return;

    editingId = event.id;
    selectedDate = event.date;

    const date = fromKey(event.date);

    currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);

    $("#eventTitle").value = event.title;
    $("#eventDate").value = event.date;
    $("#eventTime").value = event.time;
    $("#eventCategory").value = event.category;
    $("#eventDescription").value = event.description || "";
    $("#eventReminder").value = String(event.reminder ?? 10);
    $("#eventImportant").checked = Boolean(event.important);
    $("#eventCompleted").checked = Boolean(event.completed);

    $("#formTitle").textContent = "Edit Event";
    $("#submitEvent").textContent = "Save Changes";
    $("#cancelEdit").hidden = false;

    closeDialog();
    refreshDashboard();

    $("#eventFormPanel").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

$("#eventForm").addEventListener("submit", event => {
    event.preventDefault();

    const title = $("#eventTitle").value.trim();
    const date = $("#eventDate").value;
    const time = $("#eventTime").value;
    const category = $("#eventCategory").value;

    if (!title || !date || !time || !COLORS[category]) {
        $("#formMessage").textContent = "Please complete all required fields.";
        return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        toKey(fromKey(date)) !== date ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        $("#formMessage").textContent = "Please enter a valid date and time.";
        return;
    }

    const existing = events.find(item => item.id === editingId);

    const newEvent = {
        id: existing ? existing.id : Date.now(),
        title,
        date,
        time,
        category,
        description: $("#eventDescription").value.trim(),
        reminder: Number($("#eventReminder").value),
        important: $("#eventImportant").checked,
        completed: $("#eventCompleted").checked
    };

    const previousEvents = events;

    if (existing) {
        events = events.map(item =>
            item.id === editingId ? newEvent : item
        );
    } else {
        events = [...events, newEvent];
    }

    if (!saveEvents()) {
        events = previousEvents;
        return;
    }

    selectedDate = date;

    const parsed = fromKey(date);
    currentMonth = new Date(parsed.getFullYear(), parsed.getMonth(), 1);

    resetForm();
    refreshDashboard();

    $("#formMessage").textContent = existing
        ? "Event updated successfully! ✓"
        : "Event added successfully! ✓";
});

$("#cancelEdit").addEventListener("click", resetForm);

// ==========================================
// EVENT DETAILS
// ==========================================

function openDialog(id) {
    const event = events.find(item => item.id === id);
    if (!event) return;

    openedEventId = id;

    $("#dialogTitle").textContent = event.title;

    $("#dialogContent").innerHTML = `
        <div class="dialog-details">
            <p><strong>Category:</strong> ${escapeHTML(event.category)}</p>
            <p><strong>Date:</strong> ${dateLabel(event.date)}</p>
            <p><strong>Time:</strong> ${timeLabel(event.time)}</p>
            <p><strong>Description:</strong> ${escapeHTML(event.description || "No description")}</p>
            <p><strong>Reminder:</strong> ${event.reminder ? `${event.reminder} minutes before` : "None"}</p>
            <p><strong>Status:</strong> ${event.completed ? "Completed ✓" : "Pending"}</p>
            <p><strong>Priority:</strong> ${event.important ? "⭐ Important" : "Normal"}</p>
        </div>
    `;

    $("#completeDialogEvent").textContent =
        event.completed ? "Mark Pending" : "Mark Completed";

    if (!$("#eventDialog").open) {
        $("#eventDialog").showModal();
    }
}

function closeDialog() {
    if ($("#eventDialog").open) {
        $("#eventDialog").close();
    }
}

$("#closeDialog").addEventListener("click", closeDialog);

$("#eventDialog").addEventListener("click", event => {
    if (event.target === $("#eventDialog")) closeDialog();
});

$("#editDialogEvent").addEventListener("click", () => {
    if (openedEventId !== null) editEvent(openedEventId);
});

$("#completeDialogEvent").addEventListener("click", () => {
    const event = events.find(item => item.id === openedEventId);
    if (!event) return;

    const previous = event.completed;
    event.completed = !event.completed;

    if (!saveEvents()) {
        event.completed = previous;
        return;
    }

    closeDialog();
    refreshDashboard();
});

$("#deleteDialogEvent").addEventListener("click", () => {
    const event = events.find(item => item.id === openedEventId);
    if (!event) return;

    if (!confirm(`Delete "${event.title}"?`)) return;

    const previous = events;
    events = events.filter(item => item.id !== openedEventId);

    if (!saveEvents()) {
        events = previous;
        return;
    }

    closeDialog();
    refreshDashboard();
});

// ==========================================
// CALENDAR NAVIGATION
// ==========================================

function movePeriod(direction) {
    if (currentView === "month" || currentView === "list") {
        currentMonth = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth() + direction,
            1
        );

        selectedDate = toKey(currentMonth);
    } else {
        selectedDate = addDays(
            selectedDate,
            direction * (currentView === "week" ? 7 : 1)
        );

        const date = fromKey(selectedDate);
        currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    }

    refreshDashboard();
}

$("#prevMonth").addEventListener("click", () => movePeriod(-1));
$("#nextMonth").addEventListener("click", () => movePeriod(1));
$("#miniPrev").addEventListener("click", () => movePeriod(-1));
$("#miniNext").addEventListener("click", () => movePeriod(1));

$("#todayBtn").addEventListener("click", () => {
    selectedDate = toKey(new Date());

    const date = new Date();
    currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);

    refreshDashboard();
});

document.querySelectorAll(".view-btn").forEach(button => {
    button.addEventListener("click", () => {
        currentView = button.dataset.view;
        refreshDashboard();
    });
});

// ==========================================
// SEARCH
// ==========================================

$("#searchInput").addEventListener("input", event => {
    searchQuery = event.target.value.trim();
    refreshDashboard();
});

$("#clearSearch").addEventListener("click", () => {
    $("#searchInput").value = "";
    searchQuery = "";
    refreshDashboard();
});

$("#clearFilter").addEventListener("click", () => {
    activeCategory = null;
    refreshDashboard();
});

// ==========================================
// DATE / EVENT / CATEGORY CLICK HANDLERS
// ==========================================

document.addEventListener("click", event => {
    const eventButton = event.target.closest("[data-event-id]");

    if (eventButton) {
        openDialog(Number(eventButton.dataset.eventId));
        return;
    }

    const dateButton = event.target.closest("[data-select-date]");

    if (dateButton) {
        selectedDate = dateButton.dataset.selectDate;

        const date = fromKey(selectedDate);
        currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);

        refreshDashboard();
        return;
    }

    const moreButton = event.target.closest("[data-show-day]");

    if (moreButton) {
        selectedDate = moreButton.dataset.showDay;
        currentView = "day";
        refreshDashboard();
        return;
    }

    const miniButton = event.target.closest("[data-mini-date]");

    if (miniButton) {
        selectedDate = miniButton.dataset.miniDate;

        const date = fromKey(selectedDate);
        currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);

        refreshDashboard();
        return;
    }

    const categoryButton = event.target.closest("[data-category]");

    if (categoryButton) {
        const category = categoryButton.dataset.category;

        activeCategory = activeCategory === category ? null : category;
        refreshDashboard();
    }
});

// ==========================================
// SIDEBAR NAVIGATION
// ==========================================

document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
        const page = button.dataset.page;

        document.querySelectorAll(".nav-link").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        if (page === "Dashboard") {
            currentView = "month";
            activeCategory = null;
            searchQuery = "";
            $("#searchInput").value = "";
            selectedDate = toKey(new Date());

            const date = new Date();
            currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);

            refreshDashboard();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }

        if (page === "Calendar") {
            $("#calendarSection").scrollIntoView({ behavior: "smooth" });
        }

        if (page === "Add Event") {
            resetForm();
            $("#eventFormPanel").scrollIntoView({ behavior: "smooth" });
            $("#eventTitle").focus({ preventScroll: true });
        }

        if (page === "My Events") {
            currentView = "list";
            refreshDashboard();
            $("#calendarSection").scrollIntoView({ behavior: "smooth" });
        }

        if (page === "Reminders") {
            $("#notificationPanel").hidden = false;
            renderNotifications();
            $("#notificationPanel").scrollIntoView({ behavior: "smooth" });
        }

        if (page === "Categories") {
            $("#categorySection").scrollIntoView({ behavior: "smooth" });
        }

        if (page === "Settings") {
            const choice = prompt(
                "Timeora Settings\n1. Change display name\n2. Toggle dark mode\nEnter 1 or 2:"
            );

            if (choice === "1") changeProfile();
            if (choice === "2") toggleTheme();
        }
    });
});

$("#quickAddBtn").addEventListener("click", () => {
    resetForm();
    $("#eventFormPanel").scrollIntoView({ behavior: "smooth" });
    $("#eventTitle").focus({ preventScroll: true });
});

// ==========================================
// REMINDERS PANEL
// ==========================================

function renderNotifications() {
    const upcoming = sorted(events.filter(event =>
        !event.completed && isFuture(event)
    ));

    const list = upcoming.filter(event =>
        event.important || Number(event.reminder) > 0
    ).slice(0, 8);

    $("#notificationCount").textContent = list.length;

    $("#notificationList").innerHTML = list.length
        ? list.map(event => `
            <div class="notification-item">
                <strong>${escapeHTML(event.title)}</strong>
                <p>${dateLabel(event.date)} · ${timeLabel(event.time)}</p>
                <small>${event.important ? "⭐ Important" : "⏰ Reminder enabled"}</small>
                <button class="text-button" data-event-id="${event.id}">View event</button>
            </div>
        `).join("")
        : '<p class="empty-state">No upcoming reminders.</p>';
}

$("#notificationBtn").addEventListener("click", () => {
    $("#notificationPanel").hidden = !$("#notificationPanel").hidden;
    renderNotifications();
});

$("#closeNotifications").addEventListener("click", () => {
    $("#notificationPanel").hidden = true;
});

// ==========================================
// DARK MODE
// ==========================================

function toggleTheme() {
    document.body.classList.toggle("dark");

    const dark = document.body.classList.contains("dark");
    $("#themeBtn").textContent = dark ? "☀" : "☾";

    try {
        localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch (error) {
        console.warn("Could not save theme.");
    }
}

$("#themeBtn").addEventListener("click", toggleTheme);

try {
    if (localStorage.getItem(THEME_KEY) === "dark") {
        document.body.classList.add("dark");
        $("#themeBtn").textContent = "☀";
    }
} catch (error) {
    console.warn("Could not load theme.");
}

// ==========================================
// PROFILE
// ==========================================

function changeProfile() {
    const name = prompt(
        "Enter your display name:",
        $("#profileName").textContent
    );

    if (!name || !name.trim()) return;

    $("#profileName").textContent = name.trim();
    $("#welcomeName").textContent = name.trim();

    try {
        localStorage.setItem(PROFILE_KEY, name.trim());
    } catch (error) {
        console.warn("Could not save profile.");
    }
}

$("#profileBtn").addEventListener("click", changeProfile);

try {
    const name = localStorage.getItem(PROFILE_KEY);

    if (name) {
        $("#profileName").textContent = name;
        $("#welcomeName").textContent = name;
    }
} catch (error) {
    console.warn("Could not load profile.");
}

// ==========================================
// SHOW ALL BUTTONS
// ==========================================

$("#scheduleViewAll").addEventListener("click", () => {
    showAllSchedule = !showAllSchedule;
    renderSchedule();
});

$("#upcomingViewAll").addEventListener("click", () => {
    showAllUpcoming = !showAllUpcoming;
    renderUpcoming();
});

// ==========================================
// INITIALIZE TIMEORA
// ==========================================

function refreshDashboard() {
    renderStats();
    renderCalendar();
    renderMiniCalendar();
    renderSchedule();
    renderUpcoming();
    renderCategorySummary();
    renderNotifications();
}

$("#eventDate").value = selectedDate;
$("#eventTime").value = "10:00";

document.title = "Timeora | Smart Calendar & Scheduler";

refreshDashboard();


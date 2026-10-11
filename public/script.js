const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const taskList = document.querySelector("#task-list");
const taskCount = document.querySelector("#task-count");
const remainingCount = document.querySelector("#remaining-count");
const emptyState = document.querySelector("#empty-state");
const notice = document.querySelector("#notice");
const clearCompletedButton = document.querySelector("#clear-completed");
const filterButtons = [...document.querySelectorAll(".filter-button")];
const todayLabel = document.querySelector("#today-label");

let tasks = [];
let activeFilter = "all";
let noticeTimer;

todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());

async function request(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Something went wrong. Please try again.");
  }

  return response.status === 204 ? null : response.json();
}

function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    notice.hidden = true;
  }, 5000);
}

function getVisibleTasks() {
  if (activeFilter === "active") {
    return tasks.filter((task) => !task.completed);
  }
  if (activeFilter === "completed") {
    return tasks.filter((task) => task.completed);
  }
  return tasks;
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();
  taskList.replaceChildren();
  taskList.setAttribute("aria-busy", "false");
  emptyState.hidden = visibleTasks.length > 0;

  for (const task of visibleTasks) {
    const row = document.createElement("li");
    row.className = `task-row${task.completed ? " is-completed" : ""}`;

    const toggleButton = document.createElement("button");
    toggleButton.className = "task-checkbox";
    toggleButton.type = "button";
    toggleButton.setAttribute("aria-label", task.completed ? "Mark task incomplete" : "Mark task complete");
    toggleButton.setAttribute("aria-pressed", String(task.completed));
    toggleButton.innerHTML = task.completed ? "<span aria-hidden=\"true\">✓</span>" : "";
    toggleButton.addEventListener("click", () => updateTask(task.id, { completed: !task.completed }));

    const title = document.createElement("p");
    title.className = "task-title";
    title.textContent = task.title;

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = makeIconButton("Edit task", "✎", () => startEditing(row, task));
    const deleteButton = makeIconButton("Delete task", "×", () => deleteTask(task.id));
    deleteButton.classList.add("delete-button");
    actions.append(editButton, deleteButton);
    row.append(toggleButton, title, actions);
    taskList.append(row);
  }

  const remaining = tasks.filter((task) => !task.completed).length;
  taskCount.textContent = String(tasks.length);
  remainingCount.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;
  clearCompletedButton.hidden = !tasks.some((task) => task.completed);
}

function makeIconButton(label, icon, onClick) {
  const button = document.createElement("button");
  button.className = "icon-button";
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.textContent = icon;
  button.addEventListener("click", onClick);
  return button;
}

function startEditing(row, task) {
  row.replaceChildren();

  const toggleButton = document.createElement("button");
  toggleButton.className = "task-checkbox";
  toggleButton.type = "button";
  toggleButton.disabled = true;
  toggleButton.setAttribute("aria-hidden", "true");

  const form = document.createElement("form");
  form.className = "edit-form";

  const input = document.createElement("input");
  input.className = "edit-input";
  input.type = "text";
  input.maxLength = 500;
  input.value = task.title;
  input.setAttribute("aria-label", "Edit task title");
  input.required = true;

  const saveButton = document.createElement("button");
  saveButton.className = "edit-save";
  saveButton.type = "submit";
  saveButton.textContent = "Save";

  const cancelButton = document.createElement("button");
  cancelButton.className = "edit-cancel";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", renderTasks);

  form.append(input, saveButton, cancelButton);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = input.value.trim();
    if (!title) {
      input.focus();
      return;
    }
    const updated = await updateTask(task.id, { title });
    if (!updated) {
      input.focus();
    }
  });

  row.append(toggleButton, form);
  input.focus();
  input.select();
}

async function loadTasks() {
  taskList.setAttribute("aria-busy", "true");
  try {
    tasks = await request("/api/tasks");
    renderTasks();
  } catch (error) {
    taskList.setAttribute("aria-busy", "false");
    showNotice(error.message);
    emptyState.hidden = true;
  }
}

async function updateTask(id, changes) {
  try {
    const updatedTask = await request(`/api/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(changes),
    });
    tasks = tasks.map((task) => (task.id === id ? updatedTask : task));
    renderTasks();
  } catch (error) {
    showNotice(error.message);
    return false;
  }
  return true;
}

async function deleteTask(id) {
  try {
    await request(`/api/tasks/${id}`, { method: "DELETE" });
    tasks = tasks.filter((task) => task.id !== id);
    renderTasks();
  } catch (error) {
    showNotice(error.message);
  }
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) {
    taskInput.focus();
    return;
  }

  const submitButton = taskForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  try {
    const task = await request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    tasks.unshift(task);
    taskInput.value = "";
    activeFilter = "all";
    syncFilterButtons();
    renderTasks();
    taskInput.focus();
  } catch (error) {
    showNotice(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

function syncFilterButtons() {
  for (const button of filterButtons) {
    const isActive = button.dataset.filter === activeFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    syncFilterButtons();
    renderTasks();
  });
}

clearCompletedButton.addEventListener("click", async () => {
  const completedTasks = tasks.filter((task) => task.completed);
  const results = await Promise.allSettled(completedTasks.map((task) => request(`/api/tasks/${task.id}`, {
    method: "DELETE",
  })));
  const failedCount = results.filter((result) => result.status === "rejected").length;
  if (failedCount > 0) {
    showNotice(`Could not clear ${failedCount} completed ${failedCount === 1 ? "task" : "tasks"}.`);
  }
  await loadTasks();
});

loadTasks();

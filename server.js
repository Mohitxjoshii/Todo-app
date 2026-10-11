require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const requestedPort = Number(process.env.PORT) || 3000;
let port = requestedPort;

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "todo_app",
  port: Number(process.env.DB_PORT) || 5432,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/tasks", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, title, completed, created_at FROM tasks ORDER BY created_at DESC, id DESC"
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks", async (req, res, next) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return res.status(400).json({ error: "Task title is required." });
  }

  try {
    const { rows } = await pool.query(
      "INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, completed, created_at",
      [title]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/api/tasks/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Task ID must be a positive integer." });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const updates = [];
  const values = [];

  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return res.status(400).json({ error: "Task title cannot be empty." });
    }
    values.push(title);
    updates.push(`title = $${values.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(body, "completed")) {
    if (typeof body.completed !== "boolean") {
      return res.status(400).json({ error: "Completed must be a boolean." });
    }
    values.push(body.completed);
    updates.push(`completed = $${values.length}`);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "Provide a title or completed status to update." });
  }

  values.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE tasks SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING id, title, completed, created_at`,
      values
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Task not found." });
    }
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/tasks/:id", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Task ID must be a positive integer." });
  }

  try {
    const { rowCount } = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: "Task not found." });
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error("Request failed:", error);
  if (res.headersSent) {
    return next(error);
  }
  res.status(500).json({ error: "An unexpected server error occurred." });
});

async function startServer() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  return new Promise((resolve, reject) => {
    const tryListen = (candidatePort) => {
      const server = app.listen(candidatePort, () => {
        port = candidatePort;
        process.env.PORT = String(candidatePort);
        console.log(`To-Do List server is running at http://localhost:${port}`);
        resolve(server);
      });

      server.on("error", (error) => {
        if (error.code === "EADDRINUSE" && candidatePort < requestedPort + 20) {
          console.warn(`Port ${candidatePort} is in use. Trying ${candidatePort + 1} instead.`);
          tryListen(candidatePort + 1);
          return;
        }

        reject(error);
      });
    };

    tryListen(requestedPort);
  });
}

startServer().catch((error) => {
  console.error("Unable to start the server. Check your PostgreSQL connection and settings.", error);
  process.exitCode = 1;
});

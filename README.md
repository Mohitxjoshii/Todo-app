# Daymark To-Do List

A responsive task list built with Express, vanilla JavaScript, and PostgreSQL.

## Run locally

1. Install Node.js and PostgreSQL, and make sure the PostgreSQL server is running.
2. Create a PostgreSQL database named `todo_app` (or choose another name and set `DB_NAME`).
3. Copy `.env.example` to `.env`, then set `DB_USER`, `DB_PASSWORD`, and any other database settings to match your local PostgreSQL setup. `PORT` defaults to `3000`.
4. From the project root, install dependencies and start the server:

   ```sh
   npm install
   npm start
   ```

5. Visit [http://localhost:3000](http://localhost:3000) (or the port configured in `.env`).

On startup, the server connects to PostgreSQL and creates the `tasks` table if it does not already exist. The app supports creating, viewing, editing, completing, filtering, and deleting tasks.

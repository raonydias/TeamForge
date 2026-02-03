# TeamForge

Local-first Pokémon team builder that replaces spreadsheet workflows with a fast, extensible dashboard.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Run the app (server + client):

```bash
npm run dev
```

- Client runs on `http://localhost:5173`
- Server runs on `http://localhost:4000`

## Database

- SQLite file: `data/app.db`
- Migrations live in `server/drizzle`

Migrations run automatically on server startup. You can also run them manually:

```bash
npm run db:migrate
```

## Adding a New Module

1. Add the table schema in `server/src/db/schema.ts`.
2. Create a new migration SQL file under `server/drizzle`.
3. Add API routes in `server/src/index.ts`.
4. Add new UI routes/components under `client/src/routes`.

## Scoring Roadmap

- Moves and learnsets
- Role/coverage logic
- Advanced ability modeling

## Project Structure

- `server/`: Express + Drizzle + SQLite
- `client/`: React + Vite SPA
- `data/`: local SQLite database file

## Notes

- On startup the server ensures `data/` exists and seeds sample data.
- Type chart defaults to neutral multipliers if not defined.

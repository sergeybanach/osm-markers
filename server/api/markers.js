import { Pool, Client } from "pg";

// Configure PostgreSQL connection for initial database check
const client = new Client({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  password: process.env.DB_PASSWORD || "postgres",
  port: process.env.DB_PORT || 5432,
  database: "postgres", // Connect to default 'postgres' database initially
});

// Configure PostgreSQL connection pool for app
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "map_markers",
  password: process.env.DB_PASSWORD || "postgres",
  port: process.env.DB_PORT || 5432,
});

// Initialize database and table
const initializeDatabase = async () => {
  try {
    await client.connect();
    // Check if database exists
    const dbCheck = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME || "map_markers"]
    );
    if (dbCheck.rowCount === 0) {
      console.log("Creating database:", process.env.DB_NAME || "map_markers");
      await client.query(`CREATE DATABASE ${process.env.DB_NAME || "map_markers"}`);
      console.log("Database created successfully");
    }
    await client.end();
  } catch (error) {
    console.error("Error initializing database:", error.message, error.stack);
    throw error;
  }

  // Connect to the application database and check/create table
  try {
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'markers'
      )`
    );
    if (!tableCheck.rows[0].exists) {
      console.log("Creating markers table");
      await pool.query(`
        CREATE TABLE markers (
          id SERIAL PRIMARY KEY,
          latitude DOUBLE PRECISION NOT NULL,
          longitude DOUBLE PRECISION NOT NULL,
          description TEXT,
          picture_url TEXT,
          session_hash TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Markers table created successfully");
    } else {
      // Check if session_hash column exists, add it if not
      const columnCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'markers'
          AND column_name = 'session_hash'
        )
      `);
      if (!columnCheck.rows[0].exists) {
        console.log("Adding session_hash column to markers table");
        await pool.query(`ALTER TABLE markers ADD COLUMN session_hash TEXT NOT NULL DEFAULT ''`);
        console.log("session_hash column added successfully");
      }
    }
  } catch (error) {
    console.error("Error initializing markers table:", error.message, error.stack);
    throw error;
  }
};

// Initialize database and table on startup
initializeDatabase().catch((error) => {
  console.error("Failed to initialize database and table:", error.message);
  process.exit(1);
});

export default defineEventHandler(async (event) => {
  const method = event.node.req.method;

  if (method === "GET") {
    // Fetch markers for a specific session hash
    const queryParams = new URLSearchParams(event.node.req.url.split("?")[1] || "");
    const sessionHash = queryParams.get("session_hash");

    if (!sessionHash) {
      return {
        success: false,
        error: "Session hash is required",
      };
    }

    try {
      const query = `
        SELECT id, latitude, longitude, description, picture_url, session_hash, created_at
        FROM markers
        WHERE session_hash = $1
      `;
      const result = await pool.query(query, [sessionHash]);
      return {
        success: true,
        markers: result.rows,
      };
    } catch (error) {
      console.error("Error fetching markers:", error.message, error.stack);
      return {
        success: false,
        error: `Failed to fetch markers: ${error.message}`,
      };
    }
  }

  if (method === "POST") {
    // Save a new marker
    const body = await readBody(event);
    const { latitude, longitude, description, picture_url, session_hash } = body;

    if (!session_hash) {
      return {
        success: false,
        error: "Session hash is required",
      };
    }

    try {
      const query = `
        INSERT INTO markers (latitude, longitude, description, picture_url, session_hash)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, latitude, longitude, description, picture_url, session_hash, created_at
      `;
      const values = [
        latitude,
        longitude,
        description || "",
        picture_url || null,
        session_hash,
      ];
      const result = await pool.query(query, values);
      return {
        success: true,
        marker: result.rows[0],
      };
    } catch (error) {
      console.error("Error saving marker:", error.message, error.stack);
      return {
        success: false,
        error: `Failed to save marker: ${error.message}`,
      };
    }
  }

  return {
    success: false,
    error: "Method not allowed",
  };
});
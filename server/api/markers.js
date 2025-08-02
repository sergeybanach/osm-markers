import { Pool, Client } from "pg";

// Configure PostgreSQL connection for initial database check
const client = new Client({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  password: process.env.DB_PASSWORD || "postgres",
  port: process.env.DB_PORT || 5432,
  database: "postgres",
});

// Configure PostgreSQL connection pool for app
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "map_markers",
  password: process.env.DB_PASSWORD || "postgres",
  port: process.env.DB_PORT || 5432,
});

// Initialize database and tables
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

  // Connect to the application database and check/create tables
  try {
    // Check and create markers table
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
      // Check if session_hash column exists
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

    // Check and create map_positions table
    const mapPositionsTableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'map_positions'
      )`
    );
    if (!mapPositionsTableCheck.rows[0].exists) {
      console.log("Creating map_positions table");
      await pool.query(`
        CREATE TABLE map_positions (
          id SERIAL PRIMARY KEY,
          session_hash TEXT NOT NULL UNIQUE,
          center_longitude DOUBLE PRECISION NOT NULL,
          center_latitude DOUBLE PRECISION NOT NULL,
          zoom_level DOUBLE PRECISION NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log("Map_positions table created successfully");
    }
  } catch (error) {
    console.error("Error initializing tables:", error.message, error.stack);
    throw error;
  }
};

// Initialize database and tables on startup
initializeDatabase().catch((error) => {
  console.error("Failed to initialize database and tables:", error.message);
  process.exit(1);
});

export default defineEventHandler(async (event) => {
  const method = event.node.req.method;

  if (method === "GET") {
    // Fetch markers and map position for a specific session hash
    const queryParams = new URLSearchParams(event.node.req.url.split("?")[1] || "");
    const sessionHash = queryParams.get("session_hash");

    if (!sessionHash) {
      return {
        success: false,
        error: "Session hash is required",
      };
    }

    try {
      // Fetch markers
      const markersQuery = `
        SELECT id, latitude, longitude, description, picture_url, session_hash, created_at
        FROM markers
        WHERE session_hash = $1
      `;
      const markersResult = await pool.query(markersQuery, [sessionHash]);

      // Fetch map position
      const positionQuery = `
        SELECT center_longitude, center_latitude, zoom_level
        FROM map_positions
        WHERE session_hash = $1
      `;
      const positionResult = await pool.query(positionQuery, [sessionHash]);

      return {
        success: true,
        markers: markersResult.rows,
        mapPosition: positionResult.rows[0] || null,
      };
    } catch (error) {
      console.error("Error fetching data:", error.message, error.stack);
      return {
        success: false,
        error: `Failed to fetch data: ${error.message}`,
      };
    }
  }

  if (method === "POST") {
    // Save a new marker or map position
    const body = await readBody(event);
    const { latitude, longitude, description, picture_url, session_hash, center_longitude, center_latitude, zoom_level } = body;

    if (!session_hash) {
      return {
        success: false,
        error: "Session hash is required",
      };
    }

    try {
      if (latitude !== undefined && longitude !== undefined) {
        // Save marker
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
      } else if (center_longitude !== undefined && center_latitude !== undefined && zoom_level !== undefined) {
        // Save or update map position
        const query = `
          INSERT INTO map_positions (session_hash, center_longitude, center_latitude, zoom_level)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (session_hash)
          DO UPDATE SET
            center_longitude = $2,
            center_latitude = $3,
            zoom_level = $4,
            updated_at = CURRENT_TIMESTAMP
          RETURNING center_longitude, center_latitude, zoom_level, updated_at
        `;
        const values = [session_hash, center_longitude, center_latitude, zoom_level];
        const result = await pool.query(query, values);
        return {
          success: true,
          mapPosition: result.rows[0],
        };
      } else {
        return {
          success: false,
          error: "Invalid request body",
        };
      }
    } catch (error) {
      console.error("Error saving data:", error.message, error.stack);
      return {
        success: false,
        error: `Failed to save data: ${error.message}`,
      };
    }
  }

  if (method === "PUT") {
    // Update a marker
    const body = await readBody(event);
    const { id, description, latitude, longitude, picture_url, session_hash } = body;

    if (!id || !session_hash) {
      return {
        success: false,
        error: "Marker ID and session hash are required",
      };
    }

    try {
      const query = `
      UPDATE markers
      SET 
        description = COALESCE($1, description),
        latitude = COALESCE($2, latitude),
        longitude = COALESCE($3, longitude),
        picture_url = COALESCE($4, picture_url)
      WHERE id = $5 AND session_hash = $6
      RETURNING id, latitude, longitude, description, picture_url, session_hash, created_at
    `;
      const values = [description || null, latitude || null, longitude || null, picture_url || null, id, session_hash];
      const result = await pool.query(query, values);
      if (result.rowCount === 0) {
        return {
          success: false,
          error: "Marker not found or session hash mismatch",
        };
      }
      return {
        success: true,
        marker: result.rows[0],
      };
    } catch (error) {
      console.error("Error updating marker:", error.message, error.stack);
      return {
        success: false,
        error: `Failed to update marker: ${error.message}`,
      };
    }
  }

  if (method === "DELETE") {
    // Remove a marker
    const body = await readBody(event);
    const { id, session_hash } = body;

    if (!id || !session_hash) {
      return {
        success: false,
        error: "Marker ID and session hash are required",
      };
    }

    try {
      const query = `
        DELETE FROM markers
        WHERE id = $1 AND session_hash = $2
        RETURNING id
      `;
      const result = await pool.query(query, [id, session_hash]);
      if (result.rowCount === 0) {
        return {
          success: false,
          error: "Marker not found or session hash mismatch",
        };
      }
      return {
        success: true,
        message: "Marker removed successfully",
      };
    } catch (error) {
      console.error("Error removing marker:", error.message, error.stack);
      return {
        success: false,
        error: `Failed to remove marker: ${error.message}`,
      };
    }
  }

  return {
    success: false,
    error: "Method not allowed",
  };
});
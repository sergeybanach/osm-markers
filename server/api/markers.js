import { Pool } from "pg";

// Configure PostgreSQL connection
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "map_markers",
  password: "postgres", // Replace with your PostgreSQL password
  port: 5432,
});

export default defineEventHandler(async (event) => {
  const method = event.node.req.method;

  if (method === "GET") {
    // Fetch all markers
    try {
      const query =
        "SELECT id, latitude, longitude, description, picture_url, created_at FROM markers";
      const result = await pool.query(query);

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
    const { latitude, longitude, description, picture_url } = body;

    try {
      const query = `
        INSERT INTO markers (latitude, longitude, description, picture_url)
        VALUES ($1, $2, $3, $4)
        RETURNING id, latitude, longitude, description, picture_url, created_at
      `;
      const values = [
        latitude,
        longitude,
        description || "",
        picture_url || null,
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

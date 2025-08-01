<template>
  <div id="map-wrapper">
    <button class="add-marker-btn" :class="{ active: isAddingMarker }" @click="toggleAddMarker">
      {{ isAddingMarker ? "Click map to place marker" : "Add Marker" }}
    </button>

    <div style="position: absolute; bottom: 10px; left: 10px; z-index: 50;">
      <label for="sessionHashInput">Session Hash: </label>
      <input 
        id="sessionHashInput" 
        v-model="tempSessionHash" 
        type="text" 
        style="margin-right: 5px;" 
        @click="selectAndCopyHash"
      />
      <button @click="updateSessionHash"
        style="padding: 4px 8px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Update
      </button>
      <button @click="copySessionHash"
        style="padding: 4px 8px; background-color: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 5px;">
        Copy
      </button>
      <button @click="generateNewHash"
        style="padding: 4px 8px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 5px;">
        New Hash
      </button>
    </div>

    <div id="map" :class="{ 'adding-marker': isAddingMarker }" style="width: 100%; height: 100vh"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import maplibregl from "maplibre-gl";

// State for marker placement
const isAddingMarker = ref(false);
let map = null;
let mapCanvas = null;

// Session hash management
const sessionHash = ref(localStorage.getItem("sessionHash") || "");
const tempSessionHash = ref(sessionHash.value); // Temporary state for input field

// Function to generate a new session hash
const ensureSessionHash = async () => {
  if (!sessionHash.value) {
    try {
      const response = await fetch("/api/generate-session-hash");
      const data = await response.json();
      if (data.success) {
        sessionHash.value = data.sessionHash;
        tempSessionHash.value = data.sessionHash;
        localStorage.setItem("sessionHash", sessionHash.value);
      } else {
        console.error("Failed to generate session hash:", data.error);
        alert("Failed to generate session hash: " + data.error);
      }
    } catch (error) {
      console.error("Error generating session hash:", error);
      alert("Error generating session hash: " + error.message);
    }
  }
};

// OSM style configuration
const osmStyle = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// Create popup content
const createPopupContent = (marker) => {
  return `
    <div style="max-width: 200px; padding: 10px;">
      <p><strong>Description:</strong> ${marker.description || "No description"}</p>
      <p><strong>Coordinates:</strong> (${marker.latitude.toFixed(4)}, ${marker.longitude.toFixed(4)})</p>
      ${marker.picture_url ? `<img src="${marker.picture_url}" style="max-width: 100%; height: auto;" alt="Marker image">` : "<p>No image available</p>"}
    </div>
  `;
};

// Toggle marker placement mode
const toggleAddMarker = () => {
  isAddingMarker.value = !isAddingMarker.value;
  changeToProperCursor();
};

const changeToProperCursor = () => {
  mapCanvas.style.cursor = isAddingMarker.value ? "crosshair" : "";
};

// Handle map click to add marker
const addMarker = async (e) => {
  if (!isAddingMarker.value) return;
  const { lng, lat } = e.lngLat;
  const description = prompt("Enter a description for the marker (optional):");

  // Create marker with popup
  const markerData = { latitude: lat, longitude: lng, description, session_hash: sessionHash.value };
  const popup = new maplibregl.Popup().setHTML(createPopupContent(markerData));
  new maplibregl.Marker().setLngLat([lng, lat]).setPopup(popup).addTo(map);

  // Save marker to the database
  try {
    const response = await $fetch("/api/markers", {
      method: "POST",
      body: { latitude: lat, longitude: lng, description, picture_url: null, session_hash: sessionHash.value },
    });

    if (response.success) {
      alert("Marker saved successfully!");
    } else {
      alert("Failed to save marker: " + response.error);
    }
  } catch (error) {
    console.error("Error saving marker:", error);
    alert("Error saving marker: " + error.message);
  }

  // Exit marker placement mode
  isAddingMarker.value = false;
  changeToProperCursor();
};

// Load existing markers from the database
const loadMarkers = async () => {
  if (!sessionHash.value) {
    console.error("No session hash available for loading markers");
    return;
  }

  try {
    const response = await $fetch(`/api/markers?session_hash=${sessionHash.value}`, {
      method: "GET",
    });

    if (response.success) {
      // Clear existing markers
      const existingMarkers = document.getElementsByClassName("maplibre-gl-marker");
      while (existingMarkers.length > 0) {
        existingMarkers[0].remove();
      }

      // Add new markers
      response.markers.forEach((marker) => {
        const popup = new maplibregl.Popup().setHTML(createPopupContent(marker));
        new maplibregl.Marker()
          .setLngLat([marker.longitude, marker.latitude])
          .setPopup(popup)
          .addTo(map);
      });
    } else {
      console.error("Failed to load markers:", response.error);
      alert("Failed to load markers: " + response.error);
    }
  } catch (error) {
    console.error("Error fetching markers:", error);
    alert("Error fetching markers: " + error.message);
  }
};

// Update session hash
const updateSessionHash = async () => {
  if (tempSessionHash.value && tempSessionHash.value !== sessionHash.value) {
    sessionHash.value = tempSessionHash.value;
    localStorage.setItem("sessionHash", sessionHash.value);
    await loadMarkers(); // Reload markers for the new session hash
  }
};

// Generate new session hash
const generateNewHash = async () => {
  try {
    const response = await fetch("/api/generate-session-hash");
    const data = await response.json();
    if (data.success) {
      sessionHash.value = data.sessionHash;
      tempSessionHash.value = data.sessionHash;
      localStorage.setItem("sessionHash", sessionHash.value);
      await loadMarkers(); // Reload markers for the new session hash
      alert("New session hash generated successfully!");
    } else {
      console.error("Failed to generate session hash:", data.error);
      alert("Failed to generate session hash: " + data.error);
    }
  } catch (error) {
    console.error("Error generating session hash:", error);
    alert("Error generating session hash: " + error.message);
  }
};

// Copy session hash to clipboard
const copySessionHash = async () => {
  try {
    await navigator.clipboard.writeText(sessionHash.value);
    alert("Session hash copied to clipboard!");
  } catch (error) {
    console.error("Error copying session hash:", error);
    alert("Failed to copy session hash: " + error.message);
  }
};

// Select and copy session hash on input click
const selectAndCopyHash = async (event) => {
  try {
    const input = event.target;
    input.select(); // Select all text in the input
    await navigator.clipboard.writeText(tempSessionHash.value);
    alert("Session hash selected and copied to clipboard!");
  } catch (error) {
    console.error("Error selecting and copying session hash:", error);
    alert("Failed to copy session hash: " + error.message);
  }
};

onMounted(async () => {
  // Initialize the map
  map = new maplibregl.Map({
    container: "map",
    style: osmStyle,
    center: [0, 0],
    zoom: 1,
  });

  // Add navigation controls
  map.addControl(new maplibregl.NavigationControl());

  // Add click event listener for marker placement
  map.on("click", addMarker);

  mapCanvas = map.getCanvas();

  // Ensure session hash exists before loading markers
  await ensureSessionHash();
  await loadMarkers();
});

onUnmounted(() => {
  // Clean up
  if (map) {
    map.off("click", addMarker);
    map.remove();
  }
});
</script>

<style>
@import "maplibre-gl/dist/maplibre-gl.css";

.add-marker-btn {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 50;
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.add-marker-btn:hover {
  background-color: #0056b3;
}

.add-marker-btn.active {
  background-color: #28a745;
}

.add-marker-btn.active:hover {
  background-color: #218838;
}

#map-wrapper {
  position: relative;
  height: 100vh;
}

#map {
  position: absolute;
  top: 0px;
  left: 0px;
  z-index: 0;
  cursor: default;
}
</style>
<!-- pages/index.vue -->
<template>
  <div>
    <h1>My MapLibre Map</h1>
    <MapLibre />
  </div>
</template>

<script setup>
import MapLibre from "~/components/MapLibre.vue";
</script>

<style scoped>
/* Optional: Add some basic styling */
h1 {
  text-align: center;
  margin: 1rem 0;
}
</style>

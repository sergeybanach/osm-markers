<!-- components/DonateButton.vue -->
<template>
    <a href="https://www.paypal.com/donate?hosted_button_id=YOUR_BUTTON_ID" target="_blank" class="donate-btn">
        Donate
    </a>
</template>

<script setup>
// No script logic needed for a simple link button
</script>

<style scoped>
.donate-btn {
    position: absolute;
    top: 10px;
    left: 150px;
    /* Positioned to the right of the Add Marker button */
    z-index: 50;
    padding: 8px 16px;
    background-color: #28a745;
    /* Green color to match notification style */
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    text-decoration: none;
    text-align: center;
}

.donate-btn:hover {
    background-color: #218838;
    /* Darker green on hover */
}

@media (max-width: 768px) {
    .donate-btn {
        font-size: 14px;
        padding: 6px 12px;
        top: 10px;
        left: auto;
        right: 56px;
        /* Adjusted for smaller screens */
    }
}
</style>
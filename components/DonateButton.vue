<!-- components/DonateButton.vue -->
<template>
    <div>
        <!-- Donate button to open the modal -->
        <button class="donate-btn" @click="openDonateModal">
            Donate
        </button>

        <!-- Modal for BTC address -->
        <div v-if="showDonateModal" class="donate-modal" @click="closeDonateModal">
            <div class="donate-modal-content" @click.stop>
                <h2>Support with Bitcoin</h2>
                <p>Please send your donation to the following BTC address:</p>
                <div class="btc-address-container">
                    <span class="btc-address">{{ btcAddress }}</span>
                    <button class="copy-btn" @click="copyBtcAddress">Copy</button>
                </div>
                <button class="close-modal-btn" @click="closeDonateModal">Close</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';

// State for modal
const showDonateModal = ref(false);
const btcAddress = '1BJv6Urrrz4PHAoSVCyoPdHjVEVtADuhrs';

// Function to open the modal
const openDonateModal = () => {
    showDonateModal.value = true;
};

// Function to close the modal
const closeDonateModal = () => {
    showDonateModal.value = false;
};

// Function to copy BTC address to clipboard
const copyBtcAddress = async () => {
    try {
        await navigator.clipboard.writeText(btcAddress);
        alert('BTC address copied to clipboard!');
    } catch (error) {
        console.error('Error copying BTC address:', error);
        alert('Failed to copy BTC address: ' + error.message);
    }
};
</script>

<style scoped>
.donate-btn {
    position: absolute;
    top: 10px;
    left: 150px;
    z-index: 50;
    padding: 8px 16px;
    background-color: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
}

.donate-btn:hover {
    background-color: #218838;
}

.donate-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
}

.donate-modal-content {
    position: relative;
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    max-width: 90%;
    max-height: 90%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.donate-modal-content h2 {
    margin-top: 0;
    font-size: 20px;
    color: #333;
}

.donate-modal-content p {
    margin: 10px 0;
    font-size: 16px;
    color: #555;
}

.btc-address-container {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
}

.btc-address {
    font-family: monospace;
    font-size: 14px;
    background-color: #f8f9fa;
    padding: 8px;
    border-radius: 4px;
    margin-right: 10px;
    word-break: break-all;
    max-width: 300px;
}

.copy-btn {
    padding: 6px 12px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
}

.copy-btn:hover {
    background-color: #0056b3;
}

.close-modal-btn {
    padding: 8px 16px;
    background-color: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
}

.close-modal-btn:hover {
    background-color: #c82333;
}

@media (max-width: 768px) {
    .donate-btn {
        font-size: 14px;
        padding: 6px 12px;
        top: 10px;
        left: auto;
        right: 56px;
    }

    .donate-modal-content {
        padding: 15px;
    }

    .donate-modal-content h2 {
        font-size: 18px;
    }

    .donate-modal-content p {
        font-size: 14px;
    }

    .btc-address {
        font-size: 12px;
        max-width: 250px;
    }

    .copy-btn {
        font-size: 12px;
        padding: 4px 8px;
    }

    .close-modal-btn {
        font-size: 14px;
        padding: 6px 12px;
    }
}
</style>
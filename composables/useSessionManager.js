import { ref } from 'vue'

export const useSessionManager = () => {
  const route = useRoute()
  const router = useRouter()
  
  const sessionHash = ref("")
  const tempSessionHash = ref("")

  // Function to validate session hash format (base64url)
  const isValidSessionHash = (hash) => {
    if (!hash || typeof hash !== "string") return false
    const base64urlRegex = /^[A-Za-z0-9\-_]+$/
    return base64urlRegex.test(hash) && hash.length >= 32
  }

  // Function to update URL with session hash
  const updateUrlWithSessionHash = (hash) => {
    router.replace({ query: { ...route.query, session_hash: hash } })
  }

  // Function to ensure session hash exists and load map position
  const ensureSessionHashAndMapPosition = async () => {
    let hash = route.query.session_hash

    if (!isValidSessionHash(hash)) {
      try {
        const response = await fetch("/api/generate-session-hash")
        const data = await response.json()
        if (data.success) {
          hash = data.sessionHash
          sessionHash.value = hash
          tempSessionHash.value = hash
          updateUrlWithSessionHash(hash)
        } else {
          console.error("Failed to generate session hash:", data.error)
          alert("Не удалось сгенерировать хэш сессии: " + data.error)
          return null
        }
      } catch (error) {
        console.error("Error generating session hash:", error)
        alert("Ошибка при генерации хэша сессии: " + error.message)
        return null
      }
    } else {
      sessionHash.value = hash
      tempSessionHash.value = hash
    }

    try {
      const response = await $fetch(`/api/markers?session_hash=${encodeURIComponent(sessionHash.value)}`, {
        method: "GET",
      })

      if (response.success) {
        return response.mapPosition || null
      } else {
        console.error("Failed to load map position:", response.error)
        return null
      }
    } catch (error) {
      console.error("Error fetching map position:", error)
      return null
    }
  }

  // Update session hash
  const updateSessionHash = async () => {
    if (tempSessionHash.value && tempSessionHash.value !== sessionHash.value) {
      if (!isValidSessionHash(tempSessionHash.value)) {
        alert("Пожалуйста, введите корректный хэш сессии.")
        tempSessionHash.value = sessionHash.value
        return
      }
      sessionHash.value = tempSessionHash.value
      updateUrlWithSessionHash(sessionHash.value)
      const mapPosition = await ensureSessionHashAndMapPosition()
      return mapPosition
    }
    return null
  }

  // Generate new session hash
  const generateNewHash = async () => {
    const confirm = window.confirm(
      "Создание нового хэша сессии приведет к удалению всех существующих маркеров и данных карты для текущей сессии. Вы уверены, что хотите продолжить?"
    )
    if (!confirm) return false

    try {
      const response = await fetch("/api/generate-session-hash")
      const data = await response.json()
      if (data.success) {
        sessionHash.value = data.sessionHash
        tempSessionHash.value = data.sessionHash
        updateUrlWithSessionHash(sessionHash.value)
        return data.sessionHash
      } else {
        console.error("Failed to generate session hash:", data.error)
        alert("Не удалось сгенерировать хэш сессии: " + data.error)
        return false
      }
    } catch (error) {
      console.error("Error generating session hash:", error)
      alert("Ошибка при генерации хэша сессии: " + error.message)
      return false
    }
  }

  // Copy full URL with session hash to clipboard
  const copySessionHash = async () => {
    try {
      const baseUrl = window.location.origin
      const fullUrl = `${baseUrl}?session_hash=${encodeURIComponent(sessionHash.value)}`
      await navigator.clipboard.writeText(fullUrl)
      return true
    } catch (error) {
      console.error("Error copying URL:", error)
      alert("Не удалось скопировать URL: " + error.message)
      return false
    }
  }

  return {
    sessionHash,
    tempSessionHash,
    isValidSessionHash,
    updateUrlWithSessionHash,
    ensureSessionHashAndMapPosition,
    updateSessionHash,
    generateNewHash,
    copySessionHash
  }
}
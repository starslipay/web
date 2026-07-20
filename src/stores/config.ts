import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useConfigStore = defineStore('config', () => {
  const serverIp = ref<string>(localStorage.getItem('serverIp') || 'localhost')
  const serverPort = ref<string>(localStorage.getItem('serverPort') || '8080')

  const baseUrl = computed(() => {
    return `http://${serverIp.value}:${serverPort.value}`
  })

  const saveConfig = () => {
    localStorage.setItem('serverIp', serverIp.value)
    localStorage.setItem('serverPort', serverPort.value)
  }

  const resetConfig = () => {
    serverIp.value = 'localhost'
    serverPort.value = '8080'
    saveConfig()
  }

  return {
    serverIp,
    serverPort,
    baseUrl,
    saveConfig,
    resetConfig,
  }
})
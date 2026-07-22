import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface RequestLog {
  id: number
  timestamp: Date
  method: string
  url: string
  requestBody: any
  responseData: any
  statusCode: number | null
  duration: number
  error?: string
}

export const useDebugStore = defineStore('debug', () => {
  const isDebugMode = ref(false)
  const requestLogs = ref<RequestLog[]>([])
  let logId = 0

  const toggleDebugMode = () => {
    isDebugMode.value = !isDebugMode.value
  }

  const addRequestLog = (log: Omit<RequestLog, 'id'>) => {
    const newLog: RequestLog = {
      ...log,
      id: ++logId,
    }
    requestLogs.value.unshift(newLog)
    if (requestLogs.value.length > 100) {
      requestLogs.value = requestLogs.value.slice(0, 100)
    }
  }

  const clearLogs = () => {
    requestLogs.value = []
  }

  const removeLog = (id: number) => {
    const index = requestLogs.value.findIndex(log => log.id === id)
    if (index !== -1) {
      requestLogs.value.splice(index, 1)
    }
  }

  return {
    isDebugMode,
    requestLogs,
    toggleDebugMode,
    addRequestLog,
    clearLogs,
    removeLog,
  }
})
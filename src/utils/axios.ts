import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    meta?: {
      requestStartTime?: number
      requestBody?: any
    }
  }
}

interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

const instance = axios.create({
  baseURL: '',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const userToken = localStorage.getItem('userToken')
    if (userToken) {
      if (!config.headers) {
        config.headers = {} as any
      }
      config.headers['user-token'] = userToken
    }
    config.meta = config.meta || {}
    config.meta.requestStartTime = Date.now()
    config.meta.requestBody = config.data
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

instance.interceptors.response.use(
  (response) => {
    const duration = Date.now() - (response.config.meta?.requestStartTime || Date.now())
    const requestBody = response.config.meta?.requestBody
    
    const result = response.data as ApiResponse
    if (result.code === 0) {
      recordRequestLog(response.config.method?.toUpperCase() || 'GET', response.config.url || '', requestBody, result, response.status, duration)
      return result.data
    } else {
      recordRequestLog(response.config.method?.toUpperCase() || 'GET', response.config.url || '', requestBody, result, response.status, duration, result.msg)
      const error = new Error(result.msg || '请求失败')
      return Promise.reject(error)
    }
  },
  (error) => {
    const duration = Date.now() - (error.config?.meta?.requestStartTime || Date.now())
    const requestBody = error.config?.meta?.requestBody
    const url = error.config?.url || ''
    const method = error.config?.method?.toUpperCase() || 'GET'
    const statusCode = error.response?.status || null
    const responseData = error.response?.data || null
    
    let errorMessage = error.message || '网络错误'
    
    if (responseData && typeof responseData === 'object') {
      if (responseData.msg) {
        errorMessage = responseData.msg
      } else if (responseData.message) {
        errorMessage = responseData.message
      }
    }
    
    recordRequestLog(method, url, requestBody, responseData, statusCode, duration, errorMessage)
    console.error('API Error:', errorMessage)
    
    const customError = new Error(errorMessage)
    return Promise.reject(customError)
  }
)

async function recordRequestLog(method: string, url: string, requestBody: any, responseData: any, statusCode: number | null, duration: number, error?: string) {
  try {
    const { useDebugStore } = await import('@/stores/debug')
    const debugStore = useDebugStore()
    debugStore.addRequestLog({
      timestamp: new Date(),
      method,
      url,
      requestBody,
      responseData,
      statusCode,
      duration,
      error,
    })
  } catch (e) {
    console.warn('Failed to record request log:', e)
  }
}

export const api = instance
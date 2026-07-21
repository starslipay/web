import axios from 'axios'

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
  (config) => {
    const userToken = localStorage.getItem('userToken')
    if (userToken) {
      config.headers['user-token'] = userToken
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

instance.interceptors.response.use(
  (response) => {
    const result = response.data as ApiResponse
    if (result.code === 0) {
      return result.data
    } else {
      const error = new Error(result.msg || '请求失败')
      return Promise.reject(error)
    }
  },
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const api = instance
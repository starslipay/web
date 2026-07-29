import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { payGateApi } from '@/api/pay_gate'
import type { RegUserReq, GetUserInfoRsp, GetUserBalanceInfoRsp, GetUserTokenReq } from '@/api/types'

// 过期时间，单位：秒
const TOKEN_EXPIRY_SECONDS = 3600

export interface UserAccount {
  userId: string
  name: string
  phone: string
  userToken: string
}

export const useAuthStore = defineStore('auth', () => {
  const userId = ref<string | null>(localStorage.getItem('userId') || null)
  const userToken = ref<string>(localStorage.getItem('userToken') || '')
  const businessInfo = ref<string>(localStorage.getItem('businessInfo') || '')
  const password = ref<string>('')
  const isLoggedIn = computed(() => !!userId.value && !!userToken.value)
  const userInfo = ref<GetUserInfoRsp | null>(null)
  const balanceInfo = ref<GetUserBalanceInfoRsp | null>(null)
  const userAccounts = ref<UserAccount[]>([])
  
  const tokenExpiryTime = ref<number>(0)
  const tokenRemainingSeconds = ref<number>(0)
  const tokenExpired = ref<boolean>(false)
  let tokenTimer: ReturnType<typeof setInterval> | null = null

  const loadUserAccounts = () => {
    try {
      const stored = localStorage.getItem('userAccounts')
      if (stored) {
        userAccounts.value = JSON.parse(stored)
      }
    } catch {
      userAccounts.value = []
    }
  }

  const saveUserAccounts = () => {
    localStorage.setItem('userAccounts', JSON.stringify(userAccounts.value))
  }

  const addUserAccount = (account: UserAccount) => {
    const existing = userAccounts.value.find(a => a.userId === account.userId)
    if (!existing) {
      userAccounts.value.push(account)
      saveUserAccounts()
    } else {
      existing.name = account.name
      existing.phone = account.phone
      existing.userToken = account.userToken
      saveUserAccounts()
    }
  }

  const removeUserAccount = (userIdToRemove: string) => {
    userAccounts.value = userAccounts.value.filter(a => a.userId !== userIdToRemove)
    saveUserAccounts()
  }

  const parseTokenExpiry = (token: string): number => {
    if (!token || token.length <= 32) return 0
    const timestampStr = token.substring(32)
    let timestamp = parseInt(timestampStr, 10)
    if (isNaN(timestamp)) return 0
    if (timestamp > 1e12) {
      timestamp = Math.floor(timestamp / 1000)
    }
    return timestamp + TOKEN_EXPIRY_SECONDS
  }

  const startTokenTimer = () => {
    stopTokenTimer()
    tokenExpired.value = false
    if (tokenExpiryTime.value <= 0) {
      tokenRemainingSeconds.value = 0
      return
    }
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000)
      const remaining = tokenExpiryTime.value - now
      if (remaining <= 0) {
        tokenRemainingSeconds.value = 0
        tokenExpired.value = true
        stopTokenTimer()
        handleTokenExpired()
      } else {
        tokenRemainingSeconds.value = remaining
      }
    }
    updateCountdown()
    tokenTimer = setInterval(updateCountdown, 1000)
  }

  const stopTokenTimer = () => {
    if (tokenTimer) {
      clearInterval(tokenTimer)
      tokenTimer = null
    }
  }

  const handleTokenExpired = () => {
    userId.value = null
    userToken.value = ''
    businessInfo.value = ''
    password.value = ''
    userInfo.value = null
    balanceInfo.value = null
    localStorage.removeItem('userId')
    localStorage.removeItem('userToken')
    localStorage.removeItem('businessInfo')
  }

  const setToken = (token: string) => {
    userToken.value = token
    localStorage.setItem('userToken', token)
    tokenExpiryTime.value = parseTokenExpiry(token)
    if (tokenExpiryTime.value > 0) {
      startTokenTimer()
    }
  }

  const setBusinessInfo = (info: string) => {
    businessInfo.value = info
    localStorage.setItem('businessInfo', info)
  }
  
  const formatTokenCountdown = (): string => {
    if (tokenRemainingSeconds.value <= 0) return '已过期'
    const minutes = Math.floor(tokenRemainingSeconds.value / 60)
    const seconds = tokenRemainingSeconds.value % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const login = async (req: GetUserTokenReq) => {
    try {
      const response = await payGateApi.getUserToken(req)
      userId.value = response.user_id
      localStorage.setItem('userId', response.user_id)
      setToken(response.user_token)
      setBusinessInfo(req.business_info || '')
      password.value = req.password || ''
      
      try {
        const info = await payGateApi.getUserInfo({ user_id: response.user_id })
        addUserAccount({
          userId: response.user_id,
          name: info.name,
          phone: info.phone,
          userToken: response.user_token,
        })
      } catch {
        addUserAccount({
          userId: response.user_id,
          name: response.user_id,
          phone: '',
          userToken: response.user_token,
        })
      }
      
      return response
    } catch (error) {
      throw error
    }
  }

  const register = async (req: RegUserReq) => {
    try {
      const response = await payGateApi.regUser(req)
      return response
    } catch (error) {
      throw error
    }
  }

  const switchAccount = async (newUserId: string) => {
    const account = userAccounts.value.find(a => a.userId === newUserId)
    if (!account) return
    
    userId.value = newUserId
    localStorage.setItem('userId', newUserId)
    setToken(account.userToken)
    setBusinessInfo('web_switch')
    userInfo.value = null
    balanceInfo.value = null
    
    try {
      await getUserInfo()
      await getUserBalance()
    } catch (error) {
      console.error('切换账户失败:', error)
    }
  }

  const logout = () => {
    stopTokenTimer()
    tokenExpiryTime.value = 0
    tokenRemainingSeconds.value = 0
    tokenExpired.value = false
    userId.value = null
    userToken.value = ''
    businessInfo.value = ''
    password.value = ''
    userInfo.value = null
    balanceInfo.value = null
    localStorage.removeItem('userId')
    localStorage.removeItem('userToken')
    localStorage.removeItem('businessInfo')
  }

  const logoutAll = () => {
    logout()
    userAccounts.value = []
    localStorage.removeItem('userAccounts')
  }

  const getUserInfo = async () => {
    if (!userId.value) return null
    try {
      const response = await payGateApi.getUserInfo({ user_id: userId.value })
      userInfo.value = response
      
      const existing = userAccounts.value.find(a => a.userId === userId.value)
      if (existing) {
        existing.name = response.name
        existing.phone = response.phone
        saveUserAccounts()
      }
      
      return response
    } catch (error) {
      throw error
    }
  }

  const getUserBalance = async () => {
    if (!userId.value) return null
    try {
      const response = await payGateApi.getUserBalanceInfo({ user_id: userId.value })
      balanceInfo.value = response
      return response
    } catch (error) {
      throw error
    }
  }

  loadUserAccounts()

  if (userToken.value) {
    tokenExpiryTime.value = parseTokenExpiry(userToken.value)
    if (tokenExpiryTime.value > 0) {
      startTokenTimer()
    }
  }

  return {
    userId,
    userToken,
    businessInfo,
    password,
    isLoggedIn,
    userInfo,
    balanceInfo,
    userAccounts,
    tokenRemainingSeconds,
    tokenExpired,
    login,
    register,
    logout,
    logoutAll,
    switchAccount,
    getUserInfo,
    getUserBalance,
    addUserAccount,
    removeUserAccount,
    setToken,
    setBusinessInfo,
    formatTokenCountdown,
  }
})
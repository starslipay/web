import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { payGateApi } from '@/api/pay_gate'
import type { RegUserReq, GetUserInfoRsp, GetUserBalanceInfoRsp } from '@/api/types'

export interface UserAccount {
  userId: string
  name: string
  phone: string
}

export const useAuthStore = defineStore('auth', () => {
  const userId = ref<string | null>(localStorage.getItem('userId') || null)
  const password = ref<string>('')
  const isLoggedIn = computed(() => !!userId.value)
  const userInfo = ref<GetUserInfoRsp | null>(null)
  const balanceInfo = ref<GetUserBalanceInfoRsp | null>(null)
  const userAccounts = ref<UserAccount[]>([])

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
    }
  }

  const removeUserAccount = (userIdToRemove: string) => {
    userAccounts.value = userAccounts.value.filter(a => a.userId !== userIdToRemove)
    saveUserAccounts()
  }

  const login = async (req: RegUserReq) => {
    try {
      const response = await payGateApi.regUser(req)
      userId.value = response.user_id
      localStorage.setItem('userId', response.user_id)
      password.value = req.password || ''
      
      try {
        const info = await payGateApi.getUserInfo({ user_id: response.user_id })
        addUserAccount({
          userId: response.user_id,
          name: info.name,
          phone: info.phone,
        })
      } catch {
        addUserAccount({
          userId: response.user_id,
          name: response.user_id,
          phone: '',
        })
      }
      
      return response
    } catch (error) {
      throw error
    }
  }

  const switchAccount = async (newUserId: string) => {
    userId.value = newUserId
    localStorage.setItem('userId', newUserId)
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
    userId.value = null
    password.value = ''
    userInfo.value = null
    balanceInfo.value = null
    localStorage.removeItem('userId')
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

  return {
    userId,
    password,
    isLoggedIn,
    userInfo,
    balanceInfo,
    userAccounts,
    login,
    logout,
    logoutAll,
    switchAccount,
    getUserInfo,
    getUserBalance,
    addUserAccount,
    removeUserAccount,
  }
})
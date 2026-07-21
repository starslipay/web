<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { LogOut, User, Banknote, ArrowRightLeft, RefreshCw, Wallet, Building, ChevronDown, X, Plus, FileText } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const refreshing = ref(false)
const showAccountMenu = ref(false)

const formatBalance = (balance: number) => {
  const yuan = balance / 100
  return yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
}

const getCurrencySymbol = (curType: number) => {
  const symbols: Record<number, string> = {
    0: '¥',
    1: '$',
    2: '€',
  }
  return symbols[curType] || '¥'
}

const refreshData = async () => {
  refreshing.value = true
  try {
    await authStore.getUserInfo()
    await authStore.getUserBalance()
  } catch (error) {
    console.error('刷新数据失败:', error)
  } finally {
    refreshing.value = false
  }
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const handleLogoutAll = () => {
  authStore.logoutAll()
  router.push('/login')
}

const handleSwitchAccount = async (userId: string) => {
  if (userId === authStore.userId) {
    showAccountMenu.value = false
    return
  }
  showAccountMenu.value = false
  await authStore.switchAccount(userId)
}

const handleRemoveAccount = (userId: string) => {
  authStore.removeUserAccount(userId)
}

const goToTransfer = () => {
  router.push('/transfer')
}

const goToProfile = () => {
  router.push('/profile')
}

const goToTransactions = () => {
  router.push('/transactions')
}

const goToRegister = () => {
  showAccountMenu.value = false
  router.push('/register')
}

onMounted(async () => {
  try {
    await authStore.getUserInfo()
    await authStore.getUserBalance()
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="max-w-4xl mx-auto">
      <header class="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 class="text-2xl font-bold text-white">starsli支付系统</h1>
          <p class="text-blue-100 mt-1">欢迎回来，{{ authStore.userInfo?.name || authStore.userId }}</p>
        </div>
        
        <div class="relative">
          <button
            @click="showAccountMenu = !showAccountMenu"
            class="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <User class="w-4 h-4" />
            {{ authStore.userId }}
            <ChevronDown :class="['w-4 h-4 transition-transform', showAccountMenu ? 'rotate-180' : '']" />
          </button>
          
          <Transition name="dropdown">
            <div
              v-if="showAccountMenu"
              class="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
            >
              <div class="px-4 py-2 border-b border-gray-100">
                <p class="text-sm font-medium text-gray-800">已登录账户</p>
                <p class="text-xs text-gray-500">{{ authStore.userAccounts.length }} 个账户</p>
              </div>
              
              <div class="max-h-60 overflow-y-auto">
                <button
                  v-for="account in authStore.userAccounts"
                  :key="account.userId"
                  @click="handleSwitchAccount(account.userId)"
                  :class="[
                    'w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors',
                    account.userId === authStore.userId ? 'bg-primary-50' : '',
                  ]"
                >
                  <div class="flex items-center gap-3">
                    <div
                      :class="[
                        'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
                        account.userId === authStore.userId ? 'bg-primary-600' : 'bg-gray-400',
                      ]"
                    >
                      {{ account.name.charAt(0) || 'U' }}
                    </div>
                    <div class="text-left">
                      <p class="text-sm font-medium text-gray-800">{{ account.name || account.userId }}</p>
                      <p class="text-xs text-gray-500">{{ account.phone || '未绑定手机' }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span
                      v-if="account.userId === authStore.userId"
                      class="text-xs px-2 py-0.5 bg-primary-100 text-primary-600 rounded-full"
                    >
                      当前
                    </span>
                    <button
                      v-if="account.userId !== authStore.userId"
                      @click.stop="handleRemoveAccount(account.userId)"
                      class="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X class="w-4 h-4" />
                    </button>
                  </div>
                </button>
              </div>
              
              <div class="border-t border-gray-100 mt-2">
                <button
                  @click="goToRegister"
                  class="w-full px-4 py-2 flex items-center gap-2 text-sm text-primary-600 hover:bg-primary-50 transition-colors"
                >
                  <Plus class="w-4 h-4" />
                  注册新账户
                </button>
              </div>
              
              <div class="border-t border-gray-100">
                <button
                  @click="handleLogout"
                  class="w-full px-4 py-2 flex items-center gap-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <LogOut class="w-4 h-4" />
                  退出当前账户
                </button>
                <button
                  @click="handleLogoutAll"
                  class="w-full px-4 py-2 flex items-center gap-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  退出所有账户
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </header>

      <div v-if="loading" class="card p-8 text-center">
        <RefreshCw class="w-8 h-8 text-primary-600 animate-spin mx-auto" />
        <p class="text-gray-500 mt-4">加载中...</p>
      </div>

      <div v-else class="space-y-6">
        <div class="card p-6 animate-slide-up">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                <Wallet class="w-6 h-6 text-white" />
              </div>
              <div>
                <p class="text-sm text-gray-500">账户余额</p>
                <p class="text-lg font-semibold text-gray-800">{{ authStore.userInfo?.name }}</p>
              </div>
            </div>
            <button
              @click="refreshData"
              :disabled="refreshing"
              class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw :class="['w-5 h-5 text-gray-400', refreshing ? 'animate-spin' : '']" />
            </button>
          </div>

          <div class="mt-6">
            <div class="text-4xl font-bold text-gray-800">
              {{ getCurrencySymbol(authStore.balanceInfo?.cur_type || 0) }}{{ formatBalance(authStore.balanceInfo?.balance || 0) }}
            </div>
            <div class="flex items-center gap-4 mt-4">
              <div class="flex items-center gap-2 text-sm text-gray-500">
                <Banknote class="w-4 h-4" />
                <span>用户ID: {{ authStore.userId }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            @click="goToTransfer"
            class="card p-6 text-left hover:shadow-xl transition-all duration-200 hover:-translate-y-1 group animate-slide-up"
            style="animation-delay: 0.1s"
          >
            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ArrowRightLeft class="w-6 h-6 text-white" />
            </div>
            <h3 class="font-semibold text-gray-800">C2C转账</h3>
            <p class="text-sm text-gray-500 mt-1">用户间转账</p>
          </button>

          <button
            @click="goToTransfer"
            class="card p-6 text-left hover:shadow-xl transition-all duration-200 hover:-translate-y-1 group animate-slide-up"
            style="animation-delay: 0.2s"
          >
            <div class="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Building class="w-6 h-6 text-white" />
            </div>
            <h3 class="font-semibold text-gray-800">银行卡充值</h3>
            <p class="text-sm text-gray-500 mt-1">Bank2C充值</p>
          </button>

          <button
            @click="goToProfile"
            class="card p-6 text-left hover:shadow-xl transition-all duration-200 hover:-translate-y-1 group animate-slide-up"
            style="animation-delay: 0.3s"
          >
            <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <User class="w-6 h-6 text-white" />
            </div>
            <h3 class="font-semibold text-gray-800">个人资料</h3>
            <p class="text-sm text-gray-500 mt-1">查看/编辑信息</p>
          </button>

          <button
            @click="goToTransactions"
            class="card p-6 text-left hover:shadow-xl transition-all duration-200 hover:-translate-y-1 group animate-slide-up"
            style="animation-delay: 0.4s"
          >
            <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FileText class="w-6 h-6 text-white" />
            </div>
            <h3 class="font-semibold text-gray-800">交易明细</h3>
            <p class="text-sm text-gray-500 mt-1">查看交易记录</p>
          </button>
        </div>

        <div class="card p-6 animate-slide-up" style="animation-delay: 0.5s">
          <h3 class="font-semibold text-gray-800 mb-4">快速信息</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-xs text-gray-500 mb-1">用户ID</p>
              <p class="font-medium text-gray-800">{{ authStore.userId }}</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-xs text-gray-500 mb-1">手机号</p>
              <p class="font-medium text-gray-800">{{ authStore.userInfo?.phone || '-' }}</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-xs text-gray-500 mb-1">邮箱</p>
              <p class="font-medium text-gray-800">{{ authStore.userInfo?.email || '-' }}</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-xs text-gray-500 mb-1">年龄</p>
              <p class="font-medium text-gray-800">{{ authStore.userInfo?.age || '-' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showAccountMenu"
      class="fixed inset-0 z-40"
      @click="showAccountMenu = false"
    ></div>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
</style>
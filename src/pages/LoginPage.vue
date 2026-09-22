<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDebugStore } from '@/stores/debug'
import { Server, User, Lock, Eye, EyeOff, UserPlus, Zap, ChevronDown } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const debugStore = useDebugStore()

const showPassword = ref(false)
const loading = ref(false)
const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'warning',
})

// 默认填充上次登录成功的账户；若记录已不存在（如清除了历史），则回退到第一个历史账户
const getDefaultUserId = (): string => {
  const lastUserId = localStorage.getItem('lastLoginUserId') || ''
  if (lastUserId && authStore.userAccounts.some(a => a.userId === lastUserId)) {
    return lastUserId
  }
  return authStore.userAccounts[0]?.userId || ''
}

const defaultUserId = getDefaultUserId()

const loginForm = reactive({
  user_id: defaultUserId,
  password: '',
})

// 历史账号下拉面板（与账号输入框合并，点击尾部箭头展开）
const showAccountDropdown = ref(false)

// 从历史账号列表中选择一个，填充到账号输入框并关闭下拉
const pickAccount = (userId: string) => {
  loginForm.user_id = userId
  showAccountDropdown.value = false
}

const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => {
    toast.show = false
  }, 3000)
}

const goToRegister = () => {
  router.push('/register')
}

const handleLogin = async () => {
  if (!loginForm.user_id || !loginForm.password) {
    showToast('请填写账号和密码', 'error')
    return
  }

  loading.value = true
  try {
    await authStore.login({
      user_id: loginForm.user_id,
      password: loginForm.password,
    })
    await authStore.getUserInfo()
    await authStore.getUserBalance()
    showToast('登录成功', 'success')
    setTimeout(() => {
      router.push('/dashboard')
    }, 1000)
  } catch (error: any) {
    let errorMessage = '登录失败，请检查账号和密码'
    if (error.message) {
      if (error.message.includes('Network Error') || error.message.includes('ERR_FAILED')) {
        errorMessage = '无法连接到服务器，请检查网络或联系管理员'
      } else if (error.message.includes('ERR_CONNECTION_REFUSED')) {
        errorMessage = '连接被拒绝，请联系管理员'
      } else if (error.message.includes('ERR_TIMED_OUT')) {
        errorMessage = '连接超时，请检查网络连接'
      } else {
        errorMessage = error.message
      }
    }
    showToast(errorMessage, 'error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 sm:p-6">
    <div class="w-full max-w-md animate-slide-up">
      <div class="card p-6 sm:p-8">
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Server class="w-8 h-8 text-white" />
          </div>
          <h1 class="text-2xl font-bold text-gray-800">starslipay</h1>
          <p class="text-gray-500 mt-2">安全、便捷的交易系统</p>
          
          <button
            @click="debugStore.toggleDebugMode"
            :class="[
              'mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
              debugStore.isDebugMode
                ? 'bg-yellow-400 text-yellow-900 shadow-lg shadow-yellow-400/30'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            <Zap class="w-4 h-4" />
            {{ debugStore.isDebugMode ? '调试中' : '调试模式' }}
          </button>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <!-- 账号输入框（尾部箭头展开历史账号） -->
          <div>
            <label class="label">账号</label>
            <div class="relative">
              <User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="loginForm.user_id"
                type="text"
                :class="['input-field pl-12', authStore.userAccounts.length > 0 ? 'pr-12' : '']"
                placeholder="请输入账号"
                autocomplete="off"
              />
              <!-- 历史账号下拉箭头，仅有历史账号时显示 -->
              <button
                v-if="authStore.userAccounts.length > 0"
                type="button"
                @click="showAccountDropdown = !showAccountDropdown"
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-primary-600 rounded transition-colors"
                :title="showAccountDropdown ? '关闭历史账号' : '查看历史账号'"
              >
                <ChevronDown
                  class="w-5 h-5 transition-transform"
                  :class="showAccountDropdown ? 'rotate-180' : ''"
                />
              </button>

              <!-- 点击外部时关闭下拉的透明遮罩 -->
              <div
                v-if="showAccountDropdown"
                @click="showAccountDropdown = false"
                class="fixed inset-0 z-40"
              ></div>

              <!-- 历史账号下拉面板 -->
              <div
                v-if="showAccountDropdown"
                class="absolute left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto z-50"
              >
                <button
                  v-for="account in authStore.userAccounts"
                  :key="account.userId"
                  type="button"
                  @click="pickAccount(account.userId)"
                  class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-primary-50 transition-colors text-left"
                >
                  <div
                    class="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium flex-shrink-0"
                  >
                    {{ account.name.charAt(0) || 'U' }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate">
                      {{ account.name || account.userId }}
                    </p>
                    <p class="text-xs text-gray-500 truncate">ID: {{ account.userId }}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div>
            <label class="label">密码</label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                class="input-field pl-12 pr-12"
                placeholder="请输入密码"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <EyeOff v-if="showPassword" class="w-5 h-5" />
                <Eye v-else class="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full btn-primary py-3 text-lg flex items-center justify-center gap-2"
          >
            <span v-if="loading">登录中...</span>
            <span v-else>登录</span>
          </button>
        </form>

        <div class="mt-6 pt-6 border-t border-gray-100">
          <button
            @click="goToRegister"
            class="w-full btn-outline flex items-center justify-center gap-2"
          >
            <UserPlus class="w-5 h-5" />
            注册新账户
          </button>
        </div>
      </div>
    </div>

    <Transition name="toast">
      <div
        v-if="toast.show"
        :class="[
          'toast',
          toast.type === 'success' ? 'toast-success' : '',
          toast.type === 'error' ? 'toast-error' : '',
          toast.type === 'warning' ? 'toast-warning' : '',
        ]"
      >
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -100%);
}
</style>
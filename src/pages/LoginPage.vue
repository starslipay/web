<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDebugStore } from '@/stores/debug'
import { Server, User, Lock, Eye, EyeOff, UserPlus, Zap } from 'lucide-vue-next'

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

const loginForm = reactive({
  user_id: '',
  password: '',
})

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
    showToast('请填写用户名和密码', 'error')
    return
  }

  loading.value = true
  try {
    await authStore.login({
      user_id: loginForm.user_id,
      password: loginForm.password,
      business_info: 'web_login',
    })
    await authStore.getUserInfo()
    await authStore.getUserBalance()
    showToast('登录成功', 'success')
    setTimeout(() => {
      router.push('/dashboard')
    }, 1000)
  } catch (error: any) {
    let errorMessage = '登录失败，请检查用户名和密码'
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
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md animate-slide-up">
      <div class="card p-8">
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
          <div>
            <label class="label">用户名</label>
            <div class="relative">
              <User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="loginForm.user_id"
                type="text"
                class="input-field pl-12"
                placeholder="请输入用户名"
                autocomplete="off"
              />
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
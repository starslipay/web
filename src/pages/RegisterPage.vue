<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ArrowLeft, User, Lock, Mail, Phone, MapPin, Calendar, CreditCard, Eye, EyeOff, UserPlus } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'warning',
})

const registerForm = reactive({
  user_id: '',
  password: '',
  confirmPassword: '',
  name: '',
  gender: 0,
  age: '',
  address: '',
  phone: '',
  email: '',
  id_type: 0,
  id_card: '',
})

const genders = [
  { value: 0, label: '未知' },
  { value: 1, label: '男' },
  { value: 2, label: '女' },
]

const idTypes = [
  { value: 0, label: '未知' },
  { value: 1, label: '身份证' },
  { value: 2, label: '护照' },
  { value: 3, label: '驾驶证' },
]

const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
  toast.message = message
  toast.type = type
  toast.show = true
  setTimeout(() => {
    toast.show = false
  }, 3000)
}

const goBack = () => {
  router.push('/login')
}

const goToLogin = () => {
  router.push('/login')
}

const handleRegister = async () => {
  if (!registerForm.user_id) {
    showToast('请输入用户名', 'error')
    return
  }
  if (!registerForm.password) {
    showToast('请输入密码', 'error')
    return
  }
  if (registerForm.password !== registerForm.confirmPassword) {
    showToast('两次输入的密码不一致', 'error')
    return
  }

  loading.value = true
  try {
    await authStore.register({
      user_id: registerForm.user_id,
      password: registerForm.password,
      name: registerForm.name || undefined,
      gender: registerForm.gender || undefined,
      age: registerForm.age ? parseInt(registerForm.age) : undefined,
      address: registerForm.address || undefined,
      phone: registerForm.phone || undefined,
      email: registerForm.email || undefined,
      id_type: registerForm.id_type || undefined,
      id_card: registerForm.id_card || undefined,
    })
    
    await authStore.login({
      user_id: registerForm.user_id,
      password: registerForm.password,
      business_info: 'web_register',
    })
    
    await authStore.getUserInfo()
    await authStore.getUserBalance()
    
    showToast('注册成功，正在跳转...', 'success')
    setTimeout(() => {
      router.push('/dashboard')
    }, 1000)
  } catch (error: any) {
    let errorMessage = '注册失败，请检查服务器配置'
    if (error.message) {
      if (error.message.includes('Network Error') || error.message.includes('ERR_FAILED')) {
        errorMessage = '无法连接到服务器，请检查服务器配置'
      } else if (error.message.includes('ERR_CONNECTION_REFUSED')) {
        errorMessage = '连接被拒绝，请检查服务器IP和端口'
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
        <div class="flex items-center gap-4 mb-6">
          <button
            @click="goBack"
            class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft class="w-5 h-5 text-gray-600" />
          </button>
          <div class="flex-1 text-center">
            <div class="w-14 h-14 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
              <UserPlus class="w-7 h-7 text-white" />
            </div>
            <h1 class="text-2xl font-bold text-gray-800">用户注册</h1>
            <p class="text-gray-500 mt-1">创建您的新账户</p>
          </div>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label class="label">用户名 <span class="text-danger-600">*</span></label>
            <div class="relative">
              <User class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="registerForm.user_id"
                type="text"
                class="input-field pl-12"
                placeholder="请输入用户名"
                autocomplete="off"
              />
            </div>
          </div>

          <div>
            <label class="label">密码 <span class="text-danger-600">*</span></label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="registerForm.password"
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

          <div>
            <label class="label">确认密码 <span class="text-danger-600">*</span></label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="registerForm.confirmPassword"
                :type="showConfirmPassword ? 'text' : 'password'"
                class="input-field pl-12 pr-12"
                placeholder="请再次输入密码"
              />
              <button
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <EyeOff v-if="showConfirmPassword" class="w-5 h-5" />
                <Eye v-else class="w-5 h-5" />
              </button>
            </div>
          </div>

          <div class="pt-2 border-t border-gray-100">
            <p class="text-sm text-gray-500 mb-3">以下为选填信息</p>
          </div>

          <div>
            <label class="label">姓名</label>
            <input
              v-model="registerForm.name"
              type="text"
              class="input-field"
              placeholder="请输入姓名"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">性别</label>
              <select v-model="registerForm.gender" class="input-field">
                <option v-for="gender in genders" :key="gender.value" :value="gender.value">
                  {{ gender.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="label">年龄</label>
              <input
                v-model="registerForm.age"
                type="number"
                class="input-field"
                placeholder="请输入年龄"
              />
            </div>
          </div>

          <div>
            <label class="label">手机号</label>
            <div class="relative">
              <Phone class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="registerForm.phone"
                type="tel"
                class="input-field pl-12"
                placeholder="请输入手机号"
              />
            </div>
          </div>

          <div>
            <label class="label">邮箱</label>
            <div class="relative">
              <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="registerForm.email"
                type="email"
                class="input-field pl-12"
                placeholder="请输入邮箱"
              />
            </div>
          </div>

          <div>
            <label class="label">地址</label>
            <div class="relative">
              <MapPin class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                v-model="registerForm.address"
                type="text"
                class="input-field pl-12"
                placeholder="请输入地址"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">证件类型</label>
              <select v-model="registerForm.id_type" class="input-field">
                <option v-for="type in idTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="label">证件号码</label>
              <input
                v-model="registerForm.id_card"
                type="text"
                class="input-field"
                placeholder="请输入证件号码"
              />
            </div>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full btn-primary py-3 text-lg flex items-center justify-center gap-2"
          >
            <UserPlus class="w-5 h-5" />
            <span v-if="loading">注册中...</span>
            <span v-else>注册</span>
          </button>
        </form>

        <p class="text-center text-gray-500 text-sm mt-6">
          已有账户？
          <button @click="goToLogin" class="text-primary-600 hover:text-primary-700 font-medium">
            去登录
          </button>
        </p>
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
  transform: translateX(100%);
}
</style>
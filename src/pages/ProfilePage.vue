<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { payGateApi } from '@/api/pay_gate'
import { ArrowLeft, User, Edit3, Save, Mail, Phone, MapPin, Calendar, CreditCard, RefreshCw } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const editing = ref(false)
const saving = ref(false)
const toast = reactive({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error' | 'warning',
})

const editForm = reactive({
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
  router.push('/dashboard')
}

const fillEditForm = () => {
  if (authStore.userInfo) {
    editForm.name = authStore.userInfo.name
    editForm.gender = authStore.userInfo.gender
    editForm.age = String(authStore.userInfo.age)
    editForm.address = authStore.userInfo.address
    editForm.phone = authStore.userInfo.phone
    editForm.email = authStore.userInfo.email
    editForm.id_type = authStore.userInfo.id_type
    editForm.id_card = authStore.userInfo.id_card
  }
}

const startEdit = () => {
  fillEditForm()
  editing.value = true
}

const cancelEdit = () => {
  editing.value = false
}

const saveProfile = async () => {
  saving.value = true
  try {
    await payGateApi.updateUserInfo({
      user_id: authStore.userId || undefined,
      name: editForm.name || undefined,
      gender: editForm.gender || undefined,
      age: editForm.age ? parseInt(editForm.age) : undefined,
      address: editForm.address || undefined,
      phone: editForm.phone || undefined,
      email: editForm.email || undefined,
      id_type: editForm.id_type || undefined,
      id_card: editForm.id_card || undefined,
    })
    
    await authStore.getUserInfo()
    showToast('资料更新成功', 'success')
    editing.value = false
  } catch (error) {
    showToast('更新失败', 'error')
  } finally {
    saving.value = false
  }
}

const refreshData = async () => {
  loading.value = true
  try {
    await authStore.getUserInfo()
  } catch (error) {
    showToast('刷新失败', 'error')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    await authStore.getUserInfo()
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen p-6">
    <div class="max-w-2xl mx-auto">
      <header class="flex items-center justify-between mb-6 animate-fade-in">
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="p-2 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>
          <h1 class="text-2xl font-bold text-white">个人资料</h1>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="refreshData"
            :disabled="loading"
            class="p-2 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            <RefreshCw :class="['w-5 h-5', loading ? 'animate-spin' : '']" />
          </button>
          <button
            v-if="!editing"
            @click="startEdit"
            class="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <Edit3 class="w-4 h-4" />
            编辑资料
          </button>
        </div>
      </header>

      <div v-if="loading" class="card p-8 text-center">
        <RefreshCw class="w-8 h-8 text-primary-600 animate-spin mx-auto" />
        <p class="text-gray-500 mt-4">加载中...</p>
      </div>

      <div v-else class="card p-6 animate-slide-up">
        <div class="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div class="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-lg">
            <User class="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-800">
              {{ editing ? editForm.name : authStore.userInfo?.name }}
            </h2>
            <p class="text-gray-500 mt-1">用户ID: {{ authStore.userId }}</p>
          </div>
        </div>

        <div v-if="!editing" class="space-y-4">
          <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Mail class="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p class="text-sm text-gray-500">邮箱</p>
              <p class="font-medium text-gray-800">{{ authStore.userInfo?.email || '-' }}</p>
            </div>
          </div>

          <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Phone class="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p class="text-sm text-gray-500">手机号</p>
              <p class="font-medium text-gray-800">{{ authStore.userInfo?.phone || '-' }}</p>
            </div>
          </div>

          <div class="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <MapPin class="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p class="text-sm text-gray-500">地址</p>
              <p class="font-medium text-gray-800">{{ authStore.userInfo?.address || '-' }}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 bg-gray-50 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <Calendar class="w-4 h-4 text-gray-400" />
                <p class="text-sm text-gray-500">年龄</p>
              </div>
              <p class="font-medium text-gray-800">{{ authStore.userInfo?.age || '-' }}</p>
            </div>

            <div class="p-4 bg-gray-50 rounded-lg">
              <div class="flex items-center gap-2 mb-2">
                <User class="w-4 h-4 text-gray-400" />
                <p class="text-sm text-gray-500">性别</p>
              </div>
              <p class="font-medium text-gray-800">
                {{ genders.find(g => g.value === authStore.userInfo?.gender)?.label || '-' }}
              </p>
            </div>
          </div>

          <div class="p-4 bg-gray-50 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <CreditCard class="w-4 h-4 text-gray-400" />
              <p class="text-sm text-gray-500">证件信息</p>
            </div>
            <div class="flex items-center justify-between">
              <p class="font-medium text-gray-800">
                {{ idTypes.find(t => t.value === authStore.userInfo?.id_type)?.label || '-' }}
              </p>
              <p class="text-gray-600">
                {{ authStore.userInfo?.id_card ? '******' + authStore.userInfo.id_card.slice(-4) : '-' }}
              </p>
            </div>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div>
            <label class="label">姓名</label>
            <input
              v-model="editForm.name"
              type="text"
              class="input-field"
              placeholder="请输入姓名"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">性别</label>
              <select v-model="editForm.gender" class="input-field">
                <option v-for="gender in genders" :key="gender.value" :value="gender.value">
                  {{ gender.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="label">年龄</label>
              <input
                v-model="editForm.age"
                type="number"
                class="input-field"
                placeholder="请输入年龄"
              />
            </div>
          </div>

          <div>
            <label class="label">手机号</label>
            <input
              v-model="editForm.phone"
              type="tel"
              class="input-field"
              placeholder="请输入手机号"
            />
          </div>

          <div>
            <label class="label">邮箱</label>
            <input
              v-model="editForm.email"
              type="email"
              class="input-field"
              placeholder="请输入邮箱"
            />
          </div>

          <div>
            <label class="label">地址</label>
            <textarea
              v-model="editForm.address"
              class="input-field resize-none"
              rows="3"
              placeholder="请输入地址"
            ></textarea>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">证件类型</label>
              <select v-model="editForm.id_type" class="input-field">
                <option v-for="type in idTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="label">证件号码</label>
              <input
                v-model="editForm.id_card"
                type="text"
                class="input-field"
                placeholder="请输入证件号码"
              />
            </div>
          </div>

          <div class="flex gap-3 pt-4 border-t border-gray-100">
            <button
              @click="cancelEdit"
              class="flex-1 btn-outline"
            >
              取消
            </button>
            <button
              @click="saveProfile"
              :disabled="saving"
              class="flex-1 btn-success flex items-center justify-center gap-2"
            >
              <Save class="w-4 h-4" />
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
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
  transform: translateX(100%);
}
</style>
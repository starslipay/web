<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import DebugPanel from '@/components/DebugPanel.vue'
import { AlertCircle } from 'lucide-vue-next'

const showExpiredModal = ref(false)

const handleAuthExpired = () => {
  showExpiredModal.value = true
}

const goToLogin = () => {
  window.location.href = '/login'
}

onMounted(() => {
  window.addEventListener('auth-expired', handleAuthExpired)
})

onUnmounted(() => {
  window.removeEventListener('auth-expired', handleAuthExpired)
})
</script>

<template>
  <RouterView />
  <DebugPanel />
  
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showExpiredModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center animate-bounce-in">
          <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle class="w-8 h-8 text-red-500" />
          </div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">登录已过期</h3>
          <p class="text-gray-500 mb-6">您的登录状态已失效，请重新登录</p>
          <button
            @click="goToLogin"
            class="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
          >
            确认
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes bounce-in {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-bounce-in {
  animation: bounce-in 0.4s ease-out;
}
</style>
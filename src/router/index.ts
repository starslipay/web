import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/pages/RegisterPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/pages/DashboardPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/transfer',
    name: 'transfer',
    component: () => import('@/pages/TransferPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/c2c-transfer',
    name: 'c2c-transfer',
    component: () => import('@/pages/C2CTransferPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/bank2c',
    name: 'bank2c',
    component: () => import('@/pages/Bank2CPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/c2bank',
    name: 'c2bank',
    component: () => import('@/pages/C2BankPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/pages/ProfilePage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/transactions',
    name: 'transactions',
    component: () => import('@/pages/TransactionsPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/c2c-bill',
    name: 'c2c-bill',
    component: () => import('@/pages/C2CBillPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/query-order',
    name: 'query-order',
    component: () => import('@/pages/QueryOrderPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/query-c2b-bill',
    name: 'query-c2b-bill',
    component: () => import('@/pages/QueryC2BBillPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/query-recharge-withdraw',
    name: 'query-recharge-withdraw',
    component: () => import('@/pages/QueryRechargeWithdrawPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/mall',
    name: 'mall',
    component: () => import('@/pages/MallPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/pay',
    name: 'pay',
    component: () => import('@/pages/PayPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/orders',
    name: 'orders',
    component: () => import('@/pages/OrdersPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/test',
    name: 'test',
    component: () => import('@/pages/TestPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/sql',
    name: 'sql',
    component: () => import('@/pages/SQLPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/pages/AdminPage.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, from, next) => {
  const { useAuthStore } = await import('@/stores/auth')
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
      next('/login')
    } else if (to.path === '/login' && authStore.isLoggedIn) {
      next('/')
    } else {
      next()
    }
})

export default router
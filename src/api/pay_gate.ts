import { api } from '@/utils/axios'
import type {
  HealthReq,
  HealthRsp,
  UpdateUserInfoReq,
  UpdateUserInfoRsp,
  RegUserReq,
  RegUserRsp,
  GetUserInfoReq,
  GetUserInfoRsp,
  GetUserBalanceInfoReq,
  GetUserBalanceInfoRsp,
  GetUserTokenReq,
  GetUserTokenRsp,
  GetUserFlowReq,
  GetUserFlowRsp,
  C2CTransferPreReq,
  C2CTransferPreRsp,
  C2CTransferDoReq,
  C2CTransferDoRsp,
  Bank2CPreReq,
  Bank2CPreRsp,
  Bank2CDoReq,
  Bank2CDoRsp,
} from './types'

export const payGateApi = {
  health: async (req?: HealthReq): Promise<HealthRsp> => {
    const response = await api.get('/api/pay_gate/health', { params: req })
    return response.data
  },

  regUser: async (req: RegUserReq): Promise<RegUserRsp> => {
    const response = await api.post('/api/pay_gate/reg_user', req)
    return response.data
  },

  getUserToken: async (req: GetUserTokenReq): Promise<GetUserTokenRsp> => {
    const response = await api.post('/api/pay_gate/get_user_token', req)
    return response.data
  },

  updateUserInfo: async (req: UpdateUserInfoReq): Promise<UpdateUserInfoRsp> => {
    const response = await api.post('/api/pay_gate/update_user_info', req)
    return response.data
  },

  getUserInfo: async (req: GetUserInfoReq): Promise<GetUserInfoRsp> => {
    const response = await api.post('/api/pay_gate/get_user_info', req)
    return response.data
  },

  getUserBalanceInfo: async (req: GetUserBalanceInfoReq): Promise<GetUserBalanceInfoRsp> => {
    const response = await api.post('/api/pay_gate/get_user_balance_info', req)
    return response.data
  },

  getUserFlow: async (req: GetUserFlowReq): Promise<GetUserFlowRsp> => {
    const response = await api.post('/api/pay_gate/get_user_flow', req)
    return response.data
  },

  c2cTransferPre: async (req: C2CTransferPreReq): Promise<C2CTransferPreRsp> => {
    const response = await api.post('/api/pay_gate/c2c_transfer_pre', req)
    return response.data
  },

  c2cTransferDo: async (req: C2CTransferDoReq): Promise<C2CTransferDoRsp> => {
    const response = await api.post('/api/pay_gate/c2c_transfer_do', req)
    return response.data
  },

  bank2cPre: async (req: Bank2CPreReq): Promise<Bank2CPreRsp> => {
    const response = await api.post('/api/pay_gate/bank2c_pre', req)
    return response.data
  },

  bank2cDo: async (req: Bank2CDoReq): Promise<Bank2CDoRsp> => {
    const response = await api.post('/api/pay_gate/bank2c_do', req)
    return response.data
  },
}
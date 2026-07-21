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
    return api.get('/api/pay_gate/health', { params: req }) as unknown as HealthRsp
  },

  regUser: async (req: RegUserReq): Promise<RegUserRsp> => {
    return api.post('/api/pay_gate/reg_user', req) as unknown as RegUserRsp
  },

  getUserToken: async (req: GetUserTokenReq): Promise<GetUserTokenRsp> => {
    return api.post('/api/pay_gate/get_user_token', req) as unknown as GetUserTokenRsp
  },

  updateUserInfo: async (req: UpdateUserInfoReq): Promise<UpdateUserInfoRsp> => {
    return api.post('/api/pay_gate/update_user_info', req) as unknown as UpdateUserInfoRsp
  },

  getUserInfo: async (req: GetUserInfoReq): Promise<GetUserInfoRsp> => {
    return api.post('/api/pay_gate/get_user_info', req) as unknown as GetUserInfoRsp
  },

  getUserBalanceInfo: async (req: GetUserBalanceInfoReq): Promise<GetUserBalanceInfoRsp> => {
    return api.post('/api/pay_gate/get_user_balance_info', req) as unknown as GetUserBalanceInfoRsp
  },

  getUserFlow: async (req: GetUserFlowReq): Promise<GetUserFlowRsp> => {
    return api.post('/api/pay_gate/get_user_flow', req) as unknown as GetUserFlowRsp
  },

  c2cTransferPre: async (req: C2CTransferPreReq): Promise<C2CTransferPreRsp> => {
    return api.post('/api/pay_gate/c2c_transfer_pre', req) as unknown as C2CTransferPreRsp
  },

  c2cTransferDo: async (req: C2CTransferDoReq): Promise<C2CTransferDoRsp> => {
    return api.post('/api/pay_gate/c2c_transfer_do', req) as unknown as C2CTransferDoRsp
  },

  bank2cPre: async (req: Bank2CPreReq): Promise<Bank2CPreRsp> => {
    return api.post('/api/pay_gate/bank2c_pre', req) as unknown as Bank2CPreRsp
  },

  bank2cDo: async (req: Bank2CDoReq): Promise<Bank2CDoRsp> => {
    return api.post('/api/pay_gate/bank2c_do', req) as unknown as Bank2CDoRsp
  },
}
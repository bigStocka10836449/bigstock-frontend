import axios from 'axios'

const webApi = axios.create({
  baseURL: import.meta.env.VITE_WEB_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export type WebRegisterRequest<T extends object> = T & {
  turnstileToken: string
}

export interface DeviceRegisterResponse {
  message: string
}

export async function registerWebDevice<T extends object>(
  fcmRequest: T,
  turnstileToken: string,
): Promise<DeviceRegisterResponse> {
  if (!turnstileToken) {
    throw new Error('TURNSTILE_TOKEN_REQUIRED')
  }

  const request: WebRegisterRequest<T> = {
    ...fcmRequest,
    turnstileToken,
  }

  const response = await webApi.post<DeviceRegisterResponse>('/device/web/register', request)

  return response.data
}

import client from './client'

// baseURL = /api，所以 /v2/users/... → /api/v2/users/... → FastAPI
export const usersApi = {
  getMe() {
    return client.get('/v2/users/me')
  },

  uploadAvatar(file, onProgress) {
    const form = new FormData()
    form.append('avatar', file)
    return client.post('/v2/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (e) => { if (e.total) onProgress(Math.round((e.loaded / e.total) * 100)) }
        : undefined,
    })
  },

  deleteAvatar() {
    return client.delete('/v2/users/me/avatar')
  },
}

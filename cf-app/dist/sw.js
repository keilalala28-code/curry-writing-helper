const CACHE_NAME = 'curry-assistant-v2'

// 安装时缓存核心静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/', '/manifest.json', '/icon-192.svg', '/icon-512.svg'])
    )
  )
  self.skipWaiting()
})

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// 网络优先，失败时回退缓存（API 请求不缓存）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // API 请求直接透传，不做缓存
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // 缓存成功的 GET 响应
        if (event.request.method === 'GET' && res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return res
      })
      .catch(() => caches.match(event.request))
  )
})

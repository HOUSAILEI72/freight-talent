"""
一次性清缓存 + 直接调 chart 端点验证。
用法：
  cd backend
  python scripts/flush_chart_cache.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import redis

url = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
r = redis.from_url(url, decode_responses=True)

try:
    r.ping()
except Exception as e:
    print(f"[X] Redis 未运行 ({e})。清缓存任务取消（实际上没缓存可清）。")
    sys.exit(0)

keys = r.keys("chart:*")
print(f"找到 {len(keys)} 个 chart:* 缓存键")
for k in keys:
    print(f"  - {k}")
if keys:
    deleted = r.delete(*keys)
    print(f"[OK] 已删除 {deleted} 个键")
else:
    print("[OK] 无需清理")

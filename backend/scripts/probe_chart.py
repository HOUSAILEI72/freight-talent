"""
直接 HTTP 调 chart 端点，看返回什么。
需要传 admin token：
  python scripts/probe_chart.py <ADMIN_TOKEN>

获取 token：
  从浏览器 DevTools → Application → Local Storage → 'token' 复制粘贴
"""
import sys
import json
import urllib.request

if len(sys.argv) < 2:
    print("用法: python scripts/probe_chart.py <TOKEN>")
    print("token 在浏览器 localStorage['token']")
    sys.exit(1)

token = sys.argv[1].strip()

for path in [
    "/api/v2/candidates/chart?granularity=month&periods=12&refresh=true",
    "/api/v2/jobs/chart?granularity=month&periods=12&refresh=true",
]:
    url = "http://127.0.0.1:8000" + path
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        print(f"\n=== {path} ===")
        print(f"total: {body.get('total')}")
        print(f"data ({len(body.get('data', []))} 个 period):")
        for p in body.get("data", []):
            mark = "  <<" if p["count"] > 0 else ""
            print(f"  {p['period']}  count={p['count']}{mark}")
        print(f"granularity: {body.get('granularity')}")
        print(f"tag_groups: {body.get('tag_groups')}")
    except Exception as e:
        print(f"\n=== {path} ===")
        print(f"[X] 失败: {e}")
        if hasattr(e, "read"):
            print(e.read().decode("utf-8", "replace"))

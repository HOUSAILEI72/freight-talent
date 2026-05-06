"""
FastAPI 本地开发启动入口。

用法：
  cd backend
  ../.venv/Scripts/activate
  python fastapi_run.py

或使用 uvicorn 直接启动（支持 --reload）：
  uvicorn fastapi_app.main:app --host 127.0.0.1 --port 8000 --reload
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "fastapi_app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
    )

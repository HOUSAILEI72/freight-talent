"""
统一日志配置 — Flask + FastAPI 共用

环境变量：
  LOG_LEVEL          默认 INFO，可选 DEBUG/INFO/WARNING/ERROR/CRITICAL
  LOG_DIR            默认 backend/logs
  LOG_TO_FILE        默认 true；false 时只输出到 stdout
  LOG_MAX_BYTES      单文件大小，默认 10MB
  LOG_BACKUP_COUNT   滚动文件数量，默认 5
"""
import os
import sys
import logging
import logging.handlers
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent.parent  # backend/

_FORMAT = "%(asctime)s [%(levelname)-7s] [%(name)s] %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

_configured = False


def setup_logging(service_name: str = "app") -> logging.Logger:
    """初始化日志系统。幂等：重复调用只生效一次。"""
    global _configured

    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    if _configured:
        return logging.getLogger(service_name)

    formatter = logging.Formatter(_FORMAT, datefmt=_DATE_FORMAT)

    root = logging.getLogger()
    root.setLevel(level)
    for h in list(root.handlers):
        root.removeHandler(h)

    # 控制台
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    root.addHandler(console)

    # 滚动文件
    if os.getenv("LOG_TO_FILE", "true").lower() != "false":
        log_dir = Path(os.getenv("LOG_DIR", str(_BACKEND_DIR / "logs")))
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / f"{service_name}.log"
        err_file = log_dir / f"{service_name}.error.log"
        max_bytes = int(os.getenv("LOG_MAX_BYTES", str(10 * 1024 * 1024)))
        backup_count = int(os.getenv("LOG_BACKUP_COUNT", "5"))

        # 全量日志
        full = logging.handlers.RotatingFileHandler(
            log_file, maxBytes=max_bytes, backupCount=backup_count, encoding="utf-8"
        )
        full.setFormatter(formatter)
        root.addHandler(full)

        # 仅 ERROR 及以上单独保存，便于排查
        err = logging.handlers.RotatingFileHandler(
            err_file, maxBytes=max_bytes, backupCount=backup_count, encoding="utf-8"
        )
        err.setLevel(logging.ERROR)
        err.setFormatter(formatter)
        root.addHandler(err)

    # 静默高频组件
    for noisy in ("urllib3", "PIL", "openpyxl", "passlib", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    _configured = True

    logger = logging.getLogger(service_name)
    logger.info("Logging initialized: level=%s, service=%s, log_dir=%s",
                level_name, service_name,
                os.getenv("LOG_DIR", str(_BACKEND_DIR / "logs")))
    return logger

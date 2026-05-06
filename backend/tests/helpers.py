"""
helpers.py — 测试辅助函数

_make_xlsx(headers, rows) 在内存中构建最小 .xlsx 文件，
不依赖任何文件系统。
"""
import io
import openpyxl


def make_xlsx(headers: list, rows: list[list]) -> bytes:
    """构建包含 headers 表头行和 rows 数据行的最小 .xlsx bytes。"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()

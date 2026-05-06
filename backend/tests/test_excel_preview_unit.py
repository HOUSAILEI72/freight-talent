"""
test_excel_preview_unit.py — 纯单元测试（不涉及数据库）

覆盖 excel_preview.py 的核心检测逻辑。
"""
import pytest
from tests.helpers import make_xlsx
from app.services.excel_preview import run_preview


# ===========================================================================
# _infer_cell_type 基础类型推断
# ===========================================================================

def test_infer_type_via_preview_number():
    """整列均为数字 → inferred_type == number"""
    xlsx = make_xlsx(["salary"], [[10000], [20000], [30000]])
    result = run_preview(xlsx, "job", set())
    assert result.inferred_types["salary"] == "number"


def test_infer_type_via_preview_text():
    """整列均为文本 → inferred_type == text"""
    xlsx = make_xlsx(["title"], [["后勤专员"], ["销售经理"]])
    result = run_preview(xlsx, "job", set())
    assert result.inferred_types["title"] == "text"


def test_infer_type_conflict_detected():
    """同一列混合 text 和 number → type_conflicts 中有该列"""
    xlsx = make_xlsx(["mixed"], [["hello"], [123], ["world"]])
    result = run_preview(xlsx, "job", set())
    assert "mixed" in result.type_conflicts
    assert "text" in result.type_conflicts["mixed"]
    assert "number" in result.type_conflicts["mixed"]


# ===========================================================================
# 完全重复行检测
# ===========================================================================

def test_duplicate_row_detected():
    """两行完全相同 → dup_rows == 1，第二行状态 duplicate"""
    xlsx = make_xlsx(
        ["title", "city"],
        [["物流专员", "上海"], ["物流专员", "上海"]],
    )
    result = run_preview(xlsx, "job", set())
    assert result.dup_rows == 1
    dup_statuses = [r["row_status"] for r in result.row_results]
    assert "duplicate" in dup_statuses


def test_no_false_positive_duplicate():
    """两行不同 → dup_rows == 0"""
    xlsx = make_xlsx(
        ["title", "city"],
        [["物流专员", "上海"], ["物流专员", "北京"]],
    )
    result = run_preview(xlsx, "job", set())
    assert result.dup_rows == 0


# ===========================================================================
# 纯文本全局重复检测（≥8 字符）
# ===========================================================================

def test_text_global_dup_detected():
    """同一长文本在两行重复出现 → text_global_duplicate issue"""
    long_text = "这是一段超过八个字的重复简介"
    xlsx = make_xlsx(
        ["title", "description"],
        [["岗位A", long_text], ["岗位B", long_text]],
    )
    result = run_preview(xlsx, "job", set())
    all_issues = [i for r in result.row_results for i in r["issues"]]
    dup_issues = [i for i in all_issues if i["issue_type"] == "text_global_duplicate"]
    assert len(dup_issues) >= 2   # 两行各标注一次


def test_short_text_no_dup_warning():
    """短文本（<8 字符）重复不触发 text_global_duplicate"""
    xlsx = make_xlsx(
        ["city"],
        [["上海"], ["上海"], ["上海"]],
    )
    result = run_preview(xlsx, "job", set())
    all_issues = [i for r in result.row_results for i in r["issues"]]
    assert not any(i["issue_type"] == "text_global_duplicate" for i in all_issues)


# ===========================================================================
# 重复列名检测
# ===========================================================================

def test_duplicate_header_error_emitted():
    """两列同名 → errors 中含 duplicate_header，synthetic key 不进 new_fields"""
    xlsx = make_xlsx(
        ["title", "city", "title"],   # title 重复
        [["物流专员", "上海", "备用标题"]],
    )
    result = run_preview(xlsx, "job", set())

    dup_errors = [e for e in result.errors if e["issue_type"] == "duplicate_header"]
    assert len(dup_errors) == 1
    assert dup_errors[0]["field"] == "title"
    assert dup_errors[0]["col_index"] == 3   # 1-based，第三列

    # synthetic key title__2 不应出现在 new_fields
    new_field_keys = {nf["field_key"] for nf in result.new_fields}
    assert "title_2" not in new_field_keys
    assert "title__2" not in new_field_keys


def test_duplicate_header_raw_data_preserved():
    """重复列的数据仍在 raw_data 中（以 title__2 键保存，不被覆盖）"""
    xlsx = make_xlsx(
        ["title", "city", "title"],
        [["主标题", "上海", "副标题"]],
    )
    result = run_preview(xlsx, "job", set())
    assert result.total_rows == 1
    raw = result.row_results[0]["raw_data"]
    assert raw.get("title") == "主标题"
    assert raw.get("title__2") == "副标题"


# ===========================================================================
# 任意列名均被接受（不做模板匹配校验）
# ===========================================================================

def test_arbitrary_columns_no_warning():
    """上传任意列名的 Excel（不含任何已知字段）→ 无 template_mismatch 警告"""
    xlsx = make_xlsx(
        ["col_a", "col_b"],
        [["x", "y"]],
    )
    result = run_preview(xlsx, "job", set())
    warn_types = [w["issue_type"] for w in result.warnings]
    assert "template_mismatch" not in warn_types


def test_single_generic_column_no_warning():
    """仅含一个已知字段时也不发出警告"""
    xlsx = make_xlsx(
        ["city", "random_field_xyz"],
        [["上海", "数据"]],
    )
    result = run_preview(xlsx, "job", set())
    warn_types = [w["issue_type"] for w in result.warnings]
    assert "template_mismatch" not in warn_types


def test_chinese_column_headers_accepted():
    """中文列名应通过别名映射正常处理，无警告"""
    xlsx = make_xlsx(
        ["职位名称", "城市", "业务类型"],
        [["物流专员", "上海", "空运"]],
    )
    result = run_preview(xlsx, "job", set())
    warn_types = [w["issue_type"] for w in result.warnings]
    assert "template_mismatch" not in warn_types
    assert result.total_rows == 1


# ===========================================================================
# 新字段识别
# ===========================================================================

def test_new_field_registered_when_not_known():
    """列头不在 known_field_keys 中 → 出现在 new_fields"""
    xlsx = make_xlsx(
        ["title", "city", "my_custom_field"],
        [["物流专员", "上海", "自定义值"]],
    )
    known = {"title", "city"}
    result = run_preview(xlsx, "job", known)
    new_fks = {nf["field_key"] for nf in result.new_fields}
    assert "my_custom_field" in new_fks
    assert "title" not in new_fks
    assert "city" not in new_fks


def test_new_field_dedup_same_key():
    """两个不同列头规范化后产生相同 field_key → new_fields 中只出现一次"""
    xlsx = make_xlsx(
        ["My Field", "my_field"],   # 都 → my_field
        [["A", "B"]],
    )
    result = run_preview(xlsx, "job", set())
    fk_counts = {}
    for nf in result.new_fields:
        fk_counts[nf["field_key"]] = fk_counts.get(nf["field_key"], 0) + 1
    assert fk_counts.get("my_field", 0) == 1


# ===========================================================================
# 文件解析失败
# ===========================================================================

def test_corrupt_file_returns_parse_error():
    """非法字节流 → errors 中含 file_parse_error，不抛异常"""
    result = run_preview(b"not an excel file at all", "job", set())
    err_types = [e["issue_type"] for e in result.errors]
    assert "file_parse_error" in err_types


def test_empty_file_returns_parse_error():
    """空字节 → file_parse_error"""
    result = run_preview(b"", "job", set())
    err_types = [e["issue_type"] for e in result.errors]
    assert "file_parse_error" in err_types

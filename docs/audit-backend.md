# ACE-Talent 后端全量审计

**路径：** `/Users/edy/Desktop/货代招聘/backend/`
**技术栈：** Python 3.11, Flask 3.1.0 + FastAPI 0.115.6, SQLAlchemy, MySQL 8, Redis 7
**审计日期：** 2026-05-09

---

## 1. 模型层 — 10 个文件，14 张表

### 1.1 `models/user.py` — users 表（9 列）

| 列名 | 类型 | 约束 |
|---|---|---|
| id | Integer | PK |
| email | String(120) | Unique, Index, NOT NULL |
| password_hash | String(128) | NOT NULL |
| role | String(20) | NOT NULL, employer/candidate/admin |
| name | String(60) | NOT NULL |
| company_name | String(100) | Nullable |
| is_active | Boolean | NOT NULL, default True |
| created_at | DateTime | default utcnow |
| last_login | DateTime | Nullable |

方法：`set_password()`, `check_password()`, `to_dict()`

### 1.2 `models/candidate.py` — candidates 表（38 列）

**核心字段：** id, user_id (FK→users, unique, indexed)

**基本信息：** full_name, current_title, current_company, current_city, expected_city, expected_salary_min, expected_salary_max, expected_salary_label

**人口统计：** experience_years, age, education, english_level, summary

**结构化经历：** work_experiences (JSON), education_experiences (JSON), certificates (JSON)

**行业分类：** business_type, job_type, route_tags (JSON), skill_tags (JSON)

**求职状态：** availability_status (ENUM: open/passive/closed)

**联系方式：** email, phone, address, contact_visible (Boolean)

**Phase C 地理编码：** location_code (indexed), location_name, location_path, location_type, business_area_code (indexed), business_area_name

**CAND-2A 能力画像：** current_responsibilities, function_code (indexed), function_name, is_management_role, knowledge_tags (JSON), hard_skill_tags (JSON), soft_skill_tags (JSON)

**当前薪酬：** current_salary_min, current_salary_max, current_salary_months, current_average_bonus_percent, current_has_year_end_bonus, current_year_end_bonus_months

**服务端计算：** profile_status (indexed), profile_completed_at

**简历：** resume_file_path, resume_file_name, resume_uploaded_at

**时间戳：** profile_confirmed_at, last_active_at, created_at, updated_at

**隐私模型（CAND-5）：** `to_dict(include_contact=False, include_private=False)` — 14 项隐私字段仅在存在 accepted invitation 或 active application 时对 employer 可见。contact 字段额外需要 `include_contact=True`。

### 1.3 `models/job.py` — jobs 表（47 列）

**核心：** id, company_id (FK→users, indexed)

**基础：** title, city, salary_min, salary_max, salary_label, experience_required, degree_required, headcount, description (Text, NOT NULL), requirements (Text)

**行业：** business_type, job_type, route_tags (JSON), skill_tags (JSON), urgency_level

**Phase C 地理：** province (indexed), city_name (indexed), district (indexed), location_code, location_name, location_path, location_type, address, business_area_code, business_area_name

**Phase C 职能：** function_code, function_name, is_management_role, management_headcount

**技能需求：** knowledge_requirements (JSON), hard_skill_requirements (JSON), soft_skill_requirements (JSON)

**薪资结构：** salary_months, average_bonus_percent, has_year_end_bonus, year_end_bonus_months

**状态：** status (ENUM: draft/published/paused/closed)

**时间戳：** created_at, updated_at

### 1.4 `models/match_result.py` — match_results 表（9 列）

| 列名 | 类型 |
|---|---|
| id | PK |
| job_id | FK→jobs, CASCADE, indexed |
| candidate_id | FK→candidates, CASCADE, indexed |
| score | Integer, 0-100 |
| matched_tags | JSON |
| score_breakdown | JSON |
| reason_list | JSON |
| created_at / updated_at | DateTime |

唯一约束：`(job_id, candidate_id)`

### 1.5 `models/invitation.py` — invitations 表（8 列）

| 列名 | 类型 |
|---|---|
| id | PK |
| job_id | FK→jobs, CASCADE |
| candidate_id | FK→candidates, CASCADE |
| employer_id | FK→users, CASCADE |
| message | Text, Nullable |
| status | ENUM: pending/accepted/declined |
| created_at / updated_at | DateTime |

去重唯一约束已由迁移 0002 删除。declined 状态允许重发，去重逻辑在路由层。

### 1.6 `models/conversation.py` — 2 张表

**conversation_threads（7 列）：** id, invitation_id (FK→invitations, UNIQUE), job_id, candidate_id, employer_id, created_at, updated_at

**messages（7 列）：** id, thread_id (FK→threads, CASCADE, indexed), sender_user_id, sender_role, content (Text), is_read (Boolean), created_at

### 1.7 `models/job_application.py` — job_applications 表（8 列）

| 列名 | 类型 |
|---|---|
| id | PK |
| job_id / candidate_id / employer_id | FK |
| status | ENUM: saved/submitted/viewed/shortlisted/rejected/withdrawn |
| message | Text |
| created_at / updated_at | DateTime |

唯一约束：`(job_id, candidate_id)`

### 1.8 `models/tag.py` — 2 张表（FastAPI 管理，Flask 只读）

**tags（7 列）：** id, category (String 64), name (String 128), status (ENUM: pending/active/disabled), created_by, created_at, updated_at。唯一约束：(category, name)

**tag_notes（6 列）：** id, tag_id (FK), user_id (FK), description (Text), status (ENUM), created_at, updated_at。唯一约束：(tag_id, user_id)

### 1.9 `models/junction_tags.py` — 2 张 M:N 关联表

**candidate_tags：** id, candidate_id (FK, indexed), tag_id (FK, indexed), created_at。唯一约束：(candidate_id, tag_id)

**job_tags：** id, job_id (FK, indexed), tag_id (FK, indexed), created_at。唯一约束：(job_id, tag_id)

### 1.10 `models/import_models.py` — 4 张表

**field_registry：** id, entity_type, field_key, label, field_type, is_filterable, visible_roles (JSON), tier_rule_json (JSON), status (ENUM), first_seen_batch_id, created_at, updated_at。唯一约束：(entity_type, field_key)

**import_batches：** id, uploaded_by (indexed), import_type, original_filename, file_hash (indexed), detected_columns (JSON), new_fields (JSON), detected_tags (JSON), error_summary (JSON), warning_summary (JSON), preview_stats (JSON), is_confirmed, annotated_file_path, status (ENUM: preview/confirmed/failed), created_at, updated_at

**import_batch_rows：** id, batch_id (FK, indexed), row_index, row_status, row_fingerprint (indexed), issues (JSON), raw_data (JSON), created_at

**import_batch_tags：** id, batch_id (FK, CASCADE, indexed), row_index, category, tag_name, is_new_cat, is_new_tag, created_at

---

## 2. 路由层 — 11 个 Blueprint

### 2.1 `routes/auth.py` — /api/auth（253 行）

| 方法 | 路径 | 鉴权 | 限流 | 说明 |
|---|---|---|---|---|
| POST | /auth/register | None | 10/h, 3/m | 邮箱+密码+验证码注册 |
| POST | /auth/send-code | None | 10/h, 3/m | 发送 6 位邮箱验证码 (Redis+SMTP) |
| POST | /auth/login | None | 20/h, 5/m | 登录，返回 JWT |
| GET | /auth/me | JWT | — | 当前用户信息 |
| POST | /auth/logout | JWT | — | 撤销 access+refresh token |
| POST | /auth/refresh | Refresh | — | 刷新令牌，返回新的 access+refresh |

CLI：`flask auth create-admin --email X --password Y --name Z`

### 2.2 `routes/jobs.py` — /api/jobs（622 行）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /jobs | employer/admin | 创建岗位，含 Phase C + CAND-2A 字段，同步 job_tags |
| GET | /jobs/public | JWT | 公开岗位列表，7 维筛选，facet 标签组 |
| GET | /jobs/area-filters | JWT | 按 business_area_code 计数 |
| GET | /jobs/my | employer/admin | 当前用户的岗位 |
| GET | /jobs/:id | JWT | 岗位详情，角色权限校验 |
| GET | /jobs/:id/match | employer/admin | 运行匹配引擎，upsert match_results，返回排序列表 |

### 2.3 `routes/candidates.py` — /api/candidates（897 行）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /candidates/me | candidate | 自己的完整档案 |
| PUT | /candidates/me | candidate | 创建/更新档案，sentinel 模式只更新传入字段 |
| POST | /candidates/me/confirm-latest | candidate | 刷新档案鲜度时间戳 |
| GET | /candidates | employer/admin | 候选人列表，8 维筛选，CAND-5 隐私解锁 |
| GET | /candidates/area-filters | employer/admin | 按 business_area_code 计数 |
| GET | /candidates/:id | employer/admin | 候选人详情，privacy gate |
| POST | /candidates/upload-resume | candidate | PDF/DOC/DOCX 上传 (≤10MB) |

### 2.4 `routes/invitations.py` — /api/invitations（281 行）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /invitations | employer/admin | 发起邀约，幂等（pending/accepted 返回已有的；declined 可重发），自动创建 ConversationThread，发邮件 |
| GET | /invitations/sent | employer/admin | 已发出邀约列表 |
| GET | /invitations/my | candidate/admin | 收到的邀约列表 |
| GET | /invitations/company-summary | employer/admin | 汇总统计 |
| PATCH | /invitations/:id/status | candidate/admin | 接受/婉拒，已回复不可改 |

### 2.5 `routes/applications.py` — 投递系统（354 行）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /jobs/:id/saved | candidate | 收藏岗位 |
| POST | /jobs/:id/applications | candidate | 投递（幂等：重新投递=saved/withdrawn→submitted） |
| GET | /applications/my | candidate | 我的投递列表 |
| GET | /applications/received | employer/admin | 收到的投递，可按 status 过滤 |
| PATCH | /applications/:id/status | JWT | 状态机：submitted→viewed→shortlisted↔rejected↔withdrawn |

### 2.6 `routes/admin.py` — /api/admin（136 行）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /admin/overview | admin | 运营总览：总计/7日新增/最近活动(合并排序)/每日趋势 |

### 2.7 `routes/admin_import.py` — /api/admin/import（917 行）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /import/preview | admin | 上传 Excel 预览（≤20MB, .xlsx only） |
| POST | /import/batches/:id/confirm | admin | 确认导入，支持 ?dry_run=true & ?skip_errors=true |
| GET | /import/batches | admin | 批次列表（分页 20/page） |
| GET | /import/batches/:id | admin | 批次详情，?include_rows=true |
| GET | /import/batches/:id/download | admin | 下载标注 Excel |
| GET | /import/fields | admin | 字段注册表 |
| PATCH | /import/fields/:id | admin | 更新字段注册 |
| GET | /import/template | admin | 下载 Excel 模板 |

### 2.8 `routes/conversations.py` — /api/conversations（299 行）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /conversations | JWT | 会话列表（3 查询优化，joinedload+子查询+GROUP BY） |
| GET | /conversations/:id/messages | JWT | 消息历史（游标分页 ?before=&limit=），首次加载标为已读 |
| POST | /conversations/:id/messages | JWT | 发送消息（≤2000 字），Socket.IO 实时广播 |

### 2.9 `routes/employer_dashboard.py` — /api/employer（325 行）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | /employer/dashboard-filters | employer | 可选职能/区域值列表 |
| GET | /employer/dashboard-chart | employer | 时序图数据（day/week/month/quarter/year 粒度） |

### 2.10 `routes/socket_events.py` — Socket.IO 事件（219 行）

| 事件 | 方向 | 说明 |
|---|---|---|
| connect | C→S | JWT 认证，加入 user_{id} 房间 |
| disconnect | C→S | 清理 sid→user 映射 |
| reauthenticate | C→S | 更新 token 不重连 |
| join_thread | C→S | 加入 thread_{id} 房间 |
| leave_thread | C→S | 离开 thread_{id} 房间 |
| typing | C→S | 广播输入提示（排除发送者） |
| mark_read | C→S | 标记已读，广播 messages_read |

### 2.11 Health 端点（在 `__init__.py` 中）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/health | Liveness（进程存活） |
| GET | /api/ready | Readiness（DB + Redis 状态） |

---

## 3. 服务层 — 4 个文件

### 3.1 `services/matching.py`（503 行）

**CAND-7B 双边匹配：**
- `compute_employer_fit(job, candidate) → dict` — 10 维雇主适配（满分100）：职能(10) + 地点(10) + 经验(12) + 学历证书(8) + 知识(15) + 硬技能(20) + 软技能(10) + 管理岗(5) + 鲜度(5) + 职责重叠(5)
- `compute_candidate_fit(job, candidate) → dict` — 10 维求职者适配（满分100）：薪资(25) + 月数(5) + 奖金(10) + 地点偏好(20) + 职能偏好(15) + 管理岗偏好(10) + JD质量(5) + 关系信号(10)
- `compute_final_match()` — 加权总分 = employer_fit × 0.65 + candidate_fit × 0.35
- `compute_legacy_match()` — CAND-7A 旧算法（保留用于测试）

### 3.2 `services/email_service.py`（163 行）

`send_invitation_email(candidate_email, company_name, jobs, site_url)` — SMTP HTML 邮件，含企业品牌/岗位列表/CTA 链接。受 `MAIL_ENABLED` 控制。

### 3.3 `services/excel_preview.py`（649 行）

`run_preview(file_bytes, import_type, known_field_keys) → PreviewResult` — 加载 workbook，解析表头（80+ 中文别名映射），类型推断，指纹去重。`generate_annotated_excel()` 生成颜色标注 Excel。

### 3.4 `services/import_taxonomy.py`（405 行）

`parse_excel()` — 分类法 Excel 解析。分离固定字段与自由列（→标签类别），多值拆分，工作/教育经历解析，最多 5000 行/20MB。

---

## 4. 迁移链 — 13 个版本

| Revision | 日期 | 内容 |
|---|---|---|
| 0001_baseline_schema | 2026-04-14 | 全量基线：users, jobs, candidates, match_results, invitations, conversation_threads, messages |
| fe77249f9144 | 2026-04-13 | NOOP（并入 0001） |
| 454b5c374e8a | 2026-04-13 | NOOP（并入 0001） |
| 0002 | 2026-04-14 | 删除 invitations 唯一约束，允许 declined 重发 |
| 0003 | 2026-04-22 | 导入基建：field_registry, import_batches, import_batch_rows |
| 0004 | 2026-04-27 | 标签系统：tags, tag_notes, system_settings；候选人加 email/phone/address/contact_visible |
| 0005 | 2026-04-27 | import_batches 加 detected_tags (JSON) |
| 0006 | 2026-04-27 | M:N 关联表：candidate_tags, job_tags |
| 0007 | 2026-04-27 | jobs 加 province/city_name/district；candidates 加 age/work_experiences/education_experiences/certificates；import_batch_tags |
| 0008 | 2026-04-29 | Phase C：双端加 location_*/business_area_*/function_*/is_management_role/技能需求数组/薪资结构 |
| 0009 | 2026-05-05 | CAND-2A：candidates 加 current_responsibilities/function_*/能力标签/current_salary_*/profile_status |
| 0010 | 2026-05-05 | CAND-4：job_applications 表 |
| 0011 | 2026-05-09 | jobs 加 address, management_headcount |
| 0012 | 2026-05-09 | job_application_status ENUM 加 "saved" 值 |

**已知问题：** MySQL `alembic_version.version_num` 需从 VARCHAR(32) 扩到 VARCHAR(64)。

---

## 5. 应用工厂 (`app/__init__.py`)

`create_app(config_class=None) → Flask`

**注册扩展（8 个）：** db, jwt (Redis blocklist + in-memory fallback), bcrypt, cors (CORS_ORIGINS), migrate, limiter (key=remote_addr), socketio (eventlet, Redis message_queue)

**注册 Blueprint（9 个）：** auth_bp, jobs_bp, candidates_bp, invitations_bp, applications_bp, admin_bp, conversations_bp, admin_import_bp, employer_dashboard_bp

**其他：** 请求日志中间件，Socket.IO 事件注册，health/ready 端点，SPA 静态文件服务

---

## 6. 配置 (`app/config.py`)

| 类别 | 关键配置 |
|---|---|
| 数据库 | MySQL via pymysql；pool_pre_ping=True, pool_recycle=1800s, pool_size=10, max_overflow=20 |
| JWT | JWT_SECRET_KEY (≥32 字符)，access 15min，refresh 7 天，Redis blocklist |
| CORS | CORS_ORIGINS (默认 localhost:5173) |
| Redis | REDIS_URL (可选；SocketIO/blocklist/limiter 用) |
| 限流 | RATELIMIT_STORAGE_URI (默认 memory://), swallow_errors=True |
| 上传 | UPLOAD_FOLDER, MAX_CONTENT_LENGTH=10MB, pdf/doc/docx |
| 邮件 | MAIL_ENABLED, MAIL_HOST (smtp.exmail.qq.com:465), SSL |
| 环境 | DevelopmentConfig (DEBUG=True) / ProductionConfig (强制 Redis) |

---

## 7. 入口文件

| 文件 | 用途 |
|---|---|
| `run.py` | 开发入口：eventlet monkey_patch → create_app() → socketio.run(5000) |
| `gunicorn.conf.py` | 生产：1 worker + eventlet + 1000 connections + 60s timeout |
| `fastapi_run.py` | FastAPI 开发入口：uvicorn --reload (8000) |

---

## 8. 工具模块 (`app/utils/`)

| 文件 | 行数 | 说明 |
|---|---|---|
| `candidate_privacy.py` | 93 | CAND-5 隐私解锁：accepted invitation OR active application → 可以看隐私字段。批量版本避免 N+1 |
| `business_area.py` | 319 | 服务端业务区域分类法，31 省→区域映射，29 海外国家。服务器权威计算 business_area |
| `candidate_profile.py` | 59 | 14 项档案完整度检查 |
| `request_logging.py` | 91 | 请求日志中间件：method/path/status/duration/user_id/IP |

---

## 9. 测试 — 10 个文件

| 文件 | 行数 | 类型 | 覆盖 |
|---|---|---|---|
| conftest.py | 104 | 夹具 | 真实 MySQL 测试库，session 级 app/client，function 级清理 |
| helpers.py | 21 | 工具 | `make_xlsx()` 生成测试用 Excel |
| test_core_flows.py | 209 | 集成 | 登录/健康/会话/匹配/Redis |
| test_matching_service.py | 475 | 单元 | 26 个测试，CAND-7A 旧算法 + CAND-7B 双边 |
| test_application_status.py | 354 | 集成 | CAND-4B 状态机全路径 |
| test_admin_import_integration.py | 253 | 集成 | 导入预览+确认 |
| test_confirm_import_integration.py | 170 | 集成 | 导入确认(dry_run/skip_errors/标签) |
| test_excel_preview_unit.py | 212 | 单元 | Excel 预览解析器 |
| test_fixes_integration.py | 199 | 集成 | 回归修复验证 |
| test_socket_integration.py | 224 | 集成 | Socket.IO 连接/房间/消息 |
| test_auth_send_code_smoke.py | 77 | 冒烟 | 验证码发送 |

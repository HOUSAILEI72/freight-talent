from app.extensions import db
from app.models.candidate import Candidate
from app.models.junction_tags import CandidateTag


def get_candidate_by_user_id(user_id: int) -> Candidate | None:
    return Candidate.query.filter_by(user_id=user_id).first()


def get_candidate_by_id(candidate_id: int) -> Candidate | None:
    return Candidate.query.filter_by(id=candidate_id).first()


def list_candidates_with_filters(
    avail_param: str = "open",
    city: str = "",
    business_type: str = "",
    job_type: str = "",
    function_code: str = "",
    business_area_code: str = "",
    location_code_filter: str = "",
    q: str = "",
    tag_ids_raw: str = "",
    tag_groups_raw: str = "",
    gender: str = "",
    page: int = 1,
    page_size: int = 20,
    pool_type: str = "all",
    employer_id: int | None = None,
    job_id: int | None = None,
) -> dict:
    query = Candidate.query

    if avail_param == "all":
        query = query.filter(Candidate.availability_status.in_(["open", "passive_now", "passive"]))
    elif avail_param in ("open", "passive_now", "passive"):
        query = query.filter(Candidate.availability_status == avail_param)
    else:
        query = query.filter(Candidate.availability_status == "open")

    if city:
        query = query.filter(
            db.or_(Candidate.current_city == city, Candidate.expected_city == city)
        )
    if business_type:
        query = query.filter(Candidate.business_type == business_type)
    if job_type:
        query = query.filter(Candidate.job_type == job_type)
    if function_code:
        query = query.filter(Candidate.function_code == function_code)
    if business_area_code:
        query = query.filter(Candidate.business_area_code == business_area_code)
    if location_code_filter:
        from app.utils.business_area import location_filter_clause
        clause = location_filter_clause(
            Candidate.location_code, Candidate.business_area_code, location_code_filter
        )
        if clause is not None:
            query = query.filter(clause)
    if q:
        like = f"%{q}%"
        query = query.filter(
            db.or_(
                Candidate.full_name.ilike(like),
                Candidate.current_title.ilike(like),
                Candidate.current_city.ilike(like),
                Candidate.location_name.ilike(like),
                Candidate.location_path.ilike(like),
            )
        )
    if gender:
        query = query.filter(Candidate.gender == gender)
    if pool_type == "applied" and employer_id:
        from app.models.job_application import JobApplication
        from app.models.job import Job
        sub = (
            db.session.query(JobApplication.candidate_id)
            .join(Job, Job.id == JobApplication.job_id)
            .filter(JobApplication.employer_id == employer_id)
        )
        if job_id:
            sub = sub.filter(JobApplication.job_id == job_id)
        applied_ids = sub.distinct()
        query = query.filter(Candidate.id.in_(applied_ids))
    elif pool_type == "favorited" and employer_id:
        from app.models.employer_candidate_favorite import EmployerCandidateFavorite
        fav_ids = (
            db.session.query(EmployerCandidateFavorite.candidate_id)
            .filter(EmployerCandidateFavorite.employer_id == employer_id)
            .distinct()
        )
        query = query.filter(Candidate.id.in_(fav_ids))
    elif pool_type in ("personal_headhunter", "team_headhunter", "entrusted"):
        # Not yet implemented: return empty
        query = query.filter(db.false())
    if tag_ids_raw:
        ids = [int(x) for x in tag_ids_raw.split(",") if x.strip().isdigit()]
        if ids:
            query = (
                query
                .join(CandidateTag, CandidateTag.candidate_id == Candidate.id)
                .filter(CandidateTag.tag_id.in_(ids))
                .distinct()
            )

    if tag_groups_raw:
        groups = []
        for seg in tag_groups_raw.split(";"):
            grp = [int(x) for x in seg.split(",") if x.strip().isdigit()]
            if grp:
                groups.append(grp)
        for grp in groups:
            sub = (
                db.session.query(CandidateTag.candidate_id)
                .filter(CandidateTag.candidate_id == Candidate.id,
                        CandidateTag.tag_id.in_(grp))
            )
            query = query.filter(sub.exists())

    total = query.count()
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    total_pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, total_pages)

    # MySQL 8 不支持 "ORDER BY ... DESC NULLS LAST" 语法。
    # 用 CASE WHEN 把 NULL 排到末尾，等价于 PostgreSQL 的 nullslast()。
    ordered = query.order_by(
        db.case((Candidate.profile_confirmed_at.is_(None), 0), else_=1).desc(),
        Candidate.profile_confirmed_at.desc(),
    )
    items = ordered.offset((page - 1) * page_size).limit(page_size).all()

    # 如果是 applied 模式，顺带查一次 application 记录，方便路由层注入状态
    application_map: dict[int, dict] = {}
    if pool_type == "applied" and employer_id and items:
        from app.models.job_application import JobApplication
        cand_ids = [c.id for c in items]
        app_q = (
            db.session.query(JobApplication)
            .filter(
                JobApplication.employer_id == employer_id,
                JobApplication.candidate_id.in_(cand_ids),
            )
        )
        if job_id:
            app_q = app_q.filter(JobApplication.job_id == job_id)
        for app in app_q.all():
            # 一个候选人可能投了多个岗位；job_id 指定时只有一条；
            # 未指定时取最新（by id desc）覆盖即可，调用方已知是 all-jobs 模式
            existing = application_map.get(app.candidate_id)
            if existing is None or app.id > existing["application_id"]:
                application_map[app.candidate_id] = {
                    "application_id": app.id,
                    "application_status": app.status,
                    "application_job_id": app.job_id,
                    "application_message": app.message,
                }

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "application_map": application_map,
    }


def count_candidates_by_business_area() -> list:
    return (
        db.session.query(Candidate.business_area_code, db.func.count(Candidate.id))
        .filter(Candidate.availability_status.in_(["open", "passive_now", "passive"]))
        .filter(Candidate.business_area_code.isnot(None))
        .group_by(Candidate.business_area_code)
        .all()
    )


def load_tags_by_category(candidate_ids: list) -> dict:
    """批量加载候选人的标签，按分类聚合。包括 pending（导入后未审批的也展示）。
    返回 {candidate_id: {category: [name, ...]}}
    """
    if not candidate_ids:
        return {}
    rows = db.session.execute(
        db.text("""
            SELECT ct.candidate_id, t.category, t.name
            FROM candidate_tags ct
            JOIN tags t ON t.id = ct.tag_id
            WHERE ct.candidate_id IN :ids
              AND t.status IN ('active', 'pending')
            ORDER BY t.category, t.name
        """).bindparams(db.bindparam("ids", expanding=True)),
        {"ids": candidate_ids},
    ).fetchall()
    out: dict = {}
    for r in rows:
        out.setdefault(r.candidate_id, {}).setdefault(r.category, []).append(r.name)
    return out


def sync_candidate_tags(candidate_id: int, tag_ids: list, now) -> None:
    db.session.execute(
        db.text("DELETE FROM candidate_tags WHERE candidate_id = :cid"),
        {"cid": candidate_id},
    )
    for tid in tag_ids:
        if not isinstance(tid, int):
            continue
        db.session.execute(
            db.text(
                "INSERT IGNORE INTO candidate_tags (candidate_id, tag_id, created_at)"
                " VALUES (:cid, :tid, :now)"
            ),
            {"cid": candidate_id, "tid": tid, "now": now},
        )

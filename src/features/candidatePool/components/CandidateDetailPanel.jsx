import { Lock, CheckCircle } from 'lucide-react'
import { FreshBadge, AvailBadge } from './FreshBadge'
import { LockedBadge, LockedSection } from './LockedBadge'
import { formatSalaryRange, formatYearEndBonus, formatWorkPeriod } from '../utils/candidateFormatters'

function SectionHeader({ terminal, mutedColor, titleColor, children }) {
  return (
    <p
      className={terminal ? 'font-mono text-[10px] uppercase tracking-widest mb-2' : 'text-sm font-semibold text-slate-800 mb-2'}
      style={terminal ? mutedColor : titleColor}
    >
      {children}
    </p>
  )
}

function TerminalTag({ children, colorStyle }) {
  return (
    <span
      className="font-mono text-[10px] px-2 py-0.5"
      style={{ background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-sm)', ...colorStyle }}
    >
      {children}
    </span>
  )
}

export function CandidateDetailPanel({ candidate, isInvited, terminal = false }) {
  const isPrivate    = !!candidate.private_visible
  const tagsByCat    = candidate.tags_by_category || {}
  const titleColor   = terminal ? { color: 'var(--t-text)' } : undefined
  const subColor     = terminal ? { color: 'var(--t-text-secondary)' } : undefined
  const mutedColor   = terminal ? { color: 'var(--t-text-muted)' } : undefined
  const accentColor  = terminal ? { color: 'var(--t-chart-blue)' } : undefined
  const sectionDivider = terminal ? { borderTop: '1px solid var(--t-border-subtle)', paddingTop: '12px' } : undefined

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={
            terminal
              ? 'w-12 h-12 rounded flex items-center justify-center font-mono font-bold text-base flex-shrink-0'
              : `w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 ${isInvited ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'}`
          }
          style={terminal ? { background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', color: isInvited ? 'var(--t-success)' : 'var(--t-text)' } : undefined}
        >
          {candidate.full_name?.[0] ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={terminal ? 'text-sm font-semibold' : 'text-lg font-bold text-slate-800'} style={titleColor}>
              {candidate.full_name}
            </h2>
            {terminal ? (
              <>
                <FreshBadge days={candidate.freshness_days} terminal />
                {isPrivate && candidate.availability_status && <AvailBadge status={candidate.availability_status} terminal />}
                {!isPrivate && <LockedBadge terminal />}
                {isInvited && <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--t-success)' }}>INVITED</span>}
              </>
            ) : (
              <>
                <FreshBadge days={candidate.freshness_days} />
                {isPrivate && candidate.availability_status && <AvailBadge status={candidate.availability_status} />}
                {!isPrivate && <LockedBadge />}
                {isInvited && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium">
                    <CheckCircle size={10} />邀约已发出
                  </span>
                )}
              </>
            )}
          </div>
          {(candidate.current_title || (isPrivate && candidate.current_company)) && (
            <p className={terminal ? 'text-xs mt-0.5' : 'text-sm text-slate-500 mt-0.5'} style={subColor}>
              {candidate.current_title}{isPrivate && candidate.current_company ? ` · ${candidate.current_company}` : ''}
            </p>
          )}
          {candidate.expected_salary_label && (
            <p className={terminal ? 'text-sm font-semibold mt-1' : 'text-base font-bold text-blue-600 mt-1'} style={terminal ? accentColor : undefined}>
              {candidate.expected_salary_label}
            </p>
          )}
        </div>
      </div>

      {/* 基本信息格 */}
      <div className={terminal ? 'grid grid-cols-2 gap-px' : 'grid grid-cols-2 gap-3'} style={terminal ? { background: 'var(--t-border-subtle)' } : undefined}>
        {[
          { label: 'EXP',    value: isPrivate ? (candidate.experience_years != null ? `${candidate.experience_years} 年` : '—') : null, locked: !isPrivate },
          { label: 'EDU',    value: isPrivate ? (candidate.education ?? '—') : null, locked: !isPrivate },
          { label: 'AGE',    value: isPrivate ? (candidate.age != null ? `${candidate.age} 岁` : '—') : null, locked: !isPrivate },
          { label: 'GENDER', value: isPrivate ? (candidate.gender === 'male' ? '男' : candidate.gender === 'female' ? '女' : '—') : null, locked: !isPrivate },
          { label: 'CITY',   value: candidate.expected_city || candidate.location_name || candidate.business_area_name || '不限', locked: false },
        ].map(item => (
          terminal ? (
            <div key={item.label} className="px-3 py-2" style={{ background: 'var(--t-bg-panel)' }}>
              <p className="font-mono text-xs uppercase tracking-widest mb-0.5" style={mutedColor}>{item.label}</p>
              {item.locked
                ? <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: 'var(--t-text-muted)' }}><Lock size={9} />LOCKED</span>
                : <p className="text-sm" style={item.value == null ? { color: 'var(--t-text-muted)' } : subColor}>{item.value ?? '—'}</p>
              }
            </div>
          ) : (
            <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-slate-400 mb-1">{item.label}</p>
              {item.locked
                ? <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Lock size={9} />订阅后可见</span>
                : <p className="text-sm font-semibold text-slate-700">{item.value}</p>
              }
            </div>
          )
        ))}
      </div>

      {/* 能力画像 */}
      {(candidate.function_name || candidate.is_management_role != null
        || (candidate.knowledge_tags?.length ?? 0) > 0
        || (candidate.hard_skill_tags?.length ?? 0) > 0
        || (candidate.soft_skill_tags?.length ?? 0) > 0) && (
        <div style={sectionDivider}>
          <SectionHeader terminal={terminal} mutedColor={mutedColor} titleColor={titleColor}>
            {terminal ? 'PROFILE' : '能力画像'}
          </SectionHeader>
          {(candidate.function_name || candidate.is_management_role != null) && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {candidate.function_name && (
                terminal
                  ? <TerminalTag colorStyle={{ color: 'var(--t-chart-blue)' }}>{candidate.function_name}</TerminalTag>
                  : <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-100">业务 · {candidate.function_name}</span>
              )}
              {candidate.is_management_role != null && (
                terminal
                  ? <TerminalTag colorStyle={{ color: 'var(--t-text-muted)' }}>
                      {candidate.is_management_role ? 'MGT' : 'IC'}
                      {candidate.is_management_role && candidate.management_headcount != null ? ` ×${candidate.management_headcount}` : ''}
                    </TerminalTag>
                  : <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                      {candidate.is_management_role ? '管理岗位' : '非管理岗位'}
                      {candidate.is_management_role && candidate.management_headcount != null ? `（${candidate.management_headcount} 人）` : ''}
                    </span>
              )}
            </div>
          )}
          {[
            { label: terminal ? 'KNOW' : '知识',   tags: candidate.knowledge_tags },
            { label: terminal ? 'HARD' : '硬技能', tags: candidate.hard_skill_tags },
            { label: terminal ? 'SOFT' : '软技能', tags: candidate.soft_skill_tags },
          ].filter(g => Array.isArray(g.tags) && g.tags.length > 0).map(g => (
            <div key={g.label} className="mb-2 last:mb-0">
              <p className={terminal ? 'font-mono text-[10px] uppercase tracking-widest mb-1' : 'text-xs text-slate-400 mb-1'} style={mutedColor}>{g.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.tags.map((n, i) => (
                  terminal
                    ? <TerminalTag key={i} colorStyle={{ color: 'var(--t-text-secondary)' }}>{n}</TerminalTag>
                    : <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">{n}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 联系方式 */}
      {isPrivate ? (
        (candidate.email || candidate.phone) ? (
          terminal ? (
            <div style={sectionDivider}>
              <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={mutedColor}>联系方式</p>
              {candidate.phone && (
                <p className="text-xs flex items-center gap-3" style={subColor}>
                  <span className="font-mono text-[10px] uppercase tracking-widest w-8 flex-shrink-0" style={mutedColor}>TEL</span>
                  {candidate.phone}
                </p>
              )}
              {candidate.email && (
                <p className="text-xs flex items-center gap-3 mt-1" style={subColor}>
                  <span className="font-mono text-[10px] uppercase tracking-widest w-8 flex-shrink-0" style={mutedColor}>MAIL</span>
                  {candidate.email}
                </p>
              )}
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-700 mb-2">联系方式</p>
              {candidate.phone && <p className="text-sm text-blue-800 flex items-center gap-2"><span className="w-8 flex-shrink-0 font-medium">电话</span><span>{candidate.phone}</span></p>}
              {candidate.email && <p className="text-sm text-blue-800 mt-1 flex items-center gap-2"><span className="w-8 flex-shrink-0 font-medium">邮箱</span><span>{candidate.email}</span></p>}
            </div>
          )
        ) : null
      ) : (
        <LockedSection label="联系方式" terminal={terminal} />
      )}

      {/* 当前任职 */}
      {isPrivate ? (
        (candidate.current_company || candidate.current_responsibilities ||
         candidate.current_salary_min != null || candidate.current_salary_max != null ||
         candidate.current_salary_months != null || candidate.current_average_bonus_percent != null ||
         candidate.current_has_year_end_bonus != null) ? (
          <div style={sectionDivider}>
            <SectionHeader terminal={terminal} mutedColor={mutedColor} titleColor={titleColor}>
              {terminal ? 'CURRENT ROLE' : '当前任职'}
            </SectionHeader>
            {candidate.current_company && (
              <p className={terminal ? 'text-xs mb-1' : 'text-sm text-slate-700 mb-1'} style={subColor}>
                {candidate.current_company}{candidate.current_title ? ` · ${candidate.current_title}` : ''}
              </p>
            )}
            {candidate.current_responsibilities && (
              <p className={terminal ? 'text-sm leading-relaxed whitespace-pre-line mb-2' : 'text-sm text-slate-600 leading-relaxed whitespace-pre-line mb-2'} style={subColor}>
                {candidate.current_responsibilities}
              </p>
            )}
            {(candidate.current_salary_min != null || candidate.current_salary_max != null ||
              candidate.current_salary_months != null || candidate.current_average_bonus_percent != null ||
              candidate.current_has_year_end_bonus != null) && (
              terminal ? (
                <div className="grid grid-cols-2 gap-px mt-1" style={{ background: 'var(--t-border-subtle)' }}>
                  {[
                    { label: 'SALARY',   value: formatSalaryRange(candidate.current_salary_min, candidate.current_salary_max) },
                    { label: 'MONTHS',   value: candidate.current_salary_months != null ? `${candidate.current_salary_months}M` : '—' },
                    { label: 'BONUS%',   value: candidate.current_average_bonus_percent != null ? `${candidate.current_average_bonus_percent}%` : '—' },
                    { label: 'YE-BONUS', value: formatYearEndBonus(candidate.current_has_year_end_bonus, candidate.current_year_end_bonus_months) },
                  ].map(item => (
                    <div key={item.label} className="px-3 py-2" style={{ background: 'var(--t-bg-panel)' }}>
                      <p className="font-mono text-[10px] uppercase tracking-widest mb-0.5" style={mutedColor}>{item.label}</p>
                      <p className="text-xs" style={subColor}>{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '当前月薪', value: formatSalaryRange(candidate.current_salary_min, candidate.current_salary_max) },
                    { label: '薪资月数', value: candidate.current_salary_months != null ? `${candidate.current_salary_months} 月` : '—' },
                    { label: '平均奖金', value: candidate.current_average_bonus_percent != null ? `${candidate.current_average_bonus_percent}%` : '—' },
                    { label: '年终奖',   value: formatYearEndBonus(candidate.current_has_year_end_bonus, candidate.current_year_end_bonus_months) },
                  ].map(item => (
                    <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-slate-400 mb-0.5">{item.label}</p>
                      <p className="text-sm font-semibold text-slate-700">{item.value}</p>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        ) : null
      ) : (
        <LockedSection label={terminal ? 'CURRENT ROLE' : '当前任职'} terminal={terminal} />
      )}

      {/* 工作经历 */}
      {isPrivate ? (
        (candidate.work_experiences?.length > 0) ? (
          <div style={sectionDivider}>
            <SectionHeader terminal={terminal} mutedColor={mutedColor} titleColor={titleColor}>
              {terminal ? 'EXPERIENCE' : '工作经历'}
            </SectionHeader>
            <div className="space-y-3">
              {candidate.work_experiences.map((w, i) => {
                const salaryRange = w.salary != null
                  ? String(w.salary)
                  : (w.salary_min != null || w.salary_max != null) ? formatSalaryRange(w.salary_min, w.salary_max) : null
                const yebText = formatYearEndBonus(w.has_year_end_bonus, w.year_end_bonus_months)
                return (
                  <div key={i} className={terminal ? 'border-l pl-3 py-0.5' : 'border-l-2 border-blue-200 pl-3 py-1'} style={terminal ? { borderColor: 'var(--t-border)' } : undefined}>
                    <p className={terminal ? 'text-xs font-medium' : 'text-sm font-medium text-slate-800'} style={terminal ? titleColor : undefined}>{w.title || '—'} · {w.company_name || w.company || '—'}</p>
                    <p className={terminal ? 'text-xs mt-0.5' : 'text-xs text-slate-500'} style={subColor}>{formatWorkPeriod(w)}</p>
                    {w.responsibilities && <p className={terminal ? 'text-xs mt-1 leading-relaxed whitespace-pre-line' : 'text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line'} style={subColor}><span className={terminal ? 'mr-1' : 'mr-1 text-slate-400'} style={mutedColor}>职责：</span>{w.responsibilities}</p>}
                    {w.achievements && <p className={terminal ? 'text-xs mt-1 leading-relaxed whitespace-pre-line' : 'text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line'} style={subColor}><span className={terminal ? 'mr-1' : 'mr-1 text-slate-400'} style={mutedColor}>成就：</span>{w.achievements}</p>}
                    {(salaryRange || w.salary_months != null || w.average_bonus_percent != null || yebText !== '—') && (
                      <p className={terminal ? 'text-xs mt-1' : 'text-xs text-slate-500 mt-1'} style={terminal ? mutedColor : undefined}>
                        {salaryRange && <span className="mr-2">薪资 {salaryRange}</span>}
                        {w.salary_months != null && <span className="mr-2">{w.salary_months}M</span>}
                        {w.average_bonus_percent != null && <span className="mr-2">奖金 {w.average_bonus_percent}%</span>}
                        {yebText !== '—' && <span>年终奖 {yebText}</span>}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null
      ) : (
        <LockedSection label={terminal ? 'EXPERIENCE' : '工作经历'} terminal={terminal} />
      )}

      {/* 教育经历 */}
      {isPrivate ? (
        (candidate.education_experiences?.length > 0) ? (
          <div style={sectionDivider}>
            <SectionHeader terminal={terminal} mutedColor={mutedColor} titleColor={titleColor}>
              {terminal ? 'EDUCATION' : '教育经历'}
            </SectionHeader>
            <div className="space-y-2">
              {candidate.education_experiences.map((e, i) => (
                <div key={i} className={terminal ? 'border-l pl-3 py-0.5' : 'border-l-2 border-purple-200 pl-3 py-1'} style={terminal ? { borderColor: 'var(--t-border)' } : undefined}>
                  <p className={terminal ? 'text-xs font-medium' : 'text-sm font-medium text-slate-800'} style={terminal ? titleColor : undefined}>
                    {e.school || '—'} · {e.major || '—'}
                    {e.degree && <span className="ml-2 text-xs" style={mutedColor}>{e.degree}</span>}
                  </p>
                  <p className={terminal ? 'text-xs mt-0.5' : 'text-xs text-slate-500'} style={subColor}>{e.period || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null
      ) : (
        <LockedSection label={terminal ? 'EDUCATION' : '教育经历'} terminal={terminal} />
      )}

      {/* 资格证书 */}
      {isPrivate ? (
        (candidate.certificates?.length > 0) ? (
          <div style={sectionDivider}>
            <SectionHeader terminal={terminal} mutedColor={mutedColor} titleColor={titleColor}>
              {terminal ? 'CERTS' : '资格证书'}
            </SectionHeader>
            <div className="flex flex-wrap gap-1.5">
              {candidate.certificates.map((c, i) => (
                terminal
                  ? <TerminalTag key={i} colorStyle={{ color: 'var(--t-text-secondary)' }}>{c}</TerminalTag>
                  : <span key={i} className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">{c}</span>
              ))}
            </div>
          </div>
        ) : null
      ) : (
        <LockedSection label={terminal ? 'CERTS' : '资格证书'} terminal={terminal} />
      )}

      {/* 标签 */}
      {Object.keys(tagsByCat).length > 0 && (
        <div style={sectionDivider}>
          <SectionHeader terminal={terminal} mutedColor={mutedColor} titleColor={titleColor}>
            {terminal ? 'TAGS' : '标签'}
          </SectionHeader>
          <div className="space-y-2">
            {Object.entries(tagsByCat).map(([cat, names]) => (
              <div key={cat}>
                <p className={terminal ? 'font-mono text-[10px] uppercase tracking-widest mb-1' : 'text-xs text-slate-400 mb-1'} style={mutedColor}>{cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {names.map((n, i) => (
                    terminal
                      ? <TerminalTag key={i} colorStyle={{ color: 'var(--t-text-secondary)' }}>{n}</TerminalTag>
                      : <span key={i} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded-full">{n}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 个人简介 */}
      {candidate.summary && (
        <div style={sectionDivider}>
          <SectionHeader terminal={terminal} mutedColor={mutedColor} titleColor={titleColor}>
            {terminal ? 'SUMMARY' : '个人简介'}
          </SectionHeader>
          <p className={terminal ? 'text-sm leading-relaxed whitespace-pre-line' : 'text-sm text-slate-600 leading-relaxed whitespace-pre-line'} style={subColor}>
            {candidate.summary}
          </p>
        </div>
      )}
    </div>
  )
}

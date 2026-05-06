/**
 * tag_groups 序列化工具
 *
 * 用法：
 *   const groups = { '地区': [1, 2], '语言': [5, 6] }
 *   serializeTagGroups(groups) → '1,2;5,6'
 *
 * 后端按分号拆组、按逗号拆 id：同组 OR、跨组 AND。
 */
export function serializeTagGroups(groups = {}) {
  return Object.values(groups)
    .filter(ids => Array.isArray(ids) && ids.length > 0)
    .map(ids => ids.join(','))
    .join(';')
}

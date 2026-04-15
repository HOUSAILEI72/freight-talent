import { Link } from 'react-router-dom'
import { Ship } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                <Ship size={14} className="text-white" />
              </div>
              <span className="text-white font-semibold text-sm">FreightTalent</span>
            </div>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              货代行业垂直人才撮合平台，精准连接优质候选人与头部货代企业。
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
            <div>
              <p className="text-white font-medium mb-3">候选人</p>
              <ul className="space-y-2">
                <li><Link to="/candidate/upload" className="hover:text-white transition-colors">上传简历</Link></li>
                <li><Link to="/candidate/profile/me" className="hover:text-white transition-colors">查看档案</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-medium mb-3">企业</p>
              <ul className="space-y-2">
                <li><Link to="/employer/post-job" className="hover:text-white transition-colors">发布岗位</Link></li>
                <li><Link to="/employer/dashboard" className="hover:text-white transition-colors">企业控制台</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-white font-medium mb-3">平台</p>
              <ul className="space-y-2">
                <li><Link to="/admin/overview" className="hover:text-white transition-colors">运营后台</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">使用协议</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-xs text-slate-600">© 2026 FreightTalent. 专注货代行业人才匹配。</p>
          <p className="text-xs text-slate-700">沪ICP备2026XXXXXX号</p>
        </div>
      </div>
    </footer>
  )
}
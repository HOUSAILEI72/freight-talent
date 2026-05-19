import { useState, useEffect } from 'react'
import { X, Shield, FileText, ChevronRight, Building2 } from 'lucide-react'

const TABS = [
  { id: 'standards', label: '招聘行为管理规范', icon: Shield },
  { id: 'agreement', label: '平台用户协议', icon: FileText },
]

const STANDARDS_CONTENT = [
  {
    title: '一、前言',
    items: [
      '1.1 本《招聘行为管理规范》（以下简称"规范"）系用户（特指"招聘者"或有招聘需求的企业）与智锦汇人力资源（上海）有限公司（以下简称"ACE-Talent平台"或"平台"或"我们"）订立的《ACE-Talent用户协议》的有效组成部分，与《用户协议》共同构成您与ACE-Talent平台合作的法律文件。',
      '1.2 您在使用ACE-Talent服务之前，请务必审慎阅读、充分理解本规范。当您使用ACE-Talent平台服务时，即表示您已阅读并同意本规范的全部内容。',
      '1.3 ACE-Talent有权根据法律法规、政策及产品需求更新本规范，请您定期访问并查看最新版本。',
      '1.4 本规范主要基于《中华人民共和国民法典》《中华人民共和国网络安全法》《中华人民共和国就业促进法》《中华人民共和国劳动法》《中华人民共和国劳动合同法》《人力资源市场暂行条例》《网络招聘服务管理规定》等国家法律法规制定。',
    ],
  },
  {
    title: '二、基本原则',
    items: [
      '2.1 用户应仅以招聘目的使用平台，不得利用平台从事违法违规活动，或以招聘为名使用平台从事其他活动，如营销推广、寻求合作等。',
      '2.2 用户应严格遵守法律法规及本规范的规定开展招聘工作，平台应严格遵守法律法规并依据本规范的规定对用户进行管理。',
    ],
  },
  {
    title: '三、违规行为类型',
    items: [
      '3.1 重大违法违规：用户行为存在违反法律法规禁止性规定，且可能对平台招聘求职安全造成严重影响，需要立即采取措施的情况。包括但不限于：危害国家安全、涉黄涉赌涉毒、诈骗传销、侵害未成年人权益等行为。',
      '3.2 一般违法违规：包括但不限于：不签或迟签劳动合同、薪资违规（欠薪/虚高薪资/低于最低工资）、违规收费（不合理中介费/体检费）、就业歧视、不缴五险一金等违反劳动法的行为。',
      '3.3 影响求职者体验：包括但不限于：在平台从事广告引流、不文明行为（口头攻击/骚扰/面试爽约）、发布不真实职位或企业信息等。',
      '3.4 不满足准入要求：包括但不限于：营业执照注销/吊销、企业进入破产程序、使用虚假身份信息注册、人力资源服务机构无法提供相应许可证等。',
      '3.5 风险职位：包括但不限于：以招聘为名实际开展招生培训、高风险兼职、驻外高风险地区等类型的职位。',
    ],
  },
  {
    title: '四、禁止行为（重点）',
    items: [
      '4.1 严禁发布无薪资、无底薪职位，或约定低于各地最低工资标准的薪资。',
      '4.2 严禁以任何方式、理由扣押求职者证件，如身份证、学位证，或要求担保、抵押。',
      '4.3 严禁不合理收取中介费、体检费、服装费等各类费用。',
      '4.4 严禁发布招聘广告后故意不回应或面试爽约，损害求职者权益。',
      '4.5 严禁以招聘为名实施任何形式的诈骗行为。',
      '4.6 严禁发布就业歧视信息，禁止因种族、性别、户籍、年龄等原因差别对待求职者。',
      '4.7 严禁高频异常获取求职者个人信息，或通过非平台允许方式收集个人信息。',
    ],
  },
  {
    title: '五、管理措施',
    items: [
      '5.1 账号封禁：违规账号将被封禁冻结。对于严重违规行为，将依法将违规用户信息列入黑名单，相关企业将无法使用平台服务。',
      '5.2 资质核验：平台将要求违规用户补充提交资质认证材料，包括营业执照、承诺函等，核验通过方可继续使用。',
      '5.3 功能限制：包括暂时无法与求职者开聊、无法正常使用职位发布等功能。',
      '5.4 信息清除：违规发布的岗位信息将被删除或下架。',
      '5.5 法律追责：情节严重者，平台将依法向有关部门举报，并保留追究法律责任的权利。',
    ],
  },
  {
    title: '六、投诉与申诉',
    items: [
      '6.1 用户如发现平台上存在违规行为，可通过平台提供的举报渠道进行投诉举报，平台将在收到投诉后合理时间内进行核查处理。',
      '6.2 用户对平台处理结果有异议的，可在收到处理通知后7个工作日内通过官方渠道提起申诉，平台将重新审查并予以回复。',
      '6.3 平台联系方式：智锦汇人力资源（上海）有限公司，服务邮箱请通过平台官方渠道获取。',
    ],
  },
]

const AGREEMENT_CONTENT = [
  {
    title: '一、协议的接受',
    items: [
      '1.1 在您成为ACE-Talent注册用户，使用平台提供的服务之前，请您认真阅读本《用户协议》，了解您所享有的权利和承担的义务。您一旦开始使用ACE-Talent服务，即表示您已确认并接受本协议中的全部条款。',
      '1.2 本协议由您（以下简称"用户"或"您"）与智锦汇人力资源（上海）有限公司（以下简称"ACE-Talent"或"我们"）就ACE-Talent平台所订立的相关权利义务规范。ACE-Talent是一个专注货代行业的严肃纯净的招聘服务平台。',
    ],
  },
  {
    title: '二、用户注册与认证',
    items: [
      '2.1 申请注册ACE-Talent账号的用户应同时满足：以招聘和/或求职为目的；在注册之日必须年满16周岁以上。',
      '2.2 用户应向ACE-Talent提供本人真实、准确、最新及完整的资料。注册并认证为招聘者的用户，应保证及时更新单位名称、职务信息、企业邮箱等相关信息，并确保信息的真实性。',
      '2.3 若用户提供虚假信息进行注册、发布虚假招聘信息，视为严重违反本协议，ACE-Talent有权暂停或终止该用户账号并停止提供服务。',
    ],
  },
  {
    title: '三、账号安全',
    items: [
      '3.1 用户应对利用账号所进行的一切活动负全部责任。',
      '3.2 用户的账号遭到未获授权的使用时，用户应立即通知ACE-Talent。',
      '3.3 ACE-Talent账号的所有权归ACE-Talent所有，用户完成账号注册程序后，获得账号的使用权，且该使用权仅属于账号初始注册人。用户不得赠与、借用、租用、转让或售卖账号。',
    ],
  },
  {
    title: '四、服务说明',
    items: [
      '4.1 ACE-Talent通过互联网为用户提供网络服务，包括岗位发布、候选人匹配、即时通讯、标签系统等在线服务。',
      '4.2 ACE-Talent在提供网络服务时，可能会对部分服务收取一定费用，届时会在相关页面上做明确的提示。',
      '4.3 为落实法律法规要求，ACE-Talent可能不定期对用户的企业地址、招聘授权等相关信息进行真实性审核。',
      '4.4 ACE-Talent有权通过平台通知、邮件等方式告知用户服务相关的信息。',
    ],
  },
  {
    title: '五、有限责任',
    items: [
      '5.1 ACE-Talent将尽力为用户提供安全、及时、准确的服务，但无法保证服务不会中断，对服务的及时性、安全性、准确性不作保证。',
      '5.2 对于用户通过ACE-Talent传送的内容，ACE-Talent会尽合理努力按照国家有关规定处理明显违法的内容，但对于用户发布的非明显违法内容不承担责任。',
      '5.3 ACE-Talent不对用户之间的交易、沟通等行为承担任何担保或连带责任，用户应自行核实对方信息的真实性。',
    ],
  },
  {
    title: '六、用户义务',
    items: [
      '6.1 用户在使用ACE-Talent服务过程中，必须遵守中华人民共和国相关法律法规及本协议的规定。',
      '6.2 用户不得利用ACE-Talent服务从事任何违法活动或有损ACE-Talent或他人权益的活动。',
      '6.3 用户应尊重他人的知识产权和隐私权，不得发布侵犯他人知识产权或隐私权的内容。',
      '6.4 用户应遵守《招聘行为管理规范》的相关规定，合法合规开展招聘求职活动。',
    ],
  },
  {
    title: '七、个人信息保护',
    items: [
      '7.1 ACE-Talent非常重视用户的个人信息保护，将依据《中华人民共和国个人信息保护法》等相关法律法规处理用户个人信息。',
      '7.2 ACE-Talent收集的个人信息仅用于提供服务、改善用户体验、保障平台安全等目的，不会向无关第三方出售用户个人信息。',
      '7.3 用户有权查阅、更正、删除其个人信息，具体可通过账号设置或联系客服操作。',
    ],
  },
  {
    title: '八、违约责任',
    items: [
      '8.1 如用户违反本协议的任何规定，ACE-Talent有权依据违规情节对其采取包括但不限于警告、限制功能、暂停账号、永久封禁等处理措施。',
      '8.2 如用户的违规行为给ACE-Talent或其他用户造成损失，用户应依法承担相应的赔偿责任。',
    ],
  },
  {
    title: '九、协议变更',
    items: [
      '9.1 ACE-Talent有权根据法律法规、政策及产品需求对本协议进行修改，修改后的协议将在平台公告，用户继续使用服务即视为接受修改后的协议。',
    ],
  },
  {
    title: '十、法律适用与管辖',
    items: [
      '10.1 本协议的订立、执行、解释及争议的解决均应适用中华人民共和国法律。',
      '10.2 因本协议产生的争议，双方应首先通过友好协商解决；协商不成的，任何一方有权向有管辖权的人民法院提起诉讼。',
    ],
  },
]

export default function ComplianceModal({ open, onClose }) {
  const [activeTab, setActiveTab] = useState('standards')
  const [expandedSections, setExpandedSections] = useState({})

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const content = activeTab === 'standards' ? STANDARDS_CONTENT : AGREEMENT_CONTENT

  function toggleSection(title) {
    setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">平台规范与协议</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Building2 size={12} className="text-slate-400" />
                <p className="text-xs text-slate-400">智锦汇人力资源（上海）有限公司 · ACE-Talent</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setExpandedSections({}) }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors mr-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Company notice banner */}
        <div className="mx-6 mt-4 px-4 py-3 bg-blue-50 rounded-xl border border-blue-100">
          <p className="text-xs text-blue-700 leading-relaxed">
            <span className="font-semibold">ACE-Talent</span> 由 <span className="font-semibold">智锦汇人力资源（上海）有限公司</span> 运营，
            专注货代物流行业人才匹配服务。以下规范适用于所有注册用户，请认真阅读并遵守。
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {content.map((section) => {
            const isOpen = expandedSections[section.title] !== false
            return (
              <div key={section.title} className="border border-slate-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-800">{section.title}</span>
                  <ChevronRight
                    size={16}
                    className={`text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-2.5 border-t border-slate-50">
                    {section.items.map((item, i) => (
                      <p key={i} className="text-sm text-slate-600 leading-relaxed pl-2 border-l-2 border-slate-100 mt-2.5">
                        {item}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} 智锦汇人力资源（上海）有限公司 版权所有
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            我已阅读
          </button>
        </div>
      </div>
    </div>
  )
}

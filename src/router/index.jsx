import { Suspense, lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from '../App'
import { useAuth } from '../context/AuthContext'

function JobsRoute() {
  const { user } = useAuth()
  if (user?.role === 'employer') return <Navigate to="/employer/jobs" replace />
  return <JobMarketplace />
}

// ── Lazy-loaded route components (code-split per page group) ──────────────────
const Home               = lazy(() => import('../pages/Home'))
const UploadResume       = lazy(() => import('../pages/candidate/UploadResume'))
const CandidateProfile   = lazy(() => import('../pages/candidate/CandidateProfile'))
const MyInvitations      = lazy(() => import('../pages/candidate/MyInvitations'))
const JobMarketplace     = lazy(() => import('../pages/jobs/JobMarketplace'))
const CandidatePool      = lazy(() => import('../features/candidatePool'))
const EmployerHome       = lazy(() => import('../pages/employer/EmployerHome'))
const Messages           = lazy(() => import('../features/messages'))
const Dashboard          = lazy(() => import('../pages/employer/Dashboard'))
const Overview           = lazy(() => import('../pages/admin/Overview'))
const ImportManager      = lazy(() => import('../pages/admin/ImportManager'))
const AdminCharts        = lazy(() => import('../pages/admin/AdminCharts'))
const AdminCandidates    = lazy(() => import('../pages/admin/AdminCandidates'))
const AdminJobs          = lazy(() => import('../pages/admin/AdminJobs'))
const Approvals          = lazy(() => import('../pages/admin/Approvals'))
const MyTags             = lazy(() => import('../pages/tags/MyTags'))
const Login              = lazy(() => import('../pages/auth/Login'))
const RequireAuth        = lazy(() => import('./RequireAuth'))
const AuthLanding        = lazy(() => import('./AuthLanding'))
const RedirectIfAuth     = lazy(() => import('./RedirectIfAuth'))

// Terminal wrapper pages (lightweight — eager load)
import TerminalJobs from '../pages/employer/TerminalJobs'
import TerminalCandidates from '../pages/employer/TerminalCandidates'
import TerminalMessages from '../pages/employer/TerminalMessages'
import TerminalTags from '../pages/employer/TerminalTags'
import TerminalPostJob from '../pages/employer/TerminalPostJob'
import TerminalMatchResult from '../pages/employer/TerminalMatchResult'
import TerminalReceivedApplications from '../pages/employer/TerminalReceivedApplications'
import CandidateHome from '../pages/candidate/CandidateHome'
import TerminalCandidateJobs from '../pages/candidate/TerminalCandidateJobs'
import TerminalCandidateMessages from '../pages/candidate/TerminalCandidateMessages'
import TerminalCandidateTags from '../pages/candidate/TerminalCandidateTags'
import TerminalCandidateUpload from '../pages/candidate/TerminalCandidateUpload'
import TerminalCandidateInvitations from '../pages/candidate/TerminalCandidateInvitations'
import TerminalCandidateApplications from '../pages/candidate/TerminalCandidateApplications'
import TerminalCandidateProfile from '../pages/candidate/TerminalCandidateProfile'
import TerminalCandidateProfileBuilder from '../pages/candidate/TerminalCandidateProfileBuilder'
import TerminalSettings from '../pages/employer/TerminalSettings'
import TerminalPricing from '../pages/employer/TerminalPricing'
import TerminalPersonalHeadhunting from '../pages/employer/TerminalPersonalHeadhunting'
import TerminalTeamHeadhunting from '../pages/employer/TerminalTeamHeadhunting'
import TerminalCandidateSettings from '../pages/candidate/TerminalCandidateSettings'
import TerminalEmployerCandidateProfile from '../pages/employer/TerminalCandidateProfile'

// Shared loading fallback — minimal, no layout shift
function Fallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-8 h-8 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
    </div>
  )
}

function Lazy({ children }) {
  return <Suspense fallback={<Fallback />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Lazy><AuthLanding /></Lazy> },
      {
        path: 'login',
        element: (
          <Lazy><RedirectIfAuth>
            <Login />
          </RedirectIfAuth></Lazy>
        ),
      },

      // 岗位广场（candidate / admin 直接显示；employer 重定向到 /employer/jobs 保证 own=1 过滤）
      {
        path: 'jobs',
        element: (
          <Lazy><RequireAuth roles={['candidate', 'employer', 'admin']}>
            <JobsRoute />
          </RequireAuth></Lazy>
        ),
      },

      {
        path: 'messages',
        element: (
          <Lazy><RequireAuth roles={['employer', 'candidate', 'admin']}>
            <Messages />
          </RequireAuth></Lazy>
        ),
      },
      {
        path: 'messages/:threadId',
        element: (
          <Lazy><RequireAuth roles={['employer', 'candidate', 'admin']}>
            <Messages />
          </RequireAuth></Lazy>
        ),
      },

      // 标签申请（candidate / employer 共用）
      {
        path: 'tags',
        element: (
          <Lazy><RequireAuth roles={['candidate', 'employer']}>
            <MyTags />
          </RequireAuth></Lazy>
        ),
      },

      // 候选人路由
      {
        path: 'candidate/upload',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateUpload />
          </RequireAuth>
        ),
      },
      {
        path: 'candidate/profile/me',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateProfile />
          </RequireAuth>
        ),
      },
      {
        path: 'candidate/profile/builder',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateProfileBuilder />
          </RequireAuth>
        ),
      },
      {
        path: 'candidate/profile/:id',
        element: (
          <Lazy><RequireAuth roles={['candidate', 'employer', 'admin']}>
            <CandidateProfile />
          </RequireAuth></Lazy>
        ),
      },
      {
        path: 'candidate/home',
        element: (
          <RequireAuth roles={['candidate']}>
            <CandidateHome />
          </RequireAuth>
        ),
      },
      {
        path: 'candidate/jobs',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateJobs />
          </RequireAuth>
        ),
      },
      {
        path: 'candidate/messages',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateMessages />
          </RequireAuth>
        ),
      },
      {
        path: 'candidate/messages/:threadId',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateMessages />
          </RequireAuth>
        ),
      },
      {
        path: 'candidate/tags',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateTags />
          </RequireAuth>
        ),
      },
      {
        path: 'candidate/invitations',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateInvitations />
          </RequireAuth>
        ),
      },
      {
        path: 'candidate/settings',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateSettings />
          </RequireAuth>
        ),
      },
      {
        path: 'candidate/applications',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateApplications />
          </RequireAuth>
        ),
      },

      // 企业路由
      {
        path: 'candidates',
        element: (
          <Lazy><RequireAuth roles={['employer', 'admin']}>
            <CandidatePool />
          </RequireAuth></Lazy>
        ),
      },
      {
        path: 'employer/candidates',
        element: (
          <RequireAuth roles={['employer', 'admin']}>
            <TerminalCandidates />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/candidates/:id',
        element: (
          <RequireAuth roles={['employer', 'admin']}>
            <TerminalEmployerCandidateProfile />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/jobs',
        element: (
          <RequireAuth roles={['employer', 'admin']}>
            <TerminalJobs />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/messages',
        element: (
          <RequireAuth roles={['employer']}>
            <TerminalMessages />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/messages/:threadId',
        element: (
          <RequireAuth roles={['employer']}>
            <TerminalMessages />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/tags',
        element: (
          <RequireAuth roles={['employer']}>
            <TerminalTags />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/jobs/new',
        element: (
          <RequireAuth roles={['employer']}>
            <TerminalPostJob />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/jobs/:jobId/edit',
        element: (
          <RequireAuth roles={['employer']}>
            <TerminalPostJob mode="edit" />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/jobs/:jobId/match',
        element: (
          <RequireAuth roles={['employer']}>
            <TerminalMatchResult />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/applications/received',
        element: (
          <RequireAuth roles={['employer', 'admin']}>
            <TerminalReceivedApplications />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/post-job',
        element: <Navigate to="/employer/jobs/new" replace />,
      },
      {
        path: 'employer/match/:jobId',
        element: (
          <RequireAuth roles={['employer']}>
            <TerminalMatchResult />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/dashboard',
        element: (
          <RequireAuth roles={['employer']}>
            <Dashboard />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/settings',
        element: (
          <RequireAuth roles={['employer']}>
            <TerminalSettings />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/pricing',
        element: (
          <RequireAuth roles={['employer', 'admin', 'candidate']}>
            <TerminalPricing />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/headhunting/personal',
        element: (
          <RequireAuth roles={['employer', 'admin']}>
            <TerminalPersonalHeadhunting />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/headhunting/team',
        element: (
          <RequireAuth roles={['employer', 'admin']}>
            <TerminalTeamHeadhunting />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/home',
        element: (
          <Lazy><RequireAuth roles={['employer']}>
            <EmployerHome />
          </RequireAuth></Lazy>
        ),
      },

      // 管理员路由
      {
        path: 'admin/overview',
        element: (
          <Lazy><RequireAuth roles={['admin']}>
            <Overview />
          </RequireAuth></Lazy>
        ),
      },
      {
        path: 'admin/import',
        element: (
          <Lazy><RequireAuth roles={['admin']}>
            <ImportManager />
          </RequireAuth></Lazy>
        ),
      },
      {
        path: 'admin/approvals',
        element: (
          <Lazy><RequireAuth roles={['admin']}>
            <Approvals />
          </RequireAuth></Lazy>
        ),
      },
      {
        path: 'admin/charts',
        element: (
          <Lazy><RequireAuth roles={['admin']}>
            <AdminCharts />
          </RequireAuth></Lazy>
        ),
      },
      {
        path: 'admin/candidates',
        element: (
          <Lazy><RequireAuth roles={['admin']}>
            <AdminCandidates />
          </RequireAuth></Lazy>
        ),
      },
      {
        path: 'admin/jobs',
        element: (
          <Lazy><RequireAuth roles={['admin']}>
            <AdminJobs />
          </RequireAuth></Lazy>
        ),
      },
      {
        path: 'admin/tags',
        element: <Navigate to="/admin/import" replace />,
      },
    ],
  },
])

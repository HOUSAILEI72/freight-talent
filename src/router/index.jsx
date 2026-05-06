import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from '../App'
import Home from '../pages/Home'
import UploadResume from '../pages/candidate/UploadResume'
import CandidateProfile from '../pages/candidate/CandidateProfile'
import MyInvitations from '../pages/candidate/MyInvitations'
import JobMarketplace from '../pages/jobs/JobMarketplace'
import CandidatePool from '../pages/employer/CandidatePool'
import EmployerHome from '../pages/employer/EmployerHome'
import Messages from '../pages/messages/Messages'
import TerminalJobs from '../pages/employer/TerminalJobs'
import TerminalCandidates from '../pages/employer/TerminalCandidates'
import TerminalMessages from '../pages/employer/TerminalMessages'
import TerminalTags from '../pages/employer/TerminalTags'
import TerminalPostJob from '../pages/employer/TerminalPostJob'
import TerminalMatchResult from '../pages/employer/TerminalMatchResult'
import TerminalReceivedApplications from '../pages/employer/TerminalReceivedApplications'
import Dashboard from '../pages/employer/Dashboard'
import Overview from '../pages/admin/Overview'
import ImportManager from '../pages/admin/ImportManager'
import AdminCharts from '../pages/admin/AdminCharts'
import AdminCandidates from '../pages/admin/AdminCandidates'
import AdminJobs from '../pages/admin/AdminJobs'
import Approvals from '../pages/admin/Approvals'
import CandidateHome from '../pages/candidate/CandidateHome'
import TerminalCandidateJobs from '../pages/candidate/TerminalCandidateJobs'
import TerminalCandidateMessages from '../pages/candidate/TerminalCandidateMessages'
import TerminalCandidateTags from '../pages/candidate/TerminalCandidateTags'
import TerminalCandidateUpload from '../pages/candidate/TerminalCandidateUpload'
import TerminalCandidateInvitations from '../pages/candidate/TerminalCandidateInvitations'
import TerminalCandidateApplications from '../pages/candidate/TerminalCandidateApplications'
import TerminalCandidateProfile from '../pages/candidate/TerminalCandidateProfile'
import TerminalCandidateProfileBuilder from '../pages/candidate/TerminalCandidateProfileBuilder'
import MyTags from '../pages/tags/MyTags'
import Login from '../pages/auth/Login'
import RequireAuth from './RequireAuth'
import AuthLanding from './AuthLanding'
import RedirectIfAuth from './RedirectIfAuth'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <AuthLanding /> },
      {
        path: 'login',
        element: (
          <RedirectIfAuth>
            <Login />
          </RedirectIfAuth>
        ),
      },

      // 岗位广场（candidate / employer / admin 均可访问）
      {
        path: 'jobs',
        element: (
          <RequireAuth roles={['candidate', 'employer', 'admin']}>
            <JobMarketplace />
          </RequireAuth>
        ),
      },

      // 消息中心（employer + candidate + admin）
      {
        path: 'messages',
        element: (
          <RequireAuth roles={['employer', 'candidate', 'admin']}>
            <Messages />
          </RequireAuth>
        ),
      },
      {
        path: 'messages/:threadId',
        element: (
          <RequireAuth roles={['employer', 'candidate', 'admin']}>
            <Messages />
          </RequireAuth>
        ),
      },

      // 标签申请（candidate / employer 共用）
      {
        path: 'tags',
        element: (
          <RequireAuth roles={['candidate', 'employer']}>
            <MyTags />
          </RequireAuth>
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
      // /candidate/profile/me — 候选人看自己的档案（统一入口，Terminal 壳）
      {
        path: 'candidate/profile/me',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateProfile />
          </RequireAuth>
        ),
      },
      // /candidate/profile/builder — CAND-2B 档案构建（Terminal 深色，gate 跳转目标）
      {
        path: 'candidate/profile/builder',
        element: (
          <RequireAuth roles={['candidate']}>
            <TerminalCandidateProfileBuilder />
          </RequireAuth>
        ),
      },
      // /candidate/profile/:candidateId — 企业/管理员看候选人公开档案（数字 id）
      {
        path: 'candidate/profile/:id',
        element: (
          <RequireAuth roles={['candidate', 'employer', 'admin']}>
            <CandidateProfile />
          </RequireAuth>
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
      // /candidate/applications — CAND-8B "我的投递"
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
          <RequireAuth roles={['employer', 'admin']}>
            <CandidatePool />
          </RequireAuth>
        ),
      },
      // 别名路由，供 Home 和 Navbar 使用 — 企业 Terminal 版候选人池
      {
        path: 'employer/candidates',
        element: (
          <RequireAuth roles={['employer', 'admin']}>
            <TerminalCandidates />
          </RequireAuth>
        ),
      },
      // 企业 Terminal 版岗位广场
      {
        path: 'employer/jobs',
        element: (
          <RequireAuth roles={['employer', 'admin']}>
            <TerminalJobs />
          </RequireAuth>
        ),
      },
      // 企业 Terminal 版消息
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
      // 企业 Terminal 版标签申请
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
        path: 'employer/jobs/:jobId/match',
        element: (
          <RequireAuth roles={['employer']}>
            <TerminalMatchResult />
          </RequireAuth>
        ),
      },
      // 企业 Terminal 版收到的投递 — CAND-8C
      {
        path: 'employer/applications/received',
        element: (
          <RequireAuth roles={['employer', 'admin']}>
            <TerminalReceivedApplications />
          </RequireAuth>
        ),
      },
      // ── Legacy compat: keep these so old in-app links / external bookmarks
      // don't 404. /employer/post-job is a redirect to the Jobs sub-route;
      // /employer/match/:jobId still mounts the Terminal page directly so
      // we don't flash a white shell during a redirect tick.
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
        path: 'employer/home',
        element: (
          <RequireAuth roles={['employer']}>
            <EmployerHome />
          </RequireAuth>
        ),
      },

      // 管理员路由
      {
        path: 'admin/overview',
        element: (
          <RequireAuth roles={['admin']}>
            <Overview />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/import',
        element: (
          <RequireAuth roles={['admin']}>
            <ImportManager />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/approvals',
        element: (
          <RequireAuth roles={['admin']}>
            <Approvals />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/charts',
        element: (
          <RequireAuth roles={['admin']}>
            <AdminCharts />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/candidates',
        element: (
          <RequireAuth roles={['admin']}>
            <AdminCandidates />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/jobs',
        element: (
          <RequireAuth roles={['admin']}>
            <AdminJobs />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/tags',
        element: <Navigate to="/admin/import" replace />,
      },
    ],
  },
])

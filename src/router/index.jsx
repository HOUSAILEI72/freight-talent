import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from '../App'
import Home from '../pages/Home'
import UploadResume from '../pages/candidate/UploadResume'
import CandidateProfile from '../pages/candidate/CandidateProfile'
import MyInvitations from '../pages/candidate/MyInvitations'
import JobMarketplace from '../pages/jobs/JobMarketplace'
import CandidatePool from '../pages/employer/CandidatePool'
import Messages from '../pages/messages/Messages'
import PostJob from '../pages/employer/PostJob'
import MatchResult from '../pages/employer/MatchResult'
import Dashboard from '../pages/employer/Dashboard'
import Overview from '../pages/admin/Overview'
import Login from '../pages/auth/Login'
import RequireAuth from './RequireAuth'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'login', element: <Login /> },

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

      // 候选人路由
      {
        path: 'candidate/upload',
        element: (
          <RequireAuth roles={['candidate']}>
            <UploadResume />
          </RequireAuth>
        ),
      },
      // /candidate/profile/me — 候选人看自己的档案（统一入口）
      {
        path: 'candidate/profile/me',
        element: (
          <RequireAuth roles={['candidate']}>
            <CandidateProfile viewMode="self" />
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
        path: 'candidate/invitations',
        element: (
          <RequireAuth roles={['candidate']}>
            <MyInvitations />
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
      // 别名路由，供 Home 和 Navbar 使用
      {
        path: 'employer/candidates',
        element: (
          <RequireAuth roles={['employer', 'admin']}>
            <CandidatePool />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/post-job',
        element: (
          <RequireAuth roles={['employer']}>
            <PostJob />
          </RequireAuth>
        ),
      },
      {
        path: 'employer/match/:jobId',
        element: (
          <RequireAuth roles={['employer']}>
            <MatchResult />
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

      // 管理员路由
      {
        path: 'admin/overview',
        element: (
          <RequireAuth roles={['admin']}>
            <Overview />
          </RequireAuth>
        ),
      },
    ],
  },
])
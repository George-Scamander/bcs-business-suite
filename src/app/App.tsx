import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { PERMISSIONS } from '../lib/permissions'
import { AppLayout } from './layouts/AppLayout'
import { ProtectedRoute } from '../modules/auth/ProtectedRoute'
import { RoleGuard } from '../modules/auth/RoleGuard'
import { LoginPage } from '../modules/auth/pages/LoginPage'
import { ForgotPasswordPage } from '../modules/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '../modules/auth/pages/ResetPasswordPage'
import { AdminDashboardPage } from '../modules/admin/pages/AdminDashboardPage'
import { UserRoleManagementPage } from '../modules/admin/pages/UserRoleManagementPage'
import { AdminLeadPoolPage } from '../modules/admin/pages/AdminLeadPoolPage'
import { AdminOnboardingReviewCenterPage } from '../modules/admin/pages/AdminOnboardingReviewCenterPage'
import { AdminProjectOverviewPage } from '../modules/admin/pages/AdminProjectOverviewPage'
import { AdminReportExportPage } from '../modules/admin/pages/AdminReportExportPage'
import { AdminSystemConfigPage } from '../modules/admin/pages/AdminSystemConfigPage'
import { AppEntryPage } from '../modules/shared/pages/AppEntryPage'
import { BdDashboardPage } from '../modules/shared/pages/BdDashboardPage'
import { FileCenterPage } from '../modules/shared/pages/FileCenterPage'
import { NotFoundPage } from '../modules/shared/pages/NotFoundPage'
import { NotificationsPage } from '../modules/shared/pages/NotificationsPage'
import { OperationLogsPage } from '../modules/shared/pages/OperationLogsPage'
import { PmDashboardPage } from '../modules/shared/pages/PmDashboardPage'
import { ProfileSettingsPage } from '../modules/shared/pages/ProfileSettingsPage'
import { UnauthorizedPage } from '../modules/shared/pages/UnauthorizedPage'
import { BdLeadsListPage } from '../modules/leads/pages/BdLeadsListPage'
import { LeadFormPage } from '../modules/leads/pages/LeadFormPage'
import { LeadDetailPage } from '../modules/leads/pages/LeadDetailPage'
import { LeadFollowupTimelinePage } from '../modules/leads/pages/LeadFollowupTimelinePage'
import { LeadStatusChangePage } from '../modules/leads/pages/LeadStatusChangePage'
import { LeadSignContractPage } from '../modules/leads/pages/LeadSignContractPage'
import { LeadInitiateOnboardingPage } from '../modules/leads/pages/LeadInitiateOnboardingPage'
import { BdOnboardingListPage } from '../modules/onboarding/pages/BdOnboardingListPage'
import { BdOnboardingDetailPage } from '../modules/onboarding/pages/BdOnboardingDetailPage'
import { BdProjectDetailPage } from '../modules/projects/pages/BdProjectDetailPage'
import { BdRelatedProjectsPage } from '../modules/projects/pages/BdRelatedProjectsPage'
import { PmProjectsListPage } from '../modules/projects/pages/PmProjectsListPage'
import { PmProjectDetailPage } from '../modules/projects/pages/PmProjectDetailPage'
import { PmProjectProgressPage } from '../modules/projects/pages/PmProjectProgressPage'
import { PmProjectTasksPage } from '../modules/projects/pages/PmProjectTasksPage'
import { PmProjectMembersPage } from '../modules/projects/pages/PmProjectMembersPage'
import { PmProjectRisksPage } from '../modules/projects/pages/PmProjectRisksPage'
import { PmProjectClosurePage } from '../modules/projects/pages/PmProjectClosurePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<AppEntryPage />} />

            <Route
              path="admin/dashboard"
              element={
                <RoleGuard allowRoles={['super_admin']}>
                  <AdminDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/users-roles"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.USERS_READ]}>
                  <UserRoleManagementPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/leads/pool"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.LEADS_ASSIGN]}>
                  <AdminLeadPoolPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/onboarding/review-center"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.ONBOARDING_REVIEW]}>
                  <AdminOnboardingReviewCenterPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/projects/overview"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <AdminProjectOverviewPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/reports/export"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.REPORTS_EXPORT]}>
                  <AdminReportExportPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/system-config"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.SYSTEM_CONFIG]}>
                  <AdminSystemConfigPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/logs"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.LOGS_READ]}>
                  <OperationLogsPage />
                </RoleGuard>
              }
            />

            <Route
              path="bd/dashboard"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']}>
                  <BdDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <BdLeadsListPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/new"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_WRITE]}>
                  <LeadFormPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/:leadId/edit"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_WRITE]}>
                  <LeadFormPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/:leadId"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <LeadDetailPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/:leadId/followups"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_WRITE]}>
                  <LeadFollowupTimelinePage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/:leadId/status"
              element={
                <RoleGuard
                  allowRoles={['bd_user', 'super_admin']}
                  requiredPermissions={[PERMISSIONS.LEADS_STATUS_CHANGE]}
                >
                  <LeadStatusChangePage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/:leadId/sign"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.CONTRACTS_WRITE]}>
                  <LeadSignContractPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/:leadId/onboarding"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.ONBOARDING_WRITE]}>
                  <LeadInitiateOnboardingPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/onboarding"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.ONBOARDING_READ]}>
                  <BdOnboardingListPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/onboarding/:caseId"
              element={
                <RoleGuard allowRoles={['bd_user', 'project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.ONBOARDING_READ]}>
                  <BdOnboardingDetailPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/projects"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <BdRelatedProjectsPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/projects/:projectId"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <BdProjectDetailPage />
                </RoleGuard>
              }
            />

            <Route
              path="pm/dashboard"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']}>
                  <PmDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/projects"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <PmProjectsListPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/projects/:projectId"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <PmProjectDetailPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/projects/:projectId/progress"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_WRITE]}>
                  <PmProjectProgressPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/projects/:projectId/tasks"
              element={
                <RoleGuard
                  allowRoles={['project_manager', 'super_admin']}
                  requiredPermissions={[PERMISSIONS.PROJECTS_TASK_MANAGE]}
                >
                  <PmProjectTasksPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/projects/:projectId/members"
              element={
                <RoleGuard
                  allowRoles={['project_manager', 'super_admin']}
                  requiredPermissions={[PERMISSIONS.PROJECTS_MEMBER_MANAGE]}
                >
                  <PmProjectMembersPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/projects/:projectId/risks"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_WRITE]}>
                  <PmProjectRisksPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/projects/:projectId/closure"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_WRITE]}>
                  <PmProjectClosurePage />
                </RoleGuard>
              }
            />

            <Route path="files" element={<FileCenterPage />} />
            <Route path="settings/profile" element={<ProfileSettingsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="unauthorized" element={<UnauthorizedPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

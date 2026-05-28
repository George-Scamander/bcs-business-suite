import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { PERMISSIONS } from '../lib/permissions'
import { AppLayout } from './layouts/AppLayout'
import { ProtectedRoute } from '../modules/auth/ProtectedRoute'
import { RoleGuard } from '../modules/auth/RoleGuard'
import { LoginPage } from '../modules/auth/pages/LoginPage'
import { ForgotPasswordPage } from '../modules/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '../modules/auth/pages/ResetPasswordPage'
import { AdminDashboardPage } from '../modules/admin/pages/AdminDashboardPage'
import { AdminAiDataAssistantPage } from '../modules/admin/pages/AdminAiDataAssistantPage'
import { AdminLeadPoolPage } from '../modules/admin/pages/AdminLeadPoolPage'
import { UserRoleManagementPage } from '../modules/admin/pages/UserRoleManagementPage'
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
import { RecentlyDeletedPage } from '../modules/shared/pages/RecentlyDeletedPage'
import { UnauthorizedPage } from '../modules/shared/pages/UnauthorizedPage'
import { BdLeadsListPage } from '../modules/leads/pages/BdLeadsListPage'
import { BdDepartmentLeadsPage } from '../modules/leads/pages/BdDepartmentLeadsPage'
import { LeadFormPage } from '../modules/leads/pages/LeadFormPage'
import { LeadDetailPage } from '../modules/leads/pages/LeadDetailPage'
import { LeadFollowupTimelinePage } from '../modules/leads/pages/LeadFollowupTimelinePage'
import { LeadStatusChangePage } from '../modules/leads/pages/LeadStatusChangePage'
import { LeadSignContractPage } from '../modules/leads/pages/LeadSignContractPage'
import { LeadInitiateOnboardingPage } from '../modules/leads/pages/LeadInitiateOnboardingPage'
import { BdOnboardingListPage } from '../modules/onboarding/pages/BdOnboardingListPage'
import { BdOnboardingDetailPage } from '../modules/onboarding/pages/BdOnboardingDetailPage'
import { OnboardMerchantManagementPage } from '../modules/onboarding/pages/OnboardMerchantManagementPage'
import { OnboardMerchantDetailPage } from '../modules/onboarding/pages/OnboardMerchantDetailPage'
import { BdProjectDetailPage } from '../modules/projects/pages/BdProjectDetailPage'
import { BdRelatedProjectsPage } from '../modules/projects/pages/BdRelatedProjectsPage'
import { PmProjectsListPage } from '../modules/projects/pages/PmProjectsListPage'
import { PmProjectCreatePage } from '../modules/projects/pages/PmProjectCreatePage'
import { PmProjectDetailPage } from '../modules/projects/pages/PmProjectDetailPage'
import { PmProjectProgressPage } from '../modules/projects/pages/PmProjectProgressPage'
import { PmProjectTasksPage } from '../modules/projects/pages/PmProjectTasksPage'
import { PmProjectMembersPage } from '../modules/projects/pages/PmProjectMembersPage'
import { PmProjectClosurePage } from '../modules/projects/pages/PmProjectClosurePage'
import { PmLeadImportPage } from '../modules/leads/pages/PmLeadImportPage'
import { BdSalesCreatePage } from '../modules/sales/pages/BdSalesCreatePage'
import { SalesSupervisionPage } from '../modules/sales/pages/SalesSupervisionPage'
import { BdKpiDashboardPage } from '../modules/reports/pages/BdKpiDashboardPage'
import { BdKpiInsightsPage } from '../modules/reports/pages/BdKpiInsightsPage'

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
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <AdminLeadPoolPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/leads/pool/overview"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <AdminLeadPoolPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/leads/pool/today-new"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <AdminLeadPoolPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/leads/pool/bcs"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <AdminLeadPoolPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/leads/pool/non-bcs"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <AdminLeadPoolPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/leads/pool/high-intent"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <AdminLeadPoolPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/leads/pool/signed"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <AdminLeadPoolPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/leads/pool/bcs-signed"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <AdminLeadPoolPage />
                </RoleGuard>
              }
            />
            <Route
              path="recently-deleted"
              element={
                <RoleGuard allowRoles={['bd_user', 'project_manager', 'super_admin']}>
                  <RecentlyDeletedPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/leads/deleted"
              element={<Navigate to="/app/recently-deleted" replace />}
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
              path="admin/onboarding/merchants"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.ONBOARDING_READ]}>
                  <OnboardMerchantManagementPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/onboarding/merchants/:merchantId"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.ONBOARDING_READ]}>
                  <OnboardMerchantDetailPage />
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
              path="admin/sales/supervision"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <SalesSupervisionPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/sales/product-insight"
              element={<Navigate to="/app/admin/sales/supervision" replace />}
            />
            <Route
              path="admin/ai/data-assistant"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <AdminAiDataAssistantPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/kpi/dashboard"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <BdKpiDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/kpi/dashboard/insights"
              element={
                <RoleGuard allowRoles={['super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <BdKpiInsightsPage />
                </RoleGuard>
              }
            />
            <Route
              path="admin/projects/deleted"
              element={<Navigate to="/app/recently-deleted" replace />}
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
                <RoleGuard allowRoles={['bd_user', 'project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <BdLeadsListPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/department"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <BdDepartmentLeadsPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/new"
              element={
                <RoleGuard allowRoles={['bd_user', 'project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_WRITE]}>
                  <LeadFormPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/sales/new"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_WRITE]}>
                  <BdSalesCreatePage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/deleted"
              element={<Navigate to="/app/recently-deleted" replace />}
            />
            <Route
              path="bd/leads/:leadId/edit"
              element={
                <RoleGuard allowRoles={['bd_user', 'project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_WRITE]}>
                  <LeadFormPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/:leadId"
              element={
                <RoleGuard allowRoles={['bd_user', 'project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_READ]}>
                  <LeadDetailPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/:leadId/followups"
              element={
                <RoleGuard allowRoles={['bd_user', 'project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.LEADS_WRITE]}>
                  <LeadFollowupTimelinePage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/:leadId/status"
              element={
                <RoleGuard
                  allowRoles={['bd_user', 'project_manager', 'super_admin']}
                  requiredPermissions={[PERMISSIONS.LEADS_STATUS_CHANGE]}
                >
                  <LeadStatusChangePage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/:leadId/sign"
              element={
                <RoleGuard allowRoles={['bd_user', 'project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.CONTRACTS_WRITE]}>
                  <LeadSignContractPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/leads/:leadId/onboarding"
              element={
                <RoleGuard allowRoles={['bd_user', 'project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.ONBOARDING_WRITE]}>
                  <LeadInitiateOnboardingPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/onboarding"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.ONBOARDING_READ]}>
                  <OnboardMerchantManagementPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/onboarding/merchants/:merchantId"
              element={
                <RoleGuard allowRoles={['bd_user', 'super_admin']} requiredPermissions={[PERMISSIONS.ONBOARDING_READ]}>
                  <OnboardMerchantDetailPage />
                </RoleGuard>
              }
            />
            <Route
              path="bd/onboarding/cases"
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
              path="pm/sales/supervision"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <SalesSupervisionPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/kpi/dashboard"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <BdKpiDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/kpi/dashboard/insights"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_READ]}>
                  <BdKpiInsightsPage />
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
              path="pm/projects/new"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_WRITE]}>
                  <PmProjectCreatePage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/projects/deleted"
              element={<Navigate to="/app/recently-deleted" replace />}
            />
            <Route
              path="pm/onboarding/merchants"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.ONBOARDING_READ]}>
                  <OnboardMerchantManagementPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/onboarding/merchants/:merchantId"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.ONBOARDING_READ]}>
                  <OnboardMerchantDetailPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/leads/pool"
              element={<Navigate to="/app/bd/leads" replace />}
            />
            <Route
              path="pm/leads/import"
              element={
                <RoleGuard
                  allowRoles={['project_manager', 'super_admin']}
                  requiredPermissions={[PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_WRITE, PERMISSIONS.LEADS_IMPORT]}
                >
                  <PmLeadImportPage />
                </RoleGuard>
              }
            />
            <Route
              path="pm/reports/export"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.REPORTS_EXPORT]}>
                  <AdminReportExportPage />
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
              path="pm/projects/:projectId/closure"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.PROJECTS_WRITE]}>
                  <PmProjectClosurePage />
                </RoleGuard>
              }
            />

            <Route
              path="files"
              element={
                <RoleGuard allowRoles={['project_manager', 'super_admin']} requiredPermissions={[PERMISSIONS.FILES_UPLOAD]}>
                  <FileCenterPage />
                </RoleGuard>
              }
            />
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

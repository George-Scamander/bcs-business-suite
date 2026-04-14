import { Button, Result } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

export function UnauthorizedPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Result
      status="403"
      title="403"
      subTitle={t('result.unauthorizedSubtitle', { defaultValue: 'You do not have enough permissions to access this page.' })}
      extra={
        <Button type="primary" onClick={() => navigate('/app')}>
          {t('result.backHome', { defaultValue: 'Back to Home' })}
        </Button>
      }
    />
  )
}

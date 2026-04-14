import { Button, Result } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

export function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Result
      status="404"
      title="404"
      subTitle={t('result.notFoundSubtitle', { defaultValue: 'The page you are looking for does not exist.' })}
      extra={
        <Button type="primary" onClick={() => navigate('/app')}>
          {t('result.backHome', { defaultValue: 'Back to Home' })}
        </Button>
      }
    />
  )
}

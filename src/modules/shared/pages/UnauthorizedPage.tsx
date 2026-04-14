import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export function UnauthorizedPage() {
  const navigate = useNavigate()

  return (
    <Result
      status="403"
      title="403"
      subTitle="You do not have enough permissions to access this page."
      extra={
        <Button type="primary" onClick={() => navigate('/app')}>
          Back to Home
        </Button>
      }
    />
  )
}

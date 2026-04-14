import { Button, Result } from 'antd'
import { useNavigate } from 'react-router-dom'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <Result
      status="404"
      title="404"
      subTitle="The page you are looking for does not exist."
      extra={
        <Button type="primary" onClick={() => navigate('/app')}>
          Back to Home
        </Button>
      }
    />
  )
}

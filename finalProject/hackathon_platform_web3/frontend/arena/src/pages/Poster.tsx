import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, message, Spin, Tag, Space } from 'antd'
import { TrophyOutlined, ArrowRightOutlined, CalendarOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import request from '../api/request'
import dayjs from 'dayjs'
import '../index.css'

export default function Poster() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [hackathon, setHackathon] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchHackathon()
    }
  }, [id])

  const fetchHackathon = async () => {
    setLoading(true)
    try {
      const data = await request.get(`/hackathons/${id}`)
      setHackathon(data)
    } catch (error) {
      // 不显示错误消息，避免在跳转时闪烁
      console.error('获取活动信息失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取报名时间
  const getRegistrationTime = () => {
    if (!hackathon?.stages) return null
    const registrationStage = hackathon.stages.find((stage: any) => stage.stage === 'registration')
    if (registrationStage) {
      return {
        start: registrationStage.start_time,
        end: registrationStage.end_time,
      }
    }
    return null
  }

  const registrationTime = getRegistrationTime()

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!hackathon) {
    return (
      <div style={{ textAlign: 'center', padding: '60px' }}>
        {t('poster.hackathonNotFound')}
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 科技未来风格背景元素 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          opacity: 0.3,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Card
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            border: 'none',
            overflow: 'hidden',
          }}
        >
          {/* 标题区域 */}
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              margin: '-24px -24px 24px -24px',
              position: 'relative',
            }}
          >
            <TrophyOutlined
              style={{
                fontSize: '64px',
                marginBottom: '16px',
                display: 'block',
                filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))',
              }}
            />
            <h1
              style={{
                fontSize: '36px',
                fontWeight: 700,
                margin: 0,
                textShadow: '0 2px 10px rgba(0,0,0,0.3)',
                fontFamily: 'monospace',
              }}
            >
              {hackathon.name}
            </h1>
          </div>

          {/* 活动信息 */}
          <div style={{ padding: '0 20px' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <CalendarOutlined style={{ marginRight: '8px', color: '#667eea' }} />
                <strong>{t('poster.hackathonTime')}:</strong>
                <span style={{ marginLeft: '8px' }}>
                  {dayjs(hackathon.start_time).format('YYYY-MM-DD')} -{' '}
                  {dayjs(hackathon.end_time).format('YYYY-MM-DD')}
                </span>
              </div>

              {registrationTime && (
                <div>
                  <CalendarOutlined style={{ marginRight: '8px', color: '#667eea' }} />
                  <strong>{t('poster.registrationTime')}:</strong>
                  <span style={{ marginLeft: '8px' }}>
                    {dayjs(registrationTime.start).format('YYYY-MM-DD HH:mm')} -{' '}
                    {dayjs(registrationTime.end).format('YYYY-MM-DD HH:mm')}
                  </span>
                </div>
              )}

              <div>
                <strong>{t('hackathonDetail.description')}:</strong>
                <div
                  style={{
                    marginTop: '12px',
                    padding: '16px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    lineHeight: '1.8',
                    color: '#333',
                  }}
                  dangerouslySetInnerHTML={{ __html: hackathon.description?.substring(0, 200) + '...' }}
                />
              </div>

              {/* 奖项信息 */}
              {hackathon.awards && hackathon.awards.length > 0 && (
                <div>
                  <strong>{t('poster.awards')}:</strong>
                  <div style={{ marginTop: '12px' }}>
                    {hackathon.awards.map((award: any, index: number) => (
                      <Tag
                        key={index}
                        color="blue"
                        style={{
                          fontSize: '14px',
                          padding: '4px 12px',
                          marginBottom: '8px',
                        }}
                      >
                        {award.name}: {award.prize}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              {/* 报名按钮 */}
              <div style={{ textAlign: 'center', marginTop: '32px' }}>
                <Button
                  type="primary"
                  size="large"
                  icon={<ArrowRightOutlined />}
                  onClick={() => navigate(`/hackathons/${id}`)}
                  style={{
                    height: '50px',
                    fontSize: '18px',
                    padding: '0 40px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                  }}
                >
                  {t('hackathon.register')}
                </Button>
              </div>
            </Space>
          </div>
        </Card>
      </div>
    </div>
  )
}


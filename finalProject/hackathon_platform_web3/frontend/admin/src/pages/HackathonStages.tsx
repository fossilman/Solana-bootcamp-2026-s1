import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Form,
  DatePicker,
  Button,
  message,
  Space,
  Row,
  Col,
  Timeline,
  Alert,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import request from '../api/request'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

export default function HackathonStages() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [hackathon, setHackathon] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const stageOptions = [
    { value: 'registration', label: t('hackathon.registrationStage') },
    { value: 'checkin', label: t('hackathon.checkinStage') },
    { value: 'team_formation', label: t('hackathon.teamFormationStage') },
    { value: 'submission', label: t('hackathon.submissionStage') },
    { value: 'voting', label: t('hackathon.votingStage') },
  ]

  useEffect(() => {
    if (id) {
      fetchData()
    }
  }, [id])

  const fetchData = async () => {
    try {
      const [hackathonData, stagesData] = await Promise.all([
        request.get(`/hackathons/${id}`),
        request.get(`/hackathons/${id}/stages`),
      ])
      setHackathon(hackathonData)
      
      // 设置表单初始值
      const initialValues: any = {}
      stagesData.forEach((stage: any) => {
        initialValues[stage.stage] = [
          dayjs(stage.start_time),
          dayjs(stage.end_time),
        ]
      })
      form.setFieldsValue(initialValues)
      setStages(stagesData)
    } catch (error) {
      message.error(t('hackathon.fetchDetailFailed'))
    }
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const stagesData = stageOptions.map((option) => {
        const range = values[option.value]
        if (!range || !range[0] || !range[1]) {
          return null
        }
        // 使用 RFC3339 格式：YYYY-MM-DDTHH:mm:ssZ
        return {
          stage: option.value,
          start_time: range[0].toISOString(),
          end_time: range[1].toISOString(),
        }
      }).filter(Boolean)

      await request.put(`/hackathons/${id}/stages`, { stages: stagesData })
      message.success(t('hackathon.updateSuccess'))
      fetchData()
    } catch (error: any) {
      message.error(error.response?.data?.message || t('hackathon.updateFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container" data-testid="hackathon-stages-page">
      <Card
        title={
          <div style={{ fontSize: '20px', fontWeight: 600 }} data-testid="hackathon-stages-title">
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(`/hackathons/${id}`)}
                data-testid="hackathon-stages-back-button"
                aria-label={t('common.back')}
              >
                {t('common.back')}
              </Button>
              <span>{t('hackathon.stages')} - {hackathon?.name}</span>
            </Space>
          </div>
        }
        data-testid="hackathon-stages-card"
      >
        {hackathon && (
          <Alert
            message={`${t('hackathon.startTime')}: ${dayjs(hackathon.start_time).format('YYYY-MM-DD HH:mm')} - ${dayjs(hackathon.end_time).format('YYYY-MM-DD HH:mm')}`}
            type="info"
            style={{ marginBottom: '24px' }}
            data-testid="hackathon-stages-alert"
          />
        )}

        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
          data-testid="hackathon-stages-form"
        >
          <Row gutter={[16, 16]}>
            {stageOptions.map((option) => (
              <Col xs={24} sm={12} lg={12} key={option.value}>
                <Form.Item
                  name={option.value}
                  label={option.label}
                  rules={[
                    { required: true, message: t('hackathon.stageTimeRequired', { stage: option.label }) },
                  ]}
                >
                  <RangePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: '100%' }}
                    placeholder={[t('hackathon.startTime'), t('hackathon.endTime')]}
                    data-testid={`hackathon-stages-form-${option.value}-picker`}
                    aria-label={`${option.label} ${t('hackathon.stageTime')}`}
                  />
                </Form.Item>
              </Col>
            ))}
          </Row>

          <Form.Item style={{ marginTop: '24px' }}>
            <Space data-testid="hackathon-stages-form-actions">
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={loading}
                size="large"
                data-testid="hackathon-stages-form-submit-button"
                aria-label={t('common.save')}
              >
                {t('common.save')}
              </Button>
              <Button 
                onClick={() => navigate(`/hackathons/${id}`)} 
                size="large"
                data-testid="hackathon-stages-form-cancel-button"
                aria-label={t('cancel')}
              >
                {t('cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {/* 时间轴预览 */}
        {stages.length > 0 && (
          <div style={{ marginTop: '32px' }} data-testid="hackathon-stages-timeline">
            <h3 style={{ marginBottom: '16px' }}>{t('hackathon.timelinePreview')}</h3>
            <Timeline data-testid="hackathon-stages-timeline-list">
              {stages
                .sort((a, b) =>
                  dayjs(a.start_time).isBefore(dayjs(b.start_time)) ? -1 : 1
                )
                .map((stage) => {
                  const option = stageOptions.find(
                    (opt) => opt.value === stage.stage
                  )
                  return (
                    <Timeline.Item 
                      key={stage.stage} 
                      color="blue"
                      data-testid={`hackathon-stages-timeline-item-${stage.stage}`}
                    >
                      <div>
                        <strong>{option?.label || stage.stage}</strong>
                        <div style={{ marginTop: '8px', color: '#8c8c8c' }}>
                          {dayjs(stage.start_time).format('YYYY-MM-DD HH:mm')} -{' '}
                          {dayjs(stage.end_time).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                    </Timeline.Item>
                  )
                })}
            </Timeline>
          </div>
        )}
      </Card>
    </div>
  )
}


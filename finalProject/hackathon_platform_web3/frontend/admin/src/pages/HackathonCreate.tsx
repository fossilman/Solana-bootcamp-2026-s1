import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Form,
  Input,
  Button,
  DatePicker,
  Select,
  Card,
  message,
  Space,
  InputNumber,
  Row,
  Col,
  Table,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import request from '../api/request'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

// 城市列表
const CITIES = [
  '北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '武汉', '西安', '重庆',
  '天津', '苏州', '长沙', '郑州', '青岛', '大连', '厦门', '福州', '济南', '合肥',
  '石家庄', '太原', '哈尔滨', '长春', '沈阳', '南昌', '昆明', '贵阳', '南宁', '海口',
  '乌鲁木齐', '拉萨', '银川', '西宁', '呼和浩特'
]

interface Prize {
  name: string
  description?: string
  image_url?: string
}

interface Award {
  name: string
  prize: string
  quantity: number
  rank: number
  prizes?: Prize[]
}

export default function HackathonCreate() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [locationType, setLocationType] = useState('online')
  const [awards, setAwards] = useState<Award[]>([
    { name: '', prize: '1000USD', quantity: 1, rank: 1, prizes: [{ name: '', description: '' }] },
    { name: '', prize: '500USD', quantity: 2, rank: 2, prizes: [{ name: '', description: '' }] },
    { name: '', prize: '200USD', quantity: 3, rank: 3, prizes: [{ name: '', description: '' }] },
  ])
  const [autoAssignStages, setAutoAssignStages] = useState(true)
  const isEdit = !!id

  useEffect(() => {
    if (isEdit && id) {
      fetchDetail()
    }
  }, [id, isEdit])

  const fetchDetail = async () => {
    try {
      const response = await request.get(`/hackathons/${id}`)
      const data = response as any
      form.setFieldsValue({
        ...data,
        timeRange: [dayjs(data.start_time), dayjs(data.end_time)],
        max_participants: data.max_participants || 0,
      })
      setLocationType(data.location_type || 'online')
      if (data.awards && data.awards.length > 0) {
        setAwards(data.awards)
      }
    } catch (error) {
      message.error(t('hackathon.fetchDetailFailed'))
    }
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const [startTime, endTime] = values.timeRange
      // 使用 RFC3339 格式：YYYY-MM-DDTHH:mm:ssZ
      const payload = {
        ...values,
        start_time: startTime.format('YYYY-MM-DD') + 'T00:00:00Z',
        end_time: endTime.format('YYYY-MM-DD') + 'T23:59:59Z',
        timeRange: undefined,
        awards: awards,
        auto_assign_stages: autoAssignStages,
      }

      if (isEdit) {
        await request.put(`/hackathons/${id}`, payload)
        message.success(t('hackathon.updateSuccess'))
      } else {
        await request.post('/hackathons', payload)
        message.success(t('hackathon.createSuccess'))
      }
      navigate('/hackathons')
    } catch (error) {
      message.error(isEdit ? t('hackathon.updateFailed') : t('hackathon.createFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddAward = () => {
    const newRank = awards.length > 0 ? Math.max(...awards.map(a => a.rank)) + 1 : 1
    setAwards([...awards, { name: '', prize: '', quantity: 1, rank: newRank }])
  }

  const handleRemoveAward = (index: number) => {
    setAwards(awards.filter((_, i) => i !== index))
  }

  const handleAwardChange = (index: number, field: keyof Award, value: any) => {
    const newAwards = [...awards]
    newAwards[index] = { ...newAwards[index], [field]: value }
    setAwards(newAwards)
  }

  return (
    <div className="page-container" data-testid="hackathon-create-page">
      <Card
        title={
          <div style={{ fontSize: '20px', fontWeight: 600 }} data-testid="hackathon-create-title">
            {isEdit ? t('hackathon.edit') : t('hackathon.create')}
          </div>
        }
        data-testid="hackathon-create-card"
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
          initialValues={{ location_type: 'online', max_team_size: 3 }}
          data-testid="hackathon-create-form"
        >
          <Form.Item
            name="name"
            label={t('hackathon.name')}
            rules={[{ required: true, message: t('hackathon.nameRequired') }]}
          >
            <Input 
              placeholder={t('hackathon.namePlaceholder')} 
              data-testid="hackathon-create-form-name-input"
              aria-label={t('hackathon.name')}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={t('hackathon.description')}
            rules={[{ required: true, message: t('hackathon.descriptionRequired') }]}
          >
            <Input.TextArea 
              rows={4}
              placeholder={t('hackathon.descriptionPlaceholder')}
              data-testid="hackathon-create-form-description-input"
              aria-label={t('hackathon.description')}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="timeRange"
                label={t('hackathon.startTime')}
                rules={[{ required: true, message: t('hackathon.endTimeRequired') }]}
              >
                <RangePicker
                  format="YYYY-MM-DD"
                  style={{ width: '100%' }}
                  data-testid="hackathon-create-form-time-range-picker"
                  aria-label={t('hackathon.startTime')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="location_type"
                label={t('hackathon.locationType')}
                rules={[{ required: true, message: t('hackathon.locationTypeRequired') }]}
              >
                <Select 
                  placeholder={t('hackathon.locationTypePlaceholder')}
                  onChange={(value) => setLocationType(value)}
                  data-testid="hackathon-create-form-location-type-select"
                  aria-label={t('hackathon.locationType')}
                >
                  <Select.Option value="online" data-testid="hackathon-create-form-location-online">{t('hackathon.locationOnline')}</Select.Option>
                  <Select.Option value="offline" data-testid="hackathon-create-form-location-offline">{t('hackathon.locationOffline')}</Select.Option>
                  <Select.Option value="hybrid" data-testid="hackathon-create-form-location-hybrid">{t('hackathon.locationHybrid')}</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {(locationType === 'offline' || locationType === 'hybrid') && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="city"
                  label={t('hackathon.city')}
                  rules={[{ required: true, message: t('hackathon.cityRequired') }]}
                >
                  <Select 
                    placeholder={t('hackathon.cityPlaceholder')}
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={CITIES.map(city => ({ label: city, value: city }))}
                    data-testid="hackathon-create-form-city-select"
                    aria-label={t('hackathon.city')}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="location_detail"
                  label={t('hackathon.address')}
                  rules={[{ required: true, message: t('hackathon.addressRequired') }]}
                >
                  <Input 
                    placeholder={t('hackathon.addressPlaceholder')} 
                    data-testid="hackathon-create-form-location-detail-input"
                    aria-label={t('hackathon.address')}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          {(locationType === 'offline' || locationType === 'hybrid') && (
            <Form.Item
              name="map_location"
              label={t('hackathon.mapLocation')}
              tooltip={t('hackathon.mapLocationTooltip')}
            >
              <div 
                id="map-container"
                style={{ 
                  width: '100%', 
                  height: '400px', 
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  background: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999'
                }}
                data-testid="hackathon-create-form-map-container"
              >
                {t('hackathon.mapComponent')}
              </div>
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="max_team_size"
                label={t('hackathon.maxTeamSize')}
                rules={[
                  { required: true, message: t('hackathon.maxTeamSizeRequired') },
                  { type: 'number', min: 1, message: t('hackathon.maxTeamSizeMin') },
                ]}
              >
                <InputNumber
                  min={1}
                  max={20}
                  placeholder={t('hackathon.maxTeamSizePlaceholder')}
                  style={{ width: '100%' }}
                  data-testid="hackathon-create-form-max-team-size-input"
                  aria-label={t('hackathon.maxTeamSize')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="max_participants"
                label={t('hackathon.maxParticipants')}
                tooltip={t('hackathon.maxParticipantsTooltip')}
                rules={[
                  { type: 'number', min: 0, message: t('hackathon.maxParticipantsMin') },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={t('hackathon.maxParticipantsPlaceholder')}
                  min={0}
                  data-testid="hackathon-create-form-max-participants-input"
                  aria-label={t('hackathon.maxParticipants')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={t('hackathon.timeSettings')}>
            <div style={{ marginBottom: '16px' }}>
              <input
                type="checkbox"
                checked={autoAssignStages}
                onChange={(e) => setAutoAssignStages(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <label>{t('hackathon.autoAssignStages')}</label>
            </div>
          </Form.Item>

          <Form.Item label={t('hackathon.awardSettings')}>
            <div style={{ marginBottom: '16px' }}>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddAward}
                style={{ width: '100%' }}
                data-testid="hackathon-create-form-add-award-button"
              >
                {t('hackathon.addAward')}
              </Button>
            </div>
            <Table
              dataSource={awards}
              rowKey={(record, index) => `award-${index}`}
              pagination={false}
              columns={[
                {
                  title: t('hackathon.awardName'),
                  dataIndex: 'name',
                  key: 'name',
                  render: (text, record, index) => (
                    <Input
                      value={text}
                      onChange={(e) => handleAwardChange(index, 'name', e.target.value)}
                      placeholder={t('hackathon.awardNamePlaceholder')}
                    />
                  ),
                },
                {
                  title: t('hackathon.prizeAmount'),
                  dataIndex: 'prize',
                  key: 'prize',
                  render: (text, record, index) => (
                    <Input
                      value={text}
                      onChange={(e) => handleAwardChange(index, 'prize', e.target.value)}
                      placeholder={t('hackathon.prizeAmountPlaceholder')}
                    />
                  ),
                },
                {
                  title: t('hackathon.prizes'),
                  key: 'prizes',
                  width: 200,
                  render: (text, record, index) => (
                    <div>
                      {record.prizes && record.prizes.length > 0 ? (
                        record.prizes.map((prize, pIndex) => (
                          <div key={pIndex} style={{ marginBottom: '4px' }}>
                            {prize.name}
                            {prize.description && ` (${prize.description})`}
                          </div>
                        ))
                      ) : (
                        <span style={{ color: '#999' }}>{t('hackathon.noPrizes')}</span>
                      )}
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          // 添加奖品功能（简化实现）
                          const newAwards = [...awards]
                          if (!newAwards[index].prizes) {
                            newAwards[index].prizes = []
                          }
                          newAwards[index].prizes!.push({ name: '', description: '' })
                          setAwards(newAwards)
                        }}
                      >
                        {t('hackathon.addPrize')}
                      </Button>
                    </div>
                  ),
                },
                {
                  title: t('hackathon.quantity'),
                  dataIndex: 'quantity',
                  key: 'quantity',
                  width: 100,
                  render: (text, record, index) => (
                    <InputNumber
                      value={text}
                      onChange={(value) => handleAwardChange(index, 'quantity', value || 1)}
                      min={1}
                      style={{ width: '100%' }}
                    />
                  ),
                },
                {
                  title: t('hackathon.actions'),
                  key: 'action',
                  width: 80,
                  render: (_, record, index) => (
                    <Button
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveAward(index)}
                    >
                      {t('hackathon.delete')}
                    </Button>
                  ),
                },
              ]}
              data-testid="hackathon-create-form-awards-table"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: '24px', marginBottom: 0 }}>
            <Space data-testid="hackathon-create-form-actions">
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading} 
                size="large"
                data-testid="hackathon-create-form-submit-button"
                aria-label={isEdit ? t('hackathon.update') : t('hackathon.create')}
              >
                {isEdit ? t('hackathon.update') : t('hackathon.create')}
              </Button>
              <Button 
                onClick={() => navigate('/hackathons')} 
                size="large"
                data-testid="hackathon-create-form-cancel-button"
                aria-label={t('hackathon.cancel')}
              >
                {t('hackathon.cancel')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}


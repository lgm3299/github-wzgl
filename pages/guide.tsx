import React from 'react';
import { Typography, Card, Space, Steps, Tag } from 'antd';
import {
  BookOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  InboxOutlined,
  ExportOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

const GuidePage: React.FC = () => {
  return (
    <div>
      <Title level={4}>
        <Space><BookOutlined />使用指南</Space>
      </Title>

      {/* 系统简介 */}
      <Card title={<Space><DatabaseOutlined />系统简介</Space>} style={{ marginBottom: 16 }}>
        <Paragraph>
          两江校区后勤物资管理系统，用于统一管理物资的<strong>入库、出库、库存、盘点</strong>等全流程操作。
          系统基于 Cloudflare Pages 部署，数据存储于 Supabase 云数据库。
        </Paragraph>
      </Card>

      {/* 功能模块 */}
      <Card title={<Space><SettingOutlined />功能模块</Space>} style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong><InboxOutlined style={{ marginRight: 8 }} />仪表盘</Text>
            <br />
            <Text type="secondary">查看物资总数、供应商数量、本月出入库统计及库存预警信息。</Text>
          </div>

          <div>
            <Text strong><SafetyCertificateOutlined style={{ marginRight: 8 }} />物资档案</Text>
            <br />
            <Text type="secondary">
              管理物资基本信息（名称、编码、分类、规格、单位、单价、安全库存量等），
              支持按关键词、分类、状态筛选。
            </Text>
          </div>

          <div>
            <Text strong>供应商管理</Text>
            <br />
            <Text type="secondary">维护供应商档案，记录联系人、电话、邮箱、地址等信息。</Text>
          </div>

          <div>
            <Text strong><InboxOutlined style={{ marginRight: 8 }} />入库管理</Text>
            <br />
            <Text type="secondary">
              创建入库单 → 填写物资明细 → 审批确认后自动增加库存。支持草稿和已完成状态流转。
            </Text>
          </div>

          <div>
            <Text strong><ExportOutlined style={{ marginRight: 8 }} />出库管理</Text>
            <br />
            <Text type="secondary">
              创建出库单 → 选择领用人和物资明细 → 审批确认后自动扣减库存。
              出库时会校验库存是否充足。
            </Text>
          </div>

          <div>
            <Text strong>库存管理</Text>
            <br />
            <Text type="secondary">实时查看各物资库存量，关联物资名称和所属分类。</Text>
          </div>

          <div>
            <Text strong>盘点管理</Text>
            <br />
            <Text type="secondary">
              定期盘点库存，录入实盘数量，系统自动计算盈亏差异。
            </Text>
          </div>

          <div>
            <Text strong><BarChartOutlined style={{ marginRight: 8 }} />报表统计</Text>
            <br />
            <Text type="secondary">导出入口库明细报表，支持 Excel 格式下载。</Text>
          </div>

          <div>
            <Text strong>后台管理</Text>
            <br />
            <Text type="secondary">管理员可管理用户账号、分配角色权限（管理员/普通用户）。</Text>
          </div>
        </Space>
      </Card>

      {/* 使用流程 */}
      <Card title="操作流程" style={{ marginBottom: 16 }}>
        <Steps
          direction="vertical"
          size="small"
          current={-1}
          items={[
            {
              title: '登录系统',
              description: '使用 Supabase 账号密码登录，首次登录需管理员创建账户。',
            },
            {
              title: '维护基础数据',
              description: '先添加物资分类和供应商，再录入物资档案。',
            },
            {
              title: '日常入库',
              description: '选择供应商，填写入库单明细，审批后库存自动增加。',
            },
            {
              title: '日常出库',
              description: '填写领用人、选择物资和数量，审批后库存自动扣减。',
            },
            {
              title: '定期盘点',
              description: '创建盘点单，录入实盘数，查看盈亏报告。',
            },
            {
              title: '导出报表',
              description: '在报表页面筛选时间范围，导出 Excel 明细表。',
            },
          ]}
        />
      </Card>

      {/* 技术信息 */}
      <Card title="技术信息">
        <Space wrap>
          <Tag color="blue">React + TypeScript</Tag>
          <Tag color="green">Ant Design 5</Tag>
          <Tag color="purple">Supabase</Tag>
          <Tag color="orange">Cloudflare Pages</Tag>
          <Tag color="cyan">Vite</Tag>
        </Space>
      </Card>
    </div>
  );
};

export default GuidePage;

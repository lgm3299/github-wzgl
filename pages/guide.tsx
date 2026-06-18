import React from 'react';
import {
  Typography,
  Collapse,
  Steps,
  Table,
  Tag,
  Alert,
  Space,
  Divider,
  Card,
  Row,
  Col,
} from 'antd';
import {
  BookOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  ShopOutlined,
  ImportOutlined,
  ExportOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  FileExcelOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const GuidePage: React.FC = () => {
  const roleColumns = [
    { title: '角色', dataIndex: 'role', key: 'role', width: 100 },
    { title: '编码', dataIndex: 'code', key: 'code', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    { title: '权限说明', dataIndex: 'desc', key: 'desc' },
  ];

  const roleData = [
    { key: '1', role: '管理员', code: 'admin', desc: '系统全部权限，可管理用户、角色、部门，查看所有数据' },
    { key: '2', role: '后勤主管', code: 'director', desc: '审批出入库单、管理基础数据（物资/供应商）、查看报表' },
    { key: '3', role: '库管员', code: 'manager', desc: '执行出入库操作、库存管理、盘点操作' },
    { key: '4', role: '普通职工', code: 'staff', desc: '查询物资信息、查看库存、提交出库申请' },
  ];

  const moduleItems = [
    {
      key: 'overview',
      label: <Space><DashboardOutlined /><Text strong>系统概述</Text></Space>,
      children: (
        <div>
          <Paragraph>
            两江校区后勤物资管理系统是一套面向两江校区后勤管理部门的物资全生命周期管理平台，
            覆盖从物资档案建立、供应商对接，到入库、库存、出库、盘点、报表统计的完整业务流程。
          </Paragraph>
          <Paragraph>
            <Text strong>核心功能模块：</Text>
          </Paragraph>
          <Row gutter={[16, 16]}>
            {[
              { icon: <DashboardOutlined style={{ fontSize: 24, color: '#1890ff' }} />, title: '仪表盘', desc: '系统数据总览，关键指标一目了然' },
              { icon: <AppstoreOutlined style={{ fontSize: 24, color: '#52c41a' }} />, title: '物资档案', desc: '物资信息维护，分类管理' },
              { icon: <ShopOutlined style={{ fontSize: 24, color: '#faad14' }} />, title: '供应商管理', desc: '供应商信息登记与维护' },
              { icon: <ImportOutlined style={{ fontSize: 24, color: '#722ed1' }} />, title: '入库管理', desc: '物资入库登记、审批' },
              { icon: <ExportOutlined style={{ fontSize: 24, color: '#eb2f96' }} />, title: '出库管理', desc: '物资出库申请、审批、发放' },
              { icon: <DatabaseOutlined style={{ fontSize: 24, color: '#13c2c2' }} />, title: '库存管理', desc: '库存查询与预警管理' },
              { icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#fa541c' }} />, title: '盘点管理', desc: '定期盘点与差异处理' },
              { icon: <BarChartOutlined style={{ fontSize: 24, color: '#2f54eb' }} />, title: '报表统计', desc: '多维度数据报表' },
              { icon: <SettingOutlined style={{ fontSize: 24, color: '#595959' }} />, title: '后台管理', desc: '用户、部门、角色管理（管理员专有）' },
            ].map((item, idx) => (
              <Col span={8} key={idx}>
                <Card size="small" hoverable>
                  <Space direction="vertical" align="center" style={{ width: '100%' }}>
                    {item.icon}
                    <Text strong>{item.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ),
    },
    {
      key: 'roles',
      label: <Space><SafetyOutlined /><Text strong>角色与权限</Text></Space>,
      children: (
        <div>
          <Paragraph>
            系统采用 <Tag color="blue">RBAC（基于角色的访问控制）</Tag> 权限模型，
            不同角色拥有不同的操作权限，确保数据安全。
          </Paragraph>
          <Table
            columns={roleColumns}
            dataSource={roleData}
            pagination={false}
            size="small"
            bordered
            style={{ maxWidth: 800 }}
          />
          <Divider />
          <Alert
            message="提示"
            description="如需调整角色权限或新增用户，请联系系统管理员在「后台管理」模块进行操作。"
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />
        </div>
      ),
    },
    {
      key: 'dashboard',
      label: <Space><DashboardOutlined /><Text strong>仪表盘</Text></Space>,
      children: (
        <div>
          <Paragraph>
            仪表盘是登录后的默认首页，提供系统运行状况的全局概览。
          </Paragraph>
          <Paragraph>
            <Text strong>展示内容包括：</Text>
          </Paragraph>
          <ul>
            <li><Text>物资总数、库存总量、本月入库/出库数量、当前预警数</Text></li>
            <li><Text>最近入库记录列表（最近 10 条）</Text></li>
            <li><Text>最近出库记录列表（最近 10 条）</Text></li>
          </ul>
          <Paragraph type="secondary">
            点击右上角"刷新"按钮可重新加载最新数据。
          </Paragraph>
        </div>
      ),
    },
    {
      key: 'materials',
      label: <Space><AppstoreOutlined /><Text strong>物资档案</Text></Space>,
      children: (
        <div>
          <Paragraph>
            物资档案是系统的基础数据模块，用于维护所有物资的基本信息。
          </Paragraph>
          <Paragraph><Text strong>主要操作：</Text></Paragraph>
          <ul>
            <li><Text strong>新增物资：</Text>点击"新增物资"按钮，填写物资编码、名称、分类、规格、单位、最低库存等信息。</li>
            <li><Text strong>编辑物资：</Text>点击表格中的"编辑"按钮修改物资信息。编码不可重复。</li>
            <li><Text strong>删除物资：</Text>点击"删除"按钮并确认，可删除未关联库存的物资。</li>
            <li><Text strong>分类筛选：</Text>使用顶部分类下拉框快速筛选不同类别的物资。</li>
            <li><Text strong>批量导入：</Text>点击"导入"按钮，可选择 Excel 文件批量导入物资数据。</li>
            <li><Text strong>导出数据：</Text>点击"导出"按钮，将当前列表导出为 Excel 文件。</li>
          </ul>
          <Alert
            message="导入模板说明"
            description="导入 Excel 需包含以下列：物资编码、物资名称、分类、规格、单位、最低库存、备注。其中物资编码和名称为必填项。"
            type="info"
            showIcon
          />
        </div>
      ),
    },
    {
      key: 'suppliers',
      label: <Space><ShopOutlined /><Text strong>供应商管理</Text></Space>,
      children: (
        <div>
          <Paragraph>
            供应商管理用于维护物资供应商的基本信息，入库时需关联供应商。
          </Paragraph>
          <Paragraph><Text strong>主要操作：</Text></Paragraph>
          <ul>
            <li><Text strong>新增供应商：</Text>填写供应商名称、联系人、联系电话、地址等信息。</li>
            <li><Text strong>编辑/删除：</Text>修改或删除供应商信息（已关联入库单的供应商建议保留）。</li>
            <li><Text strong>导入/导出：</Text>支持 Excel 批量导入和导出。</li>
          </ul>
        </div>
      ),
    },
    {
      key: 'inbound',
      label: <Space><ImportOutlined /><Text strong>入库管理</Text></Space>,
      children: (
        <div>
          <Paragraph>
            入库管理是物资进入仓库的核心模块，支持创建入库单、提交审批全流程。
          </Paragraph>
          <Divider orientation="left" plain>操作流程</Divider>
          <Steps
            size="small"
            direction="vertical"
            current={-1}
            items={[
              {
                title: '第一步：创建入库单',
                description: '点击"新增入库"按钮，选择供应商，添加入库物资明细（选择物资、填写数量、单价）。可添加多条明细。',
              },
              {
                title: '第二步：提交入库单',
                description: '确认信息无误后提交。入库单初始状态为"草稿"。',
              },
              {
                title: '第三步：审批入库单',
                description: '后勤主管在列表中找到待审批入库单，点击"审批"按钮进行审批。审批通过后库存自动增加。',
              },
            ]}
          />
          <Divider />
          <Paragraph><Text strong>入库单状态说明：</Text></Paragraph>
          <Space>
            <Tag color="default">草稿</Tag>
            <Tag color="processing">待审批</Tag>
            <Tag color="success">已完成</Tag>
            <Tag color="error">已驳回</Tag>
          </Space>
          <Divider />
          <Alert
            message="注意事项"
            description="审批通过的入库单会自动增加对应物资的库存数量，并检查是否触发库存预警。"
            type="warning"
            showIcon
          />
        </div>
      ),
    },
    {
      key: 'outbound',
      label: <Space><ExportOutlined /><Text strong>出库管理</Text></Space>,
      children: (
        <div>
          <Paragraph>
            出库管理用于物资的领用出库，支持从申请到发放的完整流程。
          </Paragraph>
          <Divider orientation="left" plain>操作流程</Divider>
          <Steps
            size="small"
            direction="vertical"
            current={-1}
            items={[
              {
                title: '第一步：创建出库单',
                description: '点击"新增出库"按钮，选择领用部门、领用人，添加出库物资明细（选择物资、填写数量）。系统会自动检查库存是否充足。',
              },
              {
                title: '第二步：提交审批',
                description: '出库单提交后状态变为"待审批"。',
              },
              {
                title: '第三步：主管审批',
                description: '后勤主管点击"审批"按钮审批出库单。',
              },
              {
                title: '第四步：完成出库',
                description: '审批通过后可点击"完成出库"，系统自动扣减库存。',
              },
            ]}
          />
          <Divider />
          <Paragraph><Text strong>出库单状态说明：</Text></Paragraph>
          <Space>
            <Tag color="default">草稿</Tag>
            <Tag color="processing">待审批</Tag>
            <Tag color="warning">已审批</Tag>
            <Tag color="success">已完成</Tag>
            <Tag color="error">已驳回</Tag>
          </Space>
        </div>
      ),
    },
    {
      key: 'inventory',
      label: <Space><DatabaseOutlined /><Text strong>库存管理</Text></Space>,
      children: (
        <div>
          <Paragraph>
            库存管理提供当前库存的实时查看和预警管理功能。
          </Paragraph>
          <Paragraph><Text strong>两个标签页：</Text></Paragraph>
          <ul>
            <li>
              <Text strong>库存列表：</Text>
              展示所有物资的当前库存量、最近出入库时间。支持按物资名称搜索。<br />
              <Text type="secondary">当库存量低于最低库存时，该行会标红高亮显示。</Text>
            </li>
            <li>
              <Text strong>库存预警：</Text>
              展示所有库存预警记录。管理员可点击"解决预警"来处理预警（如补货后关闭预警）。<br />
              <Text type="secondary">
                预警触发规则：入库或出库操作完成后，系统自动检查库存，若低于最低库存则生成预警。
              </Text>
            </li>
          </ul>
        </div>
      ),
    },
    {
      key: 'stocktaking',
      label: <Space><CheckCircleOutlined /><Text strong>盘点管理</Text></Space>,
      children: (
        <div>
          <Paragraph>
            盘点管理用于定期核对系统库存与实际库存的一致性。
          </Paragraph>
          <Divider orientation="left" plain>操作流程</Divider>
          <Steps
            size="small"
            direction="vertical"
            current={-1}
            items={[
              {
                title: '第一步：创建盘点单',
                description: '点击"新增盘点"按钮，填写盘点名称和备注。',
              },
              {
                title: '第二步：填写盘点明细',
                description: '添加盘点物资，填写实际盘点数量。系统会自动计算差异（实际数量 - 系统库存）。',
              },
              {
                title: '第三步：完成盘点',
                description: '确认盘点结果无误后，点击"完成盘点"。系统将生成差异报告并更新库存。',
              },
            ]}
          />
          <Divider />
          <Alert
            message="导入功能"
            description="支持通过 Excel 批量导入盘点数据，Excel 需包含：物资编码、实际数量、差异原因、备注列。"
            type="info"
            showIcon
          />
        </div>
      ),
    },
    {
      key: 'reports',
      label: <Space><BarChartOutlined /><Text strong>报表统计</Text></Space>,
      children: (
        <div>
          <Paragraph>
            报表统计提供多维度的数据汇总和分析功能。
          </Paragraph>
          <Paragraph><Text strong>四个标签页：</Text></Paragraph>
          <ul>
            <li><Text strong>汇总统计：</Text>展示物资总数、库存总量、本月出入库次数等关键汇总指标。</li>
            <li><Text strong>入库报表：</Text>按时间范围和物资类别筛选入库记录。</li>
            <li><Text strong>出库报表：</Text>按时间范围和物资类别筛选出库记录。</li>
            <li><Text strong>库存报表：</Text>按分类汇总库存分布情况。</li>
          </ul>
          <Paragraph type="secondary">
            所有报表均支持导出为 Excel 文件，方便进一步分析和存档。
          </Paragraph>
        </div>
      ),
    },
    {
      key: 'admin',
      label: <Space><SettingOutlined /><Text strong>后台管理（管理员）</Text></Space>,
      children: (
        <div>
          <Alert
            message="权限说明"
            description="此模块仅系统管理员（admin 角色）可访问。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Paragraph><Text strong>三个管理标签页：</Text></Paragraph>
          <ul>
            <li>
              <Text strong>用户管理：</Text>
              管理系统用户账号，包括新增、编辑、删除用户，为用户分配角色。
            </li>
            <li>
              <Text strong>角色管理：</Text>
              管理角色定义，每个角色对应不同的操作权限集合。
            </li>
            <li>
              <Text strong>部门管理：</Text>
              管理组织架构中的部门信息。
            </li>
          </ul>
        </div>
      ),
    },
    {
      key: 'import',
      label: <Space><FileExcelOutlined /><Text strong>导入导出功能说明</Text></Space>,
      children: (
        <div>
          <Paragraph>
            系统多个模块支持 Excel 批量导入导出，提高数据录入效率。
          </Paragraph>
          <Paragraph><Text strong>支持导入的模块：</Text></Paragraph>
          <ul>
            <li><Tag color="green">物资档案</Tag> — 批量导入物资基础信息</li>
            <li><Tag color="green">供应商管理</Tag> — 批量导入供应商信息</li>
            <li><Tag color="green">入库管理</Tag> — 批量导入入库明细</li>
            <li><Tag color="green">出库管理</Tag> — 批量导入出库明细</li>
            <li><Tag color="green">库存管理</Tag> — 批量导入库存数据</li>
            <li><Tag color="green">盘点管理</Tag> — 批量导入盘点数据</li>
          </ul>
          <Divider />
          <Paragraph><Text strong>操作步骤：</Text></Paragraph>
          <Steps
            size="small"
            direction="vertical"
            current={-1}
            items={[
              {
                title: '获取模板',
                description: '点击对应页面的"导出"按钮，导出一条现有数据作为模板参考。',
              },
              {
                title: '填写数据',
                description: '在 Excel 中按模板格式填写数据，确保必填列（如物资编码、数量）完整。',
              },
              {
                title: '导入文件',
                description: '点击"导入"按钮，选择填写好的 Excel 文件上传。',
              },
              {
                title: '查看结果',
                description: '系统会显示导入结果，包括成功导入条数和跳过条数及原因。',
              },
            ]}
          />
          <Divider />
          <Alert
            message="导入注意事项"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>Excel 列名需与系统要求一致，不要修改表头文字</li>
                <li>物资编码必须在系统中已存在，否则该行会被跳过</li>
                <li>数量列必须填写有效的数字</li>
                <li>导入结果会详细说明每行数据被跳过的原因</li>
              </ul>
            }
            type="warning"
            showIcon
          />
        </div>
      ),
    },
    {
      key: 'workflow',
      label: <Space><ThunderboltOutlined /><Text strong>核心业务流程总览</Text></Space>,
      children: (
        <div>
          <Card title={<Space><ImportOutlined /><Text strong>入库流程</Text></Space>} size="small" style={{ marginBottom: 16 }}>
            <Steps
              size="small"
              current={-1}
              items={[
                { title: '创建入库单', description: '库管员' },
                { title: '提交审批', description: '库管员' },
                { title: '审批通过', description: '后勤主管' },
                { title: '库存增加', description: '系统自动' },
                { title: '预警检查', description: '系统自动' },
              ]}
            />
          </Card>
          <Card title={<Space><ExportOutlined /><Text strong>出库流程</Text></Space>} size="small" style={{ marginBottom: 16 }}>
            <Steps
              size="small"
              current={-1}
              items={[
                { title: '创建出库单', description: '职工' },
                { title: '提交审批', description: '职工' },
                { title: '审批通过', description: '后勤主管' },
                { title: '完成出库', description: '库管员' },
                { title: '库存扣减', description: '系统自动' },
                { title: '预警检查', description: '系统自动' },
              ]}
            />
          </Card>
          <Card title={<Space><CheckCircleOutlined /><Text strong>盘点流程</Text></Space>} size="small">
            <Steps
              size="small"
              current={-1}
              items={[
                { title: '创建盘点单', description: '库管员' },
                { title: '填写盘点明细', description: '库管员' },
                { title: '完成盘点', description: '库管员' },
                { title: '生成差异报告', description: '系统自动' },
              ]}
            />
          </Card>
        </div>
      ),
    },
    {
      key: 'faq',
      label: <Space><QuestionCircleOutlined /><Text strong>常见问题</Text></Space>,
      children: (
        <div>
          <Paragraph><Text strong>Q1：导入 Excel 提示"导入 0 条记录"？</Text></Paragraph>
          <Paragraph type="secondary">
            请检查：① Excel 列名是否与模板一致（注意列名不能有空格）；② 物资编码是否已在系统中存在；③ 数量列是否填写了有效数字。导入结果会显示详细的跳过原因。
          </Paragraph>
          <Divider />
          <Paragraph><Text strong>Q2：出库时提示"库存不足"？</Text></Paragraph>
          <Paragraph type="secondary">
            表示该物资的当前库存量低于出库数量。请先在库存管理中确认实际库存，如需补充请先执行入库操作。
          </Paragraph>
          <Divider />
          <Paragraph><Text strong>Q3：如何查看库存预警？</Text></Paragraph>
          <Paragraph type="secondary">
            进入"库存管理"页面，切换到"库存预警"标签页即可查看所有预警记录。点击"解决预警"可以处理预警（补货后关闭）。
          </Paragraph>
          <Divider />
          <Paragraph><Text strong>Q4：入库单审批后库存没有增加？</Text></Paragraph>
          <Paragraph type="secondary">
            审批通过后系统会自动增加库存。如果未增加，请检查入库单状态是否为"已完成"，并确认操作日志是否有异常。
          </Paragraph>
          <Divider />
          <Paragraph><Text strong>Q5：忘记密码怎么办？</Text></Paragraph>
          <Paragraph type="secondary">
            请联系系统管理员在"后台管理 → 用户管理"中重置密码。系统默认管理员账号为 admin / admin123。
          </Paragraph>
          <Divider />
          <Paragraph><Text strong>Q6：不同角色能看到哪些菜单？</Text></Paragraph>
          <Paragraph type="secondary">
            管理员可见全部菜单；后勤主管和库管员可操作业务模块；普通职工仅可查询物资和提交出库申请。具体权限请参考本指南「角色与权限」章节。
          </Paragraph>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Space align="center">
          <BookOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0 }}>系统使用指南</Title>
        </Space>
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          欢迎使用两江校区后勤物资管理系统！本指南将帮助您快速了解系统各项功能和使用方法。
        </Paragraph>
      </div>

      <Alert
        message="快速上手"
        description="新用户建议先阅读「系统概述」了解整体功能，再查看「核心业务流程总览」理解典型操作流程，最后结合实际工作需要查阅对应模块的详细说明。"
        type="success"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Collapse
        defaultActiveKey={['overview', 'workflow']}
        items={moduleItems}
        style={{ background: '#fff' }}
      />
    </div>
  );
};

export default GuidePage;

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS obs;
SET search_path TO obs, public;

-- =========================================================
-- 5.1 基础治理（5）
-- =========================================================
CREATE TABLE tenant (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        varchar(64) NOT NULL UNIQUE,
  name        varchar(128) NOT NULL,
  status      varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE RESTRICT,
  code        varchar(64) NOT NULL,
  name        varchar(128) NOT NULL,
  owner       varchar(128),
  status      varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX idx_project_tenant ON project(tenant_id);

CREATE TABLE environment (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id) ON DELETE RESTRICT,
  project_id   uuid NOT NULL REFERENCES project(id) ON DELETE RESTRICT,
  name         varchar(64) NOT NULL,
  cluster_ref  varchar(255),
  status       varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);
CREATE INDEX idx_environment_project ON environment(project_id);

CREATE TABLE service (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id) ON DELETE RESTRICT,
  project_id  uuid NOT NULL REFERENCES project(id) ON DELETE RESTRICT,
  name        varchar(128) NOT NULL,
  type        varchar(64) NOT NULL,
  repo_url    text,
  status      varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);
CREATE INDEX idx_service_project ON service(project_id);

CREATE TABLE service_version (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      uuid NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  version         varchar(64) NOT NULL,
  image           varchar(255),
  git_commit_sha  varchar(64),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, version)
);
CREATE INDEX idx_service_version_service ON service_version(service_id);

-- =========================================================
-- 5.2 发布与回滚（2）
-- =========================================================
CREATE TABLE release_record (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenant(id),
  project_id          uuid NOT NULL REFERENCES project(id),
  env_id              uuid NOT NULL REFERENCES environment(id),
  service_id          uuid NOT NULL REFERENCES service(id),
  service_version_id  uuid NOT NULL REFERENCES service_version(id),
  release_no          varchar(64),
  status              varchar(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED','CANCELED')),
  released_by         varchar(128),
  released_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_release_record_env_service ON release_record(env_id, service_id, status);

CREATE TABLE rollback_record (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_record_id  uuid NOT NULL REFERENCES release_record(id) ON DELETE CASCADE,
  from_version_id    uuid REFERENCES service_version(id),
  to_version_id      uuid REFERENCES service_version(id),
  reason             text,
  status             varchar(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED','CANCELED')),
  rolled_back_by     varchar(128),
  rolled_back_at     timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rollback_release ON rollback_record(release_record_id);

-- =========================================================
-- 5.3 CAB变更管理（3）
-- =========================================================
CREATE TABLE change_request (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant(id),
  project_id     uuid NOT NULL REFERENCES project(id),
  env_id         uuid REFERENCES environment(id),
  change_type    varchar(32) NOT NULL,
  title          varchar(255) NOT NULL,
  risk_level     varchar(16) NOT NULL CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status         varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING','APPROVED','REJECTED','EXECUTING','DONE','CANCELED')),
  planned_start  timestamptz,
  planned_end    timestamptz,
  requested_by   varchar(128),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (planned_end IS NULL OR planned_start IS NULL OR planned_end >= planned_start)
);
CREATE INDEX idx_change_request_project_status ON change_request(project_id, status);

CREATE TABLE change_approval (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_request_id  uuid NOT NULL REFERENCES change_request(id) ON DELETE CASCADE,
  approver           varchar(128) NOT NULL,
  decision           varchar(16) CHECK (decision IN ('APPROVED','REJECTED','PENDING')),
  comment            text,
  decided_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_change_approval_cr ON change_approval(change_request_id);

CREATE TABLE change_window (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  project_id  uuid NOT NULL REFERENCES project(id),
  env_id      uuid NOT NULL REFERENCES environment(id),
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  is_frozen   boolean NOT NULL DEFAULT false,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX idx_change_window_env_time ON change_window(env_id, start_time, end_time);

-- =========================================================
-- 5.4 配置中心（4）
-- =========================================================
CREATE TABLE config_namespace (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  project_id  uuid NOT NULL REFERENCES project(id),
  env_id      uuid NOT NULL REFERENCES environment(id),
  name        varchar(128) NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, env_id, name)
);
CREATE INDEX idx_config_namespace_project_env ON config_namespace(project_id, env_id);

CREATE TABLE config_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id  uuid NOT NULL REFERENCES config_namespace(id) ON DELETE CASCADE,
  key           varchar(255) NOT NULL,
  value         text,
  is_sensitive  boolean NOT NULL DEFAULT false,
  value_ref     varchar(512),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (namespace_id, key)
);
CREATE INDEX idx_config_item_namespace ON config_item(namespace_id);

CREATE TABLE config_version (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id  uuid NOT NULL REFERENCES config_namespace(id) ON DELETE CASCADE,
  version_no    int NOT NULL,
  snapshot      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    varchar(128),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (namespace_id, version_no)
);
CREATE INDEX idx_config_version_namespace ON config_version(namespace_id, version_no DESC);

CREATE TABLE config_publish (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id       uuid NOT NULL REFERENCES config_namespace(id) ON DELETE CASCADE,
  config_version_id  uuid NOT NULL REFERENCES config_version(id) ON DELETE RESTRICT,
  status             varchar(16) NOT NULL CHECK (status IN ('PENDING','SUCCESS','FAILED','ROLLBACK')),
  published_by       varchar(128),
  published_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_config_publish_ns ON config_publish(namespace_id, created_at DESC);

-- =========================================================
-- 5.5 策略中心 OPA（3）
-- =========================================================
CREATE TABLE opa_policy_bundle (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  project_id  uuid NOT NULL REFERENCES project(id),
  env_id      uuid NOT NULL REFERENCES environment(id),
  name        varchar(128) NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, env_id, name)
);

CREATE TABLE opa_policy_version (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id     uuid NOT NULL REFERENCES opa_policy_bundle(id) ON DELETE CASCADE,
  version       varchar(64) NOT NULL,
  rego_content  text NOT NULL,
  checksum      varchar(128),
  status        varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bundle_id, version)
);
CREATE INDEX idx_opa_policy_version_bundle ON opa_policy_version(bundle_id, version DESC);

CREATE TABLE opa_publish_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id          uuid NOT NULL REFERENCES opa_policy_bundle(id) ON DELETE CASCADE,
  policy_version_id  uuid NOT NULL REFERENCES opa_policy_version(id) ON DELETE RESTRICT,
  status             varchar(16) NOT NULL CHECK (status IN ('PENDING','SUCCESS','FAILED','ROLLBACK')),
  published_by       varchar(128),
  published_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_opa_publish_log_bundle ON opa_publish_log(bundle_id, created_at DESC);

-- =========================================================
-- 5.6 API / 网关治理（5）
-- =========================================================
CREATE TABLE api_definition (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id),
  project_id   uuid NOT NULL REFERENCES project(id),
  service_id   uuid NOT NULL REFERENCES service(id),
  path         varchar(512) NOT NULL,
  method       varchar(16) NOT NULL CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')),
  api_version  varchar(32) NOT NULL,
  status       varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','DEPRECATED')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, path, method, api_version)
);
CREATE INDEX idx_api_definition_project ON api_definition(project_id);

CREATE TABLE api_consumer (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant(id),
  project_id     uuid NOT NULL REFERENCES project(id),
  consumer_name  varchar(128) NOT NULL,
  auth_type      varchar(32) NOT NULL CHECK (auth_type IN ('AKSK','JWT','OAUTH2','MTLS')),
  credential_ref varchar(255),
  status         varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, consumer_name)
);
CREATE INDEX idx_api_consumer_project ON api_consumer(project_id);

CREATE TABLE api_rate_limit_policy (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id       uuid NOT NULL REFERENCES api_definition(id) ON DELETE CASCADE,
  consumer_id  uuid NOT NULL REFERENCES api_consumer(id) ON DELETE CASCADE,
  qps          int NOT NULL CHECK (qps > 0),
  burst        int NOT NULL CHECK (burst >= qps),
  window_sec   int NOT NULL DEFAULT 1 CHECK (window_sec > 0),
  status       varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (api_id, consumer_id)
);
CREATE INDEX idx_api_rl_policy_api ON api_rate_limit_policy(api_id);

CREATE TABLE gateway_route (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  project_id    uuid NOT NULL REFERENCES project(id),
  env_id        uuid NOT NULL REFERENCES environment(id),
  host          varchar(255) NOT NULL,
  path_pattern  varchar(512) NOT NULL,
  upstream_ref  varchar(255) NOT NULL,
  priority      int NOT NULL DEFAULT 100,
  status        varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (env_id, host, path_pattern)
);
CREATE INDEX idx_gateway_route_env_priority ON gateway_route(env_id, priority);

CREATE TABLE gateway_plugin_config (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id        uuid NOT NULL REFERENCES gateway_route(id) ON DELETE CASCADE,
  plugin_name     varchar(64) NOT NULL,
  plugin_config   jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, plugin_name)
);
CREATE INDEX idx_gateway_plugin_route ON gateway_plugin_config(route_id);

-- =========================================================
-- 5.7 通用审计（1）- 分区表
-- =========================================================
CREATE TABLE operation_audit_log (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant(id),
  project_id     uuid REFERENCES project(id),
  env_id         uuid REFERENCES environment(id),
  actor          varchar(128) NOT NULL,
  action         varchar(128) NOT NULL,
  resource_type  varchar(64) NOT NULL,
  resource_id    varchar(128),
  before_data    jsonb,
  after_data     jsonb,
  trace_id       varchar(128),
  ip             inet,
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE operation_audit_log_default
  PARTITION OF operation_audit_log DEFAULT;

CREATE INDEX idx_op_audit_created_at ON operation_audit_log(created_at DESC);
CREATE INDEX idx_op_audit_actor ON operation_audit_log(actor, created_at DESC);
CREATE INDEX idx_op_audit_trace ON operation_audit_log(trace_id);

-- =========================================================
-- 5.8 采集层 Agent（7）
-- =========================================================
CREATE TABLE agent_node (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant(id),
  project_id     uuid NOT NULL REFERENCES project(id),
  env_id         uuid NOT NULL REFERENCES environment(id),
  host           varchar(255) NOT NULL,
  ip             inet NOT NULL,
  version        varchar(64),
  status         varchar(16) NOT NULL DEFAULT 'ONLINE' CHECK (status IN ('ONLINE','OFFLINE','MAINTENANCE')),
  heartbeat_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (env_id, host)
);
CREATE INDEX idx_agent_node_env_status ON agent_node(env_id, status);

CREATE TABLE agent_group (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id),
  project_id   uuid NOT NULL REFERENCES project(id),
  name         varchar(128) NOT NULL,
  selector     jsonb NOT NULL DEFAULT '{}'::jsonb,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE TABLE agent_group_member (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES agent_group(id) ON DELETE CASCADE,
  agent_id   uuid NOT NULL REFERENCES agent_node(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, agent_id)
);
CREATE INDEX idx_agent_group_member_agent ON agent_group_member(agent_id);

CREATE TABLE collector_rule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  project_id    uuid NOT NULL REFERENCES project(id),
  env_id        uuid NOT NULL REFERENCES environment(id),
  rule_type     varchar(32) NOT NULL,
  rule_content  jsonb NOT NULL,
  status        varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_by    varchar(128),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_collector_rule_project_env ON collector_rule(project_id, env_id, status);

CREATE TABLE collector_target (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id      uuid NOT NULL REFERENCES collector_rule(id) ON DELETE CASCADE,
  target_type  varchar(32) NOT NULL,
  target_expr  varchar(512) NOT NULL,
  status       varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, target_type, target_expr)
);
CREATE INDEX idx_collector_target_rule ON collector_target(rule_id);

CREATE TABLE agent_plugin (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  project_id    uuid NOT NULL REFERENCES project(id),
  name          varchar(128) NOT NULL,
  plugin_type   varchar(32) NOT NULL,
  artifact_uri  varchar(1024) NOT NULL,
  checksum      varchar(128),
  status        varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name, plugin_type)
);

CREATE TABLE agent_plugin_release (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id         uuid NOT NULL REFERENCES agent_plugin(id) ON DELETE CASCADE,
  version           varchar(64) NOT NULL,
  rollout_strategy  jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            varchar(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED','CANCELED')),
  released_by       varchar(128),
  released_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plugin_id, version)
);
CREATE INDEX idx_agent_plugin_release_plugin ON agent_plugin_release(plugin_id, created_at DESC);

-- =========================================================
-- 5.9 Kafka / Schema Registry（7）
-- =========================================================
CREATE TABLE mq_cluster (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenant(id),
  project_id         uuid NOT NULL REFERENCES project(id),
  env_id             uuid NOT NULL REFERENCES environment(id),
  name               varchar(128) NOT NULL,
  bootstrap_servers  text NOT NULL,
  status             varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (env_id, name)
);

CREATE TABLE mq_topic (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id     uuid NOT NULL REFERENCES mq_cluster(id) ON DELETE CASCADE,
  name           varchar(255) NOT NULL,
  partitions     int NOT NULL CHECK (partitions > 0),
  replicas       int NOT NULL CHECK (replicas > 0),
  retention_ms   bigint NOT NULL DEFAULT 604800000 CHECK (retention_ms >= 0),
  cleanup_policy varchar(32) NOT NULL DEFAULT 'delete',
  status         varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cluster_id, name)
);
CREATE INDEX idx_mq_topic_cluster ON mq_topic(cluster_id);

CREATE TABLE mq_topic_acl (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    uuid NOT NULL REFERENCES mq_topic(id) ON DELETE CASCADE,
  principal   varchar(255) NOT NULL,
  operation   varchar(32) NOT NULL,
  permission  varchar(16) NOT NULL CHECK (permission IN ('ALLOW','DENY')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, principal, operation)
);

CREATE TABLE mq_consumer_group (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id     uuid NOT NULL REFERENCES mq_cluster(id) ON DELETE CASCADE,
  group_id       varchar(255) NOT NULL,
  owner_service  varchar(255),
  status         varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  lag            bigint NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cluster_id, group_id)
);
CREATE INDEX idx_mq_consumer_group_cluster ON mq_consumer_group(cluster_id);

CREATE TABLE schema_subject (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id     uuid NOT NULL REFERENCES mq_cluster(id) ON DELETE CASCADE,
  subject_name   varchar(255) NOT NULL,
  compatibility  varchar(32) NOT NULL DEFAULT 'BACKWARD',
  status         varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cluster_id, subject_name)
);

CREATE TABLE schema_version (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   uuid NOT NULL REFERENCES schema_subject(id) ON DELETE CASCADE,
  version      int NOT NULL,
  schema_type  varchar(32) NOT NULL CHECK (schema_type IN ('AVRO','JSON','PROTOBUF')),
  schema_def   jsonb NOT NULL,
  status       varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DEPRECATED')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, version)
);
CREATE INDEX idx_schema_version_subject ON schema_version(subject_id, version DESC);

CREATE TABLE schema_publish_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    uuid NOT NULL REFERENCES schema_subject(id) ON DELETE CASCADE,
  version_id    uuid NOT NULL REFERENCES schema_version(id) ON DELETE RESTRICT,
  status        varchar(16) NOT NULL CHECK (status IN ('PENDING','SUCCESS','FAILED','ROLLBACK')),
  published_by  varchar(128),
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_schema_publish_subject ON schema_publish_log(subject_id, created_at DESC);

-- =========================================================
-- 5.10 Flink实时计算（5）
-- =========================================================
CREATE TABLE flink_cluster (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  project_id  uuid NOT NULL REFERENCES project(id),
  env_id      uuid NOT NULL REFERENCES environment(id),
  name        varchar(128) NOT NULL,
  endpoint    varchar(512) NOT NULL,
  status      varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (env_id, name)
);

CREATE TABLE flink_job (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id  uuid NOT NULL REFERENCES flink_cluster(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  project_id  uuid NOT NULL REFERENCES project(id),
  env_id      uuid NOT NULL REFERENCES environment(id),
  job_name    varchar(255) NOT NULL,
  job_type    varchar(64) NOT NULL,
  status      varchar(16) NOT NULL DEFAULT 'STOPPED' CHECK (status IN ('RUNNING','STOPPED','FAILED','DEPLOYING')),
  owner       varchar(128),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cluster_id, job_name)
);
CREATE INDEX idx_flink_job_cluster_status ON flink_job(cluster_id, status);

CREATE TABLE flink_job_version (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid NOT NULL REFERENCES flink_job(id) ON DELETE CASCADE,
  version        varchar(64) NOT NULL,
  sql_text       text,
  artifact_uri   varchar(1024),
  config         jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','DEPRECATED')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, version)
);

CREATE TABLE flink_savepoint (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       uuid NOT NULL REFERENCES flink_job(id) ON DELETE CASCADE,
  version_id   uuid REFERENCES flink_job_version(id) ON DELETE SET NULL,
  path         varchar(1024) NOT NULL,
  trigger_time timestamptz NOT NULL,
  status       varchar(16) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','FAILED')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, path)
);

CREATE TABLE flink_deployment (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       uuid NOT NULL REFERENCES flink_job(id) ON DELETE CASCADE,
  version_id   uuid NOT NULL REFERENCES flink_job_version(id) ON DELETE RESTRICT,
  savepoint_id uuid REFERENCES flink_savepoint(id) ON DELETE SET NULL,
  status       varchar(16) NOT NULL CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED','ROLLBACK')),
  deployed_by  varchar(128),
  deployed_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_flink_deployment_job_time ON flink_deployment(job_id, deployed_at DESC);

-- =========================================================
-- 5.11 监控告警与事故闭环（15）
-- =========================================================
CREATE TABLE health_check_target (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  project_id    uuid NOT NULL REFERENCES project(id),
  env_id        uuid NOT NULL REFERENCES environment(id),
  service_id    uuid REFERENCES service(id) ON DELETE SET NULL,
  target_name   varchar(255) NOT NULL,
  check_type    varchar(16) NOT NULL CHECK (check_type IN ('HTTP','TCP','CMD')),
  check_url     varchar(1024),
  check_cmd     text,
  interval_sec  int NOT NULL DEFAULT 30 CHECK (interval_sec > 0),
  timeout_sec   int NOT NULL DEFAULT 5 CHECK (timeout_sec > 0),
  enabled       boolean NOT NULL DEFAULT true,
  status        varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (check_url IS NOT NULL OR check_cmd IS NOT NULL)
);
CREATE INDEX idx_hc_target_project_env ON health_check_target(project_id, env_id, status);

CREATE TABLE health_check_rule (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id    uuid NOT NULL REFERENCES health_check_target(id) ON DELETE CASCADE,
  metric_name  varchar(64) NOT NULL,
  op           varchar(4) NOT NULL CHECK (op IN ('>','>=','<','<=','=','!=')),
  threshold    numeric(20,6) NOT NULL,
  duration_sec int NOT NULL DEFAULT 60 CHECK (duration_sec > 0),
  severity     varchar(16) NOT NULL CHECK (severity IN ('P1','P2','P3','P4')),
  status       varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hc_rule_target ON health_check_rule(target_id, severity);

CREATE TABLE health_check_result (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  target_id    uuid NOT NULL REFERENCES health_check_target(id) ON DELETE CASCADE,
  check_time   timestamptz NOT NULL,
  status       varchar(16) NOT NULL CHECK (status IN ('UP','DOWN','DEGRADED','TIMEOUT')),
  latency_ms   int,
  error_msg    text,
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, check_time)
) PARTITION BY RANGE (check_time);

CREATE TABLE health_check_result_default
  PARTITION OF health_check_result DEFAULT;

CREATE INDEX idx_hc_result_target_time ON health_check_result(target_id, check_time DESC);

CREATE TABLE alert_event (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant(id),
  project_id     uuid NOT NULL REFERENCES project(id),
  env_id         uuid NOT NULL REFERENCES environment(id),
  source         varchar(64) NOT NULL,
  severity       varchar(16) NOT NULL CHECK (severity IN ('P1','P2','P3','P4')),
  fingerprint    varchar(255) NOT NULL,
  title          varchar(255),
  summary        text,
  status         varchar(16) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKED','SUPPRESSED','CLOSED')),
  payload        jsonb,
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_event_query ON alert_event(project_id, env_id, status, severity, first_seen_at DESC);
CREATE INDEX idx_alert_event_fingerprint ON alert_event(env_id, fingerprint);

CREATE TABLE alert_ack (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id   uuid NOT NULL REFERENCES alert_event(id) ON DELETE CASCADE,
  ack_by     varchar(128) NOT NULL,
  ack_time   timestamptz NOT NULL DEFAULT now(),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_ack_alert ON alert_ack(alert_id, ack_time DESC);

CREATE TABLE incident_ticket (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenant(id),
  project_id   uuid NOT NULL REFERENCES project(id),
  env_id       uuid NOT NULL REFERENCES environment(id),
  incident_no  varchar(64) NOT NULL UNIQUE,
  title        varchar(255) NOT NULL,
  severity     varchar(16) NOT NULL CHECK (severity IN ('P1','P2','P3','P4')),
  status       varchar(16) NOT NULL CHECK (status IN ('OPEN','PROCESSING','RESOLVED','CLOSED')),
  assignee     varchar(128),
  opened_at    timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE incident (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  project_id    uuid NOT NULL REFERENCES project(id),
  env_id        uuid NOT NULL REFERENCES environment(id),
  incident_no   varchar(64) NOT NULL UNIQUE,
  title         varchar(255) NOT NULL,
  status        varchar(16) NOT NULL CHECK (status IN (
                  'NEW','ALERTED','ACKED','MITIGATING','MITIGATED','RESOLVED','POSTMORTEM','ARCHIVED','ESCALATED','CLOSED'
                )),
  severity      varchar(16) NOT NULL CHECK (severity IN ('P1','P2','P3','P4')),
  source        varchar(64),
  owner         varchar(128),
  summary       text,
  detected_at   timestamptz NOT NULL,
  alerted_at    timestamptz,
  acked_at      timestamptz,
  mitigated_at  timestamptz,
  resolved_at   timestamptz,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_incident_query ON incident(project_id, env_id, status, severity, detected_at DESC);

CREATE TABLE incident_timeline (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  event_type  varchar(64) NOT NULL,
  event_time  timestamptz NOT NULL,
  actor_type  varchar(32),
  actor_id    varchar(128),
  detail      jsonb,
  trace_id    varchar(128),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, event_time)
) PARTITION BY RANGE (event_time);

CREATE TABLE incident_timeline_default
  PARTITION OF incident_timeline DEFAULT;

CREATE INDEX idx_incident_timeline_inc_time ON incident_timeline(incident_id, event_time DESC);

CREATE TABLE incident_alert_link (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  alert_id     uuid NOT NULL REFERENCES alert_event(id) ON DELETE CASCADE,
  alert_source varchar(64),
  fingerprint  varchar(255),
  linked_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, alert_id)
);
CREATE INDEX idx_incident_alert_link_alert ON incident_alert_link(alert_id);

CREATE TABLE incident_log_bundle (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     uuid NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  source_host     varchar(255),
  bundle_name     varchar(255) NOT NULL,
  pull_status     varchar(16) NOT NULL CHECK (pull_status IN ('PENDING','RUNNING','SUCCESS','FAILED')),
  storage_uri     varchar(1024),
  storage_checksum varchar(128),
  size_bytes      bigint,
  collected_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, bundle_name)
);
CREATE INDEX idx_incident_log_bundle_inc ON incident_log_bundle(incident_id, created_at DESC);

CREATE TABLE incident_action (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   uuid NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  action_type   varchar(64) NOT NULL,
  target_ref    varchar(255),
  executor      varchar(128),
  result_status varchar(16) NOT NULL CHECK (result_status IN ('PENDING','RUNNING','SUCCESS','FAILED')),
  result_detail jsonb,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_incident_action_inc ON incident_action(incident_id, created_at DESC);

CREATE TABLE incident_analysis (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id           uuid NOT NULL UNIQUE REFERENCES incident(id) ON DELETE CASCADE,
  root_cause_category   varchar(64),
  root_cause            text,
  prevention_actions    text,
  contributing_factors  jsonb,
  analyzed_by           varchar(128),
  analyzed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE incident_response_sla (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id         uuid NOT NULL UNIQUE REFERENCES incident(id) ON DELETE CASCADE,
  ack_deadline_at     timestamptz,
  resolve_deadline_at timestamptz,
  mtta_seconds        int,
  mttr_seconds        int,
  is_ack_breached     boolean NOT NULL DEFAULT false,
  is_resolve_breached boolean NOT NULL DEFAULT false,
  calculated_at       timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE incident_postmortem (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid NOT NULL UNIQUE REFERENCES incident(id) ON DELETE CASCADE,
  document_uri varchar(1024),
  summary      text,
  action_items jsonb,
  reviewer     varchar(128),
  published_at timestamptz,
  status       varchar(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE incident_archive (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       uuid NOT NULL UNIQUE REFERENCES incident(id) ON DELETE CASCADE,
  archive_uri       varchar(1024) NOT NULL,
  archive_checksum  varchar(128) NOT NULL,
  retention_years   int NOT NULL CHECK (retention_years > 0),
  archived_by       varchar(128),
  archived_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 5.12 安全与密钥（5）
-- =========================================================
CREATE TABLE secret_ref (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  project_id  uuid NOT NULL REFERENCES project(id),
  env_id      uuid NOT NULL REFERENCES environment(id),
  vault_path  varchar(512) NOT NULL,
  version     varchar(64) NOT NULL,
  status      varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, env_id, vault_path, version)
);

CREATE TABLE secret_rotation_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_ref_id uuid NOT NULL REFERENCES secret_ref(id) ON DELETE CASCADE,
  rotated_by    varchar(128) NOT NULL,
  rotated_at    timestamptz NOT NULL DEFAULT now(),
  status        varchar(16) NOT NULL CHECK (status IN ('SUCCESS','FAILED')),
  detail        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_secret_rotation_secret ON secret_rotation_log(secret_ref_id, rotated_at DESC);

CREATE TABLE security_scan_task (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  project_id  uuid NOT NULL REFERENCES project(id),
  env_id      uuid REFERENCES environment(id),
  target_type varchar(32) NOT NULL,
  target_ref  varchar(255) NOT NULL,
  tool        varchar(64) NOT NULL,
  status      varchar(16) NOT NULL CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED','CANCELED')),
  started_at  timestamptz,
  finished_at timestamptz,
  triggered_by varchar(128),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_security_scan_task_project ON security_scan_task(project_id, status, created_at DESC);

CREATE TABLE security_scan_result (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid NOT NULL UNIQUE REFERENCES security_scan_task(id) ON DELETE CASCADE,
  critical_cnt int NOT NULL DEFAULT 0,
  high_cnt     int NOT NULL DEFAULT 0,
  medium_cnt   int NOT NULL DEFAULT 0,
  low_cnt      int NOT NULL DEFAULT 0,
  report_uri   varchar(1024),
  summary      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE security_vulnerability (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           uuid NOT NULL REFERENCES security_scan_task(id) ON DELETE CASCADE,
  cve_id            varchar(64) NOT NULL,
  severity          varchar(16) NOT NULL CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  package_name      varchar(255),
  installed_version varchar(128),
  fix_version       varchar(128),
  state             varchar(16) NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN','ACCEPTED','FIXED','IGNORED')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, cve_id, package_name)
);
CREATE INDEX idx_security_vuln_task_severity ON security_vulnerability(task_id, severity);

-- =========================================================
-- 5.13 向量 / LLM / ML / 边缘扩展（13）
-- =========================================================
CREATE TABLE vector_collection (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  project_id  uuid NOT NULL REFERENCES project(id),
  name        varchar(128) NOT NULL,
  dim         int NOT NULL CHECK (dim > 0),
  metric      varchar(32) NOT NULL CHECK (metric IN ('cosine','l2','ip')),
  status      varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE TABLE vector_document (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id  uuid NOT NULL REFERENCES vector_collection(id) ON DELETE CASCADE,
  biz_key        varchar(255) NOT NULL,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, biz_key)
);

CREATE TABLE vector_embedding (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES vector_document(id) ON DELETE CASCADE,
  embedding    float4[] NOT NULL,
  model_name   varchar(128) NOT NULL,
  version      varchar(64) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, model_name, version)
);
CREATE INDEX idx_vector_embedding_doc ON vector_embedding(document_id);

CREATE TABLE prompt_template (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  project_id  uuid NOT NULL REFERENCES project(id),
  name        varchar(128) NOT NULL,
  scene       varchar(64) NOT NULL,
  content     text NOT NULL,
  status      varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name, scene)
);

CREATE TABLE prompt_version (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES prompt_template(id) ON DELETE CASCADE,
  version      varchar(64) NOT NULL,
  content      text NOT NULL,
  eval_score   numeric(5,2),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE TABLE llm_call_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  project_id  uuid NOT NULL REFERENCES project(id),
  env_id      uuid REFERENCES environment(id),
  provider    varchar(64) NOT NULL,
  model       varchar(128) NOT NULL,
  token_in    int NOT NULL DEFAULT 0,
  token_out   int NOT NULL DEFAULT 0,
  latency_ms  int,
  cost        numeric(12,6),
  trace_id    varchar(128),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_llm_call_audit_proj_time ON llm_call_audit(project_id, created_at DESC);

CREATE TABLE ml_model (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant(id),
  project_id  uuid NOT NULL REFERENCES project(id),
  name        varchar(128) NOT NULL,
  task_type   varchar(64) NOT NULL,
  framework   varchar(64),
  status      varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE TABLE ml_model_version (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id     uuid NOT NULL REFERENCES ml_model(id) ON DELETE CASCADE,
  version      varchar(64) NOT NULL,
  artifact_uri varchar(1024) NOT NULL,
  metrics      jsonb,
  status       varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','DEPRECATED')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, version)
);

CREATE TABLE ml_deploy (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id     uuid NOT NULL REFERENCES ml_model(id) ON DELETE CASCADE,
  version_id   uuid NOT NULL REFERENCES ml_model_version(id) ON DELETE RESTRICT,
  env_id       uuid REFERENCES environment(id),
  endpoint     varchar(512) NOT NULL,
  status       varchar(16) NOT NULL CHECK (status IN ('PENDING','RUNNING','FAILED','STOPPED')),
  deployed_by  varchar(128),
  deployed_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, version_id, endpoint)
);
CREATE INDEX idx_ml_deploy_env_status ON ml_deploy(env_id, status);

CREATE TABLE edge_node (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  project_id    uuid NOT NULL REFERENCES project(id),
  env_id        uuid REFERENCES environment(id),
  node_code     varchar(128) NOT NULL,
  site          varchar(255),
  version       varchar(64),
  status        varchar(16) NOT NULL DEFAULT 'ONLINE' CHECK (status IN ('ONLINE','OFFLINE','MAINTENANCE')),
  heartbeat_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (env_id, node_code)
);

CREATE TABLE edge_rule (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant(id),
  project_id    uuid NOT NULL REFERENCES project(id),
  rule_type     varchar(64) NOT NULL,
  rule_content  jsonb NOT NULL,
  status        varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_edge_rule_project_type ON edge_rule(project_id, rule_type);

CREATE TABLE edge_upgrade_batch (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant(id),
  project_id     uuid NOT NULL REFERENCES project(id),
  env_id         uuid REFERENCES environment(id),
  batch_no       varchar(64) NOT NULL,
  target_version varchar(64) NOT NULL,
  strategy       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         varchar(16) NOT NULL CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED','CANCELED')),
  planned_at     timestamptz,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (env_id, batch_no)
);

CREATE TABLE edge_sync_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id     uuid NOT NULL REFERENCES edge_node(id) ON DELETE CASCADE,
  object_type varchar(64) NOT NULL,
  object_id   varchar(128) NOT NULL,
  sync_status varchar(16) NOT NULL CHECK (sync_status IN ('PENDING','SUCCESS','FAILED')),
  sync_time   timestamptz NOT NULL DEFAULT now(),
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_edge_sync_node_time ON edge_sync_log(node_id, sync_time DESC);

COMMIT;
-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "external_id" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'en',
    "totp_secret" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_recovery_codes" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "last_active" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "allowed_ips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" SERIAL NOT NULL,
    "short" TEXT NOT NULL,
    "long" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "location_id" INTEGER NOT NULL,
    "fqdn" TEXT NOT NULL,
    "scheme" TEXT NOT NULL DEFAULT 'https',
    "behind_proxy" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "memory" INTEGER NOT NULL,
    "memory_overallocate" INTEGER NOT NULL DEFAULT 0,
    "disk" INTEGER NOT NULL,
    "disk_overallocate" INTEGER NOT NULL DEFAULT 0,
    "upload_size" INTEGER NOT NULL DEFAULT 100,
    "daemon_token_id" TEXT NOT NULL,
    "daemon_token" TEXT NOT NULL,
    "daemon_port" INTEGER NOT NULL DEFAULT 8080,
    "daemon_sftp_port" INTEGER NOT NULL DEFAULT 2022,
    "daemon_base" TEXT NOT NULL DEFAULT '/var/lib/pterodactyl',
    "daemon_sftp_alias" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" SERIAL NOT NULL,
    "node_id" INTEGER NOT NULL,
    "ip" TEXT NOT NULL,
    "alias" TEXT,
    "port" INTEGER NOT NULL,
    "notes" TEXT,
    "server_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nests" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT 'unknown@example.com',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eggs" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "nest_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL,
    "docker_images" JSONB NOT NULL,
    "startup" TEXT NOT NULL,
    "stop_command" TEXT,
    "config_startup" JSONB,
    "config_stop" JSONB,
    "config_files" TEXT,
    "config_logs" TEXT,
    "script_container" TEXT NOT NULL DEFAULT 'debian:stable-slim',
    "script_entry" TEXT NOT NULL DEFAULT 'bash',
    "script_install" TEXT,
    "file_denylist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "force_outgoing_ip" BOOLEAN NOT NULL DEFAULT false,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eggs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egg_variables" (
    "id" SERIAL NOT NULL,
    "egg_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "env_variable" TEXT NOT NULL,
    "default_value" TEXT NOT NULL DEFAULT '',
    "user_viewable" BOOLEAN NOT NULL DEFAULT false,
    "user_editable" BOOLEAN NOT NULL DEFAULT false,
    "rules" TEXT NOT NULL DEFAULT 'required|string',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "egg_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servers" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "uuid_short" TEXT NOT NULL,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT,
    "user_id" INTEGER NOT NULL,
    "node_id" INTEGER NOT NULL,
    "allocation_id" INTEGER NOT NULL,
    "nest_id" INTEGER NOT NULL,
    "egg_id" INTEGER NOT NULL,
    "skip_scripts" BOOLEAN NOT NULL DEFAULT false,
    "docker_image" TEXT NOT NULL,
    "startup" TEXT NOT NULL,
    "memory" INTEGER NOT NULL,
    "swap" INTEGER NOT NULL DEFAULT 0,
    "disk" INTEGER NOT NULL,
    "io" INTEGER NOT NULL DEFAULT 500,
    "cpu" INTEGER NOT NULL DEFAULT 0,
    "threads" TEXT,
    "oom_disabled" BOOLEAN NOT NULL DEFAULT false,
    "database_limit" INTEGER NOT NULL DEFAULT 0,
    "allocation_limit" INTEGER NOT NULL DEFAULT 0,
    "backup_limit" INTEGER NOT NULL DEFAULT 0,
    "installed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_variables" (
    "id" SERIAL NOT NULL,
    "server_id" INTEGER NOT NULL,
    "variable_id" INTEGER NOT NULL,
    "variable_value" TEXT NOT NULL,

    CONSTRAINT "server_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subusers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "server_id" INTEGER NOT NULL,
    "permissions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subusers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_hosts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 3306,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "max_databases" INTEGER,
    "node_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "database_hosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_databases" (
    "id" SERIAL NOT NULL,
    "server_id" INTEGER NOT NULL,
    "database_host_id" INTEGER NOT NULL,
    "database" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "remote_host" TEXT NOT NULL DEFAULT '%',
    "max_connections" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_databases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backups" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "server_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ignored_files" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disk" TEXT NOT NULL DEFAULT 'local',
    "checksum" TEXT,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "is_successful" BOOLEAN,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" SERIAL NOT NULL,
    "server_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "cron_minute" TEXT NOT NULL,
    "cron_hour" TEXT NOT NULL,
    "cron_day_of_month" TEXT NOT NULL,
    "cron_month" TEXT NOT NULL,
    "cron_day_of_week" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_processing" BOOLEAN NOT NULL DEFAULT false,
    "only_when_online" BOOLEAN NOT NULL DEFAULT false,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_tasks" (
    "id" SERIAL NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "sequence_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "time_offset" INTEGER NOT NULL DEFAULT 0,
    "continue_on_failure" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mounts" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "user_mountable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mount_nodes" (
    "mount_id" INTEGER NOT NULL,
    "node_id" INTEGER NOT NULL,

    CONSTRAINT "mount_nodes_pkey" PRIMARY KEY ("mount_id","node_id")
);

-- CreateTable
CREATE TABLE "mount_eggs" (
    "mount_id" INTEGER NOT NULL,
    "egg_id" INTEGER NOT NULL,

    CONSTRAINT "mount_eggs_pkey" PRIMARY KEY ("mount_id","egg_id")
);

-- CreateTable
CREATE TABLE "server_mounts" (
    "server_id" INTEGER NOT NULL,
    "mount_id" INTEGER NOT NULL,

    CONSTRAINT "server_mounts_pkey" PRIMARY KEY ("server_id","mount_id")
);

-- CreateTable
CREATE TABLE "transfer_logs" (
    "id" SERIAL NOT NULL,
    "server_id" INTEGER NOT NULL,
    "source_node_id" INTEGER NOT NULL,
    "target_node_id" INTEGER NOT NULL,
    "target_allocation_id" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "successful" BOOLEAN,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "transfer_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "subaction" TEXT,
    "device" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER,
    "server_id" INTEGER,
    "event" TEXT NOT NULL,
    "description" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_external_id_key" ON "users"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_identifier_key" ON "api_keys"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_token_hash_key" ON "api_keys"("token_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "password_resets_email_idx" ON "password_resets"("email");

-- CreateIndex
CREATE UNIQUE INDEX "locations_short_key" ON "locations"("short");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_uuid_key" ON "nodes"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_daemon_token_id_key" ON "nodes"("daemon_token_id");

-- CreateIndex
CREATE INDEX "nodes_location_id_idx" ON "nodes"("location_id");

-- CreateIndex
CREATE INDEX "allocations_node_id_idx" ON "allocations"("node_id");

-- CreateIndex
CREATE INDEX "allocations_server_id_idx" ON "allocations"("server_id");

-- CreateIndex
CREATE UNIQUE INDEX "allocations_node_id_ip_port_key" ON "allocations"("node_id", "ip", "port");

-- CreateIndex
CREATE UNIQUE INDEX "nests_uuid_key" ON "nests"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "nests_name_key" ON "nests"("name");

-- CreateIndex
CREATE UNIQUE INDEX "eggs_uuid_key" ON "eggs"("uuid");

-- CreateIndex
CREATE INDEX "eggs_nest_id_idx" ON "eggs"("nest_id");

-- CreateIndex
CREATE UNIQUE INDEX "egg_variables_egg_id_env_variable_key" ON "egg_variables"("egg_id", "env_variable");

-- CreateIndex
CREATE UNIQUE INDEX "servers_uuid_key" ON "servers"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "servers_uuid_short_key" ON "servers"("uuid_short");

-- CreateIndex
CREATE UNIQUE INDEX "servers_external_id_key" ON "servers"("external_id");

-- CreateIndex
CREATE INDEX "servers_user_id_idx" ON "servers"("user_id");

-- CreateIndex
CREATE INDEX "servers_node_id_idx" ON "servers"("node_id");

-- CreateIndex
CREATE INDEX "servers_allocation_id_idx" ON "servers"("allocation_id");

-- CreateIndex
CREATE INDEX "servers_egg_id_idx" ON "servers"("egg_id");

-- CreateIndex
CREATE UNIQUE INDEX "server_variables_server_id_variable_id_key" ON "server_variables"("server_id", "variable_id");

-- CreateIndex
CREATE UNIQUE INDEX "subusers_user_id_server_id_key" ON "subusers"("user_id", "server_id");

-- CreateIndex
CREATE INDEX "server_databases_server_id_idx" ON "server_databases"("server_id");

-- CreateIndex
CREATE UNIQUE INDEX "server_databases_database_host_id_database_key" ON "server_databases"("database_host_id", "database");

-- CreateIndex
CREATE UNIQUE INDEX "server_databases_database_host_id_username_key" ON "server_databases"("database_host_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "backups_uuid_key" ON "backups"("uuid");

-- CreateIndex
CREATE INDEX "backups_server_id_idx" ON "backups"("server_id");

-- CreateIndex
CREATE INDEX "schedules_server_id_idx" ON "schedules"("server_id");

-- CreateIndex
CREATE INDEX "schedules_is_active_next_run_at_idx" ON "schedules"("is_active", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_tasks_schedule_id_sequence_id_key" ON "schedule_tasks"("schedule_id", "sequence_id");

-- CreateIndex
CREATE UNIQUE INDEX "mounts_uuid_key" ON "mounts"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "mounts_name_key" ON "mounts"("name");

-- CreateIndex
CREATE INDEX "transfer_logs_server_id_idx" ON "transfer_logs"("server_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_uuid_key" ON "audit_logs"("uuid");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_server_id_idx" ON "activity_logs"("server_id");

-- CreateIndex
CREATE INDEX "activity_logs_event_idx" ON "activity_logs"("event");

-- CreateIndex
CREATE INDEX "activity_logs_timestamp_idx" ON "activity_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eggs" ADD CONSTRAINT "eggs_nest_id_fkey" FOREIGN KEY ("nest_id") REFERENCES "nests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egg_variables" ADD CONSTRAINT "egg_variables_egg_id_fkey" FOREIGN KEY ("egg_id") REFERENCES "eggs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_nest_id_fkey" FOREIGN KEY ("nest_id") REFERENCES "nests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servers" ADD CONSTRAINT "servers_egg_id_fkey" FOREIGN KEY ("egg_id") REFERENCES "eggs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_variables" ADD CONSTRAINT "server_variables_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_variables" ADD CONSTRAINT "server_variables_variable_id_fkey" FOREIGN KEY ("variable_id") REFERENCES "egg_variables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subusers" ADD CONSTRAINT "subusers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subusers" ADD CONSTRAINT "subusers_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_databases" ADD CONSTRAINT "server_databases_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_databases" ADD CONSTRAINT "server_databases_database_host_id_fkey" FOREIGN KEY ("database_host_id") REFERENCES "database_hosts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_tasks" ADD CONSTRAINT "schedule_tasks_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mount_nodes" ADD CONSTRAINT "mount_nodes_mount_id_fkey" FOREIGN KEY ("mount_id") REFERENCES "mounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mount_nodes" ADD CONSTRAINT "mount_nodes_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mount_eggs" ADD CONSTRAINT "mount_eggs_mount_id_fkey" FOREIGN KEY ("mount_id") REFERENCES "mounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_mounts" ADD CONSTRAINT "server_mounts_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_mounts" ADD CONSTRAINT "server_mounts_mount_id_fkey" FOREIGN KEY ("mount_id") REFERENCES "mounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_logs" ADD CONSTRAINT "transfer_logs_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


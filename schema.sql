-- =====================================================================
-- CSD Handshake — Supabase schema
-- =====================================================================

-- Enums
CREATE TYPE user_role AS ENUM ('student', 'partner', 'teacher', 'school_admin', 'district_admin');
CREATE TYPE user_status AS ENUM ('invited', 'active', 'deactivated');
CREATE TYPE project_status AS ENUM ('active', 'archived');
CREATE TYPE project_member_role AS ENUM ('owner', 'member', 'observer');
CREATE TYPE flag_type AS ENUM ('phone_number', 'email_address', 'social_handle', 'external_url', 'keyword');
CREATE TYPE flag_status AS ENUM ('pending', 'dismissed', 'escalated', 'resolved');
CREATE TYPE email_frequency AS ENUM ('immediate', 'daily', 'off');

-- Tables
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  school_id UUID REFERENCES schools(id),
  organization TEXT,
  status user_status NOT NULL DEFAULT 'invited',
  coc_accepted_version INTEGER,
  coc_accepted_at TIMESTAMPTZ,
  coc_accepted_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_school ON users(school_id);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  school_id UUID NOT NULL REFERENCES schools(id),
  partner_organization TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  status project_status NOT NULL DEFAULT 'active',
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES users(id),
  first_message_review BOOLEAN NOT NULL DEFAULT false,
  first_message_review_count INTEGER NOT NULL DEFAULT 3,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  rate_limit_enabled BOOLEAN NOT NULL DEFAULT false,
  rate_limit_per_hour INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_school ON projects(school_id);
CREATE INDEX idx_projects_status ON projects(status);

CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_role project_member_role NOT NULL DEFAULT 'member',
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  first_message_reviewed BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_project_members_user ON project_members(user_id) WHERE left_at IS NULL;

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  organization TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id),
  invited_by UUID NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_token ON invitations(token) WHERE accepted_at IS NULL;
CREATE INDEX idx_invitations_email ON invitations(email);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  attachment_url TEXT,
  attachment_label TEXT,
  pending_review BOOLEAN NOT NULL DEFAULT false,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id)
);
CREATE INDEX idx_messages_project_created ON messages(project_id, created_at DESC);
CREATE INDEX idx_messages_pending_review ON messages(project_id) WHERE pending_review = true;

CREATE TABLE message_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  previous_body TEXT NOT NULL,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_edits_message ON message_edits(message_id);

CREATE TABLE message_reads (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE content_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  attempted_body TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  flag_type flag_type NOT NULL,
  matched_text TEXT NOT NULL,
  was_blocked BOOLEAN NOT NULL,
  status flag_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_flags_pending ON content_flags(project_id) WHERE status = 'pending';
CREATE INDEX idx_content_flags_user_recent ON content_flags(user_id, created_at DESC) WHERE was_blocked = true;

CREATE TABLE message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id),
  reported_by UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  status flag_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_reports_pending ON message_reports(status) WHERE status = 'pending';

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_events_user ON audit_events(user_id, created_at DESC);
CREATE INDEX idx_audit_events_target ON audit_events(target_type, target_id);
CREATE INDEX idx_audit_events_type ON audit_events(event_type, created_at DESC);

CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_frequency email_frequency NOT NULL DEFAULT 'immediate',
  email_flags_only BOOLEAN NOT NULL DEFAULT false,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project_notification_overrides (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  muted BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE coc_versions (
  id SERIAL PRIMARY KEY,
  version_number INTEGER UNIQUE NOT NULL,
  content TEXT NOT NULL,
  effective_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper functions
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = p_user_id AND left_at IS NULL
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION current_user_school()
RETURNS UUID AS $$
  SELECT school_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notification_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE coc_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY schools_select ON schools FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY users_select ON users FOR SELECT USING (
  id = auth.uid()
  OR current_user_role() IN ('district_admin')
  OR (current_user_role() = 'school_admin' AND school_id = current_user_school())
  OR (current_user_role() = 'teacher' AND school_id = current_user_school())
  OR EXISTS (
    SELECT 1 FROM project_members pm1
    JOIN project_members pm2 ON pm1.project_id = pm2.project_id
    WHERE pm1.user_id = auth.uid() AND pm2.user_id = users.id
      AND pm1.left_at IS NULL AND pm2.left_at IS NULL
  )
);
CREATE POLICY users_update_self ON users FOR UPDATE USING (id = auth.uid());

CREATE POLICY projects_select ON projects FOR SELECT USING (
  is_project_member(id, auth.uid())
  OR current_user_role() = 'district_admin'
  OR (current_user_role() = 'school_admin' AND school_id = current_user_school())
  OR (current_user_role() = 'teacher' AND school_id = current_user_school())
);
CREATE POLICY projects_insert ON projects FOR INSERT WITH CHECK (
  current_user_role() IN ('teacher', 'school_admin', 'district_admin') AND created_by = auth.uid()
);
CREATE POLICY projects_update ON projects FOR UPDATE USING (
  created_by = auth.uid() OR current_user_role() IN ('school_admin', 'district_admin')
);

CREATE POLICY project_members_select ON project_members FOR SELECT USING (
  is_project_member(project_id, auth.uid())
  OR current_user_role() IN ('school_admin', 'district_admin')
  OR (current_user_role() = 'teacher' AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_members.project_id AND p.school_id = current_user_school()
  ))
);

CREATE POLICY messages_select ON messages FOR SELECT USING (
  is_project_member(project_id, auth.uid())
  OR current_user_role() IN ('school_admin', 'district_admin')
  OR (current_user_role() = 'teacher' AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = messages.project_id AND p.school_id = current_user_school()
  ))
);
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (
  is_project_member(project_id, auth.uid()) AND sender_id = auth.uid()
);
CREATE POLICY messages_update ON messages FOR UPDATE USING (
  sender_id = auth.uid() OR current_user_role() IN ('school_admin', 'district_admin')
);

CREATE POLICY audit_events_select ON audit_events FOR SELECT USING (
  current_user_role() = 'district_admin'
  OR (current_user_role() = 'school_admin' AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = audit_events.user_id AND u.school_id = current_user_school()
  ))
);

CREATE POLICY notif_prefs_self ON notification_preferences FOR ALL USING (user_id = auth.uid());

CREATE POLICY content_flags_select ON content_flags FOR SELECT USING (
  user_id = auth.uid()
  OR current_user_role() IN ('school_admin', 'district_admin')
  OR (current_user_role() = 'teacher' AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = content_flags.project_id AND p.school_id = current_user_school()
  ))
);

CREATE POLICY message_reports_select ON message_reports FOR SELECT USING (
  reported_by = auth.uid()
  OR current_user_role() IN ('school_admin', 'district_admin')
  OR (current_user_role() = 'teacher' AND EXISTS (
    SELECT 1 FROM messages m JOIN projects p ON p.id = m.project_id
    WHERE m.id = message_reports.message_id AND p.school_id = current_user_school()
  ))
);
CREATE POLICY message_reports_insert ON message_reports FOR INSERT WITH CHECK (reported_by = auth.uid());

CREATE POLICY invitations_select ON invitations FOR SELECT USING (
  invited_by = auth.uid() OR current_user_role() IN ('school_admin', 'district_admin')
);
CREATE POLICY invitations_insert ON invitations FOR INSERT WITH CHECK (
  current_user_role() IN ('teacher', 'school_admin', 'district_admin') AND invited_by = auth.uid()
);

CREATE POLICY coc_versions_select ON coc_versions FOR SELECT USING (auth.uid() IS NOT NULL);

-- Triggers
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION log_message_edit() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.body IS DISTINCT FROM NEW.body AND NEW.deleted_at IS NULL THEN
    INSERT INTO message_edits (message_id, previous_body, edited_at)
    VALUES (OLD.id, OLD.body, now());
    NEW.edited_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER messages_log_edit BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION log_message_edit();

-- Seed initial COC version
INSERT INTO coc_versions (version_number, content, effective_date) VALUES (
  1, 'Partner code of conduct v1 — see build-spec.md §7 for full text.', now()
);
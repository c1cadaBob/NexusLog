\set ON_ERROR_STOP on

DO $$
DECLARE
    v_user_id UUID;
    v_session_count INT;
    v_reset_token_count INT;
    v_login_success_count INT;
    v_login_failed_count INT;
BEGIN
    SELECT id
    INTO v_user_id
    FROM users
    WHERE tenant_id = :'tenant_id'::uuid
      AND username = :'username'
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'verify failed: user not found, tenant_id=%, username=%', :'tenant_id', :'username';
    END IF;

    SELECT COUNT(*)
    INTO v_session_count
    FROM user_sessions
    WHERE tenant_id = :'tenant_id'::uuid
      AND user_id = v_user_id
      AND refresh_token_hash <> ''
      AND COALESCE(access_token_jti, '') <> ''
      AND session_status IN ('active', 'revoked')
      AND expires_at IS NOT NULL;

    IF v_session_count = 0 THEN
        RAISE EXCEPTION 'verify failed: user_sessions not written for tenant_id=%, username=%', :'tenant_id', :'username';
    END IF;

    SELECT COUNT(*)
    INTO v_reset_token_count
    FROM password_reset_tokens
    WHERE tenant_id = :'tenant_id'::uuid
      AND user_id = v_user_id
      AND token_hash <> ''
      AND char_length(token_hash) = 64
      AND expires_at > created_at;

    IF v_reset_token_count = 0 THEN
        RAISE EXCEPTION 'verify failed: password_reset_tokens not written for tenant_id=%, username=%', :'tenant_id', :'username';
    END IF;

    SELECT COUNT(*)
    INTO v_login_success_count
    FROM login_attempts
    WHERE tenant_id = :'tenant_id'::uuid
      AND user_id = v_user_id
      AND username = :'username'
      AND result = 'success';

    SELECT COUNT(*)
    INTO v_login_failed_count
    FROM login_attempts
    WHERE tenant_id = :'tenant_id'::uuid
      AND username = :'username'
      AND result = 'failed';

    IF v_login_success_count = 0 THEN
        RAISE EXCEPTION 'verify failed: login_attempts(success) missing for tenant_id=%, username=%', :'tenant_id', :'username';
    END IF;
    IF v_login_failed_count = 0 THEN
        RAISE EXCEPTION 'verify failed: login_attempts(failed) missing for tenant_id=%, username=%', :'tenant_id', :'username';
    END IF;
END
$$;

SELECT
    :'tenant_id'::uuid AS tenant_id,
    :'username'::text AS username,
    (
        SELECT COUNT(*)
        FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.tenant_id = :'tenant_id'::uuid
          AND u.username = :'username'
    ) AS session_rows,
    (
        SELECT COUNT(*)
        FROM password_reset_tokens prt
        JOIN users u ON u.id = prt.user_id
        WHERE prt.tenant_id = :'tenant_id'::uuid
          AND u.username = :'username'
    ) AS reset_token_rows,
    (
        SELECT COUNT(*)
        FROM login_attempts la
        WHERE la.tenant_id = :'tenant_id'::uuid
          AND la.username = :'username'
    ) AS login_attempt_rows;

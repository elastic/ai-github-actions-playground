# Users and Roles (Planning)

The connected cluster can provide read-only security metadata for UX exploration through Elasticsearch security APIs such as `_security/user`, `_security/role`, and `_security/user/_has_privileges`.

For a first-pass UX, prioritize list + detail views: Users list (username, enabled, assigned roles, metadata) and Roles list (role name, cluster privileges, index privileges, run-as users, metadata).

Use capability checks from `_security/user/_has_privileges` to keep behavior safe: show full details when allowed, and a clear partial-access message when credentials cannot read some security resources.

Keep the primary workflow read-first with Refresh and search controls, plus a copy-to-Console action so advanced users can inspect raw API responses without leaving Peek.

# Users & Roles

Use the Users and Roles pages together to audit access, investigate permission changes, and understand the effective privileges of any principal in the cluster.

## Navigating from Users to Roles

On the Users page, each role chip in the detail pane is clickable. Click a role name to jump directly to the Roles page with that role pre-selected. This lets you instantly answer "what does this role actually grant?" without manually searching.

## Navigating from Roles to Users

On the Roles page, the detail pane shows an **Assigned users** section listing every user that holds the selected role. Each user chip is clickable — click a username to jump directly to the Users page with that user pre-selected. This lets you quickly pivot from "who has this role?" to "what else does this user have access to?".

## Seeing Who Has a Role

On the Roles page, the **Assigned users** chips let you answer "who would be affected if I change this role?" during an incident or access review. Click any chip to drill into the full user record on the Users page.

## Common Investigation Workflows

**Audit a user's effective access:** Open the Users page, select the user, then click each role chip to review the privileges granted by each role.

**Assess the blast radius of a role change:** Open the Roles page, select the role, and check the Assigned users list to identify all principals affected before making a change.

**Onboarding review:** Navigate to the Users page for a new user, verify the assigned roles look correct, then click through each role to confirm the privileges match expectations.

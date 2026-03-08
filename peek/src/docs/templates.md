# Index Templates

Open Index Templates from the sidebar under System to browse and inspect index templates that control how new indices are created.

## Template list

The page lists all index templates in the cluster:

- **Template name** — the unique identifier.
- **Index patterns** — the index name patterns that the template matches (e.g., `logs-*`, `metrics-*`).
- **Priority** — determines which template takes precedence when multiple templates match an index name.
- **Composed of** — component templates included in this template.

Use the search box to filter templates by name or index pattern.

## Template detail

Select a template to view its full configuration:

- **Index patterns** — the patterns this template matches.
- **Settings** — index settings applied by this template (shard count, refresh interval, codec, etc.).
- **Mappings** — field mappings defined by the template, shown as a flattened field list with types.
- **Aliases** — any aliases automatically created for matching indices.
- **Component templates** — the list of reusable component templates composed into this template.

## Component templates

Component templates are reusable building blocks that can be shared across multiple index templates. Each component template defines a partial set of settings, mappings, or aliases.

## Troubleshooting

If a new index does not pick up expected settings:

1. Check which templates match the index name using `GET /_index_template?filter_path=index_templates.name,index_templates.index_template.index_patterns`.
2. Verify template priority — the highest priority template wins when multiple templates match.
3. Inspect component template composition order — later components override earlier ones.

If templates fail to load, verify that your credentials have the `manage_index_templates` or `monitor` cluster privilege.

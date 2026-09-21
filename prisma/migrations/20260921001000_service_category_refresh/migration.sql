-- Reorder the final two service categories and align their content with the
-- website's four positional service vessels. Published releases remain immutable;
-- this updates only the editable draft tables.

UPDATE "services"
SET
  "sort_order" = 2,
  "name" = 'AI & Automation',
  "eyebrow" = 'Intelligent systems that remove repetitive work',
  "description" = 'We build AI-powered applications, assistants, document and knowledge tools, and workflow automation that helps teams work faster and make better use of their data.',
  "discipline_id" = (SELECT "id" FROM "disciplines" WHERE "key" = 'ai'),
  "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'artificial-intelligence';

UPDATE "services"
SET
  "sort_order" = 3,
  "name" = 'Custom Software',
  "eyebrow" = 'Software shaped around the way your business works',
  "description" = 'We build custom CRM platforms, internal tools, integrations, dashboards, desktop software, and other tailored systems that connect data and support the way your business operates.',
  "discipline_id" = (SELECT "id" FROM "disciplines" WHERE "key" = 'enterprise'),
  "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'enterprise-platforms';

DELETE FROM "service_capabilities"
WHERE "service_id" IN (
  SELECT "id" FROM "services"
  WHERE "slug" IN ('artificial-intelligence', 'enterprise-platforms')
);

INSERT INTO "service_capabilities" ("id", "service_id", "sort_order", "label")
SELECT gen_random_uuid(), "id", 0, 'AI Assistants' FROM "services" WHERE "slug" = 'artificial-intelligence'
UNION ALL
SELECT gen_random_uuid(), "id", 1, 'Workflow Automation' FROM "services" WHERE "slug" = 'artificial-intelligence'
UNION ALL
SELECT gen_random_uuid(), "id", 2, 'Document Processing' FROM "services" WHERE "slug" = 'artificial-intelligence'
UNION ALL
SELECT gen_random_uuid(), "id", 3, 'Knowledge Systems' FROM "services" WHERE "slug" = 'artificial-intelligence'
UNION ALL
SELECT gen_random_uuid(), "id", 0, 'Custom CRM' FROM "services" WHERE "slug" = 'enterprise-platforms'
UNION ALL
SELECT gen_random_uuid(), "id", 1, 'Internal Tools' FROM "services" WHERE "slug" = 'enterprise-platforms'
UNION ALL
SELECT gen_random_uuid(), "id", 2, 'Software Integrations' FROM "services" WHERE "slug" = 'enterprise-platforms'
UNION ALL
SELECT gen_random_uuid(), "id", 3, 'Tailored Systems' FROM "services" WHERE "slug" = 'enterprise-platforms';

UPDATE "disciplines"
SET
  "label" = CASE "key"
    WHEN 'enterprise' THEN 'Custom Software'
    WHEN 'ai' THEN 'AI & Automation'
    ELSE "label"
  END,
  "brief_seed" = CASE "key"
    WHEN 'enterprise' THEN 'We need a custom CRM, internal tool, integration, desktop application, or another tailored system. Here is how the business works today:'
    WHEN 'ai' THEN 'We want to add practical AI or automate a business workflow. Here is the problem it should solve:'
    ELSE "brief_seed"
  END
WHERE "key" IN ('enterprise', 'ai');

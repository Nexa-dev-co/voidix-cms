-- Refresh the editable CMS draft from the approved website content PDF.
--
-- Published releases are append-only and deliberately untouched. The updated draft reaches the
-- public site only after an administrator reviews it and presses Publish.

UPDATE "services"
SET
  "name" = 'Websites & Web Apps',
  "eyebrow" = 'Digital products built for performance and conversion',
  "description" = 'We design and build high-performance business websites, landing pages, web applications, customer portals, and SaaS products around your brand, users, workflows, and goals.',
  "updated_at" = NOW()
WHERE "slug" = 'web-experiences';

UPDATE "services"
SET
  "name" = 'Mobile Apps',
  "eyebrow" = 'iOS and Android experiences connected to your business',
  "description" = 'We design and develop mobile applications for customers, employees, and digital products, connecting each app to the APIs, databases, and business systems behind it.',
  "updated_at" = NOW()
WHERE "slug" = 'mobile-systems';

UPDATE "services"
SET
  "name" = 'CRM & Automation',
  "eyebrow" = 'Business systems shaped around the way you work',
  "description" = 'We build custom CRM platforms, internal tools, workflow automation, and integrations that centralize customer data, connect your systems, and reduce repetitive manual work.',
  "updated_at" = NOW()
WHERE "slug" = 'enterprise-platforms';

UPDATE "services"
SET
  "name" = 'AI Software & Tools',
  "eyebrow" = 'Practical AI integrated into real workflows',
  "description" = 'We develop AI-powered applications and add useful AI capabilities to websites, CRMs, SaaS platforms, internal tools, and existing business workflows.',
  "updated_at" = NOW()
WHERE "slug" = 'artificial-intelligence';

DELETE FROM "service_capabilities"
WHERE "service_id" IN (
  SELECT "id"
  FROM "services"
  WHERE "slug" IN (
    'web-experiences',
    'mobile-systems',
    'enterprise-platforms',
    'artificial-intelligence'
  )
);

INSERT INTO "service_capabilities" ("id", "service_id", "sort_order", "label")
SELECT gen_random_uuid(), "services"."id", "capabilities"."sort_order", "capabilities"."label"
FROM (
  VALUES
    ('web-experiences', 0, 'Business Websites'),
    ('web-experiences', 1, 'Web Applications'),
    ('web-experiences', 2, 'SaaS Products'),
    ('web-experiences', 3, 'Customer Portals'),
    ('mobile-systems', 0, 'iOS & Android'),
    ('mobile-systems', 1, 'Customer Apps'),
    ('mobile-systems', 2, 'Business Apps'),
    ('mobile-systems', 3, 'Connected Systems'),
    ('enterprise-platforms', 0, 'Custom CRM'),
    ('enterprise-platforms', 1, 'Workflow Automation'),
    ('enterprise-platforms', 2, 'Integrations'),
    ('enterprise-platforms', 3, 'Reporting'),
    ('artificial-intelligence', 0, 'AI Assistants'),
    ('artificial-intelligence', 1, 'Document Processing'),
    ('artificial-intelligence', 2, 'Knowledge Systems'),
    ('artificial-intelligence', 3, 'AI Workflows')
) AS "capabilities" ("slug", "sort_order", "label")
JOIN "services" ON "services"."slug" = "capabilities"."slug";

UPDATE "disciplines"
SET
  "label" = CASE "key"
    WHEN 'web' THEN 'Websites & Web Applications'
    WHEN 'mobile' THEN 'Mobile App Development'
    WHEN 'enterprise' THEN 'CRM, SaaS & Automation'
    WHEN 'ai' THEN 'AI Software & Tools'
  END,
  "brief_seed" = CASE "key"
    WHEN 'web' THEN 'We need a website or web application for our business. Here is what it should help us accomplish:'
    WHEN 'mobile' THEN 'We need a mobile application for our customers, team, or digital product. Here is what it should do:'
    WHEN 'enterprise' THEN 'We need a CRM, SaaS platform, automation system, or integration built around our workflow. Here is how the business works today:'
    WHEN 'ai' THEN 'We want to add practical AI to a product or business workflow. Here is the problem it should solve:'
  END
WHERE "key" IN ('web', 'mobile', 'enterprise', 'ai');

INSERT INTO "contact_section" (
  "id", "title", "lead", "brief_label", "submit_label", "updated_at"
)
VALUES (
  'singleton',
  'Tell us what you''re building.',
  'You don''t need a perfect technical specification. Tell us what you are building, who will use it, what problem it solves, and what needs to happen when it launches. We can help turn the idea into a practical product and development roadmap.',
  'What are you building?',
  'Start your project',
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "lead" = EXCLUDED."lead",
  "brief_label" = EXCLUDED."brief_label",
  "submit_label" = EXCLUDED."submit_label",
  "updated_at" = NOW();

INSERT INTO "footer_content" ("id", "tagline", "sign_off", "updated_at")
VALUES (
  'singleton',
  'Custom Software Development for Modern Businesses',
  'Voidix — software with its own gravity.',
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "tagline" = EXCLUDED."tagline",
  "sign_off" = EXCLUDED."sign_off",
  "updated_at" = NOW();

INSERT INTO "enquiry_form_content" (
  "id",
  "name_label",
  "email_label",
  "phone_label",
  "sending_label",
  "sent_message",
  "error_message",
  "reference_subject_suffix",
  "reference_brief_prefix",
  "updated_at"
)
VALUES (
  'singleton',
  'Name',
  'Email',
  'Mobile',
  'Sending…',
  'Your project details have been sent. We will review them and follow up.',
  'Your project details could not be sent. Please try again in a moment.',
  '— similar to {project}',
  'We are interested in work similar to {project}.',
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "name_label" = EXCLUDED."name_label",
  "email_label" = EXCLUDED."email_label",
  "phone_label" = EXCLUDED."phone_label",
  "sending_label" = EXCLUDED."sending_label",
  "sent_message" = EXCLUDED."sent_message",
  "error_message" = EXCLUDED."error_message",
  "reference_subject_suffix" = EXCLUDED."reference_subject_suffix",
  "reference_brief_prefix" = EXCLUDED."reference_brief_prefix",
  "updated_at" = NOW();

INSERT INTO "about_page" (
  "id",
  "eyebrow",
  "title_line_1",
  "title_line_2",
  "lead",
  "premise_quote",
  "instruments_note",
  "stack_note",
  "closing_title",
  "closing_lead",
  "careers_invite",
  "updated_at"
)
VALUES (
  'singleton',
  'About',
  'One technology partner.',
  'Multiple connected systems.',
  'Voidix is a custom software development company building digital products and business systems for companies across the United States. We turn new ideas, outdated tools, manual processes, and disconnected systems into working software.',
  'Your business → Your workflow → Your software.',
  'These are commitments, not a scoreboard. They are the four numbers we will be held to before a line of code exists.',
  'A project can begin with one system and grow into a connected digital ecosystem without rebuilding the foundation each time.',
  'Tell us what you''re building.',
  'You don''t need a perfect technical specification. Tell us what it should do, who will use it, and what needs to be true when it launches.',
  'Or come and build it with us',
  NOW()
)
ON CONFLICT ("id") DO UPDATE SET
  "eyebrow" = EXCLUDED."eyebrow",
  "title_line_1" = EXCLUDED."title_line_1",
  "title_line_2" = EXCLUDED."title_line_2",
  "lead" = EXCLUDED."lead",
  "premise_quote" = EXCLUDED."premise_quote",
  "instruments_note" = EXCLUDED."instruments_note",
  "stack_note" = EXCLUDED."stack_note",
  "closing_title" = EXCLUDED."closing_title",
  "closing_lead" = EXCLUDED."closing_lead",
  "careers_invite" = EXCLUDED."careers_invite",
  "updated_at" = NOW();

DELETE FROM "about_premise_paragraphs";
INSERT INTO "about_premise_paragraphs" ("id", "sort_order", "body")
VALUES
  (gen_random_uuid(), 0, 'Off-the-shelf software asks your business to adapt to the product. Custom software works the other way around: it is designed around your processes, customers, data, and goals.'),
  (gen_random_uuid(), 1, 'Your website should communicate with your CRM. Your CRM should communicate with your applications. Your applications should communicate with your internal systems. Automation should connect the work between them. We build that technology layer as one system.');

DELETE FROM "about_principles";
INSERT INTO "about_principles" ("id", "sort_order", "claim", "backing")
VALUES
  (gen_random_uuid(), 0, 'Replace manual processes.', 'Move repetitive work out of spreadsheets, emails, and disconnected tools and into systems that can carry it reliably.'),
  (gen_random_uuid(), 1, 'Replace outdated software.', 'Modernize legacy systems and replace software that no longer fits the way your business operates.'),
  (gen_random_uuid(), 2, 'Launch a new product.', 'Turn an idea into an MVP, SaaS platform, web application, mobile product, or connected customer experience.'),
  (gen_random_uuid(), 3, 'Connect your systems.', 'Integrate your CRM, website, applications, APIs, databases, payment systems, and business tools.'),
  (gen_random_uuid(), 4, 'Add AI where it helps.', 'Identify practical uses for AI in customer service, operations, sales, internal knowledge, documents, and data-heavy workflows.'),
  (gen_random_uuid(), 5, 'Build a competitive product.', 'Create technology around your customers and operating model instead of relying on generic software to define both.');

DELETE FROM "about_build_phases";
INSERT INTO "about_build_phases" ("id", "sort_order", "span", "name", "detail")
VALUES
  (gen_random_uuid(), 0, '01', 'Discover', 'We learn your business, users, current technology, workflows, and objectives before deciding what to build.'),
  (gen_random_uuid(), 1, '02', 'Architect', 'We turn the requirements into a roadmap covering product structure, data, integrations, automation, and priorities.'),
  (gen_random_uuid(), 2, '03', 'Design', 'We design the interfaces and workflows around the people who will use the product and the decisions they need to make.'),
  (gen_random_uuid(), 3, '04', 'Build', 'We turn the approved architecture and designs into working software, with progress visible throughout development.'),
  (gen_random_uuid(), 4, '05', 'Launch', 'We test, deploy, integrate, and prepare the product for real users and real business operations.'),
  (gen_random_uuid(), 5, '06', 'Evolve', 'We can continue improving the product, adding features, connecting systems, and introducing automation or AI as the business grows.');

DELETE FROM "about_instruments";
INSERT INTO "about_instruments" ("id", "sort_order", "label", "value")
VALUES
  (gen_random_uuid(), 0, 'First reply', 'Under 5 days'),
  (gen_random_uuid(), 1, 'First proof', '2 weeks'),
  (gen_random_uuid(), 2, 'Frame budget', '16.7 ms'),
  (gen_random_uuid(), 3, 'Handover', 'Fully documented');

DELETE FROM "about_stack_items";
INSERT INTO "about_stack_items" ("id", "sort_order", "label")
VALUES
  (gen_random_uuid(), 0, 'Websites'),
  (gen_random_uuid(), 1, 'Web applications'),
  (gen_random_uuid(), 2, 'CRM platforms'),
  (gen_random_uuid(), 3, 'Mobile apps'),
  (gen_random_uuid(), 4, 'SaaS products'),
  (gen_random_uuid(), 5, 'AI software'),
  (gen_random_uuid(), 6, 'Business automation'),
  (gen_random_uuid(), 7, 'Software integrations');

DELETE FROM "faq_entries";
INSERT INTO "faq_entries" ("id", "sort_order", "question", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 0, 'What does Voidix build?', NOW(), NOW()),
  (gen_random_uuid(), 1, 'Does Voidix work with businesses in the United States?', NOW(), NOW()),
  (gen_random_uuid(), 2, 'Can you build a custom CRM for our business?', NOW(), NOW()),
  (gen_random_uuid(), 3, 'Can you turn our idea into a SaaS product?', NOW(), NOW()),
  (gen_random_uuid(), 4, 'Can you integrate AI into software we already use?', NOW(), NOW()),
  (gen_random_uuid(), 5, 'Can you automate our existing business processes?', NOW(), NOW()),
  (gen_random_uuid(), 6, 'Do you build mobile apps?', NOW(), NOW()),
  (gen_random_uuid(), 7, 'Can you connect our CRM, website, and other software?', NOW(), NOW()),
  (gen_random_uuid(), 8, 'How much does custom software development cost?', NOW(), NOW()),
  (gen_random_uuid(), 9, 'How do we start a project?', NOW(), NOW());

INSERT INTO "faq_paragraphs" ("id", "faq_entry_id", "sort_order", "body")
SELECT gen_random_uuid(), "id", 0,
  CASE "question"
    WHEN 'What does Voidix build?' THEN 'Voidix builds custom digital products and business software, including websites, web applications, CRM systems, mobile applications, SaaS platforms, AI-powered tools, automation systems, and software integrations.'
    WHEN 'Does Voidix work with businesses in the United States?' THEN 'Yes. Voidix works with B2B companies across the United States that need custom software, digital products, automation, integrations, or AI solutions.'
    WHEN 'Can you build a custom CRM for our business?' THEN 'Yes. A custom CRM can be designed around your sales pipeline, customer data, team workflows, reporting requirements, integrations, and automation needs.'
    WHEN 'Can you turn our idea into a SaaS product?' THEN 'Yes. Voidix can take a software concept through planning, UX and UI design, development, integrations, deployment, and continued product development.'
    WHEN 'Can you integrate AI into software we already use?' THEN 'Yes. AI capabilities can be integrated into existing websites, CRMs, SaaS products, internal systems, and business workflows when the technology and use case support it.'
    WHEN 'Can you automate our existing business processes?' THEN 'Yes. We can analyze repetitive workflows, connect systems, automate data movement, trigger actions, and reduce unnecessary manual work.'
    WHEN 'Do you build mobile apps?' THEN 'Yes. Voidix develops mobile applications for businesses and digital products, including customer-facing apps and internal business applications.'
    WHEN 'Can you connect our CRM, website, and other software?' THEN 'Yes. Software integrations can connect websites, CRMs, payment systems, databases, APIs, communication tools, and other business platforms.'
    WHEN 'How much does custom software development cost?' THEN 'The cost depends on the product''s scope, complexity, integrations, number of users, design requirements, and development requirements. Voidix evaluates the project before providing a development proposal.'
    WHEN 'How do we start a project?' THEN 'Tell us what you are building, who it is for, what problem it solves, and what the software needs to accomplish. We will review the requirements and determine the appropriate next step.'
  END
FROM "faq_entries";

-- Add explicit call and text actions to the existing Direct footer group. Published releases stay
-- append-only and receive these links the next time Footer is published.
WITH "direct_group" AS (
  SELECT "id"
  FROM "footer_link_groups"
  WHERE "title" = 'Direct'
  ORDER BY "sort_order"
  LIMIT 1
),
"starting_order" AS (
  SELECT COALESCE(MAX("footer_links"."sort_order"), -1) AS "value"
  FROM "footer_links"
  INNER JOIN "direct_group" ON "direct_group"."id" = "footer_links"."group_id"
),
"new_links" ("relative_order", "label", "href") AS (
  VALUES
    (1, 'Call +1 (307) 317-9422', 'tel:+13073179422'),
    (2, 'Text', 'sms:+13073179422')
)
INSERT INTO "footer_links" ("id", "group_id", "sort_order", "label", "href")
SELECT
  gen_random_uuid(),
  "direct_group"."id",
  "starting_order"."value" + "new_links"."relative_order",
  "new_links"."label",
  "new_links"."href"
FROM "direct_group"
CROSS JOIN "starting_order"
CROSS JOIN "new_links"
WHERE NOT EXISTS (
  SELECT 1
  FROM "footer_links"
  WHERE "footer_links"."href" = "new_links"."href"
);

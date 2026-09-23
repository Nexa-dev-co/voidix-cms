-- Add Facebook to the existing Elsewhere footer group. Published releases stay
-- append-only and receive this link the next time Footer is published.
WITH "elsewhere_group" AS (
  SELECT "id"
  FROM "footer_link_groups"
  WHERE lower("title") = 'elsewhere'
  ORDER BY "sort_order"
  LIMIT 1
),
"starting_order" AS (
  SELECT COALESCE(MAX("footer_links"."sort_order"), -1) AS "value"
  FROM "footer_links"
  INNER JOIN "elsewhere_group" ON "elsewhere_group"."id" = "footer_links"."group_id"
),
"new_links" ("relative_order", "label", "href") AS (
  VALUES
    (1, 'Facebook', 'https://www.facebook.com/Voidix.tech/')
)
INSERT INTO "footer_links" ("id", "group_id", "sort_order", "label", "href")
SELECT
  gen_random_uuid(),
  "elsewhere_group"."id",
  "starting_order"."value" + "new_links"."relative_order",
  "new_links"."label",
  "new_links"."href"
FROM "elsewhere_group"
CROSS JOIN "starting_order"
CROSS JOIN "new_links"
WHERE NOT EXISTS (
  SELECT 1
  FROM "footer_links"
  WHERE "footer_links"."href" = "new_links"."href"
);

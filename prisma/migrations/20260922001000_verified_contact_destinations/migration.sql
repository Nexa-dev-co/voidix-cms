-- Bring existing footer drafts in line with the studio's first verified social profile and public
-- inbox. Published releases remain append-only; an editor must publish the updated draft for the
-- site to consume it.
UPDATE "footer_links"
SET "href" = 'https://www.linkedin.com/company/voidix-tech'
WHERE "href" = 'https://linkedin.com/company/voidixstudio';

DELETE FROM "footer_links"
WHERE "href" = 'https://dribbble.com/voidixstudio';

UPDATE "footer_links"
SET
  "label" = 'info@voidix.tech',
  "href" = 'mailto:info@voidix.tech'
WHERE "href" = 'mailto:hello@voidix.studio';

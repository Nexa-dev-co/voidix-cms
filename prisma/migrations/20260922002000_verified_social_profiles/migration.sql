-- Replace the remaining placeholder social destinations in existing footer drafts. Published
-- releases stay append-only and receive these links the next time Footer is published.
UPDATE "footer_links"
SET "href" = 'https://x.com/Voidix_tech'
WHERE "href" = 'https://x.com/voidixstudio';

UPDATE "footer_links"
SET "href" = 'https://github.com/Voidix-tech'
WHERE "href" = 'https://github.com/voidixstudio';

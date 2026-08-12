-- Make `submissions` record what the site's enquiry form actually sends.
--
-- This is the same class of correction as `20260812000001_contact_footer_reshape`: the table was
-- modelled before the form was wired to it, and connecting the two showed three places where the
-- model demanded something the form does not collect, or dropped something it does.
--
--  1. `name` and `message` become nullable. The site's form requires exactly ONE field — the email
--     address — and that is a deliberate, documented decision over there: a required-field wall in
--     front of a first message costs more conversations than a tidier inbox is worth. With NOT NULL
--     here, a visitor who typed an address and pressed send got a 422 and the words "That did not
--     send", which is the form breaking on a path it openly offers.
--
--  2. `phone` is added. The form asks for a mobile and validates it; there was nowhere to put it,
--     so it was going to arrive at this endpoint and be dropped in silence. The applications table
--     already has this column — an enquiry is not a lesser record than an application.
--
--  3. `source` widens 40 → 120. It carries the form's subject, which names both a discipline and,
--     from the works field, the project the visitor was pointing at: "Artificial Intelligence —
--     like Halcyon". 40 characters truncates the half that says which project.
--
-- Nothing here is destructive: relaxing NOT NULL and widening a VARCHAR both keep every existing
-- row exactly as it is. `promoteSubmission` fills a missing name from the email address the same
-- way the spreadsheet importer does, and `enquiries.message` was already nullable.

ALTER TABLE "submissions" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "submissions" ALTER COLUMN "message" DROP NOT NULL;
ALTER TABLE "submissions" ADD COLUMN "phone" VARCHAR(40);
ALTER TABLE "submissions" ALTER COLUMN "source" TYPE VARCHAR(120);

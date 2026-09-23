import assert from "node:assert/strict";
import test from "node:test";

import {
  footerSchema,
  isExternalLinkUrl,
  isSafeLinkUrl,
} from "../lib/validation/contentSchemas";

test("Elsewhere group contains Facebook with correct URL and label in footer schema", () => {
  const sampleRawFooter = [
    "[Elsewhere]",
    "X | https://x.com/Voidix_tech",
    "LinkedIn | https://www.linkedin.com/company/voidix-tech",
    "GitHub | https://github.com/Voidix-tech",
    "Facebook | https://www.facebook.com/Voidix.tech/",
  ].join("\n");

  const parsed = footerSchema.parse({
    tagline: "Custom Software Development for Modern Businesses",
    signOff: "Voidix — software with its own gravity.",
    linkGroups: sampleRawFooter,
  });

  const elsewhere = parsed.linkGroups.find((group) => group.title === "Elsewhere");
  assert.ok(elsewhere, "Elsewhere group must exist");

  const facebookLink = elsewhere.links.find((link) => link.label === "Facebook");
  assert.ok(facebookLink, "Facebook link must exist");
  assert.equal(facebookLink.href, "https://www.facebook.com/Voidix.tech/");
});

test("Facebook link URL is safe and identified as external", () => {
  const facebookUrl = "https://www.facebook.com/Voidix.tech/";
  assert.equal(isSafeLinkUrl(facebookUrl), true);
  assert.equal(isExternalLinkUrl(facebookUrl), true);
});

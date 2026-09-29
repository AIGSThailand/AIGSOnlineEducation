import assert from "node:assert/strict";
import { EMAIL_EVENTS } from "../features/email/events";
import { mailosaurCaptureHint } from "../features/email/mailosaur";
import { renderEmailTemplate, unknownTemplateVariables } from "../features/email/render";

const event = EMAIL_EVENTS["support.ticket_created"];
const rendered = renderEmailTemplate(event.defaults, {
  siteName: "AIGS",
  ticketId: "abc",
  subject: "Hello\r\nBcc: evil@example.com",
  body: "<script>alert(1)</script>",
  userEmail: "learner@example.com",
});

assert.equal(rendered.subject.includes("\n"), false);
assert.equal(rendered.subject.includes("\r"), false);
assert.equal(rendered.html.includes("<script>"), false);
assert.match(rendered.html, /&lt;script&gt;/);
assert.match(rendered.text, /<script>alert/);
assert.equal(
  unknownTemplateVariables("support.ticket_created", {
    ...event.defaults,
    subject: "{{notAVariable}}",
  }).join(","),
  "notAVariable"
);
assert.deepEqual(unknownTemplateVariables("email.test", EMAIL_EVENTS["email.test"].defaults), []);

assert.equal(mailosaurCaptureHint("production", "abc12345"), null);
assert.equal(mailosaurCaptureHint("local", "bad id"), null);
const hint = mailosaurCaptureHint("staging", "abc12345");
assert.equal(hint?.host, "smtp.mailosaur.net");
assert.equal(hint?.port, 2525);
assert.equal(hint?.secure, false);
assert.equal(hint?.username, "abc12345@mailosaur.net");
assert.equal(hint?.inboxDomain, "abc12345.mailosaur.net");

console.log("email render checks passed");

# Vision

## What this is for

A consulting firm's engagement lead and its client cannot read pull requests, verdicts or a markdown report issue. The AGK portal gives
them one page per project in plain business words: what was delivered this week, what is proven, what needs their decision, what is at
risk, what it cost, and how the requirements stand. The page reads only the AGK facts document published by each project's weekly
report. It writes nothing, stores nothing, holds no secret and uses no model.

## Who it serves

The engagement lead of a consulting firm and the client of that firm, neither of whom reads pull requests, verdicts or a markdown
report issue.

## How success is measured

- Every listed project has a card that either shows its facts or says "not known yet" with a named reason.
- Every sentence on the page is a requirement's own sentence or a fixed phrase over a facts number, and every line links to its evidence
  on GitHub.
- The page is live on GitHub Pages and usable at phone width.

## Out of scope

- Writes of any kind, any model or generated prose, any server, holding any secret.
- Later slices, not this one: sign-in, private repositories, the GitHub App, action buttons, creating projects, SSO, theming.

## Project rules

- The portal is read-only and reads public repositories only. <!-- project-specific -->
- The portal stores nothing, holds no secret and uses no model. <!-- project-specific -->
- Every sentence is a requirement's own sentence or a fixed phrase over a facts number. <!-- project-specific -->
- An unknown in the facts is shown as "not known yet", never hidden. <!-- project-specific -->
- Pages are designed mobile first. <!-- project-specific -->

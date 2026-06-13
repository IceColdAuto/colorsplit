# ColorSplit Product Rules

Current MVP:
- Only two user-facing flows: Solo and Color Together.
- Color Together is always hidden split/tear coloring.
- Reveal always happens at the end.
- No selectable game modes.
- No Advanced options.
- No Reveal/Live toggle.
- No Line Helper / Stay in Lines / Free Color.
- Solo has no mode/helper settings.
- Apple login stays disabled until configured.
- External invite link stays as fallback.
- In-app friend invites stay.
- Waiting room has a back confirmation before leaving.

Before changing UI:
- Do not reintroduce deleted concepts.
- Do not add new modes.
- Do not hide removed options inside Advanced settings.

## Gallery ownership checkpoint

- Account gallery is account-based and cloud-backed.
- Guest artworks are temporary and tied to the current guestId.
- Guest artworks migrate automatically to the current account on sign-in.
- No migration prompt/banner is shown.
- Migrated artworks are hidden from guest mode after logout.
- Account artworks are not visible after logout.
- Another account on the same device cannot see previous account artworks.
- Legacy/unknown-owner artworks are hidden by default.

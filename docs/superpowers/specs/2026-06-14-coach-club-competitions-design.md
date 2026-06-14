# Coach Club Competitions Design

## Objective

Allow a coach to create a club-level competition event and assign the concerned judokas, while preserving the existing ability for a judoka or parent to create individual competitions when needed.

## Functional Scope

In scope:
- a coach can create and edit a club competition event;
- a coach can assign multiple judokas to that club event;
- each assigned judoka gets an individual participation that appears in their own competition history;
- the coach can enter or update combats and final rankings for all participations in the club event;
- a judoka or parent can still enter or update data only for their own participation scope;
- removing a judoka from a club event detaches the participation from the club grouping but keeps the individual competition, combats, and ranking.

Out of scope:
- changing Google authentication or invitation rules;
- introducing location or actual weigh-in fields;
- replacing the existing individual competition and combat screens completely;
- deleting sports data automatically when a participant is removed from a club event.

## Domain Model

The model separates the shared event from individual judoka participation.

- `ClubCompetition`: the shared event created by a coach. It carries common event data such as name, date, age category, and weight category defaults when applicable.
- `Competition`: the existing individual judoka competition record. It remains the owner of ranking and is still the parent for combats.
- `ClubCompetitionParticipation`: the link between a club event and an individual `Competition` for one judoka.

The existing `competitions.id_judoka` remains the participant/owner judoka. This keeps judoka season statistics and combat ownership close to the current model.

## Permissions

- `JUDOKA` can create, edit, finalize, and manage combats only for their own individual competitions.
- `PARENT` can create, edit, finalize, and manage combats for competitions in their managed judoka scope.
- `COACH` can create and edit club competition events, assign or detach judokas, and manage combats/rankings for all linked participations.
- `ADMIN` inherits coach competition-management rights and keeps existing admin rights.

Coach write permissions are intentionally limited to competition-event and sports-data workflows. Coaches do not gain invitation-management rights.

## Data Design

Add a `club_competitions` table:
- `id_club_competition` text primary key;
- `nom` text not null;
- `date` date not null;
- `categorie_age` text not null default empty string;
- `categorie_poids` text not null default empty string;
- timestamps.

Add nullable `club_competition_id` on `competitions`:
- references `club_competitions.id_club_competition`;
- nullable so existing individual competitions remain valid;
- setting it to null detaches the participation from the club event without deleting sports data.

No new combat table is needed. `combats.id_competition` continues to reference the individual competition participation.

## Core Flows

### Coach Creates A Club Competition

1. Coach opens a club competition creation form.
2. Coach enters common event details.
3. Coach selects one or more judokas.
4. The backend creates one `club_competitions` record.
5. The backend creates one linked `competitions` record per selected judoka.
6. The coach lands on the club competition detail view with all participations visible.

### Coach Adds Or Removes Participants

Adding a participant creates a new linked `competitions` record for that judoka unless a matching participation already exists.

Removing a participant sets that participation's `club_competition_id` to null. The individual competition, combats, and ranking remain available in the judoka history.

### Judoka Or Parent Updates Their Participation

When a judoka or parent opens a linked participation, they see the same individual competition behavior as today. Their writes are limited to their own scope.

### Coach Updates Sports Data

When a coach opens a club competition detail view, they can select a participant and enter combats or final ranking for that participant. The backend validates that the target competition is linked to the club event or otherwise in the coach's global sports-management scope.

## UI Design

Home remains role-aware:
- judoka and parent flows keep the existing individual competition creation action;
- coach home shows club competition dashboard and a primary action to create a club competition;
- admin sees the same club competition workflow plus admin management actions.

Club competition detail shows:
- event summary;
- participant list with judoka names and current ranking/combat record;
- participant add/detach controls for coach/admin;
- a way to open the individual participation detail for combat and ranking entry.

Individual competition detail remains usable for judoka and parent. If the competition is linked to a club event, it may show a small club-event context label.

## Validation And Error Handling

Server-side validation must enforce:
- club event name and date are required;
- selected participant ids must exist;
- coach/admin can manage all club-event participations;
- judoka/parent can manage only their own scoped participation;
- duplicate participant links in the same club event are rejected;
- detaching a participant never deletes combats or ranking.

User-facing errors should be explicit:
- "Judoka participant obligatoire.";
- "Ce judoka est déjà inscrit à cette compétition club.";
- "Accès refusé à cette participation.";
- "La participation a été retirée de la compétition club sans supprimer ses résultats."

## Tests

Add focused tests for:
- domain creation of a club competition with participations;
- coach can create a club event and linked competitions;
- judoka can still create an individual competition;
- parent can still create in managed scope;
- coach can manage combats/rankings for linked participations;
- judoka/parent cannot manage another participant's data;
- detaching a participant clears only the club link and keeps sports data;
- Supabase schema includes `club_competitions` and nullable `competitions.club_competition_id`;
- UI hides club participant management from judoka/parent and exposes it to coach/admin.

## Migration Notes

Existing rows in `competitions` should remain untouched with `club_competition_id = null`.

Existing screens and statistics can continue reading `competitions` and `combats`. The club dashboard should group by `club_competition_id` when present, and may keep the existing name/date grouping as a fallback for legacy individual competitions.

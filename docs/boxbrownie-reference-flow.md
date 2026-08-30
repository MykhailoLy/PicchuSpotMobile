# SnapSnapSnap / BoxBrownie UX Reference

## Purpose

This document records UX observations from user-provided screenshots of SnapSnapSnap powered by BoxBrownie.

It is a reference study only.

Do not copy competitor branding, artwork, proprietary imagery, exact layout, or marketing copy.

## Confirmed flow from screenshots

### First-run onboarding

The app introduces:

- the SnapSnapSnap product
- large photo/upload size expectations
- mobile-data upload behavior

The onboarding then asks the user to choose a Quality Mode.

### Quality modes

Screenshots show:

**Pro Capture Mode**

- tripod required
- multiple exposures
- about 8-second capture time
- about 20 MB data per photo upload

**Balanced Capture Mode**

- tripod recommended, or very still handheld use
- several exposures
- about 5-second capture time
- about 15 MB data per photo upload

**Quick Capture Mode**

- handheld or tripod
- single exposure
- faster/lower-quality positioning
- lower upload data requirement

These values describe the competitor product only. They are not PicchuSpot requirements.

### Home / shoots

The home experience is shoot-centric.

Observed controls include:

- create new shoot
- search
- filter
- options/settings

The first-use coach mark points the user to the new-shoot action.

### Filter

Observed filter choices include:

- group by Shoots / Photos
- order by Time / Name
- Grid / List / Thumb layout

These options demonstrate that Shoot is the primary organizing entity.

They do not all need to be in the PicchuSpot MVP.

### Options and settings

Observed options include:

- Login
- Settings
- Trash
- Guide
- Contact
- Help

Settings include:

- Language
- Quality
- Shutter Delay
- Aspect Ratio
- Default Zoom
- Auto Download Edited Photos
- Use mobile data to upload orders
- Shake Detection Warning
- editing preferences
- notifications
- backup import/export

### New shoot

A bottom sheet asks for a Shoot name.

Observed actions:

- Start New Shoot
- Import from Gallery

This confirms a local-first workflow where imported photos and camera capture both belong to a Shoot.

### Camera

Observed camera UI includes:

- quality-mode access
- grid control
- composition grid
- 0.5 / 0.6x / 1 zoom choices
- shutter button
- cancel/close
- orientation guidance recommending landscape for property photos

### Shoot gallery

A created shoot shows:

- shoot name
- Unedited / Edited counts
- import from gallery
- select
- edit shoot name
- delete shoot
- camera action
- select edits

A thumbnail can represent one user-visible photo while showing a stack/count badge.

### Edit/service selection

Per-image service choices observed:

- Image Enhancement
- Item Removal
- Virtual Staging
- Day to Dusk

The flow supports moving image-by-image through service assignment.

### Batch service selection

A Day to Dusk flow shows multiple photos with:

- per-photo selection
- Select All
- selected-count-aware Next action

This is a useful pattern for real-estate shoots with many images.

### Editing instructions

After selecting a service, the app asks whether the user wants to add editing instructions.

### Virtual Staging options

Observed fields/options include:

- Look of Furniture
- Room Name/Area
- Furniture & Accessories Required
- disclaimer toggle
- Reference Files upload
- Markup Virtual Staging

Furniture style selection is visual.

### Review order

The review screen shows:

- selected photos
- service badges on each photo
- transaction/pricing area
- authentication requirement before checkout/pricing completion

One screenshot shows more than one service badge on a single photo, supporting a model where a photo can have multiple services.

### Authentication

Login is shown late in the flow rather than blocking initial local capture.

Observed methods include:

- email/password
- magic link
- account creation
- password recovery

## Product lessons for PicchuSpot

Useful concepts to adopt:

- Shoot as the primary local entity
- offline/local work before login
- capture and import in the same shoot
- persistent local media
- multi-exposure capture hidden behind one user-visible photo
- batch selection for services
- multiple services per photo
- service-specific options
- editing preferences
- mobile-data upload preference
- clear capture settings

## Patterns not to copy directly

PicchuSpot should not reproduce:

- SnapSnapSnap branding
- red visual identity
- exact screen layouts
- exact onboarding copy
- competitor icons/artwork
- unnecessary empty space
- heavy dependence on coach marks
- all filter/settings complexity in the MVP

PicchuSpot should keep the current cleaner Shoots / Orders / Account navigation and premium editorial design direction.

## Important inference, not confirmed fact

A shoot-gallery thumbnail in the supplied screenshots displays a stack icon with the number 5.

This strongly suggests that one displayed image may be backed by multiple capture files/exposures.

However, the screenshots alone do not prove:

- which quality mode produced that stack
- whether the number always equals exposure count
- exact EV offsets
- exact bracket count for Balanced or Pro

Do not hard-code PicchuSpot capture counts from this observation.

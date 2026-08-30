# Capture Data Model

## Goal

Model real-estate capture so the user sees one property photo even when that photo is produced from multiple raw exposures.

Do not treat every bracket exposure as a separate user-visible photo.

## Entities

### Shoot

Represents one property/session.

Suggested fields:

- id
- propertyName
- address
- createdAt
- updatedAt

A Shoot owns its local photos and capture sets.

### Photo

Represents one user-visible property image.

A Photo may originate from:

- gallery import
- Quick capture
- Balanced capture
- Pro capture

A Photo may later receive one or more editing services.

### CaptureSet

Represents the raw camera capture operation that creates one user-visible Photo.

For a single-exposure mode:

~~~text
Photo
  -> CaptureSet
       -> ExposureAsset
~~~

For a bracketed mode:

~~~text
Photo
  -> CaptureSet
       -> ExposureAsset
       -> ExposureAsset
       -> ExposureAsset
       -> ...
~~~

Suggested fields:

- id
- shootId
- photoId
- mode
- createdAt
- status
- expectedExposureCount
- completedExposureCount

### ExposureAsset

Represents one raw camera file belonging to a CaptureSet.

Suggested fields:

- id
- captureSetId
- uri
- evOffset
- width
- height
- mimeType
- createdAt
- sortOrder

### Imported asset

A gallery-imported image does not need a multi-exposure CaptureSet.

It can be stored as a Photo with an imported source asset.

The implementation may reuse the existing local asset table initially, provided future migration to Photo/CaptureSet semantics remains straightforward.

## Capture modes

### Quick

Product direction:

- single exposure
- handheld-friendly
- fast
- lower data volume

### Balanced

Product direction:

- multiple exposures
- usable handheld only if sufficiently stable
- higher quality than Quick
- moderate capture time/data

Exact exposure count and EV spacing are not decided.

### Pro

Product direction:

- multiple exposures
- tripod-oriented
- highest capture quality
- longest capture time/data

Exact exposure count and EV spacing are not decided.

## Do not hard-code competitor counts

Reference screenshots from SnapSnapSnap show multi-exposure capture modes and a thumbnail stack indicator with the number 5.

That is useful evidence that multiple raw files may map to one displayed photo, but it is not sufficient to conclude that PicchuSpot Balanced or Pro should use exactly five exposures.

Bracket count, EV spacing, shutter timing, stabilization tolerance, and lens behavior must be validated on physical devices.

## Local persistence

Metadata:

- SQLite

Binary media:

- Expo document storage

No capture should depend on an active network connection.

A capture operation should be recoverable if the app backgrounds or upload is unavailable.

## File ownership

Files created/copied by PicchuSpot should live under a shoot-owned directory.

Deleting a Photo/CaptureSet/Shoot must only delete files owned by that entity.

Never delete arbitrary gallery originals.

Imported images must be copied into PicchuSpot-owned persistent storage before the app treats them as durable local assets.

## Ordering and display

User-visible Photos need stable ordering independent of raw exposure ordering.

ExposureAsset ordering is internal to a CaptureSet.

The gallery should display one tile per Photo, not one tile per exposure.

## Future upload queue

Upload should be modeled separately from capture persistence.

Suggested future states:

- local
- queued
- uploading
- uploaded
- failed
- retrying

Network loss must not cause local capture loss.

Mobile data upload should be an explicit preference, with Wi-Fi-safe defaults considered for large real-estate media.
